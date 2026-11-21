// The light template export: when a layer is a PNG sequence, what the options mean, and how both timelines name a sequence. Pure.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as acorn from 'acorn';
import { chooseFormat, LONG_SECONDS } from '../../harness/media/template-clips.mjs';
import { blurFor, readArgs, FULL_BLUR } from '../../harness/media/template-export.mjs';
import { posterTime } from '../../harness/media/poster.mjs';
import { premiereXml } from '../../harness/lib/premiere-xml.mjs';
import { aeJsx } from '../../harness/lib/ae-jsx.mjs';
import { referencedFiles, xmlFiles, MEDIA_ROOT } from '../../harness/lib/template-refs.mjs';
import { templateReadme } from '../../harness/lib/template-readme.mjs';

const MB = 1 << 20;

test('a moving layer is a PNG sequence when it is at most half the ProRes size, else ProRes', () => {
  const base = { frames: 150, fps: 30, movBytes: 100 * MB };
  assert.equal(chooseFormat({ ...base, sequenceBytes: 5 * MB }), 'sequence');
  assert.equal(chooseFormat({ ...base, sequenceBytes: 50 * MB }), 'sequence', 'exactly half is still a sequence');
  assert.equal(chooseFormat({ ...base, sequenceBytes: 50 * MB + 1 }), 'prores');
  assert.equal(chooseFormat({ ...base, sequenceBytes: 120 * MB }), 'prores', 'a sequence larger than ProRes never wins');
});

test('a layer over 20 s is ProRes however small its PNGs are', () => {
  assert.equal(LONG_SECONDS, 20);
  assert.equal(chooseFormat({ frames: 600, fps: 30, sequenceBytes: 1, movBytes: 100 * MB }), 'sequence', '20 s exactly');
  assert.equal(chooseFormat({ frames: 601, fps: 30, sequenceBytes: 1, movBytes: 100 * MB }), 'prores');
});

test('the blur is what was asked for, else 1 when light and 32 when not', () => {
  assert.equal(FULL_BLUR, 32);
  assert.equal(blurFor(null, false), 32);
  assert.equal(blurFor(null, true), 1);
  assert.equal(blurFor(8, true), 8);
  assert.equal(blurFor(1, false), 1);
});

test('readArgs reads the light, blur and poster options and refuses bad ones', () => {
  const light = readArgs(['p.html', '--light']);
  assert.deepEqual([light.light, light.blur, light.fps, light.poster, light.posterOnly], [true, null, 30, null, false]);
  assert.equal(readArgs(['p.html']).light, false);
  assert.equal(readArgs(['p.html', '--light', '--blur', '4']).blur, 4);
  const poster = readArgs(['--poster', 'out/poster.webp', 'p.html', '--poster-at', '2.5', '--poster-only']);
  assert.deepEqual([poster.pagePath, poster.poster, poster.posterAt, poster.posterOnly], ['p.html', 'out/poster.webp', 2.5, true]);
  for (const [argv, want] of [
    [['p.html', '--blur', '0'], /--blur must be a whole number/],
    [['p.html', '--blur', 'x'], /--blur must be a whole number/],
    [['p.html', '--fps', '100'], /--fps must be a whole number from 1 to 99/],
    [['p.html', '--poster'], /--poster needs the webp file/],
    [['p.html', '--poster-at', '-1', '--poster', 'a.webp'], /--poster-at must be seconds/],
    [['p.html', '--poster-only'], /--poster-only needs --poster/],
    [['--light'], /usage:/],
  ]) assert.throws(() => readArgs(argv), want, argv.join(' '));
});

test('the poster is the spectacle second when it lies in the film, else 60% of the length', () => {
  assert.equal(posterTime('2.5', 5), 2.5);
  assert.equal(posterTime('0', 5), 0);
  assert.equal(posterTime(undefined, 5), 3);
  assert.equal(posterTime(null, 5), 3);
  assert.equal(posterTime('', 5), 3);
  assert.equal(posterTime('9', 5), 3, 'past the end');
  assert.equal(posterTime('5', 5), 3, 'the end is not a frame');
  assert.equal(posterTime('soon', 12.4), 7.44);
});

const clips = [
  { name: '01-world-a', file: '01-world-a/01-world-a_00001.png', start: 0, end: 30, blend: 'normal', sequence: true },
  { name: '02-world-b', file: '02-world-b.mov', start: 0, end: 30, blend: 'normal', sequence: false },
  { name: '03 odd #name', file: '03 odd #name.png', start: 0, end: 30, blend: 'normal' },
];
const seq = { name: 'film', width: 1920, height: 1080, fps: 30, frames: 30, markers: [] };

test('the XML names a sequence by its first frame under media/, with the file name as the clip name', () => {
  const xml = premiereXml({ ...seq, mediaRoot: MEDIA_ROOT, video: clips, audio: [] });
  assert.ok(xml.includes('<pathurl>file://localhost/vawe-template/media/01-world-a/01-world-a_00001.png</pathurl>'));
  assert.ok(xml.includes('<name>01-world-a_00001.png</name>'));
  assert.deepEqual(xmlFiles(xml), ['01-world-a/01-world-a_00001.png', '02-world-b.mov', '03 odd #name.png']);
});

test('the script imports a sequence as one footage item and a movie as it was; the ES3 still parses', () => {
  const jsx = aeJsx({ ...seq, stack: clips.map((c) => ({ kind: 'clip', ...c })), audio: [] });
  assert.doesNotThrow(() => acorn.parse(jsx, { ecmaVersion: 3 }));
  assert.match(jsx, /options\.sequence = true/);
  const plan = JSON.parse(/var PLAN = (.*);\n/.exec(jsx)[1]);
  assert.deepEqual(plan.stack.map((c) => c.sequence), [true, false, false]);
  assert.deepEqual(referencedFiles(premiereXml({ ...seq, mediaRoot: MEDIA_ROOT, video: clips, audio: [] }), jsx), ['01-world-a/01-world-a_00001.png', '02-world-b.mov', '03 odd #name.png']);
});

test('the README says what a PNG sequence is, and keeps the ProRes line when there is none', () => {
  const info = (layers) => ({ ...seq, layers, texts: [], audio: { mix: null, cues: [] }, skipped: [], notes: [] });
  const light = templateReadme(info(clips.map((c) => ({ ...c, blendVaries: false })))).split('\n').join(' ');
  assert.match(light, /numbered PNG pictures/);
  assert.match(light, /01-world-a\/ \(PNG sequence\)/);
  assert.match(light, /tick "Image Sequence"/);
  const full = templateReadme(info([{ ...clips[1], blendVaries: false }])).split('\n').join(' ');
  assert.match(full, /Every picture clip is Apple ProRes 4444/);
  assert.doesNotMatch(full, /Image Sequence/);
});
