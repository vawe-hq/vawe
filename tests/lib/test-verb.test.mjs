import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { testSteps, SERIAL_TESTS, VERBS, stripChromeNoise, commitsBehind, staleNote } from '../../harness/cli/verbs.mjs';
import { parseAt, compareProblem } from '../../harness/media/compare-frames.mjs';
import { UsageError } from '../../harness/cli/parse.mjs';

test('stripChromeNoise drops the known Chrome lines and keeps the rest', () => {
  const text = 'a\n[1:2] task_policy_set TASK_CATEGORY_POLICY failed: (os/kern) invalid argument\nCVDisplayLinkCreateWithCGDisplay failed\nreal error\n';
  assert.equal(stripChromeNoise(text), 'a\nreal error\n');
});

test('staleNote names the commit count only when the checkout is behind; commitsBehind takes the larger local ref', () => {
  assert.equal(staleNote(0), '');
  assert.match(staleNote(1), /1 commit behind main/);
  assert.match(staleNote(12), /12 commits behind main/);
  const counts = { 'HEAD..main': '3\n', 'HEAD..origin/main': '5\n' };
  assert.equal(commitsBehind((args) => counts[args[2]]), 5);
  assert.equal(commitsBehind(() => { throw new Error('no ref'); }), 0);
});

test('frame --vs builds the compare step, and every usage error names its flag', () => {
  assert.deepEqual(parseAt('1, 4,7.5'), [1, 4, 7.5]);
  assert.equal(compareProblem({ ours: 'a.mp4', at: '1,4' }), null);
  assert.match(compareProblem({ at: '1' }), /missing <ours\.mp4> or --page/);
  assert.match(compareProblem({ ours: 'a.mp4' }), /missing --at/);
  assert.match(compareProblem({ ours: 'a.mp4', at: '1,x' }), /--at has a value that is not a number.*"x"/);
  const sheet = VERBS.find((v) => v.name === 'frame');
  const [mp4] = sheet.build({ vs: 'r.mp4', at: '1,4' }, ['a.mp4']);
  assert.deepEqual(mp4.args, ['a.mp4', '--ref', 'r.mp4', '--at', '1,4']);
  const [page] = sheet.build({ vs: 'r.mp4' }, ['films/x/page.html']);
  assert.deepEqual(page.args, ['--page', 'films/x/page.html', '--ref', 'r.mp4', '--at', 'cuts']);
  assert.throws(() => sheet.build({ vs: 'r.mp4', at: '1,x' }, ['a.mp4']), /--at has a value that is not a number/);
  assert.throws(() => sheet.build({ vs: 'r.mp4', labels: true, at: '1' }, ['a.mp4']), UsageError);
  assert.doesNotMatch(sheet.next({}, ['films/x/page.html']), /reference left/);
  assert.match(sheet.next({ vs: 'r.mp4' }, ['films/x/page.html']), /reference left/);
});

test('vawe test runs every test file once: the serial files alone and last, the rest together first', () => {
  const [parallel, serial] = testSteps().map((s) => s.node.slice(1));
  assert.deepEqual(serial, SERIAL_TESTS);
  for (const f of SERIAL_TESTS) assert.ok(fs.existsSync(f), f);
  assert.equal(parallel.some((f) => SERIAL_TESTS.includes(f)), false);
  assert.ok(parallel.includes('tests/lib/test-verb.test.mjs'));
  assert.equal(new Set(parallel).size, parallel.length);
});
