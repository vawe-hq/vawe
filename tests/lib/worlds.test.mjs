import test from 'node:test';
import assert from 'node:assert/strict';
import { waiverHint } from '../../harness/lib/waivers.mjs';
import { HOLD_RULE } from '../../harness/lib/read-hold.mjs';
import { worldIds, worldSpans, stillTime, heldWorlds, mergeSameContent, worldLimit, readNeed, READ_MARGIN_S, TURN_SECONDS_MAX } from '../../harness/lib/worlds.mjs';

const at = (t, ...shown) => ({ t, worlds: [['a', '#111111'], ['b', '#eeeeee'], ['c', null]].map(([id, ground]) => ({ id, visible: shown.includes(id), ground })) });
const samples = [at(0.5, 'a'), at(1.5, 'a'), at(2.5, 'a', 'b'), at(3.5, 'b'), at(4.5, 'b')];

test('worldIds keeps page order', () => {
  assert.deepEqual(worldIds(samples), ['a', 'b', 'c']);
});

test('a span runs from the first to the last visible sample, widened by half a step', () => {
  const spans = worldSpans(samples, { step: 1, dur: 5 });
  assert.deepEqual(spans[0], { id: 'a', signature: '["#111111",[],[]]', start: 0, end: 3, playing: false, ground: '#111111', readNeed: 0 });
  assert.deepEqual(spans[1], { id: 'b', signature: '["#eeeeee",[],[]]', start: 2, end: 5, playing: false, ground: '#eeeeee', readNeed: 0 });
});

test('a span stays inside the film and a world never shown has null times', () => {
  const spans = worldSpans([at(0.2, 'b'), at(0.7, 'b')], { step: 1, dur: 0.9 });
  assert.deepEqual(spans[1], { id: 'b', signature: '["#eeeeee",[],[]]', start: 0, end: 0.9, playing: false, ground: '#eeeeee', readNeed: 0 });
  assert.deepEqual(spans[2], { id: 'c', start: null, end: null, ground: null, readNeed: 0 });
});

test('stillTime is the middle of the span, and 0 for a world never shown', () => {
  assert.equal(stillTime({ start: 2, end: 5 }), 3.5);
  assert.equal(stillTime({ start: null, end: null }), 0);
  assert.equal(stillTime(undefined), 0);
});

test('the starter has one data-world element per beat, with ids s1, s2, ...', async () => {
  const { starterPage } = await import('../../harness/cli/new.mjs');
  const { starterBeats } = await import('../../harness/lib/worlds.mjs');
  const worldCount = (l) => starterBeats(l).length;
  assert.equal(worldCount(4), 2);
  assert.equal(worldCount(12), 6);
  assert.equal(worldCount(1), 2);
  const ids = [...starterPage({ length: 12 }).matchAll(/data-world="([a-z0-9-]+)"/g)].map((m) => m[1]);
  assert.deepEqual(ids, ['s1', 's2', 's3', 's4', 's5', 's6']);
  assert.match(starterPage({ length: 12 }), /--beat-2: 3\.53s/);
});

test('no starter world is longer than the world-turns limit, for any length', async () => {
  const { starterBeats } = await import('../../harness/lib/worlds.mjs');
  for (const length of [3, 5, 6, 7.3, 12, 12.4, 20, 30, 61]) {
    for (const b of starterBeats(length)) assert.ok(b.end - b.start <= TURN_SECONDS_MAX + 1e-9, `${length} s: ${b.id} is ${b.end - b.start} s`);
  }
});

const span = (id, start, end) => ({ id, start, end, ground: '#fff' });

test('a world visible longer than the limit is held, and its line names the world', () => {
  const found = heldWorlds([span('s1', 0, 2), span('s2', 2, 5.5), span('s3', 5.5, 7.5)]);
  assert.deepEqual(found, [{ len: 3.5, text: `world held s2 2-5.5 s (3.5 s, limit 2 s); ${waiverHint('world-held@2-5.5')}` }]);
});

test('a world of exactly the limit, measured a few frames long on the frame grid, is not held', () => {
  assert.deepEqual(heldWorlds([span('s2', 1.967, 4.033)]), []);
  assert.equal(heldWorlds([span('s2', 1.9, 4.1)]).length, 1);
});

test('adjacent worlds with the same ground are two turns, not one held world', () => {
  const same = [span('a', 0, 2), span('b', 2, 4), span('c', 4, 6)];
  assert.deepEqual(heldWorlds(same), []);
});

test('a world never shown is not held, and a declared hold covers its world', () => {
  assert.deepEqual(heldWorlds([{ id: 'x', start: null, end: null, ground: null }]), []);
  const authoring = { allow: ['world-held@2-5.5'], _why: { 'world-held@2-5.5': 'world s2 holds the wordmark 3.5 s as the last beat' }, _worlds: ['s2'] };
  assert.deepEqual(heldWorlds([span('s2', 2, 5.5)], TURN_SECONDS_MAX, authoring), []);
});

test('a world may stay as long as its text needs to be read, never less than the world-turns limit', async () => {
  const { heldWorlds, readNeed, READ_MARGIN_S, TURN_SECONDS_MAX } = await import('../../harness/lib/worlds.mjs');
  const need = readNeed(['Say the one thing', 'why it matters']);
  const long = { id: 's1', start: 0, end: need + READ_MARGIN_S, ground: null, readNeed: need };
  assert.equal(heldWorlds([long]).length, 0);
  assert.equal(heldWorlds([{ ...long, end: need + READ_MARGIN_S + 0.5 }]).length, 1);
  assert.equal(heldWorlds([{ id: 's2', start: 0, end: TURN_SECONDS_MAX + 0.5, readNeed: 0 }]).length, 1);
});

test('the starter gives its first world the read time of the headline and its line', async () => {
  const { starterBeats, readNeed, READ_MARGIN_S, TURN_SECONDS_MAX } = await import('../../harness/lib/worlds.mjs');
  const [first, ...rest] = starterBeats(12, ['Say the one thing', 'why it matters']);
  assert.ok(Math.abs(first.end - (readNeed(['Say the one thing', 'why it matters']) + READ_MARGIN_S)) < 0.01);
  for (const b of rest) assert.ok(b.end - b.start <= TURN_SECONDS_MAX + 1e-9);
  assert.equal(rest.at(-1).end, 12);
});

test('a flat run inside worlds that show text is not blank; a run past them is', async () => {
  const { insideTextWorlds } = await import('../../harness/lib/worlds.mjs');
  const spans = [{ id: 's1', start: 0, end: 3.5, readNeed: 2 }, { id: 's2', start: 3.5, end: 6, readNeed: 1.2 }, { id: 's3', start: 6, end: 8, readNeed: 0 }];
  assert.equal(insideTextWorlds(spans, { a: 1, b: 5.9 }), true);
  assert.equal(insideTextWorlds(spans, { a: 5, b: 7.5 }), false);
});

test('the starter rests the eye: every fourth world after the first three, never the last, shows no words and lasts the limit', async () => {
  const { starterBeats } = await import('../../harness/lib/worlds.mjs');
  const quiet = (length) => starterBeats(length).filter((b) => b.wordless);
  assert.deepEqual(quiet(8), []);
  assert.deepEqual(quiet(12).map((b) => b.id), ['s4']);
  assert.deepEqual(quiet(20).map((b) => b.id), ['s4', 's8']);
  for (const length of [10, 12, 20, 30, 61]) {
    const beats = starterBeats(length);
    assert.equal(beats.at(-1).wordless, false);
    assert.equal(beats.at(-1).end, length);
    for (const b of quiet(length)) assert.equal(+(b.end - b.start).toFixed(2), TURN_SECONDS_MAX);
    beats.slice(1).forEach((b, i) => assert.equal(b.start, beats[i].end));
  }
});

const content = (id, start, end, signature, readNeed = 0) => ({ id, start, end, signature, readNeed, ground: '#111' });

test('a beat split into two data-world elements with the same ground and words is one held world', () => {
  const split = [content('s1', 0, 2, '["#111",["ship it"]]'), content('s2', 2, 4.5, '["#111",["ship it"]]')];
  assert.equal(mergeSameContent(split).length, 1);
  const [found] = heldWorlds(split);
  assert.match(found.text, /^world held s1\+s2 0-4\.5 s \(4\.5 s, limit 2 s; s1 and s2 show the same ground, words and things, so they are one world/);
});

test('worlds whose words or ground differ are separate turns, and a span with no signature never merges', () => {
  assert.deepEqual(heldWorlds([content('s1', 0, 2, '["#111",["a"]]'), content('s2', 2, 4, '["#111",["b"]]')]), []);
  assert.deepEqual(heldWorlds([content('s1', 0, 2, '["#111",["a"]]'), content('s2', 2, 4, '["#eee",["a"]]')]), []);
  assert.deepEqual(heldWorlds([span('s1', 0, 2), span('s2', 2, 4)]), []);
});

test('padding words cannot buy a world more time than the readable-hold ceiling', () => {
  const words = (n) => Array.from({ length: n }, (_, i) => `w${i}`).join(' ');
  assert.ok(readNeed([words(40)]) > 20);
  assert.equal(worldLimit({ readNeed: readNeed([words(40)]) }), HOLD_RULE.ceiling + READ_MARGIN_S);
  assert.equal(worldLimit({ readNeed: readNeed([words(4)]) }), readNeed([words(4)]) + READ_MARGIN_S);
  assert.equal(heldWorlds([content('s1', 0, 8, '["#111",["many words"]]', readNeed([words(40)]))]).length, 1);
  assert.equal(heldWorlds([content('s1', 0, 5.6, '["#111",["real line"]]', readNeed([words(8)]))]).length, 0);
});

test('worldSpans signs a world by its ground and its lower-cased words in any order', () => {
  const sample = (t, texts) => ({ t, worlds: [{ id: 'a', visible: true, ground: '#111', texts }] });
  const [one] = worldSpans([sample(0, ['B', 'a']), sample(1, ['a'])], { step: 1, dur: 2 });
  assert.equal(one.signature, '["#111",["a","b"],[]]');
});

test('worlds with the same words but different things on screen are not merged', () => {
  const sample = (t, id, shape) => ({ t, worlds: [{ id, visible: true, ground: '#111', texts: [], shape }] });
  const a = worldSpans([sample(0, 'a', ['div.ring|#ff0000|2,2,8,8'])], { step: 1, dur: 4 })[0];
  const b = worldSpans([sample(2, 'b', ['div.card|#ffffff|4,4,6,6'])], { step: 1, dur: 4 })[0];
  const copy = worldSpans([sample(2, 'c', ['div.ring|#ff0000|2,2,8,8'])], { step: 1, dur: 4 })[0];
  assert.notEqual(a.signature, b.signature);
  assert.equal(a.signature, copy.signature);
  assert.equal(mergeSameContent([{ ...a, start: 0, end: 2 }, { ...b, start: 2, end: 4 }]).length, 2);
});

test('worlds with nothing readable on them (no ground, words or parts) are never merged', () => {
  const sample = (t, id) => ({ t, worlds: [{ id, visible: true, ground: null, texts: [], shape: [] }] });
  const [a] = worldSpans([sample(0, 'a')], { step: 1, dur: 4 });
  const [b] = worldSpans([sample(2, 'b')], { step: 1, dur: 4 });
  assert.equal(a.signature, null);
  assert.equal(mergeSameContent([{ ...a, start: 0, end: 2 }, { ...b, start: 2, end: 4 }]).length, 2);
});

test('readHolds: a text world is read-held from its start for its read time, inside its span', async () => {
  const { readHolds } = await import('../../harness/lib/worlds.mjs');
  const spans = [{ id: 'a', start: 0, end: 4, readNeed: 1.2 }, { id: 'b', start: 4, end: 5, readNeed: 3 }, { id: 'c', start: 5, end: 8, readNeed: 0 }, { id: 'd', start: null, end: null, readNeed: 2 }];
  assert.deepEqual(readHolds(spans), [[0, 1.2], [4, 5]]);
});
