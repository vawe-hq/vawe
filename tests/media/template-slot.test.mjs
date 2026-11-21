// A person's picture or clip goes into a template slot: resized, cropped from the centre, a video cut or looped to the span. Needs ffmpeg.
//   node --test tests/media/template-slot.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fillSlot, spanArgs, coverFilter } from '../../harness/media/template-slot.mjs';
import { probe } from '../../harness/media/footage.mjs';
import { ffmpegOrDie } from '../../harness/lib/scratch.mjs';
import { rawRgb } from '../../harness/lib/text-contrast.mjs';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'vawe-slot-'));

/** A 1000x400 picture: the left half red, the right half blue. */
function twoToneImage(dir) {
  const file = path.join(dir, 'two-tone.png');
  ffmpegOrDie(['-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=red:s=500x400', '-f', 'lavfi', '-i', 'color=c=blue:s=500x400', '-filter_complex', 'hstack', '-frames:v', '1', file], file, 'fixture image');
  return file;
}

function clip(dir, seconds) {
  const file = path.join(dir, `clip-${seconds}.mp4`);
  ffmpegOrDie(['-v', 'error', '-y', '-f', 'lavfi', '-i', `testsrc=s=200x100:r=25:d=${seconds}`, '-pix_fmt', 'yuv420p', file], file, 'fixture clip');
  return file;
}

const imageSlot = { key: 'screen-1', kind: 'image', size: '320x200', file: 'assets/slots/screen-1.png' };
const videoSlot = { key: 'clip-1', kind: 'video', size: '320x180', file: 'assets/slots/clip-1.mp4' };

test('coverFilter scales to cover the box, then crops the overflow', () => {
  assert.equal(coverFilter({ width: 320, height: 200 }), 'scale=320:200:force_original_aspect_ratio=increase,crop=320:200');
});

test('spanArgs loops a clip shorter than the span and always cuts at it', () => {
  assert.deepEqual(spanArgs(0.5, 3), { input: ['-stream_loop', '-1'], output: ['-t', '3'] });
  assert.deepEqual(spanArgs(5, 3), { input: [], output: ['-t', '3'] });
  assert.deepEqual(spanArgs(3, 3), { input: [], output: ['-t', '3'] });
  assert.deepEqual(spanArgs(5, undefined), { input: [], output: [] });
});

test('an image is cropped from the centre to the slot size', () => {
  const dir = tmp();
  try {
    const film = path.join(dir, 'film');
    const dest = fillSlot(film, { slot: imageSlot, path: twoToneImage(dir) });
    assert.equal(dest, path.join(film, 'assets/slots/screen-1.png'));
    const { width, height } = probe(dest);
    assert.deepEqual([width, height], [320, 200]);
    const rgb = rawRgb(fs.readFileSync(dest));
    const at = (x, y) => [...rgb.subarray((y * 320 + x) * 3, (y * 320 + x) * 3 + 3)];
    assert.ok(at(2, 100)[0] > 200 && at(2, 100)[2] < 60, `the left edge is red: ${at(2, 100)}`);
    assert.ok(at(317, 100)[2] > 200 && at(317, 100)[0] < 60, `the right edge is blue: ${at(317, 100)}`);
    assert.ok(at(160, 100)[0] > 100 || at(160, 100)[2] > 100, 'the cut is near the middle');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('a jpg slot is written as a jpg and a webp slot as a webp, at the slot size', () => {
  const dir = tmp();
  try {
    const src = twoToneImage(dir);
    for (const ext of ['jpg', 'webp']) {
      const dest = fillSlot(path.join(dir, 'film'), { slot: { ...imageSlot, size: '200x200', file: `assets/slots/a.${ext}` }, path: src });
      assert.deepEqual([probe(dest).width, probe(dest).height], [200, 200], ext);
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('a video longer than the span is cut, a shorter one is looped, and the size is the slot size with no sound', () => {
  const dir = tmp();
  try {
    const long = fillSlot(path.join(dir, 'a'), { slot: { ...videoSlot, span: 1 }, path: clip(dir, 3) });
    const probed = probe(long);
    assert.deepEqual([probed.width, probed.height, probed.hasAudio], [320, 180, false]);
    assert.ok(Math.abs(probed.seconds - 1) < 0.1, `cut to 1 s, got ${probed.seconds}`);
    const looped = fillSlot(path.join(dir, 'b'), { slot: { ...videoSlot, span: 3 }, path: clip(dir, 1) });
    assert.ok(Math.abs(probe(looped).seconds - 3) < 0.1, `looped to 3 s, got ${probe(looped).seconds}`);
    const whole = fillSlot(path.join(dir, 'c'), { slot: videoSlot, path: clip(dir, 2) });
    assert.ok(Math.abs(probe(whole).seconds - 2) < 0.1, 'no span keeps the length');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('a missing file is an error that names the slot, and a file that is not media fails loudly', () => {
  const dir = tmp();
  try {
    assert.throws(() => fillSlot(path.join(dir, 'film'), { slot: imageSlot, path: path.join(dir, 'nope.png') }), /slot screen-1: no such file/);
    const fake = path.join(dir, 'fake.png');
    fs.writeFileSync(fake, 'not a picture');
    assert.throws(() => fillSlot(path.join(dir, 'film'), { slot: imageSlot, path: fake }), /slot image/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
