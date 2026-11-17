import test from 'node:test';
import assert from 'node:assert/strict';
import { probeTracks, readHoldProblems, readHoldUnmeasured, rowsNeed, lineNeed, HOLD_RULE } from '../../harness/lib/read-hold.mjs';

const box = [0, 0, 400, 60];
const at = (t, ...texts) => ({ t, lines: texts.map((text) => ({ text, box })) });
const rows = (t, ...texts) => ({ t, lines: texts.map((text, block) => ({ text, box, block })) });

test('probeTracks: one run of samples is one track, in and out at half a step', () => {
  const tracks = probeTracks([at(0.25), at(0.75, 'Ship it now'), at(1.25, 'Ship it now'), at(1.75)], { step: 0.5, frameH: 600 });
  assert.deepEqual(tracks.map((t) => t.text), ['Ship it now']);
  assert.deepEqual([tracks[0].tIn, tracks[0].tOut, tracks[0].sizeSettled], [0.5, 1.5, 0.1]);
});

test('probeTracks: the Words table gives the settle time, so a long entrance is not counted as hold', () => {
  const samples = [at(0.25, 'Go'), at(0.75, 'Go'), at(1.25, 'Go'), at(1.75)];
  const plain = readHoldProblems(probeTracks(samples, { step: 0.5, frameH: 600 }));
  const spec = readHoldProblems(probeTracks(samples, { step: 0.5, frameH: 600 }, [{ text: 'Go', settle: 1 }]));
  assert.equal(plain.length, 0);
  assert.equal(spec.length, 1);
  assert.ok(spec[0].hold < 1.08);
});

test('probeTracks: a line that returns later is a second run', () => {
  const tracks = probeTracks([at(0.25, 'A'), at(0.75), at(1.25, 'A')], { step: 0.5, frameH: 600 });
  assert.equal(tracks.length, 2);
});

test('probeTracks: product chrome is not a line to read', () => {
  const chrome = { t: 0.75, lines: [{ text: 'Inbox', box, chrome: true }, { text: 'Ship it now', box }] };
  const tracks = probeTracks([chrome, { ...chrome, t: 1.25 }], { step: 0.5, frameH: 600 });
  assert.deepEqual(tracks.map((t) => t.text), ['Ship it now']);
});

const LIST = ['02:14 Ship Thursday', '07:40 Free forever', '09:05 Sync Friday'];
const listSamples = (holdSamples) => [rows(0.25), ...Array.from({ length: holdSamples }, (_, i) => rows(0.75 + i * 0.5, ...LIST)), rows(0.75 + holdSamples * 0.5)];

test('separate rows of a list are separate lines: three short rows held 4 s are no problem, and a short hold names each row alone', () => {
  assert.deepEqual(readHoldProblems(probeTracks(listSamples(8), { step: 0.5, frameH: 600 })), []);
  const short = readHoldProblems(probeTracks(listSamples(2), { step: 0.5, frameH: 600 }));
  assert.deepEqual(short.map((p) => p.text), LIST);
  assert.ok(short.every((p) => p.n === 3 && p.rows === 3));
});

test('rows shown together need the longest row plus a word of time per extra row, not the sum', () => {
  const need = rowsNeed([lineNeed(3), lineNeed(3), lineNeed(3)]);
  assert.ok(Math.abs(need - (HOLD_RULE.floor + 2 * HOLD_RULE.perExtraRow)) < 1e-9);
  assert.ok(need < 3 * lineNeed(3));
  assert.equal(rowsNeed([lineNeed(10)]), lineNeed(10));
});

test('a flood of 26 notices is held at most the ceiling, and a long line keeps its own time', () => {
  assert.equal(rowsNeed(Array(26).fill(lineNeed(3))), HOLD_RULE.ceiling);
  assert.equal(rowsNeed([lineNeed(10), lineNeed(3)]), lineNeed(10));
});

test('the texts of one element are one line, and the words of a split headline count as one headline', () => {
  const split = (t) => ({ t, lines: ['Ship', 'faster', 'than', 'ever', 'before'].map((text) => ({ text, box, block: 0 })) });
  const problems = readHoldProblems(probeTracks([at(0.25), split(0.75), split(1.25), at(1.75)], { step: 0.5, frameH: 600 }));
  assert.equal(problems.length, 1);
  assert.equal(problems[0].n, 5);
  assert.equal(problems[0].text, 'Ship faster than ever before');
});

test('a line that left before its settle time has no hold: not a problem, counted as not measured', () => {
  const samples = [at(0.25, 'Go'), at(0.75, 'Go'), at(1.25), at(2.25)];
  const tracks = probeTracks(samples, { step: 0.5, frameH: 600 }, [{ text: 'Go', settle: 3 }]);
  assert.deepEqual(readHoldProblems(tracks), []);
  assert.equal(readHoldUnmeasured(tracks).length, 1);
});

test('a typed line is one track that settles when it stops changing, not one track per prefix', () => {
  const full = 'Ship it now';
  const typed = Array.from(full, (_, i) => rows(0.25 + i * 0.25, full.slice(0, i + 1)));
  const held = (n) => Array.from({ length: n }, (_, i) => rows(0.25 + full.length * 0.25 + i * 0.25, full));
  const after = 0.25 + (full.length + 8) * 0.25;
  const tracks = probeTracks([...typed, ...held(8), rows(after)], { step: 0.25, frameH: 600 });
  assert.deepEqual(tracks.map((t) => t.text), [full]);
  assert.equal(tracks[0].tSettled, 0.25 + (full.length - 1) * 0.25 - 0.125);
  assert.deepEqual(readHoldProblems(tracks), []);
  const short = probeTracks([...typed, ...held(1), rows(after)], { step: 0.25, frameH: 600 });
  assert.equal(readHoldProblems(short).length, 1);
});

test('two elements that type different text never join into one track', () => {
  const two = (a, b) => ({ t: 0, lines: [{ text: a, box, block: 0 }, { text: b, box, block: 1 }] });
  const s = [two('A', 'B'), two('AB', 'BC'), two('ABC', 'BCD')].map((x, i) => ({ ...x, t: 0.25 + i * 0.25 }));
  assert.deepEqual(probeTracks([...s, rows(1)], { step: 0.25, frameH: 600 }).map((t) => t.text).sort(), ['ABC', 'BCD']);
});

const frame = { step: 0.5, frameH: 600 };
const at2 = (t, lines) => ({ t, lines: lines.map((l) => ({ box, ...l })) });
const letters = (block, word) => [...word].map((text, i) => ({ text, block, ...(i ? { glued: true } : {}) }));

test('a word split into letter spans is one word: "before" and "lunch" held 2.5 s are no problem', () => {
  const held = [1.25, 1.75, 2.25, 2.75, 3.25].map((t) => at2(t, [...letters(54, 'before'), ...letters(78, 'lunch')]));
  assert.deepEqual(readHoldProblems(probeTracks([at2(0.25, []), ...held, at2(3.75, [])], frame)), []);
});

test('letter spans that arrive over more than half a second are still one line, named as the word', () => {
  const spread = (t, n) => at2(t, letters(5, 'backlit').slice(0, n));
  const tracks = probeTracks([at2(0.25, []), spread(0.75, 2), spread(1.25, 5), spread(1.75, 7), spread(2.25, 7), at2(2.75, [])], frame);
  const [problem] = readHoldProblems(tracks);
  assert.equal(problem.text, 'backlit');
  assert.equal(problem.n, 1);
});

test('lines of two worlds that follow each other are not rows of one list', () => {
  const samples = [at2(0.25, []), at2(0.75, [{ text: 'it', block: 1 }]), at2(1.25, [{ text: 'before', block: 2 }]), at2(1.75, [{ text: 'before', block: 2 }]), at2(2.25, [{ text: 'before', block: 2 }]), at2(2.75, [])];
  const [problem] = readHoldProblems(probeTracks(samples, frame));
  assert.equal(problem.text, 'it');
  assert.equal(problem.rows, 1);
});

test('a counter that ticks through numbers is looked at, not read', () => {
  const ticks = ['11:52', '11:53', '11:54', '11:55'].map((text, i) => at2(0.75 + i * 0.5, [{ text, block: 9 }]));
  assert.deepEqual(readHoldProblems(probeTracks([at2(0.25, []), ...ticks, at2(2.75, [])], frame)), []);
});

test('a lone full stop is not a word: "Ship it before ." is three words', () => {
  const held = [0.75, 1.25, 1.75].map((t) => at2(t, ['Ship', 'it', 'before', '.'].map((text) => ({ text, block: 3 }))));
  assert.deepEqual(readHoldProblems(probeTracks([at2(0.25, []), ...held, at2(2.25, [])], frame)), []);
});
