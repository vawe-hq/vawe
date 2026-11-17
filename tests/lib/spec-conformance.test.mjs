import test from 'node:test';
import assert from 'node:assert/strict';
import { specTimes, settleTimes, unmeasuredWords, runStart, lineFor, findable, skippedWords, wordTimes, wordChecks, objectChecks, measuredSpec, cutChecks, cutSpans, checkLines, checkAdvice, APPEAR_TOL_S, LAYOUT_TOL_PCT } from '../../harness/lib/spec-conformance.mjs';

const frame = { frameW: 1000, frameH: 500 };
const word = { text: 'Ship it', appear: 1, settle: 1.5, cap: 8, x: 10, y: 40 };
const FRAME_S = 1 / 30;

test('specTimes: every frame of the film, only when objects are named', () => {
  assert.deepEqual(specTimes({ objects: [] }, 2).boxes, []);
  const o = specTimes({ words: [], objects: [{ in: 1 }] }, 1);
  assert.equal(o.boxes.length, 31);
  assert.equal(o.boxes[30], 1);
});

test('runStart: the first frame of the run is found whatever the hint is, and repeats', async () => {
  const on = (t) => t >= 2.5 - 1e-9;
  for (const hint of [0, 1, 2.25, 2.5, 2.75, 5, 9.9]) {
    const first = await runStart(on, hint, { dur: 10 });
    assert.ok(Math.abs(first - 2.5) <= FRAME_S, `hint ${hint} gave ${first}`);
    assert.equal(await runStart(on, first, { dur: 10 }), first);
  }
});

test('runStart: copying the measured time back into the spec does not move it', async () => {
  const on = (t) => t >= 3.4 - 1e-9;
  let spec = 4;
  const seen = [];
  for (let i = 0; i < 4; i++) { spec = await runStart(on, spec, { dur: 10 }); seen.push(spec); }
  assert.equal(new Set(seen).size, 1);
});

test('runStart: picks the run nearest the hint, null when nothing starts, 0 when on from the start', async () => {
  const blink = (t) => (t >= 1 && t < 2) || t >= 6;
  assert.ok(Math.abs(await runStart(blink, 1.5, { dur: 10 }) - 1) <= FRAME_S);
  assert.ok(Math.abs(await runStart(blink, 4, { dur: 10 }) - 6) <= FRAME_S);
  assert.equal(await runStart(() => false, 3, { dur: 10 }), null);
  assert.equal(await runStart(() => true, 3, { dur: 10 }), 0);
});

test('lineFor: a word split into spans is found in the element text, spaces ignored', () => {
  const sample = { lines: [{ text: 'H', box: [0, 0, 10, 10], fontPx: 40 }, { text: 'i', box: [10, 0, 10, 10], fontPx: 40 }], blocks: [{ text: 'Hi there', box: [0, 0, 80, 10], fontPx: 40 }] };
  assert.equal(lineFor(sample, 'hi there').text, 'Hi there');
  assert.equal(lineFor(sample, 'HiThere').text, 'Hi there');
  assert.equal(lineFor(sample, 'nope'), null);
  assert.equal(lineFor({ lines: [{ text: 'Ship it' }, { text: 'Ship it now' }] }, 'ship it').text, 'Ship it');
});

test('findable: a word under 2 letters or only punctuation is skipped with a note', () => {
  assert.ok(findable('Go') && findable('v2') && !findable('.') && !findable('A') && !findable('...') && !findable(' - '));
  assert.deepEqual(skippedWords([{ text: 'Go' }, { text: '.' }, { text: 'a' }]), ['.', 'a']);
  assert.deepEqual(wordChecks([{ text: '.', appear: 1 }], [], frame, [{ appear: null }]), []);
  assert.deepEqual(settleTimes([{ text: '.' }], [{ appear: 1, settle: 1 }]), []);
});

// a word whose letters are separate spans: every letter must show before the word counts
const fadeIn = (at) => async (t) => ({ lines: t >= at ? [{ text: 'Ship it', fontPx: 57.14, box: [100, 200, 300, 60] }] : [], blocks: [] });

test('wordTimes: a word that appears at 2.50 s measures 2.50 within a frame, whatever the spec says', async () => {
  const linesAt = fadeIn(2.5 - 1e-9);
  for (const appear of [0.5, 2.5, 2.25, 8]) {
    const { appear: got } = await wordTimes({ text: 'Ship it', appear }, linesAt, { dur: 12, frame });
    assert.ok(Math.abs(got - 2.5) <= FRAME_S, `spec ${appear} gave ${got}`);
  }
});

test('wordTimes: settle is the first frame the box stops moving', async () => {
  const linesAt = async (t) => ({ lines: [{ text: 'Ship it', fontPx: 40, box: [t < 2 ? 100 + (2 - t) * 300 : 100, 200, 300, 60] }], blocks: [] });
  const { settle } = await wordTimes({ text: 'Ship it', appear: 0.5, settle: 2.4 }, linesAt, { dur: 5, frame });
  assert.ok(Math.abs(settle - 2) <= 2 * FRAME_S, `settle ${settle}`);
});

test('wordTimes: settle is the same whatever the brief says, so a synced brief never moves it', async () => {
  const linesAt = async (t) => ({ lines: [{ text: 'Ship it', fontPx: 40, box: [t < 2 ? 100 + (2 - t) * 300 : 100, 200, 300, 60] }], blocks: [] });
  for (const spec of [0.6, 1, 1.5, 2.4, 4]) {
    const { settle } = await wordTimes({ text: 'Ship it', appear: 0.5, settle: spec }, linesAt, { dur: 5, frame });
    assert.ok(Math.abs(settle - 2) <= 2 * FRAME_S, `spec ${spec} gave ${settle}`);
  }
});

test('wordChecks: appear time from the measure, then cap height and position at settle', () => {
  // 1% of a 500 px frame is 5 px; fontPx 57.14 gives cap 0.7 * 57.14 / 500 = 8%
  const samples = [{ t: 1.5, lines: [{ text: 'Ship it', fontPx: 57.14, box: [100, 200, 300, 60] }] }];
  const checks = wordChecks([word], samples, frame, [{ appear: 1.03, settle: 1.5 }]);
  assert.deepEqual(checks.map((c) => [c.label, +c.dev.toFixed(2)]), [['"Ship it" appears', 0.03], ['"Ship it" cap height at 1.5 s', 0], ['"Ship it" x (left) at 1.5 s', 0], ['"Ship it" y (top) at 1.5 s', 0]]);
  assert.deepEqual(checkLines(checks, APPEAR_TOL_S), []);
});

test('wordChecks: late text and a wrong size are named with spec and film values', () => {
  const samples = [{ t: 1.5, lines: [{ text: 'Ship it', fontPx: 35, box: [150, 200, 300, 60] }] }];
  const checks = wordChecks([word], samples, frame, [{ appear: 1.2, settle: 1.5 }]);
  const lines = [...checkLines(checks.filter((c) => c.unit === 's'), APPEAR_TOL_S), ...checkLines(checks.filter((c) => c.unit === '%'), LAYOUT_TOL_PCT)];
  assert.deepEqual(lines, ['"Ship it" appears: spec 1.00 s, film 1.20 s', '"Ship it" cap height at 1.5 s: spec 8.0%, film 4.9%', '"Ship it" x (left) at 1.5 s: spec 10.0%, film 15.0%']);
});

test('wordChecks: a word that never shows is not found, and has no layout checks to fail', () => {
  const checks = wordChecks([word], [], frame, [{ appear: null, settle: null }]);
  assert.deepEqual(checks.map((c) => c.label), ['"Ship it" appears']);
  assert.match(checkLines(checks, APPEAR_TOL_S)[0], /not found within the sampled window/);
  assert.deepEqual(unmeasuredWords([word, { text: 'Go' }], [{ appear: null, settle: null }, { appear: 1, settle: null }]), { unseen: ['Ship it'], moving: ['Go'] });
});

// bench title-sting: a centred 1920x1080 title written as x 50, y 44, cap 16 (its left edge is 28.8%, its top 28.3%)
const centred = { t: 0.97, lines: [], blocks: [{ text: 'Ember', fontPx: 259.2, box: [553, 306, 814, 324] }] };
const ember = { text: 'Ember', appear: 0.5, cap: 16, x: 50, y: 44 };

test('wordChecks: x and y name the nearest of left, centre, right and top, middle, bottom, so a centred word written as 50 passes', () => {
  const checks = wordChecks([ember], [centred], { frameW: 1920, frameH: 1080 }, [{ appear: 0.53, settle: 0.97, whole: true }]);
  assert.deepEqual(checks.filter((c) => c.unit === '%').map((c) => [c.label, c.dev <= LAYOUT_TOL_PCT]), [['"Ember" cap height at 0.97 s', true], ['"Ember" x (centre) at 0.97 s', true], ['"Ember" y (middle) at 0.97 s', true]]);
});

test('wordChecks: a word really off its spec stays out on every edge', () => {
  const checks = wordChecks([{ ...ember, x: 60 }], [centred], { frameW: 1920, frameH: 1080 }, [{ appear: 0.53, settle: 0.97, whole: true }]);
  assert.deepEqual(checkLines(checks.filter((c) => c.unit === '%'), LAYOUT_TOL_PCT), ['"Ember" x (centre) at 0.97 s: spec 60.0%, film 50.0%']);
});

test('wordChecks: top and bottom are the ink (cap top, baseline) when the line carries its font metrics, so the font ascent never moves a word off its spec', () => {
  const inked = { t: 0.97, lines: [], blocks: [{ text: 'Ember', fontPx: 259.2, ink: { top: 0.278, bottom: 0.255 }, box: [553, 306, 814, 324] }] };
  const y = wordChecks([{ ...ember, y: 35 }], [inked], { frameW: 1920, frameH: 1080 }, [{ appear: 0.53, settle: 0.97, whole: true }]).at(-1);
  assert.equal(y.label, '"Ember" y (top) at 0.97 s');
  assert.ok(Math.abs(y.got - 35.0) < 0.05 && y.dev < 0.05, `${y.got}`);
  const [bare] = wordChecks([{ ...ember, y: 28.3 }], [centred], { frameW: 1920, frameH: 1080 }, [{ appear: 0.53, settle: 0.97, whole: true }]).slice(-1);
  assert.ok(bare.dev < 0.05, 'a line without ink falls back to its text box');
});

test('wordChecks: a miss names the CSS that closes it', () => {
  const lunch = { t: 4.367, lines: [{ text: 'LUNCH.', fontPx: 388.8, box: [100, 400, 1500, 330] }], blocks: [] };
  const checks = wordChecks([{ text: 'LUNCH.', appear: 3.6, cap: 30, x: 5.2, y: 40 }], [lunch], { frameW: 1920, frameH: 1080 }, [{ appear: 3.6, settle: 4.367, whole: false }]);
  assert.match(checks.find((c) => c.label.includes('cap height')).fix, /from calc\(var\(--vh\) \* 0\.360\) to calc\(var\(--vh\) \* 0\.429\)/);
  assert.match(checks.find((c) => c.label.includes('x (left)')).fix, /^move it left by calc\(var\(--vw\) \* 0\.000\)|^move it right by/);
  assert.match(checkAdvice(checks.find((c) => c.label.includes('cap height'))), /^"LUNCH\." cap height at 4\.367 s: spec 30\.0%, film 25\.2%: set its font-size/);
});

test('settleTimes: one sample per distinct measured settle, none for a word that never rests', () => {
  assert.deepEqual(settleTimes([word, { text: 'Go now' }, { text: 'Hi there' }, { text: 'Gone' }], [{ settle: 2.4 }, { settle: 1.1 }, { settle: 2.4 }, { settle: null }]), [1.1, 2.4]);
});

test('lineFor: a short word is never found inside another word, and prefers the element that holds only it', () => {
  const sample = { lines: [{ text: 'Ship', box: [0, 0, 1, 1] }, { text: 'marlo.studio', box: [0, 0, 1, 1] }, { text: 'Marlo', box: [0, 0, 1, 1] }], blocks: [] };
  assert.equal(lineFor(sample, 'it'), null);
  assert.equal(lineFor({ lines: [{ text: 'Ship it before lunch.' }], blocks: [] }, 'it').text, 'Ship it before lunch.');
  assert.equal(lineFor({ lines: [{ text: 'marlo.studio' }, { text: 'Marlo' }] }, 'marlo').text, 'Marlo');
  assert.equal(lineFor({ lines: [{ text: 'marlo.studio' }] }, 'marlo').text, 'marlo.studio');
  assert.equal(lineFor({ lines: [{ text: 'marlo.studio' }] }, 'marlo', { whole: true }), null);
});

test('wordTimes: the word is measured on the element that holds only it, not on a line that merely contains it', async () => {
  const linesAt = async (t) => ({ lines: [{ text: 'marlo.studio', fontPx: 12, box: [10, 460, 100, 14] }, ...(t >= 2 ? [{ text: 'Marlo', fontPx: 100, box: [200, 100, 400, 120] }] : [])], blocks: [] });
  const got = await wordTimes({ text: 'marlo', appear: 0.2 }, linesAt, { dur: 5, frame });
  assert.ok(Math.abs(got.appear - 2) <= FRAME_S && got.whole, JSON.stringify(got));
  assert.ok(got.settle >= got.appear && got.settle < 2.5, JSON.stringify(got));
});

test('wordTimes: a word parked half out of the frame is not at rest until it is fully inside', async () => {
  const linesAt = async (t) => ({ lines: [{ text: 'Ship it', fontPx: 40, box: [100, t < 2 ? 470 : 200, 300, 60] }], blocks: [] });
  const { appear, settle } = await wordTimes({ text: 'Ship it' }, linesAt, { dur: 5, frame });
  assert.equal(appear, 0);
  assert.ok(settle >= 2 - FRAME_S, `settle ${settle}`);
});

test('wordTimes: a word with no times in the brief is still measured', async () => {
  const linesAt = async (t) => ({ lines: t >= 1 ? [{ text: 'Ship it', fontPx: 40, box: [100, 200, 300, 60] }] : [], blocks: [] });
  const got = await wordTimes({ text: 'Ship it' }, linesAt, { dur: 5, frame });
  assert.ok(Math.abs(got.appear - 1) <= FRAME_S && got.settle >= got.appear && got.settle < 1.5, JSON.stringify(got));
});

// a dense box track: one box per frame of a 4 s film
function boxes(o, alphaFrom, restFrom) {
  const times = specTimes({ objects: [o] }, 4).boxes;
  const track = times.map((t) => [t < restFrom ? 100 + (restFrom - t) * 200 : 100, 50, 80, 80, t >= alphaFrom ? 1 : 0, 1]);
  return { times, tracks: [track], matched: [0] };
}

test('objectChecks: in, settle and out are read from the box track', async () => {
  const o = { id: 'mark', selector: '.mark', in: 0.3, settle: 0.9, out: 2 };
  const checks = await objectChecks([o], boxes(o, 0.3, 0.9), frame);
  assert.deepEqual(checks.map((c) => [c.label, c.got]), [['mark in', 0.3], ['mark settle', 0.9], ['mark out', null]]);
  assert.equal(checks[0].dev, 0);
});

test('objectChecks: an object that rests long before its spec settle time is measured at its true rest, not at a window edge', async () => {
  const o = { id: 'mark', selector: '.mark', in: 0.3, settle: 3, out: 3.9 };
  const track = boxes(o, 0.3, 0.9);
  const first = (await objectChecks([o], track, frame)).find((c) => c.label === 'mark settle').got;
  assert.ok(Math.abs(first - 0.9) <= FRAME_S);
  const again = (await objectChecks([{ ...o, settle: first }], track, frame)).find((c) => c.label === 'mark settle').got;
  assert.equal(again, first);
});

test('objectChecks: a missing selector is reported', async () => {
  const checks = await objectChecks([{ id: 'x', selector: '.x', in: 1 }], { times: [], tracks: [], matched: [-1] }, frame);
  assert.match(checkLines(checks, 0.05)[0], /x \(\.x\) found: not found/);
});

test('measuredSpec: the measured times per word and per object, for spec-sync', async () => {
  const o = { id: 'mark', selector: '.mark', in: 0.3, settle: 0.9 };
  const objects = await objectChecks([o], boxes(o, 0.3, 0.9), frame);
  const m = measuredSpec([word], [{ appear: 1.1, settle: 1.4 }], objects);
  assert.deepEqual(m.words, [{ text: 'Ship it', appear: 1.1, settle: 1.4 }]);
  assert.deepEqual(m.objects, [{ id: 'mark', in: 0.3, settle: 0.9 }]);
});

test('cutChecks: a hard jump near a shot start must land within one frame; soft changes are left alone', () => {
  const shots = [{ id: 'S1', start: 0 }, { id: 'S2', start: 2 }, { id: 'S3', start: 4 }];
  const checks = cutChecks(shots, [{ t: 2.1, mag: 50 }], 30);
  assert.equal(checks.length, 1);
  assert.equal(Math.round(checks[0].dev), 3);
  assert.deepEqual(cutChecks(shots, [{ t: 2.03, mag: 50 }], 30).map((c) => c.dev <= 1), [true]);
  assert.match(checkLines(checks, 1)[0], /S2 cut: spec 2.00 s, film 2.10 s \(3.0 frames off\)/);
});

test('cutChecks: the largest jump inside the declared wipe is the cut; the span is capped at 1 s and sorted by time', () => {
  const shots = [{ id: 'S1', start: 0, end: 2.3 }, { id: 'S2', start: 2, end: 4 }];
  assert.deepEqual(cutSpans(shots), [[2, 2.3]]);
  const jumps = [{ t: 2.1, mag: 30 }, { t: 2.23, mag: 60 }];
  assert.equal(cutChecks(shots, jumps, 30)[0].got, 2.23);
  assert.equal(cutChecks(shots, jumps, 30)[0].dev, 0);
  assert.ok(cutChecks(shots, [{ t: 2.4, mag: 60 }], 30)[0].dev > 1);
  assert.ok(cutChecks([{ id: 'S1', start: 0, end: 2 }, { id: 'S2', start: 2 }], [{ t: 2.23, mag: 60 }], 30)[0].dev > 1);
  assert.deepEqual(cutSpans([{ start: 0, end: 9 }, { start: 3, end: 9 }, { start: 5, end: 9 }]), [[3, 4], [5, 6]]);
  assert.deepEqual(cutSpans([{ start: 0, end: 9 }, { start: 5, end: 6 }, { start: 3, end: 9 }]), [[3, 4], [5, 6]]);
});
