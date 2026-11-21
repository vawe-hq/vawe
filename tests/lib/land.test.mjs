import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { conflictedFiles, hasTrackedEdits, bigBlobs, e2eLine, e2eLineFromReport, keepAliveSsh } from '../../harness/lib/land.mjs';

test('conflictedFiles lists only unmerged paths', () => {
  const porcelain = 'UU src/a.mjs\n M b.txt\nAA c.md\n?? d.txt\nDU e.js\n';
  assert.deepEqual(conflictedFiles(porcelain), ['src/a.mjs', 'c.md', 'e.js']);
  assert.deepEqual(conflictedFiles(' M b.txt\n'), []);
});

test('hasTrackedEdits ignores untracked files', () => {
  assert.equal(hasTrackedEdits('?? films/x/\n'), false);
  assert.equal(hasTrackedEdits(''), false);
  assert.equal(hasTrackedEdits(' M a.mjs\n?? b\n'), true);
});

test('bigBlobs names each blob over the limit once and skips commits and trees', () => {
  const text = [
    'commit aaa 250 ',
    'tree bbb 100 ',
    `blob ccc ${6 * 1024 * 1024} assets/big file.mp4`,
    `blob ccc ${6 * 1024 * 1024} assets/copy.mp4`,
    `blob ddd ${5 * 1024 * 1024} assets/exactly-five.mp4`,
    'blob eee 10 small.txt',
  ].join('\n');
  assert.deepEqual(bigBlobs(text), [{ path: 'assets/big file.mp4', bytes: 6 * 1024 * 1024 }]);
});

test('e2eLine reads the result line of the push output; the report is used only for the same sha', () => {
  const out = 'remote: x\n✓ page tests (1.0s)\n\n✓ e2e passed in 4.2s\nreport: quality/runs/e2e/x/report.md\nTo github.com:a/b.git\n';
  assert.equal(e2eLine(out), '✓ e2e passed in 4.2s');
  assert.equal(e2eLine('✗ e2e FAILED in 9s\n'), '✗ e2e FAILED in 9s');
  assert.equal(e2eLine('nothing here'), null);
  assert.equal(e2eLineFromReport({ sha: 'abc', pass: true, seconds: 4.2 }, 'abc'), '✓ e2e passed in 4.2s');
  assert.equal(e2eLineFromReport({ sha: 'abc', pass: false, seconds: 9 }, 'abc'), '✗ e2e FAILED in 9s');
  assert.equal(e2eLineFromReport({ sha: 'old', pass: true, seconds: 4 }, 'abc'), null);
  assert.equal(e2eLineFromReport(null, 'abc'), null);
});

test('keepAliveSsh keeps the user ssh command and adds the keep-alive options', () => {
  assert.equal(keepAliveSsh(undefined), 'ssh -o ServerAliveInterval=20 -o ServerAliveCountMax=60');
  assert.equal(keepAliveSsh('ssh -i k'), 'ssh -i k -o ServerAliveInterval=20 -o ServerAliveCountMax=60');
});

test('land stops on a rebase conflict, aborts the rebase and exits non-zero naming the step and the file', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vawe-land-'));
  const git = (cwd, ...a) => execFileSync('git', a, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    const origin = path.join(dir, 'origin.git');
    const a = path.join(dir, 'a');
    const b = path.join(dir, 'b');
    git(dir, 'init', '--bare', '-b', 'main', origin);
    for (const r of [a, b]) {
      git(dir, 'clone', '-q', origin, r);
      git(r, 'config', 'user.email', 't@t');
      git(r, 'config', 'user.name', 't');
    }
    fs.writeFileSync(path.join(a, 'f.txt'), '0\n');
    git(a, 'add', 'f.txt'); git(a, 'commit', '-qm', 'base'); git(a, 'push', '-q', 'origin', 'HEAD:main');
    git(b, 'pull', '-q', 'origin', 'main');
    fs.writeFileSync(path.join(a, 'f.txt'), 'a\n');
    git(a, 'commit', '-qam', 'a edits'); git(a, 'push', '-q', 'origin', 'HEAD:main');
    fs.writeFileSync(path.join(b, 'f.txt'), 'b\n');
    git(b, 'commit', '-qam', 'b edits');
    const land = path.resolve('harness/dev/land.mjs');
    const r = spawnSync(process.execPath, [land], { cwd: b, encoding: 'utf8' });
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /land: FAILED at rebase: .*conflict in f\.txt/);
    assert.equal(git(b, 'status', '--porcelain').trim(), '', 'no half-finished rebase is left');
    assert.equal(git(b, 'log', '-1', '--format=%s').trim(), 'b edits');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('land refuses a range that adds a file over 5 MB, even when a later commit deletes it, and names the file', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vawe-land-'));
  const git = (cwd, ...a) => execFileSync('git', a, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    const origin = path.join(dir, 'origin.git');
    const w = path.join(dir, 'w');
    git(dir, 'init', '--bare', '-b', 'main', origin);
    git(dir, 'clone', '-q', origin, w);
    git(w, 'config', 'user.email', 't@t');
    git(w, 'config', 'user.name', 't');
    fs.writeFileSync(path.join(w, 'f.txt'), '0\n');
    git(w, 'add', 'f.txt'); git(w, 'commit', '-qm', 'base'); git(w, 'push', '-q', 'origin', 'HEAD:main');
    fs.writeFileSync(path.join(w, 'huge.bin'), Buffer.alloc(6 * 1024 * 1024, 7));
    git(w, 'add', 'huge.bin'); git(w, 'commit', '-qm', 'add huge');
    git(w, 'rm', '-q', 'huge.bin'); git(w, 'commit', '-qm', 'drop huge');
    const r = spawnSync(process.execPath, [path.resolve('harness/dev/land.mjs')], { cwd: w, encoding: 'utf8' });
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /land: FAILED at big-file scan: .*huge\.bin \(6\.0 MB\)/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('land pushes a clean branch to main, runs the tests first and prints the hook e2e line and the range', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vawe-land-'));
  const git = (cwd, ...a) => execFileSync('git', a, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    const origin = path.join(dir, 'origin.git');
    const w = path.join(dir, 'w');
    git(dir, 'init', '--bare', '-b', 'main', origin);
    git(dir, 'clone', '-q', origin, w);
    git(w, 'config', 'user.email', 't@t');
    git(w, 'config', 'user.name', 't');
    for (const d of ['tests/lib', 'tests/hooks']) fs.mkdirSync(path.join(w, d), { recursive: true });
    fs.writeFileSync(path.join(w, 'tests/lib/ok.test.mjs'), "import test from 'node:test'; test('ok', () => {});\n");
    git(w, 'add', '.'); git(w, 'commit', '-qm', 'base'); git(w, 'push', '-q', 'origin', 'HEAD:main');
    fs.writeFileSync(path.join(w, 'f.txt'), '1\n');
    git(w, 'add', 'f.txt'); git(w, 'commit', '-qm', 'one');
    fs.writeFileSync(path.join(w, '.git/hooks/pre-push'), "#!/bin/sh\necho '✓ e2e passed in 3.1s'\n", { mode: 0o755 });
    const r = spawnSync(process.execPath, [path.resolve('harness/dev/land.mjs')], { cwd: w, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /1 test files passed/);
    assert.match(r.stdout, /✓ e2e passed in 3\.1s/);
    assert.match(r.stdout, /pushed [0-9a-f]{9}\.\.[0-9a-f]{9} \(1 commit\) to origin\/main/);
    assert.equal(git(origin, 'log', '-1', '--format=%s', 'main').trim(), 'one');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('land names the failing test, not only "tests failed", and pushes nothing', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vawe-land-'));
  const git = (cwd, ...a) => execFileSync('git', a, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    const origin = path.join(dir, 'origin.git');
    const w = path.join(dir, 'w');
    git(dir, 'init', '--bare', '-b', 'main', origin);
    git(dir, 'clone', '-q', origin, w);
    git(w, 'config', 'user.email', 't@t');
    git(w, 'config', 'user.name', 't');
    for (const d of ['tests/lib', 'tests/hooks']) fs.mkdirSync(path.join(w, d), { recursive: true });
    fs.writeFileSync(path.join(w, 'tests/lib/ok.test.mjs'), "import test from 'node:test'; test('ok', () => {});\n");
    git(w, 'add', '.'); git(w, 'commit', '-qm', 'base'); git(w, 'push', '-q', 'origin', 'HEAD:main');
    fs.writeFileSync(path.join(w, 'tests/lib/bad.test.mjs'), "import test from 'node:test'; test('the help names --out', () => { throw new Error('x'); });\n");
    git(w, 'add', '.'); git(w, 'commit', '-qm', 'bad');
    const r = spawnSync(process.execPath, [path.resolve('harness/dev/land.mjs')], { cwd: w, encoding: 'utf8', env: Object.fromEntries(Object.entries(process.env).filter(([k]) => k !== 'NODE_TEST_CONTEXT')) });
    assert.notEqual(r.status, 0);
    assert.match(r.stdout + r.stderr, /not ok \d+ - the help names --out/);
    assert.equal(git(origin, 'log', '-1', '--format=%s', 'main').trim(), 'base');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
