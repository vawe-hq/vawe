// harness/dev/e2e.mjs: `vawe e2e`. The page tests plus a half-size draft render of every page film and
// fixture page, in parallel, each checked for a non-empty mp4 of the right duration. It never stops at
// the first failure: one run reports on everything. Leaves quality/runs/e2e/<timestamp>/report.{json,md}
// and quality/runs/e2e/latest.json; only the newest KEEP_RUNS run directories stay.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ensurePageFonts } from '../lib/ensure-fonts.mjs';
import { resolveDuration } from '../media/page-duration.mjs';
import { pruneRuns, trackedPages, trackedFiles } from '../lib/e2e-runs.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const RUNS_DIR = path.join(repoRoot, 'quality', 'runs', 'e2e');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const runDir = path.join(RUNS_DIR, stamp);
fs.mkdirSync(path.join(runDir, 'renders'), { recursive: true });

const PAGE_TESTS = ['tests/media/render-page-determinism.test.mjs', 'tests/media/render-page-draft-layout.test.mjs', 'tests/media/page-audio.test.mjs'];
const CONCURRENCY = Math.max(2, Math.min(4, Math.floor(os.cpus().length / 2)));
const DURATION_SLACK_S = 0.15;
const KEEP_RUNS = 5;

const listDir = (dir) => (fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }) : []);

function findPages() {
  const pages = [];
  for (const d of listDir(path.join(repoRoot, 'films'))) {
    if (!d.isDirectory()) continue;
    const direct = path.join('films', d.name, 'page.html');
    if (fs.existsSync(path.join(repoRoot, direct))) pages.push(direct);
    for (const e of listDir(path.join(repoRoot, 'films', d.name))) {
      const nested = path.join('films', d.name, e.name, 'page.html');
      if (e.isDirectory() && fs.existsSync(path.join(repoRoot, nested))) pages.push(nested);
    }
  }
  for (const f of listDir(path.join(repoRoot, 'tests/fixtures/pages'))) {
    if (f.name.endsWith('.html')) pages.push(path.join('tests/fixtures/pages', f.name));
  }
  return trackedPages(pages, trackedFiles(repoRoot, ['films', 'tests/fixtures/pages']));
}

function motionTests() {
  return listDir(path.join(repoRoot, 'tests/motion')).filter((f) => f.name.endsWith('.test.mjs')).map((f) => `tests/motion/${f.name}`);
}

function run(cmd, args) {
  const t0 = Date.now();
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd: repoRoot });
    let out = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { out += d; });
    child.on('error', (e) => resolve({ exitCode: 1, out: String(e.message), ms: Date.now() - t0 }));
    child.on('close', (code) => resolve({ exitCode: code ?? 1, out, ms: Date.now() - t0 }));
  });
}

function probeDuration(mp4) {
  try {
    const s = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nk=1:nw=1', mp4], { encoding: 'utf8' });
    return parseFloat(s.trim());
  } catch { return NaN; }
}

async function renderCheck(page) {
  const name = page.replace(/[\\/]/g, '__').replace(/\.html$/, '');
  const mp4 = path.join(runDir, 'renders', `${name}.mp4`);
  const r = await run(process.execPath, ['harness/media/render-page.mjs', page, mp4]);
  const problems = [];
  if (r.exitCode !== 0) problems.push(`render exited ${r.exitCode}`);
  else if (!fs.existsSync(mp4) || fs.statSync(mp4).size === 0) problems.push('no mp4 or an empty mp4');
  else {
    const want = await resolveDuration(path.join(repoRoot, page));
    const got = probeDuration(mp4);
    if (!(got > 0)) problems.push('mp4 has no readable duration');
    else if (Number.isFinite(want) && want > 0 && Math.abs(got - want) > DURATION_SLACK_S) problems.push(`duration ${got.toFixed(2)}s, page says ${want}s`);
  }
  return { name: `render ${page}`, pass: problems.length === 0, ms: r.ms, detail: problems.join('; '), log: problems.length ? r.out.split('\n').slice(-8).join('\n') : '' };
}

async function pool(tasks, limit) {
  const results = new Array(tasks.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, async () => {
    while (next < tasks.length) { const i = next++; results[i] = await tasks[i](); }
  }));
  return results;
}

const t0 = Date.now();
const pages = findPages();
for (const p of pages) ensurePageFonts(path.join(repoRoot, p));
const tests = [...PAGE_TESTS, ...motionTests()].filter((f) => fs.existsSync(path.join(repoRoot, f)));
const tasks = [
  async () => {
    const r = await run(process.execPath, ['--test', ...tests]);
    return { name: `node --test (${tests.length} file(s))`, pass: r.exitCode === 0, ms: r.ms, detail: r.exitCode === 0 ? '' : `exit ${r.exitCode}`, log: r.exitCode === 0 ? '' : r.out.split('\n').slice(-25).join('\n') };
  },
  ...pages.map((p) => () => renderCheck(p)),
];
const results = await pool(tasks, CONCURRENCY);

let sha = 'unknown';
try { sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).trim(); } catch { /* no git, still report */ }
const pass = results.every((r) => r.pass);
const report = { timestamp: new Date().toISOString(), sha, pass, seconds: Number(((Date.now() - t0) / 1000).toFixed(1)), pages: pages.length, checks: results };
fs.writeFileSync(path.join(runDir, 'report.json'), JSON.stringify(report, null, 2) + '\n');
fs.writeFileSync(path.join(RUNS_DIR, 'latest.json'), JSON.stringify(report, null, 2) + '\n');
fs.writeFileSync(path.join(runDir, 'report.md'), [
  `# e2e run · ${report.timestamp}`,
  '',
  `${pass ? 'PASS' : 'FAIL'} · ${report.seconds}s · ${pages.length} page(s) · commit ${sha.slice(0, 8)}`,
  '',
  '| check | result | seconds | detail |',
  '| --- | --- | --- | --- |',
  ...results.map((r) => `| ${r.name} | ${r.pass ? 'pass' : 'FAIL'} | ${(r.ms / 1000).toFixed(1)} | ${r.detail} |`),
  '',
  ...results.filter((r) => r.log).map((r) => `## ${r.name}\n\n\`\`\`\n${r.log}\n\`\`\`\n`),
].join('\n'));

pruneRuns(RUNS_DIR, KEEP_RUNS);

for (const r of results) console.log(`${r.pass ? '✓' : '✗'} ${r.name} (${(r.ms / 1000).toFixed(1)}s)${r.detail ? `: ${r.detail}` : ''}`);
console.log(`\n${pass ? '✓' : '✗'} e2e ${pass ? 'passed' : 'FAILED'} in ${report.seconds}s`);
console.log(`report: quality/runs/e2e/${stamp}/report.md (also quality/runs/e2e/latest.json)`);
process.exit(pass ? 0 : 1);
