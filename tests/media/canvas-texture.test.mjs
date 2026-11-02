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
import { insideRects, extractStillFrames, extractStillFrame } from '../../harness/media/see/words.mjs';
import { ocrFrames } from '../../harness/media/see/ocr.mjs';

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
    fs.mkdirSync(path.join(dir, 'one'));
    const files = extractStillFrames(video, [1, 0.2, 1], 30, dir);
    assert.equal(files[0], files[2]);
    assert.notEqual(files[0], files[1]);
    assert.ok(files.every((f) => fs.statSync(f).size > 0));
    extractStillFrame(video, 0.21, path.join(dir, 'ss.png'));
    assert.deepEqual(fs.readFileSync(extractStillFrames(video, [0.21], 30, path.join(dir, 'one'))[0]), fs.readFileSync(path.join(dir, 'ss.png')));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('the layout sample lists the :root colours the page paints with, not an unused one or a custom property that is no colour', async () => {
  const { sampleLayout } = await import('../../harness/media/draft-check.mjs');
  const page = 'tests/fixtures/pages/declared-palette.html';
  const opened = await openPage(page, resolveFrame(page, {}));
  try {
    await opened.page.goto(opened.url, { waitUntil: 'load' });
    await settle(opened.page);
    const [sample] = await sampleLayout(opened.page, [0], async () => {});
    assert.deepEqual(sample.palette, [[0, 0, 0, 1], [241, 234, 219, 1]]);
  } finally { await opened.close(); }
});

test('ocrFrames reads a file named twice once and gives both entries the same words', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ocr-frames-'));
  try {
    const png = path.join(dir, 'f_1.png');
    spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=white:size=320x180', '-frames:v', '1', png]);
    const [a, b] = ocrFrames([{ src: png, base: png.replace(/\.png$/, '') }, { src: png, base: png.replace(/\.png$/, '') }], 60, 3, 320, 180);
    assert.deepEqual(a, b);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
