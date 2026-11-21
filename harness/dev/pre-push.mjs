#!/usr/bin/env node
// The checks of .githooks/pre-push, scoped to what the push changes. The hook runs push-guard itself.
//
//   node harness/dev/pre-push.mjs --range <remote..local | sha> [--range ...]   run the guards and the planned checks
//   node harness/dev/pre-push.mjs --files a b c --dry-run                       print the plan for a file list, run nothing
//
// A range git cannot diff here (an unknown remote sha) plans every check.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { planChecks, e2eKey, renderEntries } from '../lib/pre-push-plan.mjs';
import { operationInProgress } from '../lib/git-operation.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const E2E_GREEN = path.join(ROOT, 'quality/runs/e2e/green-key.json');
const UNIT_DIRS = ['tests/lib', 'tests/hooks', 'tests/dev'];

const git = (args) => spawnSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 });
const node = (args, opts = {}) => spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28, ...opts });

function changedFiles(ranges) {
  const files = new Set();
  for (const range of ranges) {
    const diff = range.includes('..') ? git(['diff', '--name-only', range]) : git(['diff', '--name-only', `${git(['merge-base', 'origin/main', range]).stdout.trim()}..${range}`]);
    if (diff.status !== 0) return [];
    diff.stdout.split('\n').filter(Boolean).forEach((f) => files.add(f));
  }
  return [...files];
}

const testFiles = (dir) => fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })
  .flatMap((e) => (e.isDirectory() ? testFiles(path.join(dir, e.name)) : e.name.endsWith('.test.mjs') ? [path.join(dir, e.name)] : []));

function guards() {
  const emdash = node(['harness/dev/no-emdash.mjs'], { stdio: 'inherit' });
  if (emdash.status !== 0) return false;
  const warn = (out) => out.split('\n').filter((l) => /^⚠|grew/.test(l)).forEach((l) => console.error(l));
  warn(node(['quality/gates/doc-refs.mjs']).stdout);
  const bench = node(['harness/dev/bench.mjs', 'fast']);
  warn(`${bench.stdout}\n${bench.stderr}`);
  return true;
}

const runInherit = (name, args) => {
  console.log(`pre-push: ${name}`);
  return node(args, { stdio: 'inherit' }).status === 0;
};

function e2eCache() {
  const tree = git(['ls-tree', 'HEAD']);
  if (tree.status !== 0) return { key: null };
  const names = renderEntries(tree.stdout).map((e) => e.name);
  const dirty = git(['status', '--porcelain', '--untracked-files=all', '--', ...names]).stdout.trim();
  return { key: dirty ? null : e2eKey(tree.stdout), dirty: Boolean(dirty) };
}

function runE2e() {
  const { key, dirty } = e2eCache();
  let green = null;
  try { green = JSON.parse(fs.readFileSync(E2E_GREEN, 'utf8')); } catch { /* no green run recorded */ }
  if (key && green?.key === key) {
    console.log(`pre-push: e2e reused, the render inputs are byte-equal to the green run at ${green.sha.slice(0, 9)}`);
    console.log(`✓ e2e passed in ${green.seconds}s`);
    return true;
  }
  console.log(`pre-push: e2e runs (${dirty ? 'the render inputs have uncommitted or untracked files, so no cached result applies' : green ? 'the render inputs changed since the last green run' : 'no green run recorded'})`);
  const ok = node(['harness/dev/e2e.mjs'], { stdio: 'inherit' }).status === 0;
  if (ok && key) {
    const report = JSON.parse(fs.readFileSync(path.join(ROOT, 'quality/runs/e2e/latest.json'), 'utf8'));
    fs.writeFileSync(E2E_GREEN, `${JSON.stringify({ key, sha: git(['rev-parse', 'HEAD']).stdout.trim(), seconds: report.seconds })}\n`);
  }
  return ok;
}

const STEPS = {
  unit: () => runInherit(`unit tests (${UNIT_DIRS.join(', ')})`, ['--test', ...UNIT_DIRS.flatMap(testFiles).sort()]),
  e2e: runE2e,
};

function main(argv) {
  const dryRun = argv.includes('--dry-run');
  const filesAt = argv.indexOf('--files');
  const ranges = argv.flatMap((a, i) => (argv[i - 1] === '--range' ? [a] : []));
  const files = filesAt >= 0 ? argv.slice(filesAt + 1).filter((a) => !a.startsWith('--')) : changedFiles(ranges);
  const { checks, reasons } = planChecks(files);
  console.log(`pre-push: ${files.length} changed file(s). Always: push-guard, em dash scan, doc refs, bench.`);
  for (const c of checks) console.log(`pre-push: run ${c} (${reasons[c]})`);
  for (const c of ['unit', 'e2e'].filter((c) => !checks.includes(c))) console.log(`pre-push: skip ${c} (no changed file can affect it)`);
  if (dryRun) return 0;
  const pending = operationInProgress(path.resolve(ROOT, git(['rev-parse', '--git-dir']).stdout.trim()));
  if (pending) { console.error(pending); return 1; }
  if (!guards()) return 1;
  for (const c of checks) if (!STEPS[c]()) { console.error(`pre-push blocked: ${c} failed. Fix it, or push with --no-verify when you know better.`); return 1; }
  return 0;
}

process.exit(main(process.argv.slice(2)));
