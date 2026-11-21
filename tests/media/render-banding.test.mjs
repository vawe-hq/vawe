// A smaller final must not bring banding back. The score: average 64 rows of a dark ramp and find the
// longest run of pixels that rounds to one quarter luma step. The source ramp is dithered, as Chrome
// paints one; plain 8-bit x264 smooths the dither away into bands, the master and the web copy must not.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ffmpegEncode, ffmpegWebEncode } from '../../harness/media/render-page.mjs';

const W = 960, H = 540, ROWS = 64;

// The Y plane as coded: a gray conversion of a tagged stream rescales the range and changes the run lengths.
function longestFlatRun(file) {
  const px = execFileSync('ffmpeg', ['-v', 'error', '-ss', '0.2', '-i', file, '-frames:v', '1', '-vf', `crop=${W - 200}:${ROWS}:100:200,extractplanes=y,format=gray16le`, '-f', 'rawvideo', '-'], { maxBuffer: 1 << 25 });
  const w = W - 200;
  let longest = 0, run = 0, prev = null;
  for (let x = 0; x < w; x++) {
    let sum = 0;
    for (let y = 0; y < ROWS; y++) sum += px.readUInt16LE((y * w + x) * 2) / 257;
    const q = Math.round((sum / ROWS) * 4);
    run = q === prev ? run + 1 : 1;
    prev = q;
    longest = Math.max(longest, run);
  }
  return longest;
}

test('the master and the web copy keep a dark ramp free of bands', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vawe-banding-'));
  try {
    execFileSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', `color=c=black:s=${W}x${H}:r=60:d=0.5`,
      '-vf', `format=rgb24,geq=r='trunc(11+17*X/W+random(0))':g='trunc(16+21*X/W+random(1))':b='trunc(32+40*X/W+random(2))'`, path.join(dir, 'f%06d.png')]);
    const kArr = Array(30).fill(1);
    const start = kArr.map((_, i) => i).concat(30);
    const master = path.join(dir, 'master.mp4'), web = path.join(dir, 'web.mp4');
    const r = ffmpegEncode(dir, 60, kArr, start, master, { final: true });
    assert.equal(r.status, 0, r.stderr);
    const w = ffmpegWebEncode(dir, 60, kArr, start, web);
    assert.equal(w.status, 0, w.stderr);
    const plain = path.join(dir, 'plain.mp4');
    execFileSync('ffmpeg', ['-v', 'error', '-framerate', '60', '-i', path.join(dir, 'f%06d.png'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '16', plain]);
    const banded = longestFlatRun(plain);
    assert.ok(banded >= 30, `the undithered control should band: longest flat run ${banded} px`);
    for (const f of [master, web]) {
      const flat = longestFlatRun(f);
      assert.ok(flat <= banded / 2, `${path.basename(f)}: longest flat run ${flat} px, banded control ${banded} px`);
    }
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
