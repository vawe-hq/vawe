// Drafts share the warm draft browser; an edit to the page between two drafts must show in the second.
// Needs Chrome and ffmpeg.   node --test tests/media/draft-warm-edit.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { renderPage } from '../../harness/media/render-page.mjs';

const PAGE = 'tests/fixtures/pages/zz-warm-edit.html';
const html = (colour) => `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="duration" content="0.3"><meta name="blank" content="0-0.3">
<style>html,body{margin:0;height:100%;background:${colour}}</style></head><body></body></html>`;

function firstPixel(mp4) {
  const r = spawnSync('ffmpeg', ['-v', 'error', '-i', mp4, '-frames:v', '1', '-vf', 'crop=8:8:0:0,scale=1:1,format=rgb24', '-f', 'rawvideo', '-'], { maxBuffer: 1 << 20, encoding: 'buffer' }); if (!r.stdout.length) throw new Error(String(r.stderr));
  return [...r.stdout];
}

test('an edited page shows in the next draft', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vawe-warm-edit-'));
  try {
    fs.writeFileSync(PAGE, html('#ff0000'));
    await renderPage(PAGE, path.join(dir, 'a.mp4'), { fps: 10, workers: 1 });
    fs.writeFileSync(PAGE, html('#0000ff'));
    await renderPage(PAGE, path.join(dir, 'b.mp4'), { fps: 10, workers: 1 });
    const [r1, , b1] = firstPixel(path.join(dir, 'a.mp4'));
    const [r2, , b2] = firstPixel(path.join(dir, 'b.mp4'));
    assert.ok(r1 > 200 && b1 < 60, `first draft is not red (${r1}, ${b1})`);
    assert.ok(b2 > 200 && r2 < 60, `second draft is not blue (${r2}, ${b2})`);
  } finally { fs.rmSync(PAGE, { force: true }); fs.rmSync(dir, { recursive: true, force: true }); }
});
