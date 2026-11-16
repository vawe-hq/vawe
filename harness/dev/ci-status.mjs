import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const run = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8' }).trim();

let slug;
try {
  // git@github.com:Owner/repo.git or https://github.com/Owner/repo(.git)
  const url = run('git', ['remote', 'get-url', 'origin']);
  const m = url.match(/github\.com[:/]([^/]+\/[^/]+?)(\.git)?$/);
  if (!m) throw new Error('not a github remote');
  slug = m[1];
} catch {
  process.exit(0); // no origin, or not GitHub: nothing to report
}

try {
  run('gh', ['--version']);
} catch {
  console.log(`· ci: gh CLI not found, skipping. Check manually: https://github.com/${slug}/actions`);
  process.exit(0);
}

const wfDir = path.join(ROOT, '.github/workflows');
const workflowFiles = fs.readdirSync(wfDir).filter((f) => f.endsWith('.yml') || f.endsWith('.yaml')).sort();
if (!workflowFiles.length) process.exit(0); // no workflows: nothing to report

let runs;
try {
  const out = run('gh', ['run', 'list', '--repo', slug, '--limit', String(Math.max(50, workflowFiles.length * 5)),
    '--json', 'workflowName,conclusion,status,headBranch,url,createdAt']);
  runs = JSON.parse(out);
} catch {
  console.log(`· ci: could not reach GitHub (not authenticated, offline, or no runs yet). `
    + `Check after pushing: gh run list --repo ${slug} --limit 10`);
  process.exit(0);
}

const nameOf = (file) => {
  const text = fs.readFileSync(path.join(wfDir, file), 'utf8');
  const m = text.match(/^name:\s*(.+)$/m);
  return m ? m[1].trim().replace(/^["']|["']$/g, '') : file;
};

let anyRed = false;
for (const file of workflowFiles) {
  const wfName = nameOf(file);
  const last = runs.find((r) => r.workflowName === wfName);
  if (!last) {
    const filtered = /^\s+paths:/m.test(fs.readFileSync(path.join(wfDir, file), 'utf8'));
    console.log(`· ci: ${file} · no runs in the last ${runs.length}${filtered ? ' (it runs only when its paths change)' : ', or it has never run'}`);
    continue;
  }
  const glyph = last.conclusion === 'success' ? '✓' : last.status !== 'completed' ? '…' : '✗';
  const verdict = last.status !== 'completed' ? last.status : last.conclusion;
  console.log(`${glyph} ci: ${file} · last run on ${last.headBranch} was ${verdict} (${last.createdAt}) ${last.url}`);
  if (glyph === '✗') anyRed = true;
}
if (anyRed) {
  console.log('  CI is red on at least one workflow right now. CI runs only the basics (static gates, lib, motion and hooks tests). This hook runs the site build, dev tests and e2e locally, so a red CI run is a basics failure. Keep it green: harness/README.md "CI".');
}
console.log(`  after this push: gh run list --repo ${slug} --limit 10`);
process.exit(0);
