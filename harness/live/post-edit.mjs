#!/usr/bin/env node
// One PostToolUse hook for an edited file: the code-shape ratchet and the em dash scan, in one node start.
// A check returns { text, block }: text goes to stderr, block makes the exit 2.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { summarize } from '../lib/hook-report.mjs';
import { EM, EXCLUDE, SCOPE } from '../dev/no-emdash.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const BASELINE = path.join(ROOT, 'quality/baselines/code-quality-baseline.json');
const BIN = path.join(ROOT, 'node_modules/oxlint/bin/oxlint'); // run with node: the .bin shim is a shell script Windows cannot start
const CFG = path.join(ROOT, '.oxlintrc.json');

const SHAPE = new Set(['complexity', 'max-lines-per-function', 'max-depth', 'max-nested-callbacks', 'max-params']);

/** Run oxlint over one file's content, without touching the real working tree copy. */
function lintContent(rel, content) {
  const tmp = path.join(os.tmpdir(), `code-quality-live-${process.pid}-${path.basename(rel)}`);
  fs.writeFileSync(tmp, content);
  try {
    const r = spawnSync(process.execPath, [BIN, '-c', CFG, '--format=json', tmp], { cwd: ROOT, encoding: 'utf8' });
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

/** The shape check of one edited .js/.mjs file against HEAD and the baseline. */
function codeQuality(file) {
  if (!file || !/\.m?js$/.test(file)) return null;
  if (!fs.existsSync(BIN) || !fs.existsSync(CFG)) return null;   // no toolchain, no opinion

  if (!fs.existsSync(file)) return null;
  const top = checkoutOf(file);
  const rel = path.relative(top, file).split(path.sep).join('/');
  // A film page is authored work judged by its frames, not framework code judged by its shape.
  if (rel.startsWith('..') || rel.startsWith('films/') || rel.includes('node_modules')) return null;

  const found = lintContent(rel, fs.readFileSync(file, 'utf8'));
  if (!found.length) return null;
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
    return { text: `${rel} carries ${total} pre-existing finding(s), unchanged.\n`, block: false };
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
    + 'run: vawe-dev check code-quality WRITE=1  (that accepts the new number as the line to hold).\n\n'
    + 'Refused by harness/live/post-edit.mjs. Limits live in .oxlintrc.json.\n';

  return { text: summarize('code-quality', rel, full) + '\n', block: true };
}

function coveredByPush(rel) {
  return SCOPE.some((entry) => {
    if (entry === '*.md') return rel.endsWith('.md');
    if (entry === 'Makefile') return rel === 'Makefile' || rel.endsWith('/Makefile');
    return rel === entry || rel.startsWith(`${entry}/`);
  });
}

/** The em dash scan of the text one Write or Edit put in a file. */
function emDash(file, input) {
  if (!file) return null;

  const rel = path.relative(ROOT, file).split(path.sep).join('/');
  if (rel.startsWith('..') || EXCLUDE.some((f) => f(rel))) return null;
  if (coveredByPush(rel)) return null;   // pre-push already scans this file; don't say it twice
  if (!fs.existsSync(file)) return null;

  const full = fs.readFileSync(file, 'utf8');
  const written = typeof input.content === 'string' ? input.content : input.new_string;
  if (typeof written !== 'string') return null;
  const at = typeof input.content === 'string' ? 0 : full.indexOf(written);
  if (at === -1) return null;   // couldn't locate the edit verbatim, say nothing rather than guess

  const startLine = full.slice(0, at).split('\n').length;
  const hits = [];
  const segLines = written.split('\n');
  for (let i = 0; i < segLines.length; i++) {
    if (segLines[i].includes(EM)) hits.push({ line: startLine + i, text: segLines[i].trim() });
  }
  if (!hits.length) return null;

  const lines = hits.map((h) => `  ${rel}:${h.line}  ${h.text}`);
  return { block: true, text:
    'This edit wrote an em dash (U+2014).\n\n' + `${lines.join('\n')}\n\n`
    + 'Use a colon, a comma, a period, or parentheses instead, or split the sentence. The pre-push\n'
    + 'check (harness/dev/no-emdash.mjs) would block this later; fixing it now is cheaper.\n\n'
    + 'Refused by harness/live/post-edit.mjs.\n' };
}

let raw = '';
process.stdin.on('data', (d) => { raw += d; });
process.stdin.on('end', () => {
  let input;
  try { input = JSON.parse(raw).tool_input || {}; } catch { process.exit(0); }
  const file = input.file_path || '';
  const results = [codeQuality(file), emDash(file, input)].filter(Boolean);
  process.stderr.write(results.map((r) => r.text).join(''));
  process.exit(results.some((r) => r.block) ? 2 : 0);
});
