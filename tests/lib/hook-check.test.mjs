import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { missingHooks, hookAdvice, LIVE_HOOKS } from '../../harness/lib/hook-check.mjs';

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const dir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'vawe-hooks-'));
const write = (base, name, settings) => {
  fs.mkdirSync(path.join(base, '.claude'), { recursive: true });
  fs.writeFileSync(path.join(base, '.claude', name), JSON.stringify(settings));
};
const reg = (event, file) => ({ hooks: { [event]: [{ hooks: [{ type: 'command', command: `node harness/live/${file}` }] }] } });

test('with no settings file every live hook is missing', () => {
  assert.deepEqual(missingHooks(dir(), dir()).map((h) => h.file), LIVE_HOOKS.map((h) => h.file));
});

test('a hook in the project, the user or the local settings counts as registered', () => {
  const root = dir(), home = dir();
  write(root, 'settings.json', reg('PostToolUse', 'log-read.mjs'));
  write(home, 'settings.json', reg('PreToolUse', 'verb-hint.mjs'));
  write(root, 'settings.local.json', reg('UserPromptSubmit', 'stage-say.mjs'));
  assert.deepEqual(missingHooks(root, home), []);
});

test('a hook on the wrong event, and a settings file that is not JSON, do not count', () => {
  const root = dir(), home = dir();
  write(root, 'settings.json', reg('PreToolUse', 'log-read.mjs'));
  fs.mkdirSync(path.join(home, '.claude'), { recursive: true });
  fs.writeFileSync(path.join(home, '.claude', 'settings.json'), '{ nope');
  assert.ok(missingHooks(root, home).some((h) => h.file === 'log-read.mjs'));
});

test('the advice line carries the JSON to add', () => {
  const [line] = hookAdvice(LIVE_HOOKS.filter((h) => h.file === 'log-read.mjs'));
  const json = JSON.parse(line.slice(line.indexOf('{"hooks"')));
  assert.deepEqual(json, { hooks: { PostToolUse: [{ matcher: 'Read', hooks: [{ type: 'command', command: 'node harness/live/log-read.mjs' }] }] } });
});

test('a worktree has no settings: the main checkout\'s hooks count', () => {
  const main = fs.realpathSync(dir()), home = dir();
  const git = (cwd, ...args) => spawnSync('git', ['-c', 'commit.gpgsign=false', '-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd, encoding: 'utf8' });
  git(main, 'init', '-q');
  git(main, 'commit', '-q', '--allow-empty', '-m', 'x');
  const tree = path.join(fs.realpathSync(dir()), 'wt');
  assert.equal(git(main, 'worktree', 'add', '-q', tree).status, 0);
  write(main, 'settings.json', reg('PostToolUse', 'log-read.mjs'));
  assert.ok(!missingHooks(tree, home).some((h) => h.file === 'log-read.mjs'));
});

test('doctor prints the advice for the missing hooks and keeps its exit code; --quiet prints none', () => {
  const home = dir(), root = dir();
  for (const f of ['harness/dev/doctor.mjs', 'harness/lib/doctor-hint.mjs', 'harness/lib/hook-check.mjs']) {
    fs.mkdirSync(path.dirname(path.join(root, f)), { recursive: true });
    fs.copyFileSync(path.join(REPO, f), path.join(root, f));
  }
  const run = (...flags) => spawnSync(process.execPath, [path.join(root, 'harness/dev/doctor.mjs'), ...flags], { cwd: root, encoding: 'utf8', env: { ...process.env, HOME: home, USERPROFILE: home } });
  const loud = run();
  assert.match(loud.stdout, /advice: hook stage-say\.mjs is not registered/);
  assert.equal(loud.status, /required tool\(s\) missing/.test(loud.stdout) ? 1 : 0);
  assert.doesNotMatch(run('--quiet').stdout, /advice: hook/);
});
