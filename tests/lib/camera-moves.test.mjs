import test from 'node:test';
import assert from 'node:assert/strict';
import { cameraOnlySpans, cameraLoad, withCameraStills } from '../../harness/lib/camera-moves.mjs';
import { barLint, constantCamera } from '../../harness/lib/bar-lint.mjs';
import { problemsOf } from '../../harness/lib/ship-status.mjs';

const rec = (over) => ({ target: 0, label: 'el', id: '', props: ['translate'], delay: 0, duration: 1, easing: 'linear', kfEasings: [], opacity: null, from: '', kf: {}, fullFrame: false, area: 1000, decorative: false, ...over });
const camera = (delay, duration, over = {}) => rec({ id: 'camera', props: ['scale'], delay, duration, fullFrame: true, ...over });
const stats = (cameraOnly, duration = 6) => ({ duration, turns: [], static: withCameraStills([], cameraOnly) });
const stillProblems = (records, duration) => problemsOf(stats(cameraOnlySpans(records), duration), [], undefined, {}, [{ id: 'a', start: 0, end: duration }]).filter((p) => p.startsWith('static window'));

test('a hold kept alive only by a fast whole-frame move is a still window', () => {
  const records = [camera(0, 6, { kf: { scale: ['1', '10'] } }), rec({ target: 1, delay: 0, duration: 0.4, opacity: [0, 1] })];
  const problems = stillProblems(records, 6);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /only the camera moves/);
});

test('a slow camera ease keeps a hold alive, a fast one does not', () => {
  const slow = camera(0, 6, { kf: { scale: ['1', '1.2'] } });
  assert.deepEqual(cameraOnlySpans([slow]), []);
  assert.deepEqual(stillProblems([slow], 6), []);
  assert.deepEqual(cameraOnlySpans([camera(0, 2, { kf: { translate: ['0px 0px', '900px 0px'] } })]), [[0, 2]]);
  assert.deepEqual(cameraOnlySpans([camera(0, 6)]), []);
});

test('the same hold with a counter or typing in it is not a still window', () => {
  const counter = rec({ target: 1, props: ['textContent'], delay: 0.2, duration: 5.6 });
  assert.deepEqual(stillProblems([camera(0, 6), counter], 6), []);
  assert.deepEqual(stillProblems([counter], 6), []);
});

test('a scale or translate on an element that covers the frame is a camera move, a small element is not', () => {
  assert.deepEqual(cameraOnlySpans([rec({ props: ['translate'], delay: 1, duration: 3, fullFrame: true, kf: { translate: ['0px 0px', '3000px 0px'] } })]), [[1, 4]]);
  assert.deepEqual(cameraOnlySpans([rec({ props: ['translate'], delay: 1, duration: 3 })]), []);
  assert.deepEqual(cameraOnlySpans([rec({ props: ['clipPath'], delay: 1, duration: 3, fullFrame: true })]), []);
});

test('a camera push at the spectacle does not fire constant-camera, the same push in every world does', () => {
  const film = { dur: 20, worlds: [0, 5, 10, 15].map((start) => ({ start, end: start + 5 })) };
  assert.deepEqual(constantCamera([camera(13, 2)], film, 14), []);
  const sting = { dur: 5, worlds: null };
  assert.deepEqual(constantCamera([camera(0, 4.5)], sting, 3), []);
  const found = constantCamera([camera(0, 4.5)], sting);
  assert.equal(found.length, 1);
  assert.equal(found[0].code, 'constant-camera');
  assert.match(found[0].what, /90% of the film/);
});

test('constant-camera fires over 4 worlds in a row even when the share is low', () => {
  const worlds = Array.from({ length: 10 }, (_, i) => ({ start: 2 * i, end: 2 * i + 2 }));
  const moves = [2, 4, 6, 8, 10].map((t) => camera(t, 2));
  const load = cameraLoad(moves, { dur: 20, worlds });
  assert.equal(load.worlds, 5);
  assert.ok(load.share < 0.6);
  assert.match(constantCamera(moves, { dur: 20, worlds })[0].what, /5 worlds in a row/);
  assert.deepEqual(constantCamera(moves.slice(0, 4), { dur: 20, worlds }), []);
});

test('withCameraStills merges the camera seconds into the pixel runs and drops slivers', () => {
  assert.deepEqual(withCameraStills([{ a: 1, b: 1.5, len: 0.5 }], [[1.4, 3]]), [{ a: 1, b: 3, len: 2, camera: true }]);
  assert.deepEqual(withCameraStills([], [[1, 1.2]]), []);
  assert.deepEqual(withCameraStills([{ a: 1, b: 2, len: 1 }], []), [{ a: 1, b: 2, len: 1 }]);
});

test('a camera: still declaration in DESIGN.md turns the constant-camera finding on, and nothing else does', () => {
  const sting = { dur: 5, worlds: null };
  const run = (decl) => barLint({ records: [camera(0, 4.5)], boxes: null, text: null, film: sting, camera: decl }).map((f) => f.code);
  assert.deepEqual(run(null), []);
  assert.deepEqual(run('still'), ['constant-camera']);
  assert.deepEqual(run('free'), []);
});
