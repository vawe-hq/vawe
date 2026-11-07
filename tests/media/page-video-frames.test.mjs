// A <video> clip on a page shows exactly the source frame the contract names (core/engine/page-seek.js): source second
// trim + (t - at) * rate, held at trim before data-at and at the last frame after the end. The fixture clip paints its own frame
// number as 7 black or white cells, so a rendered row of pixels names the source frame.
// Needs Chrome and ffmpeg.   node --test tests/media/page-video-frames.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const RENDER = path.join(ROOT, 'harness/media/render-page.mjs');
const SRC_FPS = 30;
const SRC_FRAMES = 120;
const BITS = 7;
const CELL = 10;
const W = 320, H = 180;

const sh = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8', maxBuffer: 1 << 28 });

function makeClip(file) {
  sh('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', `color=c=black:s=${BITS * CELL}x36:r=${SRC_FPS}:d=${SRC_FRAMES / SRC_FPS}`,
    '-vf', `geq=lum='255*mod(floor(N/pow(2,floor(X/${CELL}))),2)':cb=128:cr=128`,
    '-c:v', 'libx264', '-crf', '10', '-g', '15', '-bf', '0', '-pix_fmt', 'yuv420p', file]);
}

const page = ({ at, trim, rate, seconds = 3, extra = '' }) => `<!doctype html><html><head><meta charset="utf-8"><meta name="duration" content="${seconds}">
<style>*{margin:0}html,body{background:#000}video{position:absolute;inset:0;width:100vw;height:100vh;object-fit:fill}</style></head>
<body><video src="clip.mp4" data-at="${at}" data-trim="${trim}" data-rate="${rate}" ${extra} muted></video></body></html>`;

function decodeFrames(mp4) {
  const raw = execFileSync('ffmpeg', ['-v', 'error', '-i', mp4, '-vf', `scale=${W}:${H},crop=${W}:4:0:${H / 2 - 2},scale=${BITS}:1:flags=area`, '-f', 'rawvideo', '-pix_fmt', 'gray', '-'], { maxBuffer: 1 << 26 });
  const frames = [];
  for (let i = 0; i + BITS <= raw.length; i += BITS) frames.push([...raw.subarray(i, i + BITS)].reduce((n, v, bit) => n + (v > 127 ? 2 ** bit : 0), 0));
  return frames;
}

function expectedFrame(k, fps, { at, trim, rate }) {
  const clipEnd = SRC_FRAMES / SRC_FPS;
  const s = Math.min(Math.max(trim + (k / fps - at) * rate, trim), clipEnd);
  return Math.min(Math.floor(s * SRC_FPS + 1e-6), SRC_FRAMES - 1);
}

// A final renders in software and is slow, so it covers the hold and the play but not the end of the clip (the draft does).
const MODES = [
  { name: 'draft 30 fps', fps: 30, args: [], clip: { at: 1, trim: 0.5, rate: 2, seconds: 3 }, holdsEnd: true },
  { name: 'final 60 fps', fps: 60, args: ['--final'], clip: { at: 0.2, trim: 0.5, rate: 2, seconds: 0.6 }, holdsEnd: false },
];

for (const mode of MODES) {
  test(`a clip at data-trim=0.5 data-rate=2 shows the exact source frame in every film frame (${mode.name})`, () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'page-video-frames-'));
    try {
      const clip = mode.clip;
      makeClip(path.join(dir, 'clip.mp4'));
      fs.writeFileSync(path.join(dir, 'page.html'), page(clip));
      const out = path.join(dir, 'out.mp4');
      const r = spawnSync('node', [RENDER, path.join(dir, 'page.html'), out, '--fps', String(mode.fps), '--w', String(W), '--h', String(H), '--silent', ...mode.args], { encoding: 'utf8' });
      assert.equal(r.status, 0, `${r.stdout}\n${r.stderr}`);
      const got = decodeFrames(out);
      const want = got.map((_, k) => expectedFrame(k, mode.fps, clip));
      assert.equal(got.length, clip.seconds * mode.fps);
      const wrong = got.map((g, k) => (g === want[k] ? null : `film frame ${k}: shows source frame ${g}, want ${want[k]}`)).filter(Boolean);
      assert.deepEqual(wrong.slice(0, 8), [], `${wrong.length} of ${got.length} frames wrong`);
      assert.equal(want[0], 15, 'before data-at the clip holds its trim frame');
      if (mode.holdsEnd) assert.equal(want.at(-1), SRC_FRAMES - 1, 'after its end the clip holds its last frame');
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });
}

test('a render refuses a missing clip and a trim at or past the end, and clamps a trim-end past the file', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'page-video-lint-'));
  try {
    makeClip(path.join(dir, 'clip.mp4'));
    const run = (html) => {
      fs.writeFileSync(path.join(dir, 'page.html'), html);
      return spawnSync('node', [RENDER, path.join(dir, 'page.html'), path.join(dir, 'out.mp4'), '--fps', '5', '--w', '160', '--h', '90', '--silent'], { encoding: 'utf8' });
    };
    const missing = run(page({ at: 0, trim: 0, rate: 1 }).replace('clip.mp4', 'nope.mp4'));
    assert.notEqual(missing.status, 0);
    assert.match(missing.stderr, /<video src="nope\.mp4">.*does not exist/);
    const badTrim = run(page({ at: 0, trim: 5, rate: 1, extra: 'data-trim-end="2"' }));
    assert.notEqual(badTrim.status, 0);
    assert.match(badTrim.stderr, /data-trim 5 is not before the end 2 \(data-trim-end\)/);
    const badRate = run(page({ at: 0, trim: 0, rate: 0 }));
    assert.notEqual(badRate.status, 0);
    assert.match(badRate.stderr, /data-rate must be above 0/);
    const past = run(page({ at: 0, trim: 0, rate: 1, extra: 'data-trim-end="9"' }));
    assert.equal(past.status, 0, past.stderr);
    assert.match(past.stderr, /data-trim-end 9 is past the end of the file/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('a page whose only sound is a <video> clip gets that sound in the render, starting at data-at', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'page-video-sound-'));
  try {
    sh('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=s=64x36:r=30:d=2', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=2',
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', path.join(dir, 'talk.mp4')]);
    fs.writeFileSync(path.join(dir, 'page.html'), `<!doctype html><html><head><meta charset="utf-8"><meta name="duration" content="3"></head>
<body style="margin:0;background:#000"><video src="talk.mp4" data-at="1" style="width:100vw;height:100vh"></video></body></html>`);
    const out = path.join(dir, 'out.mp4');
    const r = spawnSync('node', [RENDER, path.join(dir, 'page.html'), out, '--fps', '5', '--w', '160', '--h', '90'], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    assert.match(sh('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type', '-of', 'csv=p=0', out]), /audio/);
    const silence = spawnSync('ffmpeg', ['-hide_banner', '-i', out, '-af', 'silencedetect=noise=-40dB:d=0.2', '-f', 'null', '-'], { encoding: 'utf8' }).stderr;
    const end = Number(silence.match(/silence_end: ([\d.]+)/)?.[1]);
    assert.ok(Math.abs(end - 1) < 0.05, `the clip sound starts at ${end} s, wanted 1 s`);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
