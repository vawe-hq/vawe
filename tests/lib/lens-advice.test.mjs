// tests/lib/lens-advice.test.mjs: the lens lines of a draft (pure).
import test from 'node:test';
import assert from 'node:assert/strict';
import { texelLine, poseLine, backdropLine, lensLines } from '../../harness/lib/lens-advice.mjs';
import { cueRead, poseOf, lensPose } from '../../core/surfaces/lens-views.js';
import { lensTimes } from '../../harness/media/lens-probe.mjs';
import { texelRatio } from '../../core/surfaces/lens.js';

const sample = (t, o = {}) => ({ t, pose: { x: 5, y: -8, z: 0 }, texel: 0.9, edge: null, backdrop: null, ...o });

test('the texel line names the worst second, the ratio and the fix; none at 1.0x or below', () => {
  assert.equal(texelLine([sample(1), sample(2, { texel: 1.0 })]), null);
  const line = texelLine([sample(1, { texel: 1.2 }), sample(5.9, { texel: 1.46 })]);
  assert.match(line, /1\.46x its source pixels at 5\.9 s/);
  assert.match(line, /bin\/vawe new --from-url <url> --tour steps\.json --scale 2/);
});

test('the pose line marks a tilt over the readable range and over the clamp', () => {
  const line = poseLine([sample(1), sample(5, { pose: { x: 14, y: 0, z: 0 } }), sample(9, { pose: { x: 0, y: 30, z: 0 } })]);
  assert.match(line, /1\.0s 5\/-8, 5\.0s 14\/0!, 9\.0s 0\/30 OVER/);
  assert.match(line, /readable up to 10, clamp 25/);
  assert.equal(poseLine([]), null);
});

test('the pose line names the world that holds the second', () => {
  assert.match(poseLine([sample(2)], [{ id: 's2', start: 1, end: 3 }]), /s2 5\/-8/);
});

test('the backdrop line reads the last sample that sees the edge, with the numbers of cueRead', () => {
  const dark = sample(8, { edge: [0.05, 0.05, 0.05], backdrop: [0, 0, 0] });
  const read = cueRead(dark.backdrop, dark.edge);
  const line = backdropLine([sample(1), dark]);
  assert.match(line, new RegExp(`page edge ${read.edge.toFixed(1)}:1`));
  assert.match(line, /shadow invisible/);
  assert.match(line, /compare 3 backdrops in one sheet/);
  assert.match(backdropLine([sample(8, { edge: [0.1, 0.1, 0.1], backdrop: [0.95, 0.95, 0.94] })]), /shadow reads/);
  assert.equal(backdropLine([sample(1)]), null);
});

test('a page with no lens prints nothing', () => {
  assert.deepEqual(lensLines([], null), []);
  assert.deepEqual(lensLines(undefined, null), []);
});

test('poseOf inverts lensPose; the probe grid is even and inside the film', () => {
  const back = poseOf(lensPose({ x: 15, y: -45, z: 3 }));
  assert.ok(Math.abs(back.x - 15) < 1e-9 && Math.abs(back.y + 45) < 1e-9 && Math.abs(back.z - 3) < 1e-9);
  const times = lensTimes(12);
  assert.equal(times.length, 12);
  assert.ok(times[0] > 0 && times.at(-1) < 12);
});

test('texelRatio is screen px per texture px: a 2x texture drawn at zoom 1 on a 1080 frame of a 1080 source is 0.5', () => {
  const p = { zoom: 1, focal: 1, aim: [960, 540], tiltX: 0, tiltY: 0, roll: 0, distortion: { amount: 0 }, shift: [0, 0], fit: null };
  const ratio = texelRatio(p, [1920, 1080], { w: 1920, h: 1080 }, 2, [960, 540]);
  assert.ok(ratio > 0.4 && ratio < 0.6, String(ratio));
});
