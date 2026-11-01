import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { devFix, VERBS } from '../../harness/cli/verbs.mjs';
import { stripProblem } from '../../harness/media/see/strip-math.mjs';

const ROOT = path.join(import.meta.dirname, '../..');

test('a dev failure names the next step: wait for a slot, bisect a lost browser, else frames', () => {
  assert.equal(devFix('exit 1: TimeoutError: Navigation timeout of 120000 ms exceeded', ['p.html']), 'bin/vawe wait p.html');
  assert.match(devFix('exit 1: error: TargetCloseError: Protocol error (Runtime.callFunctionOn): Target closed', ['p.html']), /bin\/vawe dev p\.html --from 0 --to 4/);
  assert.equal(devFix('exit 2: render stalled', ['p.html']), 'bin/vawe frame p.html --world all');
});

test('a failing check gate writes its reason to stderr, where the run log reads it', () => {
  const r = spawnSync(process.execPath, [path.join(ROOT, 'harness/lib/check-gate.mjs'), 'page-check', '/nonexistent.html'], { encoding: 'utf8' });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /✗ page-check: 1 failed/);
  assert.doesNotMatch(r.stdout, /✗ page-check/);
});

test('refs add with a wrong type shows the command to run', () => {
  const r = spawnSync(process.execPath, [path.join(ROOT, 'harness/dev/refs.mjs'), 'add', 'ref.mp4', '--type', 'movie'], { encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /--type is product or brand, not "movie"; for example: vawe refs add ref\.mp4 --type product/);
});

test('see --probe reaches the element probe of see.mjs and names what it lacks', () => {
  const see = VERBS.find((v) => v.name === 'see');
  assert.deepEqual(see.build({ probe: true, sel: '.card', at: '2.4' }, ['p.html'])[0].args, ['p.html', '--probe', '--sel', '.card', '--at', '2.4']);
  assert.throws(() => see.build({ probe: true, at: '2' }, ['p.html']), /--probe needs --sel/);
  assert.throws(() => see.build({ sel: '.a' }, ['p.html']), /--sel needs --probe/);
  assert.throws(() => see.build({ probe: true, sel: '.a' }, ['a.mp4']), /--probe reads a page/);
});

test('stripProblem: an --at list points at vawe frame', () => {
  assert.match(stripProblem({ at: '0.5,3,6', cuts: false, span: 1, fps: 8 }), /takes one second.*vawe frame <page\|mp4> --at 0\.5,3,6/);
  assert.match(stripProblem({ at: 'abc', cuts: false, span: 1, fps: 8 }), /not a number of seconds/);
});
