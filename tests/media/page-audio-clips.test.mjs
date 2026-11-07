// tests/media/page-audio-clips.test.mjs: a <video> element is a clip spec of the <audio> shape. Its sound starts at data-at,
// lasts the trimmed length over data-rate, follows data-gain, and ducks music when its role is vo. Needs ffmpeg, not Chrome.
//   node --test tests/media/page-audio-clips.test.mjs
// PAGE_AUDIO_MODULE points the tests at another copy of page-audio.mjs (the fail-on-old proof).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const SR = 44100;
const moduleUrl = process.env.PAGE_AUDIO_MODULE ? pathToFileURL(path.resolve(process.env.PAGE_AUDIO_MODULE)).href : '../../harness/media/page-audio.mjs';
const { mixAndMux, readPageAudio } = await import(moduleUrl);

const ff = (args) => assert.equal(spawnSync('ffmpeg', ['-y', '-loglevel', 'error', ...args]).status, 0);

function withDir(body) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'page-audio-clips-'));
  const video = path.join(dir, 'film.mp4');
  ff(['-f', 'lavfi', '-i', 'color=c=black:s=64x64:r=30:d=8', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', video]);
  return body({ dir, video }).finally(() => fs.rmSync(dir, { recursive: true, force: true }));
}

function clipFile(dir, name, { tone = true, seconds = 5, freq = 440, level = 0.5 } = {}) {
  const file = path.join(dir, name);
  const audio = tone ? ['-f', 'lavfi', '-i', `sine=frequency=${freq}:duration=${seconds}:sample_rate=${SR}`, '-af', `volume=${level}`, '-c:a', 'aac'] : [];
  ff(['-f', 'lavfi', '-i', `color=c=red:s=64x64:r=30:d=${seconds}`, ...audio, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-shortest', file]);
  return file;
}

const musicFile = (dir, seconds) => {
  const file = path.join(dir, 'music.wav');
  ff(['-f', 'lavfi', '-i', `sine=frequency=220:duration=${seconds}:sample_rate=${SR}`, '-af', 'volume=0.5', file]);
  return file;
};

const bedOf = (src) => ({ src, at: 0, gain: 0, fadeIn: 0, fadeOut: 0, trim: 0, trimEnd: null, duck: null, role: 'music' });
const clip = (src, o = {}) => ({ src, at: 0, gain: 0, gainSet: false, defaultGain: 0, fadeIn: 0, fadeOut: 0, trim: 0, trimEnd: null, duck: null, role: 'clip', rate: 1, ...o });

// Mono samples of the mix, optionally through an ffmpeg audio filter (a low-pass keeps a 220 Hz bed apart from a clip tone).
async function mixed(dir, video, specs, af = 'anull') {
  const out = path.join(dir, `mix-${crypto.randomUUID()}.mp4`);
  await mixAndMux({ specs, duration: 8, video, out });
  const pcm = spawnSync('ffmpeg', ['-loglevel', 'error', '-i', out, '-af', af, '-ac', '1', '-ar', String(SR), '-f', 'f32le', '-'], { maxBuffer: 64 * 1024 * 1024 });
  return new Float32Array(pcm.stdout.buffer.slice(pcm.stdout.byteOffset, pcm.stdout.byteOffset + pcm.stdout.byteLength));
}

const rmsDb = (s, a, b) => {
  const part = s.slice(Math.round(a * SR), Math.round(b * SR));
  return 20 * Math.log10(Math.sqrt(part.reduce((m, v) => m + v * v, 0) / part.length));
};

// First and last second where the 10 ms RMS is above 0.01.
function extent(s) {
  const win = SR / 100;
  let start = -1, end = -1;
  for (let i = 0; i + win <= s.length; i += win / 2) {
    let sum = 0;
    for (let j = i; j < i + win; j++) sum += s[j] * s[j];
    if (Math.sqrt(sum / win) > 0.01) { if (start < 0) start = i / SR; end = (i + win) / SR; }
  }
  return { start, end, length: end - start };
}

// Reads a page of <audio> and <video> elements (attribute maps, `muted` as a key) the way readPageAudio does, with a stand-in DOM.
async function readSpecs(dir, audios, videos) {
  const el = (attrs, src) => ({
    hasAttribute: (k) => k in attrs, getAttribute: () => src, querySelector: () => null, loop: false,
    dataset: Object.fromEntries(Object.entries(attrs).filter(([k]) => k !== 'muted')),
  });
  globalThis.document = { querySelectorAll: (sel) => (sel === 'audio' ? audios : videos).map(([attrs, src]) => el(attrs, src)), querySelector: () => null };
  globalThis.location = { href: `file://${dir}/page.html` };
  const warned = [];
  const warn = console.warn;
  console.warn = (m) => warned.push(m);
  try {
    const { specs } = await readPageAudio({ evaluate: async (fn) => fn() }, { pagePath: path.join(dir, 'page.html'), duration: 8 });
    return { specs, warned };
  } finally {
    console.warn = warn;
    delete globalThis.document;
    delete globalThis.location;
  }
}

const mixedFromPage = async (dir, video, attrs) => mixed(dir, video, (await readSpecs(dir, [], [[attrs, 'tone.mp4']])).specs);

test('a clip sounds from data-at for its trimmed length over data-rate', () => withDir(async ({ dir, video }) => {
  clipFile(dir, 'tone.mp4');
  const plain = extent(await mixedFromPage(dir, video, { at: '1', trim: '1', trimEnd: '3' }));
  assert.ok(Math.abs(plain.start - 1) < 0.01, `onset at ${plain.start} s, wanted 1 s`);
  assert.ok(Math.abs(plain.length - 2) < 0.03, `${plain.length} s long, wanted 2 s`);
  const fast = extent(await mixedFromPage(dir, video, { at: '1', trim: '1', trimEnd: '3', rate: '2' }));
  assert.ok(Math.abs(fast.start - 1) < 0.01 && Math.abs(fast.length - 1) < 0.05, `rate 2: from ${fast.start} s, ${fast.length} s long, wanted 1 s and 1 s`);
  const slow = extent(await mixedFromPage(dir, video, { at: '1', trim: '1', trimEnd: '2', rate: '0.5' }));
  assert.ok(Math.abs(slow.start - 1) < 0.01 && Math.abs(slow.length - 2) < 0.05, `rate 0.5: from ${slow.start} s, ${slow.length} s long, wanted 1 s and 2 s`);
  const slowest = extent(await mixedFromPage(dir, video, { at: '1', trim: '1', trimEnd: '2', rate: '0.25' }));
  assert.ok(Math.abs(slowest.length - 4) < 0.08, `rate 0.25: ${slowest.length} s long, wanted 4 s`);
}));

test('a clip keeps its pitch at another rate', () => withDir(async ({ dir, video }) => {
  const file = clipFile(dir, 'tone.mp4');
  const s = await mixed(dir, video, [clip(file, { at: 0, trim: 0, trimEnd: 4, rate: 2 })]);
  let crossings = 0;
  for (let i = Math.round(0.5 * SR); i < Math.round(1.5 * SR); i++) if (s[i - 1] < 0 && s[i] >= 0) crossings++;
  assert.ok(Math.abs(crossings - 440) < 8, `${crossings} rising zero crossings in one second, wanted 440`);
}));

test('data-gain moves the clip level by that many dB', () => withDir(async ({ dir, video }) => {
  const file = clipFile(dir, 'tone.mp4');
  const loud = await mixed(dir, video, [clip(file, { gain: 0 })]);
  const quiet = await mixed(dir, video, [clip(file, { gain: -6 })]);
  const drop = rmsDb(loud, 1, 3) - rmsDb(quiet, 1, 3);
  assert.ok(Math.abs(drop - 6) < 0.3, `data-gain -6 lowered the level by ${drop} dB`);
}));

test('a hard cut fades over a few ms, so the clip does not click', () => withDir(async ({ dir, video }) => {
  const file = clipFile(dir, 'tone.mp4');
  const s = await mixed(dir, video, [clip(file, { at: 1, trim: 1, trimEnd: 3 })]);
  const around = (t) => s.slice(Math.round(t * SR) - 4, Math.round(t * SR) + 4).reduce((m, v) => Math.max(m, Math.abs(v)), 0);
  assert.ok(around(1) < 0.1 && around(3) < 0.1, `sample peaks at the cuts: ${around(1)} and ${around(3)}`);
}));

test('a vo clip ducks an <audio loop> music file by VO_DUCK_DB; a plain clip does not', () => withDir(async ({ dir, video }) => {
  const bed = bedOf(musicFile(dir, 8));
  const file = clipFile(dir, 'tone.mp4', { freq: 2000, level: 0.1 });
  const lows = 'lowpass=f=400';
  const bare = await mixed(dir, video, [bed], lows);
  const vo = await mixed(dir, video, [bed, clip(file, { at: 3, trimEnd: 2, role: 'vo' })], lows);
  assert.ok(Math.abs(rmsDb(vo, 1, 2) - rmsDb(bare, 1, 2)) < 0.2, 'the music is untouched before the clip');
  const ducked = rmsDb(vo, 3.5, 4.5) - rmsDb(bare, 3.5, 4.5);
  assert.ok(Math.abs(ducked + 18) < 1, `the music moved ${ducked} dB under the vo clip, wanted -18`);
  const plain = await mixed(dir, video, [bed, clip(file, { at: 3, trimEnd: 2 })], lows);
  assert.ok(Math.abs(rmsDb(plain, 3.5, 4.5) - rmsDb(bare, 3.5, 4.5)) < 0.2, 'a plain clip leaves the music alone');
}));

test('readPageAudio: <video> specs follow the <audio> ones; muted, silent and out-of-range rate add none', () => withDir(async ({ dir }) => {
  clipFile(dir, 'tone.mp4', { seconds: 4 });
  clipFile(dir, 'silent.mp4', { tone: false, seconds: 4 });
  const { specs, warned } = await readSpecs(dir,
    [[{ at: '0.5', gain: '-3' }, 'tone.mp4']],
    [[{ muted: '' }, 'tone.mp4'], [{ at: '1' }, 'silent.mp4'], [{ at: '1.5', rate: '9' }, 'tone.mp4'], [{ at: '2', trim: '1', role: 'vo', gain: '-4' }, 'tone.mp4']]);
  assert.deepEqual(specs.map((s) => [s.role, s.at, s.gain]), [['sfx', 0.5, -3], ['vo', 2, -4]]);
  assert.equal(specs[0].rate, undefined);
  assert.deepEqual([specs[1].rate, specs[1].trim, Math.round(specs[1].trimEnd)], [1, 1, 4]);
  assert.match(warned.join('\n'), /data-rate="9" is outside 0.25 to 4/);
}));
