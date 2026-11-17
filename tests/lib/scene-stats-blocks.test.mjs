import test from 'node:test';
import assert from 'node:assert/strict';
import { frameFeatures, windowChange, windowBlocks, staticRuns, blockChanged } from '../../harness/media/scene-stats.mjs';
import { statsWithCamera } from '../../harness/media/draft-check.mjs';

const W = 160, H = 90;

function frame(draw) {
  const rgb = new Uint8Array(W * H * 3).fill(20);
  draw((x, y, v) => { const p = (y * W + x) * 3; rgb[p] = rgb[p + 1] = rgb[p + 2] = v; });
  return frameFeatures(rgb, W, H);
}

const patch = (x0, y0, size, v) => (set) => { for (let y = y0; y < y0 + size; y++) for (let x = x0; x < x0 + size; x++) set(x, y, v); };

test('a 6 px patch that changes is far under 2 percent of the frame but fills a block', () => {
  const a = frame(() => {}), b = frame(patch(40, 40, 6, 200));
  assert.ok(windowChange([a, b])[1] < 0.02);
  assert.equal(blockChanged(a, b), 36);
});

test('a small part moving keeps the hold alive; the same film without it is one still run', () => {
  const still = Array.from({ length: 20 }, () => frame(() => {}));
  const small = still.map((_, i) => (i >= 5 && i < 15 ? frame(patch(40 + i, 40, 6, 200)) : still[i]));
  assert.deepEqual(staticRuns(windowChange(still), undefined, windowBlocks(still)), [{ a: 0, b: 1.9, len: 1.9 }]);
  assert.ok(staticRuns(windowChange(small))[0].len > 1.5, 'without blocks the move is read as still');
  const runs = staticRuns(windowChange(small), undefined, windowBlocks(small));
  assert.ok(runs.every((r) => r.len <= 0.5), JSON.stringify(runs));
});

test('a change under the pixel step (a soft glow on a dark ground) does not count as motion', () => {
  const a = frame(() => {}), b = frame(patch(40, 40, 30, 28));
  assert.equal(blockChanged(a, b), 0);
});

test('a camera-only span past the end of the film is no still window', () => {
  const stats = { duration: 5, static: [] };
  assert.deepEqual(statsWithCamera(stats, [[5, 5.6]]).static, []);
  const [run] = statsWithCamera(stats, [[4.2, 5.6]]).static;
  assert.equal(run.b, 5);
});
