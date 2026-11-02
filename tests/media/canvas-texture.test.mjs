// tests/media/canvas-texture.test.mjs: text painted on a canvas follows the texture rules of the DOM (aria-hidden or data-chrome plus a
// data-texture reason), and the word-event frames come from one decode pass. Needs Chrome and ffmpeg.
//   node --test tests/media/canvas-texture.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { openPage, settle, resolveFrame } from '../../harness/media/render-page.mjs';
import { textureCanvases } from '../../harness/lib/canvas-film.mjs';
import { TEXTURE } from '../../harness/lib/draft-check.mjs';
import { insideRects, extractStillFrames } from '../../harness/media/see/words.mjs';

const PAGE = 'tests/fixtures/pages/texture-canvas.html';

test('only a canvas under aria-hidden with a data-texture reason is texture, and its rect is a share of the frame', async () => {
  const opened = await openPage(PAGE, resolveFrame(PAGE, {}));
  try {
    await opened.page.goto(opened.url, { waitUntil: 'load' });
    await settle(opened.page);
    assert.deepEqual(await opened.page.evaluate(textureCanvases, TEXTURE.reasonMin), [{ x: 0.5, y: 0, w: 0.5, h: 0.5 }]);
  } finally { await opened.close(); }
});

test('a word whose centre is inside a texture rect is texture', () => {
  const rects = [{ x: 0.5, y: 0, w: 0.5, h: 0.5 }];
  assert.equal(insideRects({ cxFrac: 0.7, cyFrac: 0.2 }, rects), true);
  assert.equal(insideRects({ cxFrac: 0.2, cyFrac: 0.2 }, rects), false);
  assert.equal(insideRects({ cxFrac: 0.7, cyFrac: 0.2 }, []), false);
});

test('extractStillFrames writes the frames asked for in one pass, in the order of the times', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'still-frames-'));
  try {
    const video = path.join(dir, 'count.mp4');
    spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc=size=160x90:rate=30:duration=2', '-pix_fmt', 'yuv420p', video]);
    const files = extractStillFrames(video, [1, 0.2, 1], 30, dir);
    assert.equal(files[0], files[2]);
    assert.notEqual(files[0], files[1]);
    assert.ok(files.every((f) => fs.statSync(f).size > 0));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
