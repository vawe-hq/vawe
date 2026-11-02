// tests/media/shot-tour.test.mjs: the steps file and the tweens of `vawe new --from-url --tour` (pure, no browser).
import test from 'node:test';
import assert from 'node:assert/strict';
import { CLICK_S, TAIL_S, frameCount, frameTime, inside, parseTour, pressedAt, stepsDue, tourSize, tween, valueAt } from '../../harness/media/tour-math.mjs';

const lin = (u) => u;

test('a list of steps is sorted data with the default durations and a tail', () => {
  const tour = parseTour(JSON.stringify([
    { t: 0, scroll: 0 },
    { t: 1, move: '#a' },
    { t: 2, hover: [10, 20], dur: 0.25 },
    { t: 3, click: '#a' },
    { t: 3.5, scrollTo: '#b', offset: 40 },
  ]));
  assert.deepEqual(tour.steps.map((s) => s.kind), ['scroll', 'move', 'move', 'click', 'scrollTo']);
  assert.deepEqual(tour.steps.map((s) => s.dur), [0, 0.6, 0.25, CLICK_S, 1]);
  assert.equal(tour.steps[4].offset, 40);
  assert.equal(tour.dur, 4.5 + TAIL_S);
  assert.equal(tour.cursor, null);
});

test('the object form sets the length and the start of the cursor', () => {
  const tour = parseTour(JSON.stringify({ dur: 9, cursor: [5, 6], steps: [{ t: 1, move: '#a' }] }));
  assert.equal(tour.dur, 9);
  assert.deepEqual(tour.cursor, [5, 6]);
  assert.throws(() => parseTour(JSON.stringify({ dur: 1, steps: [{ t: 1, move: '#a' }] })), /ends before the last step at 1.6 s/);
});

test('a bad file fails with one line that names the fix', () => {
  for (const [bad, message] of [
    ['nope', /not JSON/],
    ['[]', /no steps/],
    [JSON.stringify([{ t: 1 }]), /step 1 needs exactly one of/],
    [JSON.stringify([{ t: 1, move: '#a', click: '#a' }]), /move and click/],
    [JSON.stringify([{ move: '#a' }]), /needs "t"/],
    [JSON.stringify([{ t: 2, move: '#a' }, { t: 1, move: '#b' }]), /step 2 starts at 1 s, before step 1 at 2 s/],
    [JSON.stringify([{ t: 1, click: [1, 2] }]), /"click" takes a selector/],
    [JSON.stringify([{ t: 1, scroll: '#a' }]), /"scroll" has no usable value/],
    [JSON.stringify([{ t: 1, move: '#a', dur: -1 }]), /"dur" is not a number/],
    [JSON.stringify([{ t: 1, move: '#a', offset: 3 }]), /"offset" is a number of px and only goes with "scrollTo"/],
  ]) assert.throws(() => parseTour(bad), message);
});

test('a frame is a pure function of its index', () => {
  assert.equal(frameCount(17, 60), 1020);
  assert.equal(frameCount(2.5, 24), 60);
  assert.equal(frameTime(30, 60), 0.5);
});

test('stepsDue hands each step to exactly one frame, the first one at or after its second', () => {
  const steps = [{ t: 0 }, { t: 0.5 }, { t: 0.51 }, { t: 1 }];
  const seen = [];
  let prev = -Infinity;
  for (let i = 0; i <= 60; i++) { const t = frameTime(i, 60); for (const s of stepsDue(steps, prev, t)) seen.push([s.t, i]); prev = t; }
  assert.deepEqual(seen, [[0, 0], [0.5, 30], [0.51, 31], [1, 60]]);
});

test('a tween holds its start, eases between and holds its end', () => {
  const seg = { t0: 1, dur: 2, from: 10, to: 30 };
  assert.equal(tween(seg, 0.5, lin), 10);
  assert.equal(tween(seg, 2, lin), 20);
  assert.equal(tween(seg, 3, lin), 30);
  assert.equal(tween(seg, 9, lin), 30);
  assert.equal(tween({ t0: 1, dur: 0, from: 5, to: 7 }, 1, lin), 7);
});

test('valueAt follows segments in order, each one from where the last stood', () => {
  const segs = [{ t0: 0, dur: 1, from: 0, to: 100 }, { t0: 2, dur: 1, from: 100, to: 0 }];
  assert.equal(valueAt(segs, -1, 7, lin), 7);
  assert.equal(valueAt(segs, 0.5, 7, lin), 50);
  assert.equal(valueAt(segs, 1.5, 7, lin), 100);
  assert.equal(valueAt(segs, 2.5, 7, lin), 50);
  assert.equal(valueAt(segs, 4, 7, lin), 0);
});

test('the button is down for CLICK_S from the click second', () => {
  const clicks = [{ t0: 1 }];
  assert.equal(pressedAt(clicks, 0.99), false);
  assert.equal(pressedAt(clicks, 1), true);
  assert.equal(pressedAt(clicks, 1 + CLICK_S - 0.001), true);
  assert.equal(pressedAt(clicks, 1 + CLICK_S), false);
});

test('inside, and a 16:9 viewport with even sides', () => {
  const r = { left: 10, top: 10, width: 100, height: 20 };
  assert.equal(inside({ x: 60, y: 20 }, r), true);
  assert.equal(inside({ x: 5, y: 20 }, r), false);
  assert.deepEqual(tourSize(1280), { width: 1280, height: 720 });
  assert.deepEqual(tourSize(1440), { width: 1440, height: 810 });
});
