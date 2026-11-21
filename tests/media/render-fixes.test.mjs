// Render-based checks of three engine fixes, small and short so e2e runs them on every push:
// lens noise follows the render fps, split text rests like unsplit text, a 4:4:4 proxy keeps a red-on-black edge.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { addFootage } from '../../harness/media/footage.mjs';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SCRIPT = path.join(ROOT, 'harness/media/render-page.mjs');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'render-fixes-'));
test.after(() => fs.rmSync(tmp, { recursive: true, force: true }));

function render(page, name, fps, size) {
  const out = path.join(tmp, name);
  execFileSync('node', [SCRIPT, path.join(ROOT, 'tests/fixtures/pages', page), out, '--fps', String(fps), '--w', String(size[0]), '--h', String(size[1])], { encoding: 'utf8' });
  return out;
}

// Gray bytes of frame `n` of the mp4, optionally cropped to w:h:x:y.
function grayFrame(mp4, n, crop) {
  const vf = [`select=eq(n\\,${n})`, ...(crop ? [`crop=${crop}`] : []), 'format=gray'].join(',');
  return execFileSync('ffmpeg', ['-v', 'error', '-i', mp4, '-vf', vf, '-frames:v', '1', '-f', 'rawvideo', '-'], { maxBuffer: 1 << 26 });
}

const meanAbsDiff = (a, b) => a.reduce((s, v, i) => s + Math.abs(v - b[i]), 0) / a.length;

test('lens noise follows the render fps: grain changes every frame at 60 fps, a page fps of 30 keeps its hold', () => {
  const auto = render('lens-grain-60fps.html', 'auto.mp4', 60, [960, 540]);
  const held = render('lens-grain-fps30.html', 'held.mp4', 60, [960, 540]);
  const changed = meanAbsDiff(grayFrame(auto, 0), grayFrame(auto, 1));
  const same = meanAbsDiff(grayFrame(held, 0), grayFrame(held, 1));
  assert.ok(changed > 3, `consecutive 60 fps frames differ by ${changed.toFixed(2)} of 255, expected about 8`);
  assert.ok(same < 1.5, `a page that sets fps 30 differs by ${same.toFixed(2)} between two 60 fps frames, expected about 0`);
});

test('split text rests like the unsplit text, to the pixel', () => {
  const mp4 = render('split-kerning.html', 'split.mp4', 10, [960, 540]);
  const plain = grayFrame(mp4, 0, '960:150:0:20');
  const split = grayFrame(mp4, 0, '960:150:0:270');
  const diff = meanAbsDiff(plain, split);
  const ink = plain.filter((v) => v < 128).length;
  assert.ok(ink > 5000, `the line drew ${ink} ink pixels`);
  assert.ok(diff < 0.5, `split and unsplit differ by ${diff.toFixed(3)} of 255 on average`);
});

// Red lines on black at odd pixel offsets: a pure chroma edge. A lossless 4:4:4 source, so the proxy is the only loss.
function redLinesClip(file) {
  const boxes = [101, 301, 501, 701, 901].map((x) => `drawbox=x=${x}:y=51:w=3:h=300:color=red:t=fill`).join(',');
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=black:s=1280x720:r=10:d=2', '-vf', `${boxes},format=yuv444p`, '-c:v', 'libx264', '-crf', '0', file]);
}

// Red channel PSNR of a proxy against its source, both as RGB.
function redPsnr(proxy, source) {
  const r = spawnSync('ffmpeg', ['-i', proxy, '-i', source, '-lavfi', '[0]format=gbrp[a];[1]format=gbrp[b];[a][b]psnr', '-f', 'null', '-'], { encoding: 'utf8' });
  return Number(/PSNR r:([\d.]+)/.exec(r.stderr)[1]);
}

test('a screen recording gets a 4:4:4 proxy that keeps the red-on-black chroma edge, a noisy clip stays 4:2:0', () => {
  const src = path.join(tmp, 'lines.mp4');
  redLinesClip(src);
  const [screen] = addFootage(path.join(tmp, 'film'), [src], {});
  assert.equal(screen.pixFmt, 'yuv444p');
  const sharp = redPsnr(screen.file, src);
  const flat = path.join(tmp, 'flat.mp4');
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', src, '-vf', 'format=yuv420p', '-c:v', 'libx264', '-crf', '18', flat]);
  const smeared = redPsnr(flat, src);
  assert.ok(sharp > 48, `the 4:4:4 proxy keeps the red edge at ${sharp.toFixed(1)} dB`);
  assert.ok(sharp > smeared + 5, `4:4:4 ${sharp.toFixed(1)} dB against 4:2:0 ${smeared.toFixed(1)} dB`);
  const noisy = path.join(tmp, 'noisy.mp4');
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'perlin=size=640x360:rate=10', '-t', '2', '-vf', 'noise=alls=12:allf=t+u,format=yuv420p', '-c:v', 'libx264', '-crf', '14', noisy]);
  assert.equal(addFootage(path.join(tmp, 'film-noisy'), [noisy], {})[0].pixFmt, 'yuv420p');
});
