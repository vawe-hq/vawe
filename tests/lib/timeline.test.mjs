// harness/lib/timeline.mjs and harness/lib/audio-view.mjs: cue resolution with data-on, world lookup, rhythm flags, level at a time.
//   node --test tests/lib/timeline.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startOnSpans } from '../../harness/media/page-audio.mjs';
import { worldAt, worldRows, timelineOf, timelineLines } from '../../harness/lib/timeline.mjs';
import { parseSeconds, activeAt, fadeDb, levelDb, rmsDb, waveformSvg } from '../../harness/lib/audio-view.mjs';

const spans = [
  { id: 'a', start: 0, end: 1, readNeed: 0 },
  { id: 'b', start: 0.5, end: 2, readNeed: 1.2 },
  { id: 'c', start: 2, end: 5, readNeed: 0 },
  { id: 'gone', start: null, end: null, readNeed: 0 },
];
const spec = (o) => ({ synth: 'tap', at: 0, gain: -12, fadeIn: 0, fadeOut: 0, trim: 0, duck: null, role: 'sfx', on: null, ...o });

test('data-on moves a cue to the first second its world shows, plus data-at', () => {
  const specs = [spec({ on: 'world:b', at: 0.25 }), spec({ at: 3 })];
  assert.deepEqual(startOnSpans(specs, spans), []);
  assert.deepEqual(specs.map((s) => s.at), [0.75, 3]);
});

test('data-on names a bad form, an unknown world or a world that never shows', () => {
  assert.match(startOnSpans([spec({ on: 'b' })], spans)[0], /not world:<id>/);
  assert.match(startOnSpans([spec({ on: 'world:zz' })], spans)[0], /no world shows with that id \(worlds: a b c gone\)/);
  assert.match(startOnSpans([spec({ on: 'world:gone' })], spans)[0], /no world shows/);
});

test('worldAt takes the world that started last, and the last world owns the end', () => {
  assert.equal(worldAt(spans, 0.2), 'a');
  assert.equal(worldAt(spans, 0.7), 'b');
  assert.equal(worldAt(spans, 2), 'c');
  assert.equal(worldAt(spans, 5), 'c');
  assert.equal(worldAt(spans, 6), null);
});

test('a cut lasts until the next world starts', () => {
  assert.deepEqual(worldRows(spans).map((w) => [w.id, w.cut]), [['a', 0.5], ['b', 1.5], ['c', 3]]);
});

test('the rhythm line flags equal cuts and no slow cut with the board checks', () => {
  const t = (cuts) => timelineOf({ spans: cuts.map((c, i) => ({ id: `w${i}`, start: cuts.slice(0, i).reduce((a, b) => a + b, 0), end: cuts.slice(0, i + 1).reduce((a, b) => a + b, 0) })), specs: [], duration: 9, spectacle: null }).rhythm.advice;
  assert.deepEqual(t([0.6, 0.6, 0.6]), ['all 3 cuts last 0.6 s; vary them', 'no cut over 0.9 s; add one slow cut']);
  assert.deepEqual(t([0.5, 1.5, 0.7]), []);
});

test('the timeline puts the spectacle and every cue in its world, the bed apart', () => {
  const specs = [spec({ at: 0.75, on: 'world:b' }), spec({ synth: null, src: 'track.wav', role: 'music', at: 0, gain: -28 })];
  const t = timelineOf({ spans, specs, duration: 5, spectacle: 2.5 });
  assert.deepEqual(t.spectacle, { at: 2.5, world: 'c' });
  assert.deepEqual(t.cues.map((c) => [c.voice, c.at, c.world]), [['tap', 0.75, 'b']]);
  assert.deepEqual(t.bed.map((c) => c.voice), ['track.wav']);
  assert.ok(timelineLines(t).some((l) => l.includes('0.75 s  tap  -12 dB  world b')));
});

test('--at reads comma seconds and refuses anything else', () => {
  assert.deepEqual(parseSeconds('0.8, 2.75'), [0.8, 2.75]);
  assert.throws(() => parseSeconds('1,x'), /needs seconds/);
});

test('activeAt gives the cue offset, a looped bed wraps and a finished cue is gone', () => {
  const tracks = [{ spec: spec({ at: 1 }), seconds: 0.5 }, { spec: spec({ synth: null, src: 'track.wav', role: 'music', at: 0 }), seconds: 2 }];
  const at = (t) => activeAt(tracks, t, 6).map((h) => [h.voice, +h.into.toFixed(2), +h.offset.toFixed(2)]);
  assert.deepEqual(at(1.25), [['tap', 0.25, 0.25], ['track.wav', 1.25, 1.25]]);
  assert.deepEqual(at(3), [['track.wav', 3, 1]]);
});

test('level is the window RMS plus data-gain, and a fade-out lowers it', () => {
  const rate = 1000;
  const samples = new Float32Array(1000).fill(0.5);
  assert.equal(+rmsDb(samples, 0, 1000).toFixed(2), -6.02);
  const hit = { into: 0.5, length: 1, offset: 0.5 };
  assert.equal(levelDb({ samples, rate, spec: spec({ gain: -10 }), hit }), -16);
  assert.equal(levelDb({ samples, rate, spec: spec({ gain: -10, fadeOut: 1 }), hit }), -22);
  assert.equal(fadeDb(spec({ fadeIn: 1 }), 0.5, 3), -6.0205999132796245);
});

test('the waveform svg holds a line per world and a tick per cue', () => {
  const svg = waveformSvg({ samples: new Float32Array(4800).fill(0.1), rate: 48000, duration: 1, worlds: [{ id: 'one', start: 0 }, { id: 'two', start: 0.5 }], cues: [{ voice: 'tap', at: 0.5 }], title: 't' });
  assert.equal((svg.match(/class="world"/g) ?? []).length, 2);
  assert.equal((svg.match(/class="cue"/g) ?? []).length, 1);
  assert.match(svg, /two 0\.5/);
});
