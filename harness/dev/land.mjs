#!/usr/bin/env node
// vawe-dev land: the one way to put a worktree branch on main. Fetch, rebase onto origin/main, scan the range for big files,
// run tests/lib and tests/hooks, push HEAD to main, then print the pre-push e2e line and the pushed range.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync, spawn } from 'node:child_process';
import { conflictedFiles, hasTrackedEdits, bigBlobs, megabytes, e2eLine, e2eLineFromReport, keepAliveSsh, rebaseDecision, pushErrorText, BIG_FILE_BYTES } from '../lib/land.mjs';

const ROOT = process.cwd();
const TEST_DIRS = ['tests/lib', 'tests/hooks'];

class LandError extends Error {
  constructor(step, message) { super(message); this.step = step; }
}

function git(args, { input, allowFail = false } = {}) {
  const r = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8', input, maxBuffer: 1 << 28 });
  if (r.status !== 0 && !allowFail) throw new Error(`git ${args[0]} failed: ${(r.stderr || r.stdout).trim().split('\n').pop()}`);
  return r;
}

const testFiles = (dir) => fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })
  .flatMap((e) => (e.isDirectory() ? testFiles(path.join(dir, e.name)) : e.name.endsWith('.test.mjs') ? [path.join(dir, e.name)] : []));

const isAncestor = (a, b) => git(['merge-base', '--is-ancestor', a, b], { allowFail: true }).status === 0;

function rebase() {
  git(['fetch', 'origin', 'main']);
  const decision = rebaseDecision({ headInMain: isAncestor('HEAD', 'origin/main'), containsMain: isAncestor('origin/main', 'HEAD') });
  if (decision === 'merged') throw new LandError('rebase', 'nothing to land: every commit of this branch is already in origin/main');
  if (decision === 'skip') return console.log('land: the branch already contains origin/main, no rebase needed');
  const edits = git(['status', '--porcelain', '--untracked-files=no']).stdout;
  if (hasTrackedEdits(edits)) throw new LandError('rebase', 'the tree has uncommitted edits to tracked files: commit or stash them, then run bin/vawe-dev land again');
  const r = git(['rebase', 'origin/main'], { allowFail: true });
  if (r.status === 0) return;
  const files = conflictedFiles(git(['status', '--porcelain']).stdout);
  git(['rebase', '--abort'], { allowFail: true });
  throw new LandError('rebase', `rebase onto origin/main stopped on a conflict${files.length ? ` in ${files.join(', ')}` : ''}; the rebase is aborted and the branch is as before. Run git rebase origin/main by hand, resolve it, then run bin/vawe-dev land again`);
}

function scanBigFiles() {
  const objects = git(['rev-list', '--objects', 'origin/main..HEAD']).stdout;
  const sizes = git(['cat-file', '--batch-check=%(objecttype) %(objectname) %(objectsize) %(rest)'], { input: objects });
  const big = bigBlobs(sizes.stdout);
  if (big.length) throw new LandError('big-file scan', `a commit in the range adds a file over ${megabytes(BIG_FILE_BYTES)}: ${big.map((b) => `${b.path} (${megabytes(b.bytes)})`).join(', ')}. Remove it from the history, then run bin/vawe-dev land again`);
}

function runTests() {
  const files = TEST_DIRS.flatMap(testFiles).sort();
  const r = spawnSync(process.execPath, ['--test', ...files], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 });
  if (r.status === 0) return `${files.length} test files passed (${TEST_DIRS.join(', ')})`;
  const failed = r.stdout.split('\n').filter((l) => /^\s*not ok /.test(l)).slice(0, 5).join('\n');
  throw new LandError('tests', `${TEST_DIRS.join(' and ')} failed${failed ? `:\n${failed}` : ` (exit ${r.status})`}`);
}

function push() {
  const configured = git(['config', 'core.sshCommand'], { allowFail: true }).stdout.trim();
  const env = { ...process.env, GIT_SSH_COMMAND: keepAliveSsh(process.env.GIT_SSH_COMMAND, configured) };
  return new Promise((resolve) => {
    const child = spawn('git', ['push', 'origin', 'HEAD:main'], { cwd: ROOT, env });
    let out = '';
    const take = (d) => { out += d; process.stderr.write(d); };
    child.stdout.on('data', take);
    child.stderr.on('data', take);
    child.on('close', (code) => resolve({ code, out }));
  });
}

function readReport() {
  try { return JSON.parse(fs.readFileSync(path.join(ROOT, 'quality/runs/e2e/latest.json'), 'utf8')); } catch { return null; }
}

async function main() {
  const step = (name, fn) => { console.log(`land: ${name}`); return fn(); };
  step('fetch and rebase onto origin/main', rebase);
  const before = git(['rev-parse', 'origin/main']).stdout.trim();
  const head = git(['rev-parse', 'HEAD']).stdout.trim();
  if (before === head) throw new LandError('rebase', 'nothing to land: HEAD is origin/main');
  step('scan the range for big files', scanBigFiles);
  console.log(`land: ${step('run the tests', runTests)}`);
  const { code, out } = await step('push to main (the pre-push hook runs e2e)', push);
  if (code !== 0) throw new LandError('push', `git push failed${e2eLine(out) ? ` after ${e2eLine(out)}` : ''}:\n${pushErrorText(out)}\nThe CI status line the hook prints last is not the cause. If main moved, run bin/vawe-dev land again`);
  console.log(e2eLine(out) ?? e2eLineFromReport(readReport(), head) ?? 'e2e: no result line found in the push output or quality/runs/e2e/latest.json');
  const count = git(['rev-list', '--count', `${before}..${head}`]).stdout.trim();
  console.log(`pushed ${before.slice(0, 9)}..${head.slice(0, 9)} (${count} commit${count === '1' ? '' : 's'}) to origin/main`);
}

main().catch((e) => {
  console.error(`land: FAILED at ${e.step ?? 'an unexpected step'}: ${e.message}`);
  process.exit(1);
});
