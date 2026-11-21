import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { noiseFrame } from '../../core/surfaces/lens.js';
import { resolveFrame } from '../../harness/media/render-page.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('noiseFrame: every output frame gets its own index at the seek times the render uses', () => {
  for (const fps of [24, 30, 60]) {
    for (const from of [0, 1.5]) {
      for (let i = 0; i < 3600; i++) {
        const t = (from * 1000 + (i / fps) * 1000) / 1000;
        assert.equal(noiseFrame(t, fps), Math.round(from * fps) + i, `fps ${fps}, from ${from}, frame ${i}`);
      }
    }
  }
});

test('resolveFrame: the frame facts carry the render fps, so stills match the render they preview', () => {
  const page = path.join(ROOT, 'tests/fixtures/pages/lens-grain-60fps.html');
  assert.equal(resolveFrame(page, { final: true }).renderFps, 60);
  assert.equal(resolveFrame(page, {}).renderFps, 30);
  assert.equal(resolveFrame(page, { final: true, fps: 24 }).renderFps, 24);
});
