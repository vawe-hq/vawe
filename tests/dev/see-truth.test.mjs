// The scorer's own maths and table on canned tool results. No renders.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  ORDER, PROBE_OFFSET, beatRows, cutsRows, cutsSeeRows, eventsSeeRows, eyeRows, flashRows, flashSeeRows, formatSummary, formatTable, groundRows, heights, lookRows, lookSeeRows, lumaOfL, motionRows,
  noTool, notAvailable, parseAudioAt, parseLook, parseLufs, parseStrip, parseVelocity, scoreRow, soundRows, summarise, typeRows,
} from '../../harness/dev/see-truth.mjs';

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '../fixtures/truth');
const truth = (name) => JSON.parse(fs.readFileSync(path.join(DIR, name, 'truth.json'), 'utf8'));
const statuses = (rows) => rows.map((x) => x.status);

test('every fixture has a page and a truth.json that names its tolerances', () => {
  for (const name of ORDER) {
    assert.ok(fs.existsSync(path.join(DIR, name, 'page.html')), `${name}/page.html`);
    const t = truth(name);
    assert.equal(t.fixture, name);
    assert.ok(Object.keys(t.tolerance).length > 0, `${name} tolerances`);
  }
});

test('scoreRow passes inside the tolerance and fails outside it', () => {
  const base = { fixture: 'x', measure: 'm', tool: 't', truth: 1, tolerance: 0.1 };
  assert.equal(scoreRow({ ...base, measured: 1.1 }).status, 'pass');
  const off = scoreRow({ ...base, measured: 1.2 });
  assert.equal(off.status, 'fail');
  assert.ok(Math.abs(off.error - 0.2) < 1e-9);
});

test('scoreRow fails a missing value and compares strings exactly', () => {
  const base = { fixture: 'x', measure: 'm', tool: 't', tolerance: 1 };
  assert.deepEqual([null, undefined, NaN].map((v) => scoreRow({ ...base, truth: 3, measured: v }).status), ['fail', 'fail', 'fail']);
  assert.equal(scoreRow({ ...base, truth: 'linear', measured: 'linear' }).status, 'pass');
  assert.equal(scoreRow({ ...base, truth: 'linear', measured: 'ease-out' }).status, 'fail');
});

test('summarise counts each status per fixture and in total', () => {
  const rows = [
    scoreRow({ fixture: 'a', measure: 'm', tool: 't', truth: 1, measured: 1, tolerance: 0 }),
    scoreRow({ fixture: 'a', measure: 'm', tool: 't', truth: 1, measured: 2, tolerance: 0 }),
    noTool('b', 'm', 1),
    notAvailable('b', 'm', 1, 'vawe look'),
  ];
  const s = summarise(rows);
  assert.deepEqual(s.byFixture.a, { pass: 1, fail: 1, 'no tool': 0, 'not available': 0 });
  assert.deepEqual(s.byFixture.b, { pass: 0, fail: 0, 'no tool': 1, 'not available': 1 });
  assert.equal(s.total.pass + s.total.fail + s.total['no tool'] + s.total['not available'], 4);
  assert.match(formatSummary(rows), /weakest: a 50%/);
});

test('formatTable prints the seven columns, signed error and a dash for a missing value', () => {
  const rows = [
    scoreRow({ fixture: 'cuts', measure: 'cut 1 second', tool: 'vawe spec', truth: 0.5, measured: 0.5333, tolerance: 0.0334 }),
    scoreRow({ fixture: 'cuts', measure: 'cut 2 second', tool: 'vawe spec', truth: 0.6, measured: null, tolerance: 0.0334 }),
    noTool('flash', 'flash event', 2),
  ];
  const lines = formatTable(rows).split('\n');
  assert.match(lines[0], /^measure\s+\| truth\s+\| measured\s+\| error\s+\| tolerance\s+\| result\s+\| tool$/);
  assert.match(lines[2], /cuts: cut 1 second\s+\| 0.5\s+\| 0.533\s+\| \+0.033\s+\| \+-0.033\s+\| pass\s+\| vawe spec/);
  assert.match(lines[3], /\| 0.6\s+\| -\s+\| -\s+\| \+-0.033\s+\| fail/);
  assert.match(lines[4], /\| 2\s+\| -\s+\| -\s+\| -\s+\| no tool\s+\| no tool$/);
});

test('lumaOfL inverts the CIE L of a grey', () => {
  assert.ok(Math.abs(lumaOfL(80.6) - 200) < 1);
  assert.ok(Math.abs(lumaOfL(94.8) - 240) < 1);
  assert.ok(Math.abs(lumaOfL(0)) < 1e-6);
});

test('heights scales the horizontal part by the aspect', () => {
  assert.ok(Math.abs(heights({ x: 0, y: 0 }, { x: 0.5, y: 0 }, 2) - 1) < 1e-9);
  assert.ok(Math.abs(heights({ x: 0.2, y: 0.1 }, { x: 0.2, y: 0.6 }, 1.78) - 0.5) < 1e-9);
});

test('parseVelocity reads start, settle, overshoot, peak speed and shape', () => {
  const text = [
    'velocity of x.html, 0.00 to 3.00 s, 361 samples (1080 px frame height)',
    '1. div#a',
    '  position: starts 0.50 s, peak 2.44 frame heights/s (2641 px/s) at 0.51 s, settles 1.40 s, overshoots its rest by 8%, ease-out',
    '  scale: still',
    '2. div#b',
    '  position: starts 1.75 s, peak 0.37 frame heights/s (400 px/s) at 1.88 s, settles 2.75 s, no overshoot, linear',
    '  scale: still',
  ].join('\n');
  const [a, b] = parseVelocity(text);
  assert.deepEqual(a.position, { moves: true, start: 0.5, peakPxPerS: 2641, settle: 1.4, overshootPct: 8, shape: 'ease-out' });
  assert.deepEqual(b.position, { moves: true, start: 1.75, peakPxPerS: 400, settle: 2.75, overshootPct: 0, shape: 'linear' });
  assert.equal(a.label, 'div#a');
});

test('parseVelocity marks a still element', () => {
  assert.equal(parseVelocity('1. div#c\n  position: still\n  scale: still')[0].position.moves, false);
});

test('parseStrip reads the motion line', () => {
  const text = '  motion: starts 0.50 s, peaks 0.93 at 0.50 s, settles 0.80 s; 1 burst\n';
  assert.deepEqual(parseStrip(text), { start: 0.5, settle: 0.8, bursts: 1 });
  assert.equal(parseStrip('no motion line'), null);
});

test('parseAudioAt and parseLufs read the audio verb text', () => {
  const text = 'mix as written: -20.6 LUFS, -6.8 dBTP\n0.6 s  world quiet\n  pluck: 0.10 s into 0.78 s, -11.8 dB\n1.6 s  world quiet\n  impact: 0.10 s into 0.83 s, -9.9 dB\n';
  assert.equal(parseLufs(text), -20.6);
  assert.deepEqual(parseAudioAt(text), [
    { at: 0.6, cues: [{ voice: 'pluck', into: 0.1 }] },
    { at: 1.6, cues: [{ voice: 'impact', into: 0.1 }] },
  ]);
});

test('cutsRows pass on exact results and fail on a lost short world', () => {
  const t = truth('cuts');
  const timeline = { worlds: t.truth.worlds.map((w) => ({ id: w.id, start: w.start, end: w.end })) };
  const frame = (s) => Math.round(s * 30);
  const spec = {
    cuts: t.truth.cuts.map((c) => ({ t: c, frame: frame(c) })),
    shots: t.truth.worlds.map((w, i) => ({ index: i + 1, t0: w.start, t1: w.end })),
  };
  assert.ok(cutsRows(t, { spec, timeline }).every((x) => x.status === 'pass'));
  const lost = { worlds: timeline.worlds.filter((w) => w.id !== 'w2') };
  const rows = cutsRows(t, { spec, timeline: lost });
  assert.equal(rows.find((x) => x.measure === 'world count' && x.tool === 'vawe see --plan').status, 'fail');
  assert.equal(rows.find((x) => x.measure === 'world w2 duration' && x.tool === 'vawe see --plan').status, 'fail');
});

test('cutsRows with no tool result fail instead of throwing', () => {
  assert.ok(statuses(cutsRows(truth('cuts'), { spec: null, timeline: null })).every((s) => s === 'fail'));
});

test('flashRows read length from the cut pair and peak from the shot colour', () => {
  const t = truth('flash');
  const spec = {
    cuts: [{ frame: 24, t: 0.8 }, { frame: 26, t: 0.867 }, { frame: 54, t: 1.8 }, { frame: 57, t: 1.9 }],
    shots: [{ index: 2, f0: 24 }, { index: 4, f0: 54 }],
    colour: { perShot: [{ shot: 2, dominant: [80.6, 0, 0] }, { shot: 4, dominant: [94.8, 0, 0] }] },
  };
  const rows = flashRows(t, { spec });
  assert.deepEqual(statuses(rows), Array(6).fill('pass').concat('no tool'));
});

test('motionRows score the velocity, spec and frame results against the truth', () => {
  const t = truth('motion');
  const velocity = [
    { label: 'div#a', position: { moves: true, start: 0.5, settle: 1.4, overshootPct: 8, peakPxPerS: 2641, shape: 'ease-out' } },
    { label: 'div#b', position: { moves: true, start: 1.75, settle: 2.75, overshootPct: 0, peakPxPerS: 400, shape: 'linear' } },
  ];
  const spec = { shots: [{ elements: [
    { axis: 'x', start: { t: 0.5 }, land: { t: 1.467 }, overshoot: 1.08, to: [379.5, 100], easing: { class: 'bezier' } },
    { axis: 'x', start: { t: 1.75 }, land: { t: 2.75 }, overshoot: 1, to: [200, 250], easing: { class: 'linear' } },
  ] }] };
  const rows = motionRows(t, { velocity, spec, stripA: { start: 0.5, settle: 0.8, bursts: 1 }, stripB: { start: 1.75, settle: 2.75, bursts: 1 } });
  const by = (m, tool) => rows.find((x) => x.measure === m && x.tool.includes(tool));
  assert.equal(by('A settle second', 'velocity').status, 'pass');
  assert.equal(by('A overshoot (points of travel)', 'spec').status, 'pass');
  assert.equal(by('A settle second', '--moment <s> (mp4)').status, 'fail');
  assert.equal(by('B ease shape', 'spec').status, 'pass');
  assert.equal(rows.at(-1).status, 'no tool');
});

test('eyeRows measure the error in frame heights and the cut travel', () => {
  const t = truth('eye');
  const perShot = t.truth.shots.map((s) => ({ t0: s.t0, start: s.start, end: s.end, travel: heights(s.start, s.end, t.aspect) }));
  const cuts = [1, 2].map((i) => ({ at: t.truth.shots[i].t0, jump: heights(t.truth.shots[i - 1].end, t.truth.shots[i].start, t.aspect) }));
  assert.ok(eyeRows(t, { spec: { eye: { perShot, cuts } } }).every((x) => x.status === 'pass'));
  const bad = perShot.map((p) => ({ ...p, start: { x: 0.9, y: 0.9 } }));
  assert.ok(eyeRows(t, { spec: { eye: { perShot: bad, cuts } } }).some((x) => x.status === 'fail'));
  assert.equal(eyeRows(t, { spec: { eye: { perShot, cuts: [] } } }).filter((x) => x.status === 'fail').length, 2);
});

test('groundRows compare the ground colour, the cut deltaE and the drift', () => {
  const t = truth('ground');
  const perShot = t.truth.shots.map((s) => ({ t0: s.t0, start: s.lab, lightDrift: s.driftL ?? null }));
  const cuts = t.truth.cutDeltaE.map((dE, i) => ({ at: t.truth.shots[i + 1].t0, dE }));
  assert.ok(groundRows(t, { spec: { ground: { perShot, cuts } } }).every((x) => x.status === 'pass'));
  const missing = groundRows(t, { spec: { ground: { perShot: perShot.slice(0, 3), cuts: cuts.slice(0, 2) } } });
  assert.equal(missing.find((x) => x.measure === 'cut 3 deltaE').status, 'fail');
});

test('typeRows turn frames into seconds and the box height into a fraction of the frame', () => {
  const t = truth('type');
  const text = t.truth.words.map((w) => ({ text: w.text, f0: Math.round(w.in * 30), f1: Math.round(w.out * 30), boxHeightPx: 0.1347 * 540 }));
  const spec = { fps: 30, media: { height: 540 }, shots: [{ text }] };
  assert.ok(typeRows(t, { spec }).every((x) => x.status === 'pass'));
  assert.ok(typeRows(t, { spec: null }).every((x) => x.status === 'fail'));
});

test('soundRows read cue starts from the probes, the timeline, the mp4 hits and the loudness', () => {
  const t = truth('sound');
  const audioAt = t.truth.cues.map((c) => ({ at: c.at + PROBE_OFFSET, cues: [{ voice: c.voice, into: PROBE_OFFSET }] }));
  const timeline = { cues: t.truth.cues.map((c) => ({ voice: c.voice, at: c.at })) };
  const spec = { fps: 30, audio: { hits: t.truth.cues.map((c) => ({ t: c.at + 0.005 })) } };
  assert.ok(soundRows(t, { audioAt, lufs: -20.6, timeline, spec }).every((x) => x.status === 'pass'));
  const late = { fps: 30, audio: { hits: t.truth.cues.map((c) => ({ t: c.at + 0.08 })) } };
  assert.ok(soundRows(t, { audioAt, lufs: -20.6, timeline, spec: late }).some((x) => x.status === 'fail'));
});

test('parseLook reads the glow sigma, the signed offset and the stripe period from the look table', () => {
  const text = [
    'bloom 90 to 10% (px)         | 16 (gaussian sigma about 12.5; 11080 edges)',
    'chromatic offset B minus R   | median dx -4.4 px, dy 0 px; 81% of 9502 edges off by 1 px or more',
    'screen texture               | vertical stripes, period 3 px, RGB-striped (channels 75 deg apart)',
  ].join('\n');
  assert.deepEqual(parseLook(text), { bloomSigma: 12.5, offset: 4.4, stripePeriod: 3 });
  assert.deepEqual(parseLook('nothing'), { bloomSigma: null, offset: null, stripePeriod: null });
});

test('lookRows grade the look measures against the truth, and a missing reading fails', () => {
  assert.deepEqual(statuses(lookRows(truth('look'), { look: { bloomSigma: 12.5, offset: 4.4, stripePeriod: 3 } })), Array(3).fill('pass'));
  assert.deepEqual(statuses(lookRows(truth('look'), { look: null })), Array(3).fill('fail'));
});

test('see rows pass on the values of the truth and fail on a missing see.json', () => {
  const t = truth('cuts');
  const a = { structure: { cuts: t.truth.cuts.map((at) => ({ at })), shots: t.truth.worlds.map((w) => ({ start: w.start, length: w.end - w.start })), worlds: t.truth.worlds }, media: { height: 540 } };
  assert.ok(cutsSeeRows(t, { a, p: a }).every((x) => x.status === 'pass'));
  assert.ok(cutsSeeRows(t, { a: null, p: null }).every((x) => x.status === 'fail'));
});

test('the flash event row needs the flashes counted and no cut left over', () => {
  const t = truth('flash');
  const flashes = t.truth.flashes.map((f) => ({ at: f.start, frames: f.frames, peakLuma: f.peakLuma }));
  assert.ok(flashSeeRows(t, { a: { structure: { cuts: [] }, look: { flashes } } }).every((x) => x.status === 'pass'));
  const row = flashSeeRows(t, { a: { structure: { cuts: [{ at: 0.8 }] }, look: { flashes } } }).at(-1);
  assert.equal(row.status, 'fail');
});

test('lookSeeRows read the sigma, the offset and the stripe period of see.json', () => {
  const a = { look: { film: { bloom: { sigma: 12.5 }, chroma: { dx: -4.4, dy: 0 }, texture: { striped: true, period: 3.01 } } } };
  assert.deepEqual(statuses(lookSeeRows(truth('look'), { a })), Array(3).fill('pass'));
});

test('beatRows passes a sound.json that matches the truth and fails a wrong verdict', () => {
  const t = truth('beat');
  const sound = { tempo: { bpm: 100.4 }, grid: [{ kind: 'beat', t: 0.3 }], onsets: t.truth.hits.map((h) => ({ attack: h + 0.002 })),
    cuts: { rows: t.truth.cuts.map((c) => ({ verdict: c.verdict, frames: -c.frames })) }, cues: [{ voice: t.truth.cue.voice, at: t.truth.cue.at }] };
  assert.ok(statuses(beatRows(t, { sound })).every((s) => s === 'pass'));
  sound.cuts.rows[2].verdict = 'on beat';
  assert.equal(beatRows(t, { sound }).filter((x) => x.status === 'fail').length, 1);
  assert.ok(beatRows(t, { sound: null }).every((x) => x.status === 'fail'));
});

test('eventsSeeRows score each event second, its sound offset and verdict, and the sounds with no action', () => {
  const t = truth('events');
  const a = { shots: [{ events: [
    { t: 1.033, sound: { t: 1.005, label: 'pop', frames: -0.8 }, verdict: 'sound on the frame' },
    { t: 2.233, sound: { t: 2.305, label: 'pop', frames: 2.2 }, verdict: 'sound near' },
  ] }], sound: { events: { soundsWithoutAction: [{ t: 3.604, label: 'pop' }] } } };
  assert.ok(eventsSeeRows(t, { a }).every((x) => x.status === 'pass'));
  const late = { ...a, shots: [{ events: [{ ...a.shots[0].events[0], sound: { t: 1.2, label: 'pop', frames: 6 }, verdict: 'sound off' }, a.shots[0].events[1]] }] };
  const rows = eventsSeeRows(t, { a: late });
  assert.equal(rows.find((x) => x.measure.endsWith('box A appears: verdict')).status, 'fail');
  assert.ok(eventsSeeRows(t, { a: null }).every((x) => x.status === 'fail'));
});
