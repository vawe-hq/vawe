import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { addFootage, logFootage, slugOf, standardRate, wordsOf } from '../../harness/media/footage.mjs';

const ffmpeg = (...args) => assert.equal(spawnSync('ffmpeg', ['-v', 'error', '-y', ...args], { encoding: 'utf8' }).status, 0);
const src = 'testsrc=size=320x180:rate=30:duration=2';

function fixtures() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vawe-footage-'));
  const clips = path.join(dir, 'clips');
  fs.mkdirSync(clips);
  ffmpeg('-f', 'lavfi', '-i', src, '-pix_fmt', 'yuv420p', path.join(clips, 'Beach Day.mp4'));
  ffmpeg('-f', 'lavfi', '-i', src, '-f', 'lavfi', '-i', 'sine=frequency=440:duration=2', '-shortest', '-pix_fmt', 'yuv420p', path.join(clips, 'talk.mov'));
  ffmpeg('-f', 'lavfi', '-i', src, '-vf', "select='lt(mod(n,10),6)'", '-fps_mode', 'vfr', '-pix_fmt', 'yuv420p', path.join(clips, 'phone.mp4'));
  return { dir, clips, film: path.join(dir, 'film') };
}

const packetTimes = (file) => spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'packet=pts_time', '-of', 'csv=p=0', file], { encoding: 'utf8' })
  .stdout.trim().split('\n').map(Number).sort((a, b) => a - b);
const hasAudio = (file) => spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=codec_name', '-of', 'csv=p=0', file], { encoding: 'utf8' }).stdout.includes('aac');

test('proxies are constant frame rate, sized to the clip length, with audio only when the source had it', () => {
  const { dir, clips, film } = fixtures();
  try {
    const out = addFootage(film, [clips], {});
    assert.deepEqual(out.map((c) => c.slug), ['beach-day', 'phone', 'talk']);
    for (const c of out) {
      const frames = packetTimes(c.file);
      assert.equal(frames.length, Math.round(c.seconds * c.fps), c.slug);
      const gaps = frames.slice(1).map((t, i) => +(t - frames[i]).toFixed(4));
      assert.ok(Math.max(...gaps) - Math.min(...gaps) < 0.002, `${c.slug} gaps ${Math.min(...gaps)}..${Math.max(...gaps)}`);
      assert.equal(hasAudio(c.file), c.slug === 'talk', c.slug);
      assert.equal(c.hasAudio, c.slug === 'talk');
    }
    assert.equal(out[0].fps, 30);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('a clip over the box is fitted without a crop, a smaller one is kept', () => {
  const { dir, clips, film } = fixtures();
  try {
    ffmpeg('-f', 'lavfi', '-i', 'testsrc=size=2560x1440:rate=10:duration=1', '-pix_fmt', 'yuv420p', path.join(clips, 'big.mp4'));
    const out = Object.fromEntries(addFootage(film, [path.join(clips, 'big.mp4'), path.join(clips, 'Beach Day.mp4')], {}).map((c) => [c.slug, c]));
    assert.deepEqual([out.big.width, out.big.height], [1920, 1080]);
    assert.deepEqual([out['beach-day'].width, out['beach-day'].height], [320, 180]);
    const full = addFootage(path.join(dir, 'film-full'), [path.join(clips, 'big.mp4')], { full: true })[0];
    assert.deepEqual([full.width, full.height], [2560, 1440]);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('two files with one slug get distinct slugs, and a second add keeps a fresh proxy', () => {
  const { dir, clips, film } = fixtures();
  try {
    fs.mkdirSync(path.join(dir, 'other'));
    const twin = path.join(dir, 'other', 'BEACH day.mp4');
    fs.copyFileSync(path.join(clips, 'Beach Day.mp4'), twin);
    const first = addFootage(film, [path.join(clips, 'Beach Day.mp4'), twin], {});
    assert.deepEqual(first.map((c) => c.slug), ['beach-day', 'beach-day-2']);
    assert.ok(first.every((c) => !c.skipped));
    const mtime = fs.statSync(first[0].file).mtimeMs;
    const again = addFootage(film, [twin, path.join(clips, 'Beach Day.mp4')], {});
    assert.deepEqual(again.map((c) => [c.slug, c.skipped]), [['beach-day-2', true], ['beach-day', true]]);
    assert.equal(fs.statSync(first[0].file).mtimeMs, mtime);
    const later = new Date(Date.now() + 5000);
    fs.utimesSync(path.join(clips, 'Beach Day.mp4'), later, later);
    assert.equal(addFootage(film, [path.join(clips, 'Beach Day.mp4')], {})[0].skipped, false);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('a missing input and a non-video file are refused with the name', () => {
  const { dir, film } = fixtures();
  try {
    assert.throws(() => addFootage(film, [path.join(dir, 'nope.mp4')], {}), /no such clip or folder/);
    fs.writeFileSync(path.join(dir, 'notes.txt'), 'x');
    assert.throws(() => addFootage(film, [path.join(dir, 'notes.txt')], {}), /not mp4, mov/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('footage.md has a row per clip with audio yes or no', () => {
  const { dir, clips, film } = fixtures();
  const outBefore = new Set(fs.readdirSync('out'));
  try {
    addFootage(film, [path.join(clips, 'talk.mov'), path.join(clips, 'Beach Day.mp4')], {});
    const md = fs.readFileSync(logFootage(film).path, 'utf8');
    assert.match(md, /^\| beach-day \| 2\.0\d \| 30 \| 320x180 \| no \| - \|$/m);
    assert.match(md, /^\| talk \| 2\.0\d \| 30 \| 320x180 \| yes \| -?\d+\.\d LUFS/m);
    assert.match(md, /^## talk$/m);
    assert.match(md, /Shots \(hard cuts only\): 1\. 0\.00-2\.0\d s/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    for (const f of fs.readdirSync('out')) if (!outBefore.has(f)) fs.rmSync(path.join('out', f), { force: true });
  }
});

test('slugOf, standardRate and wordsOf', () => {
  assert.equal(slugOf('/x/IMG_0042 (1).MOV', new Set()), 'img-0042-1');
  assert.equal(slugOf('/x/a.mp4', new Set(['a', 'a-2'])), 'a-3');
  assert.deepEqual(standardRate(29.87), [30000, 1001]);
  assert.deepEqual(standardRate(120), [60, 1]);
  assert.deepEqual(standardRate(18), [18, 1]);
  const json = { transcription: [{ text: ' hello', offsets: { from: 120, to: 480 } }, { text: ' [BLANK_AUDIO]', offsets: { from: 480, to: 900 } }, { text: ' world', offsets: { from: 900, to: 1400 } }] };
  assert.deepEqual(wordsOf(json), [{ word: 'hello', start: 0.12, end: 0.48 }, { word: 'world', start: 0.9, end: 1.4 }]);
});
