import test from 'node:test';
import assert from 'node:assert/strict';
import { breatheSpecs, breathe, glint } from '../../core/motion/alive.js';

test('a breath starts at its second, runs whole periods and returns to rest', () => {
  const { frames, timing } = breatheSpecs({ at: 2.8, dur: 3.2, period: 1.6 });
  assert.equal(timing.delay, 2800);
  assert.equal(timing.duration, 1600);
  assert.equal(timing.iterations, 2);
  assert.deepEqual([frames[0].scale, frames[2].scale], [1, 1]);
  assert.ok(frames[1].scale > 1);
});

test('breathe and glint animate through Web Animations at the given second', () => {
  const calls = [];
  const el = { style: {}, ownerDocument: { createElement: () => ({ style: {}, setAttribute() {}, animate: (...a) => calls.push(a) }) }, append() {}, animate: (...a) => calls.push(a) };
  breathe(el, { at: 1 });
  glint(el, { at: 3, dur: 0.8 });
  assert.equal(calls[0][1].delay, 1000);
  assert.equal(calls[1][1].delay, 3000);
  assert.equal(calls[1][1].duration, 800);
  assert.equal(el.style.overflow, 'hidden');
});
