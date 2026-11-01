import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ALIASES, aliasNotice } from '../../harness/cli/aliases.mjs';
import { VERBS } from '../../harness/cli/verbs.mjs';
import { parseArgs } from '../../harness/cli/parse.mjs';
import { aliasSeen } from '../../harness/lib/next-once.mjs';

const ROOT = path.resolve(import.meta.dirname, '../..');
const P = 'films/examples/colour-sting/page.html';

// Each row: the old command, the command it becomes. Every new command must parse, and its steps must be the ones the old verb gave.
const ROWS = [
  [['still', P, '--at', '4.2'], ['frame', P, '--at', '4.2']],
  [['still', P, '--at', '0', '--aspect', '1200:630', '--size', '1200x630'], ['frame', P, '--at', '0', '--aspect', '1200:630', '--size', '1200x630']],
  [['still', P, '--at', '3', '--param', 'look=riso'], ['frame', P, '--at', '3', '--param', 'look=riso']],
  [['sheet', P, '--at', '0.5,1.2,3', '--labels'], ['frame', P, '--at', '0.5,1.2,3', '--labels']],
  [['sheet', P], ['frame', P]],
  [['sheet', P, '--at', '3'], ['frame', P, '--at', '3', '--sheet']],
  [['sheet', P, '--at=3'], ['frame', P, '--at=3', '--sheet']],
  [['sheet', P, '--ref', 'r.mp4', '--at', '2.5,3.1'], ['frame', P, '--vs', 'r.mp4', '--at', '2.5,3.1']],
  [['sheet', P, '--ref', 'r.mp4', '--at', '3'], ['frame', P, '--vs', 'r.mp4', '--at', '3']],
  [['frames', P], ['frame', P, '--world', 'all']],
  [['frames', P, '--full'], ['frame', P, '--full', '--world', 'all']],
  [['frames', P, '--full', '--world', 's3,s5'], ['frame', P, '--full', '--world', 's3,s5']],
  [['frames', P, '--zoom'], ['frame', P, '--sharp', '--world', 'all']],
  [['frames', P, '--looks', '--at', '4.5,9', '--only', 'crt'], ['frame', P, '--looks', '--at', '4.5,9', '--only', 'crt']],
  [['strip', P, '--at', '8.4', '--span', '1'], ['frame', P, '--moment', '8.4', '--span', '1']],
  [['strip', P, '--cuts'], ['frame', P, '--cuts']],
  [['strip', P, '--at', '8.4', '--onion', '--span', '0.6', '--n', '6'], ['frame', P, '--moment', '8.4', '--onion', '--span', '0.6', '--n', '6']],
  [['strip', P, '--at', '2.75', '--velocity', '--ids', 'a,b'], ['frame', P, '--moment', '2.75', '--velocity', '--ids', 'a,b']],
  [['zoom', P, '--at', '2.4', '--box', '800,400,240,135', '--scale', '8'], ['frame', P, '--at', '2.4', '--box', '800,400,240,135', '--scale', '8']],
  [['zoom', P, '--auto', '--at', '3'], ['frame', P, '--auto', '--at', '3']],
  [['storyboard', P], ['frame', P, '--board']],
  [['storyboard', P, '--all'], ['frame', P, '--all', '--board']],
  [['storyboard', P, '--directions'], ['frame', P, '--directions']],
  [['storyboard', P, '--text', '--json'], ['see', P, '--json', '--plan']],
];

test('every old picture command maps to the command that replaced it', () => {
  for (const [old, now] of ROWS) assert.deepEqual(ALIASES[old[0]](old.slice(1)), now, old.join(' '));
});

test('every mapped command parses and builds the script the old verb ran', () => {
  const SCRIPT = { still: /\/still\.mjs$/, sheet: /\/(sheet|compare-frames)\.mjs$/, frames: /\/(frames|looks)\.mjs$/, strip: /\/see\.mjs$/, zoom: /\/zoom\.mjs$/, storyboard: /\/(storyboard|directions-board|timeline)\.mjs$/ };
  for (const [old, now] of ROWS) {
    const verb = VERBS.find((v) => v.name === now[0]);
    const { values, positional } = parseArgs(verb, now.slice(1));
    const [step] = verb.build(values, positional);
    assert.match(step.script, SCRIPT[old[0]], old.join(' '));
  }
});

test('the notice names the old and the new command', () => {
  assert.equal(aliasNotice('still', ['frame', P, '--at', '4.2']), `vawe: \`vawe still\` is now \`vawe frame ${P} --at 4.2\``);
});

test('the notice shows once per session and agent, and again after a reset or for another agent', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vawe-alias-'));
  const seen = (alias, sessionId, agent = null) => aliasSeen('f', alias, { root, sessionId, agent });
  assert.equal(seen('still', 's1'), false);
  assert.equal(seen('still', 's1'), true);
  assert.equal(seen('sheet', 's1'), false, 'another old verb');
  assert.equal(seen('still', 's1', 'film-a'), false, 'another agent');
  assert.equal(seen('still', 's1', 'film-a'), true);
  assert.equal(seen('still', 's2'), false, 'another session');
  assert.equal(seen('still', null), false, 'no session, no memory');
});

test('bin/vawe runs an old verb as frame, prints the notice on stderr and logs the alias', () => {
  const run = spawnSync(process.execPath, [path.join(ROOT, 'bin/vawe'), 'sheet', P, '--at', '3', '--cols', 'x'], { cwd: ROOT, encoding: 'utf8', env: { ...process.env, CLAUDE_CODE_SESSION_ID: '' } });
  assert.match(run.stderr, /`vawe sheet` is now `vawe frame films\/examples\/colour-sting\/page.html --at 3 --cols x --sheet`/);
  assert.match(run.stdout, /vawe: frame FAILED/);
});
