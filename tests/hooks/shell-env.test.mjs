import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { addNoMatch, ENV_LINE } from '../../harness/live/shell-env.mjs';

const HOOK = path.resolve('harness/live/shell-env.mjs');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'vawe-shellenv-'));
const SESSION_START = JSON.stringify({ hook_event_name: 'SessionStart', source: 'startup' });

const runHook = (envFile) => spawnSync(process.execPath, [HOOK], { input: SESSION_START, encoding: 'utf8', env: { ...process.env, CLAUDE_ENV_FILE: envFile } });
const inZsh = (envFile, command) => spawnSync('zsh', ['-c', `source '${envFile}'; ${command}`], { encoding: 'utf8', cwd: tmp() });

test('the SessionStart hook writes the line once, even when it runs again on resume', () => {
  const file = path.join(tmp(), 'env.sh');
  fs.writeFileSync(file, 'export A=1\n');
  assert.equal(runHook(file).status, 0);
  assert.equal(runHook(file).status, 0);
  assert.equal(fs.readFileSync(file, 'utf8'), `export A=1\n${ENV_LINE}\n`);
});

test('with no CLAUDE_ENV_FILE the hook does nothing and exits 0', () => {
  const r = runHook('');
  assert.equal(r.status, 0);
  assert.equal(addNoMatch(''), false);
});

test('without the line an unquoted glob with no match stops zsh; with it the pattern passes through as in bash', { skip: spawnSync('zsh', ['-c', 'true']).status !== 0 }, () => {
  const empty = path.join(tmp(), 'empty.sh');
  fs.writeFileSync(empty, '');
  const before = inZsh(empty, 'ls out/*.png');
  assert.match(before.stderr, /no matches found/);

  const file = path.join(tmp(), 'env.sh');
  runHook(file);
  const after = inZsh(file, 'ls out/*.png; echo after; echo x?a=b');
  assert.doesNotMatch(after.stderr, /no matches found/);
  assert.match(after.stderr, /No such file/);
  assert.match(after.stdout, /after\nx\?a=b/);
});

test('a glob that matches still expands, and the line is harmless in bash', () => {
  const file = path.join(tmp(), 'env.sh');
  runHook(file);
  const z = inZsh(file, 'touch a.png; echo *.png');
  assert.equal(z.stdout.trim(), 'a.png');
  const b = spawnSync('bash', ['-c', `source '${file}'; echo ok`], { encoding: 'utf8' });
  assert.equal(b.stdout.trim(), 'ok');
});
