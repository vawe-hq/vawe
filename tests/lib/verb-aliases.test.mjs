import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ALIASES, aliasNotice, aliasKey } from '../../harness/cli/aliases.mjs';
import { VERBS, ALIAS_TARGETS } from '../../harness/cli/verbs.mjs';
import { parseArgs, UsageError } from '../../harness/cli/parse.mjs';
import { aliasSeen, resetShown } from '../../harness/lib/next-once.mjs';

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

// The script and the arguments the old verb handed to it, for each row above that is not a refusal.
const STEPS = [
  ['harness/media/still.mjs', [P, '--at', '4.2']],
  ['harness/media/still.mjs', [P, '--at', '0', '--size', '1200x630']],
  ['harness/media/still.mjs', [P, '--at', '3']],
  ['harness/media/sheet.mjs', [P, '--at', '0.5,1.2,3', '--labels']],
  ['harness/media/sheet.mjs', [P]],
  ['harness/media/sheet.mjs', [P, '--at', '3']],
  ['harness/media/sheet.mjs', [P, '--at', '3']],
  ['harness/media/compare-frames.mjs', ['--page', P, '--ref', 'r.mp4', '--at', '2.5,3.1']],
  ['harness/media/compare-frames.mjs', ['--page', P, '--ref', 'r.mp4', '--at', '3']],
  ['harness/media/frames.mjs', [P]],
  ['harness/media/frames.mjs', [P, '--full']],
  ['harness/media/frames.mjs', [P, '--full', '--world', 's3,s5']],
  ['harness/media/frames.mjs', [P, '--zoom']],
  ['harness/media/looks.mjs', [P, '--at', '4.5,9', '--only', 'crt']],
  ['harness/media/see.mjs', [P, '--moment', '8.4', '--span', '1', '--fps', '8']],
  ['harness/media/see.mjs', [P, '--cuts', '--span', '1', '--fps', '8']],
  ['harness/media/see.mjs', [P, '--onion', '8.4', '--span', '0.6', '--n', '6']],
  ['harness/media/see.mjs', [P, '--velocity', '2.75', '--span', '1', '--ids', 'a,b']],
  ['harness/media/see/zoom.mjs', [P, '--at', '2.4', '--box', '800,400,240,135', '--scale', '8']],
  ['harness/media/see/zoom.mjs', [P, '--at', '3', '--auto', '--scale', '3']],
  ['harness/media/storyboard.mjs', [P]],
  ['harness/media/storyboard.mjs', [P, '--all']],
  ['harness/media/directions-board.mjs', [P]],
  ['harness/media/timeline.mjs', [P, '--json']],
];

test('every mapped command parses and builds the script and arguments the old verb ran', () => {
  assert.equal(STEPS.length, ROWS.length);
  ROWS.forEach(([old, now], i) => {
    const verb = VERBS.find((v) => v.name === now[0]);
    const { values, positional } = parseArgs(verb, now.slice(1));
    const [step] = verb.build(values, positional);
    assert.deepEqual([step.script, step.args], STEPS[i], old.join(' '));
  });
});

test('an old verb keeps the flags it required: a call that failed before fails now, naming the frame flag', () => {
  const refused = (old, re) => assert.throws(() => ALIASES[old[0]](old.slice(1)), (e) => e instanceof UsageError && re.test(e.message), old.join(' '));
  refused(['still', P], /still needs --at <s>: vawe frame .* --at <s>/);
  refused(['still', P, '--at', '1,2'], /still takes one second, got "1,2": vawe frame/);
  refused(['still', P, '--at', 'cuts'], /still takes one second/);
  refused(['strip', P], /strip needs --at <s> or --cuts: vawe frame .* --moment <s>/);
  refused(['strip', P, '--cuts', '--at', '2'], /strip --cuts does not take --at/);
  refused(['zoom', P, '--at', '3'], /zoom needs --at <s> and --box x,y,w,h or --auto/);
  refused(['zoom', P, '--vs', 'R', '--at', '2'], /zoom needs --at <s> and --box/);
  refused(['zoom', P, '--box', '1,2,3,4'], /zoom needs --at <s>/);
});

test('bin/vawe prints a refused old call as a usage error, exit 2, logged under the old name', () => {
  const run = spawnSync(process.execPath, [path.join(ROOT, 'bin/vawe'), 'zoom', P, '--at', '3'], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(run.status, 2);
  assert.match(run.stderr, /vawe: zoom needs --at <s> and --box/);
  assert.match(run.stdout, /vawe: zoom FAILED/);
});

test('the notice names the old and the new command', () => {
  assert.equal(aliasNotice('still', ['frame', P, '--at', '4.2']), `vawe: \`vawe still\` is now \`vawe frame ${P} --at 4.2\``);
});

test('the notice shows once per session, agent and old verb with its new form; again after a reset', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vawe-alias-'));
  const seen = (key, sessionId, agent = null) => aliasSeen(key, { root, sessionId, agent });
  assert.equal(seen('still->frame', 's1'), false);
  assert.equal(seen('still->frame', 's1'), true);
  assert.equal(seen('sheet->frame', 's1'), false, 'another old verb');
  assert.equal(seen('storyboard->frame', 's1'), false);
  assert.equal(seen('storyboard->see', 's1'), false, 'the same old verb, another new verb');
  assert.equal(seen('still->frame', 's1', 'film-a'), false, 'another agent');
  assert.equal(seen('still->frame', 's1', 'film-a'), true);
  assert.equal(seen('still->frame', 's2'), false, 'another session');
  assert.equal(seen('still->frame', null), false, 'no session, no memory');
  assert.equal(seen('still->frame', 's1'), true);
  resetShown(root, 's1');
  assert.equal(seen('still->frame', 's1'), false, 'a reset (the PreCompact hook) brings it back');
  assert.equal(seen('still->frame', 's1'), true);
  assert.equal(seen('still->frame', 's2'), true, 'another session keeps its memory');
});

test('without a session the notice is short, with one it names the whole command', () => {
  assert.equal(aliasNotice('strip', ['frame', P, '--cuts'], { short: true }), 'vawe: `vawe strip` is now `vawe frame`');
  assert.equal(aliasKey('storyboard', ['see', P, '--plan']), 'storyboard->see');
});

test('bin/vawe shows the notice once per session across calls, and again for the same old verb that became another verb', () => {
  const session = `alias-test-${process.pid}`;
  const call = (...args) => spawnSync(process.execPath, [path.join(ROOT, 'bin/vawe'), ...args], { cwd: ROOT, encoding: 'utf8', env: { ...process.env, CLAUDE_CODE_SESSION_ID: session, VAWE_AGENT: session } });
  const first = call('sheet', 'no-such.html', '--at', '1,2');
  assert.match(first.stderr, /`vawe sheet` is now `vawe frame no-such\.html --at 1,2`/);
  assert.doesNotMatch(call('sheet', 'no-such.html', '--at', '1,2').stderr, /is now/);
  assert.match(call('storyboard', 'no-such.html').stderr, /`vawe storyboard` is now `vawe frame no-such\.html --board`/);
  assert.match(call('storyboard', 'no-such.html', '--text').stderr, /`vawe storyboard` is now `vawe see no-such\.html --plan`/);
  assert.match(call('sheet', 'no-such.html', '--at', '1,2').stdout, /vawe: frame FAILED/);
  const file = path.join(ROOT, 'out', '_unfiled.runs.jsonl');
  const mine = fs.readFileSync(file, 'utf8').split('\n').filter((l) => l.includes(session));
  fs.writeFileSync(file, fs.readFileSync(file, 'utf8').split('\n').filter((l) => l && !l.includes(session)).map((l) => `${l}\n`).join(''));
  assert.deepEqual(mine.map((l) => JSON.parse(l).alias), ['sheet->frame', 'storyboard->frame', 'storyboard->see']);
});

test('bin/vawe with no session prints the short notice', () => {
  const env = { ...process.env, CLAUDE_CODE_SESSION_ID: '' };
  const run = spawnSync(process.execPath, [path.join(ROOT, 'bin/vawe'), 'strip', 'no-such.html', '--cuts'], { cwd: ROOT, encoding: 'utf8', env });
  assert.match(run.stderr, /^vawe: `vawe strip` is now `vawe frame`$/m);
});

test('fonts and palette left the verb table, still run, and say once what replaced them', () => {
  for (const name of ['fonts', 'palette']) {
    assert.equal(VERBS.find((v) => v.name === name), undefined, name);
    assert.deepEqual(ALIASES[name](['--x']), [name, '--x']);
    assert.ok(ALIAS_TARGETS.some((v) => v.name === name), name);
    assert.match(aliasNotice(name, [name]), new RegExp(`\`vawe ${name}\` is retired: vawe new writes .* into brief\\.md; this call still runs`));
  }
  const env = { ...process.env, CLAUDE_CODE_SESSION_ID: '' };
  const run = spawnSync(process.execPath, [path.join(ROOT, 'bin/vawe'), 'palette', '--id', 'seed-200'], { cwd: ROOT, encoding: 'utf8', env });
  assert.equal(run.status, 0);
  assert.match(run.stdout, /BRAND SEED · seed-200/);
  assert.match(run.stderr, /`vawe palette` is retired/);
  assert.match(spawnSync(process.execPath, [path.join(ROOT, 'bin/vawe'), 'fonts'], { cwd: ROOT, encoding: 'utf8' }).stdout, /Geist \| variable 100-900 \| assets\/fonts\/Geist\.woff2/);
});
