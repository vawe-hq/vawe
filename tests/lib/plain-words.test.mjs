import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PLAIN, plain, BOARD_LABELS } from '../../harness/lib/plain-words.mjs';
import { DETAILS } from '../../harness/lib/measured-brief.mjs';

const JARGON = /\b(world|spectacle|handoff|beat|beats|strip|register|live-hold|aspect|sting|captures?|UI)\b/i;

test('the map turns each harness term into plain words and leaves other words alone', () => {
  assert.equal(plain('world'), 'scene');
  assert.equal(plain('spectacle'), 'the big moment');
  assert.equal(plain('handoff'), 'how one scene leads to the next');
  assert.equal(plain('unmapped'), 'unmapped');
  for (const term of ['world', 'spectacle', 'cut', 'strip', 'beat', 'handoff', 'live-hold', 'register']) assert.ok(PLAIN[term], term);
});

test('no board label and no plain phrase holds a harness term', () => {
  for (const v of [...Object.values(BOARD_LABELS), ...Object.values(PLAIN)]) assert.ok(!JARGON.test(v), v);
});

test('the questions of vawe new use plain words', () => {
  for (const d of DETAILS) assert.ok(!JARGON.test(d.question), d.question);
});
