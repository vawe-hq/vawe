#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { summarize } from '../lib/hook-report.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const BASELINE = path.join(ROOT, 'quality/baselines/code-quality-baseline.json');
const BIN = path.join(ROOT, 'node_modules/.bin/oxlint');
const CFG = path.join(ROOT, '.oxlintrc.json');

const SHAPE = new Set(['complexity', 'max-lines-per-function', 'max-depth', 'max-nested-callbacks', 'max-params']);

/** Run oxlint over one file's content, without touching the real working tree copy. */
function lintContent(rel, content) {
  const tmp = path.join(os.tmpdir(), `code-quality-live-${process.pid}-${path.basename(rel)}`);
  fs.writeFileSync(tmp, content);
  try {
    const r = spawnSync(BIN, ['-c', CFG, '--format=json', tmp], { cwd: ROOT, encoding: 'utf8' });
    let diags = [];
    try { diags = (JSON.parse(r.stdout).diagnostics || []); } catch { return []; }
    return diags
      .map((d) => ({ rule: (/eslint\(([^)]+)\)/.exec(d.code) || [, ''])[1], message: d.message,
                     line: d.labels && d.labels[0] ? d.labels[0].span.line : 0 }))
      .filter((d) => SHAPE.has(d.rule));
  } finally {
    fs.rmSync(tmp, { force: true });
  }
}

const tally = (found) => {
  const counts = {};
  for (const d of found) counts[d.rule] = (counts[d.rule] || 0) + 1;
  return counts;
};

// A commit hook runs with GIT_DIR and GIT_INDEX_FILE set, which point every git call here at the wrong repo.
const GIT_ENV = Object.fromEntries(Object.entries(process.env).filter(([k]) => k !== 'GIT_DIR' && k !== 'GIT_INDEX_FILE'));

// A file inside a linked worktree (.claude/worktrees/<x>/...) is compared with that worktree's HEAD.
function checkoutOf(file) {
  const r = spawnSync('git', ['rev-parse', '--show-toplevel'], { cwd: path.dirname(file), encoding: 'utf8', env: GIT_ENV });
  return r.status === 0 ? r.stdout.trim() : ROOT;
}

/** The file's content at git HEAD, or null for an untracked/new file. */
function headContent(top, rel) {
  const r = spawnSync('git', ['show', `HEAD:${rel}`], { cwd: top, encoding: 'utf8', env: GIT_ENV });
  return r.status === 0 ? r.stdout : null;
}

let raw = '';
process.stdin.on('data', (d) => { raw += d; });
process.stdin.on('end', () => {
  let file;
  try { file = (JSON.parse(raw).tool_input || {}).file_path || ''; } catch { process.exit(0); }
  if (!file || !/\.m?js$/.test(file)) process.exit(0);
  if (!fs.existsSync(BIN) || !fs.existsSync(CFG)) process.exit(0);   // no toolchain, no opinion

  if (!fs.existsSync(file)) process.exit(0);
  const top = checkoutOf(file);
  const rel = path.relative(top, file);
  // A film page is authored work judged by its frames, not framework code judged by its shape.
  if (rel.startsWith('..') || rel.startsWith('site/') || rel.startsWith('films/') || rel.includes('node_modules')) process.exit(0);

  const found = lintContent(rel, fs.readFileSync(file, 'utf8'));
  if (!found.length) process.exit(0);
  const counts = tally(found);

  let base = {};
  try { base = JSON.parse(fs.readFileSync(BASELINE, 'utf8')); } catch { /* no baseline yet */ }

  const atHead = headContent(top, rel);
  const headCounts = atHead === null ? null : tally(lintContent(rel, atHead));

  const allowed = (rule) => {
    const key = `${rel}::${rule}`;
    const hasBase = Object.prototype.hasOwnProperty.call(base, key);
    const fromHead = headCounts === null ? null : (headCounts[rule] || 0);
    if (!hasBase) return fromHead === null ? 0 : fromHead;
    if (fromHead === null) return base[key];
    return fromHead;
  };

  const worse = Object.entries(counts).filter(([rule, n]) => n > allowed(rule));
  if (!worse.length) {
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    if (total > 0) process.stderr.write(`${rel} carries ${total} pre-existing finding(s), unchanged.\n`);
    process.exit(0);
  }

  const lines = [];
  for (const [rule, n] of worse) {
    const had = allowed(rule);
    lines.push(`  ${rule}: was ${had}, now ${n}`);
    for (const d of found.filter((f) => f.rule === rule)) lines.push(`    ${rel}:${d.line}  ${d.message}`);
  }

  const full =
    `This edit made ${rel} more tangled than it was.\n\n${lines.join('\n')}\n\n`
    + 'Split it so each function does one job. A function that needs a paragraph to describe what it\n'
    + 'does is usually two functions. Keep the comments, move each one with the code it explains.\n\n'
    + 'If the shape you wrote is genuinely right and the rule is wrong here, say so in your reply and\n'
    + 'run: vawe check code-quality WRITE=1  (that accepts the new number as the line to hold).\n\n'
    + 'Refused by harness/live/code-quality.mjs. Limits live in .oxlintrc.json.\n';

  const say = summarize('code-quality', rel, full);
  process.stderr.write(say + '\n');
  process.exit(2);
});
