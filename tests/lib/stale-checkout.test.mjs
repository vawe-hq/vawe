import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { commitsBehind, fetchDue, staleLine, staleCheckoutLine, canFastForward, mainCheckoutLine } from '../../harness/lib/stale-checkout.mjs';

const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

test('staleLine is empty when level and names the count and one command when behind', () => {
  assert.equal(staleLine(0, false), '');
  assert.match(staleLine(1, false), /1 commit behind origin\/main.*git rebase origin\/main/);
  assert.match(staleLine(4, false), /4 commits behind/);
  assert.match(staleLine(4, true), /commit or stash the tracked edits, then run git rebase origin\/main/);
});

test('fetchDue allows one fetch per 10 minutes', () => {
  assert.equal(fetchDue(0, 1000), false);
  assert.equal(fetchDue(0, 599_000), false);
  assert.equal(fetchDue(0, 601_000), true);
  assert.equal(fetchDue(1000, 1000 + 601_000), true);
});

test('commitsBehind takes the larger ref count and survives a missing ref', () => {
  const counts = { 'HEAD..main': '3\n', 'HEAD..origin/main': '5\n' };
  assert.equal(commitsBehind((a) => counts[a[2]]), 5);
  assert.equal(commitsBehind((a) => counts[a[2]], ['main']), 3);
  assert.equal(commitsBehind(() => { throw new Error('no ref'); }), 0);
});

test('a worktree behind origin/main gets the line after one fetch, then the cache holds', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vawe-stale-'));
  try {
    const origin = path.join(dir, 'origin.git');
    const a = path.join(dir, 'a');
    const b = path.join(dir, 'b');
    git(dir, 'init', '--bare', '-b', 'main', origin);
    git(dir, 'clone', '-q', origin, a);
    for (const r of [a]) { git(r, 'config', 'user.email', 't@t'); git(r, 'config', 'user.name', 't'); }
    fs.writeFileSync(path.join(a, 'f.txt'), '1');
    git(a, 'add', 'f.txt'); git(a, 'commit', '-qm', 'one'); git(a, 'push', '-q', 'origin', 'HEAD:main');
    git(dir, 'clone', '-q', origin, b);
    git(b, 'config', 'user.email', 't@t'); git(b, 'config', 'user.name', 't');
    git(b, 'commit', '-q', '--allow-empty', '-m', 'local');
    assert.equal(staleCheckoutLine(b, { now: 1_000_000 }), '');
    fs.writeFileSync(path.join(a, 'f.txt'), '2');
    git(a, 'commit', '-qam', 'two'); git(a, 'push', '-q', 'origin', 'HEAD:main');
    assert.equal(staleCheckoutLine(b, { now: 1_000_000 + 1000 }), '', 'inside the 10 minutes no fetch runs');
    const line = staleCheckoutLine(b, { now: 1_000_000 + 700_000 });
    assert.match(line, /1 commit behind origin\/main.*git rebase origin\/main/);
    fs.writeFileSync(path.join(b, 'untracked.txt'), 'x');
    assert.doesNotMatch(staleCheckoutLine(b, { now: 1_000_000 + 700_001 }), /stash/, 'untracked files are not tracked edits');
    fs.writeFileSync(path.join(b, 'f.txt'), 'edited');
    assert.match(staleCheckoutLine(b, { now: 1_000_000 + 700_002 }), /commit or stash/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

const ONLY_NOW = { now: Number.MAX_SAFE_INTEGER };
function stubGit({ ahead = 0, edits = '', detached = false, refuse = false, operationDir = null, added = '' }) {
  const calls = [];
  const fn = (args) => {
    calls.push(args.join(' '));
    const [cmd] = args;
    if (cmd === 'fetch') return '';
    if (cmd === 'rev-list') return args[2] === 'HEAD..origin/main' ? '3\n' : `${ahead}\n`;
    if (cmd === 'status') return edits;
    if (cmd === 'diff') return added;
    if (cmd === 'rev-parse') return `${operationDir}\n`;
    if (cmd === 'symbolic-ref' && detached) throw new Error('detached');
    if ((cmd === 'merge' || cmd === 'checkout') && refuse) throw new Error('untracked file would be overwritten');
    return '';
  };
  return { fn, calls };
}
const gitDirWith = (name) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vawe-gitdir-'));
  if (name) fs.mkdirSync(path.join(dir, name));
  return dir;
};
const staleRoot = () => fs.mkdtempSync(path.join(os.tmpdir(), 'vawe-stale-root-'));

test('canFastForward is true only for a behind checkout with nothing of its own', () => {
  const clean = { behind: 2, ahead: 0, trackedEdits: false, operation: '' };
  assert.equal(canFastForward(clean), true);
  assert.equal(canFastForward({ ...clean, behind: 0 }), false);
  assert.equal(canFastForward({ ...clean, ahead: 1 }), false);
  assert.equal(canFastForward({ ...clean, trackedEdits: true }), false);
  assert.equal(canFastForward({ ...clean, operation: 'a rebase is in progress' }), false);
});

test('a clean checkout behind origin/main moves forward on a branch and prints one line', () => {
  const { fn, calls } = stubGit({ operationDir: gitDirWith('') });
  assert.equal(staleCheckoutLine(staleRoot(), { ...ONLY_NOW, git: fn }), 'this checkout moved forward 3 commits to origin/main');
  assert.ok(calls.includes('merge --ff-only origin/main'));
});

test('a clean detached checkout moves with checkout --detach', () => {
  const { fn, calls } = stubGit({ detached: true, operationDir: gitDirWith('') });
  assert.match(staleCheckoutLine(staleRoot(), { ...ONLY_NOW, git: fn }), /moved forward 3 commits/);
  assert.ok(calls.includes('checkout --detach origin/main'));
});

test('local commits keep the warning and run no move', () => {
  const { fn, calls } = stubGit({ ahead: 1, operationDir: gitDirWith('') });
  assert.match(staleCheckoutLine(staleRoot(), { ...ONLY_NOW, git: fn }), /3 commits behind origin\/main/);
  assert.ok(!calls.some((c) => c.startsWith('merge') || c.startsWith('checkout')));
});

test('tracked edits keep the warning and run no move', () => {
  const { fn, calls } = stubGit({ edits: ' M f.txt\n', operationDir: gitDirWith('') });
  assert.match(staleCheckoutLine(staleRoot(), { ...ONLY_NOW, git: fn }), /commit or stash/);
  assert.ok(!calls.some((c) => c.startsWith('merge') || c.startsWith('checkout')));
});

test('a rebase in progress keeps the warning and runs no move', () => {
  const { fn, calls } = stubGit({ operationDir: gitDirWith('rebase-merge') });
  assert.match(staleCheckoutLine(staleRoot(), { ...ONLY_NOW, git: fn }), /3 commits behind origin\/main/);
  assert.ok(!calls.some((c) => c.startsWith('merge') || c.startsWith('checkout')));
});

test('a git refusal falls back to the warning', () => {
  const { fn } = stubGit({ refuse: true, operationDir: gitDirWith('') });
  assert.match(staleCheckoutLine(staleRoot(), { ...ONLY_NOW, git: fn }), /3 commits behind origin\/main.*git rebase origin\/main/);
});

test('a file origin/main adds that already exists on disk blocks the move and is named', () => {
  const root = staleRoot();
  fs.mkdirSync(path.join(root, 'assets'));
  fs.writeFileSync(path.join(root, 'assets', 'logo.svg'), 'local');
  const { fn, calls } = stubGit({ operationDir: gitDirWith(''), added: 'docs/new.md\nassets/logo.svg\n' });
  const line = staleCheckoutLine(root, { ...ONLY_NOW, git: fn });
  assert.match(line, /3 commits behind origin\/main.*not moved: origin\/main adds assets\/logo\.svg, which exists here/);
  assert.ok(!calls.some((c) => c.startsWith('merge') || c.startsWith('checkout')));
});

function mainAndWorktree(dir) {
  const origin = path.join(dir, 'origin.git');
  const main = path.join(dir, 'main');
  const author = path.join(dir, 'author');
  git(dir, 'init', '--bare', '-b', 'main', origin);
  git(dir, 'clone', '-q', origin, author);
  git(author, 'config', 'user.email', 't@t'); git(author, 'config', 'user.name', 't');
  fs.writeFileSync(path.join(author, 'f.txt'), '1');
  git(author, 'add', 'f.txt'); git(author, 'commit', '-qm', 'one'); git(author, 'push', '-q', 'origin', 'HEAD:main');
  git(dir, 'clone', '-q', origin, main);
  git(main, 'config', 'user.email', 't@t'); git(main, 'config', 'user.name', 't');
  git(main, 'checkout', '-q', '--detach');
  const wt = path.join(dir, 'wt');
  git(main, 'worktree', 'add', '-q', '--detach', wt);
  const publish = (name) => { fs.writeFileSync(path.join(author, name), 'x'); git(author, 'add', name); git(author, 'commit', '-qm', name); git(author, 'push', '-q', 'origin', 'HEAD:main'); };
  return { main, wt, publish };
}

test('a worktree session moves a clean detached main checkout to origin/main, once per 10 minutes', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vawe-mainmove-'));
  try {
    const { main, wt, publish } = mainAndWorktree(dir);
    publish('two.txt');
    git(wt, 'fetch', '-q', 'origin', 'main');
    const line = mainCheckoutLine(wt, { now: 1_000_000 });
    assert.match(line, /1 commit behind origin\/main: moved it to origin\/main/);
    assert.equal(git(main, 'rev-parse', 'HEAD'), git(main, 'rev-parse', 'origin/main'));
    publish('three.txt');
    git(wt, 'fetch', '-q', 'origin', 'main');
    assert.equal(mainCheckoutLine(wt, { now: 1_000_000 + 1000 }), '', 'inside the 10 minutes nothing runs');
    assert.match(mainCheckoutLine(wt, { now: 1_000_000 + 700_000 }), /moved it/);
    assert.equal(mainCheckoutLine(main, { now: 9_000_000 }), '', 'a session in the main checkout is the other function');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('the main checkout stays put, with one line saying why: tracked changes, a branch, local commits, a colliding file', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vawe-mainstay-'));
  try {
    const { main, wt, publish } = mainAndWorktree(dir);
    publish('two.txt');
    git(wt, 'fetch', '-q', 'origin', 'main');
    let at = 1_000_000;
    const line = () => mainCheckoutLine(wt, { now: (at += 700_000) });
    fs.writeFileSync(path.join(main, 'f.txt'), 'edited');
    assert.match(line(), /not moved: it has tracked changes/);
    git(main, 'checkout', '-q', '--', 'f.txt');
    fs.writeFileSync(path.join(main, 'two.txt'), 'mine');
    assert.match(line(), /not moved: origin\/main adds two\.txt, which exists there/);
    fs.rmSync(path.join(main, 'two.txt'));
    git(main, 'commit', '-q', '--allow-empty', '-m', 'local');
    assert.match(line(), /not moved: its HEAD has commits origin\/main lacks/);
    git(main, 'checkout', '-q', '-B', 'work', 'origin/main~1');
    assert.match(line(), /not moved: it is on a branch/);
    assert.notEqual(git(main, 'rev-parse', 'HEAD'), git(main, 'rev-parse', 'origin/main'));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
