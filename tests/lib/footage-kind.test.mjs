import test from 'node:test';
import assert from 'node:assert/strict';
import { pairMetrics, classify } from '../../harness/media/footage-kind.mjs';
import { proxyPlan } from '../../harness/media/footage.mjs';

const W = 64, H = 36;
const flat = () => new Uint8Array(W * H).fill(10);
const withBar = () => { const f = flat(); for (let y = 0; y < H; y++) for (let x = 20; x < 24; x++) f[y * W + x] = 200; return f; };
const noisy = (seed) => Uint8Array.from({ length: W * H }, (_, i) => (Math.imul(i + seed, 2654435761) >>> 24));

test('pairMetrics: a still frame with a bar is flat, still and has an edge; noise is none of them', () => {
  const ui = pairMetrics(withBar(), withBar(), W, H);
  assert.ok(ui.flat > 0.9 && ui.still === 1 && ui.edge > 0.01, JSON.stringify(ui));
  const cam = pairMetrics(noisy(1), noisy(2), W, H);
  assert.ok(cam.flat < 0.1 && cam.still < 0.1, JSON.stringify(cam));
});

test('classify: the median pair decides', () => {
  const ui = pairMetrics(withBar(), withBar(), W, H);
  const cam = pairMetrics(noisy(1), noisy(2), W, H);
  assert.equal(classify([ui, ui, cam]).screen, true);
  assert.equal(classify([cam, cam, ui]).screen, false);
});

test('proxyPlan: a screen is 4:4:4 and full size unless told otherwise, other footage is 4:2:0 and boxed', () => {
  assert.deepEqual(proxyPlan({ screen: true }, undefined), { full: true, pixFmt: 'yuv444p' });
  assert.deepEqual(proxyPlan({ screen: true }, false), { full: false, pixFmt: 'yuv444p' });
  assert.deepEqual(proxyPlan({ screen: false }, undefined), { full: false, pixFmt: 'yuv420p' });
  assert.deepEqual(proxyPlan({ screen: false }, true), { full: true, pixFmt: 'yuv420p' });
});
