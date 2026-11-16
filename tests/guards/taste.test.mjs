import test from 'node:test';
import assert from 'node:assert/strict';
import { tasteFor, TASTE_TOPICS } from '../../harness/guards/index.mjs';
import { tasteLines } from '../../harness/lib/taste-steps.mjs';

test('a stage gives the lines of the step the hooks print, one rule id each', () => {
  const lines = tasteFor('motion');
  const printed = tasteLines('motion').slice(1);
  assert.deepEqual(lines.map((l) => `- ${l}`), printed);
  assert.ok(lines.every((l) => /\(rule [a-z-]+\)$/.test(l)));
});

test('the stages the loop names map to a step; an unknown stage has none', () => {
  assert.ok(tasteFor('board').some((l) => l.includes('(rule readable-hold)')));
  assert.ok(tasteFor('states').some((l) => l.includes('(rule accent-share)')));
  assert.deepEqual(tasteFor('nowhere'), []);
});

test('a topic narrows across steps and ends with the craft doc to read', () => {
  const type = tasteFor('draft', 'type');
  assert.ok(type.some((l) => l.includes('(rule readable-text-size)')));
  assert.equal(type.at(-1), 'read taste/craft/typography.md');
  assert.equal(new Set(type).size, type.length);
  assert.ok(tasteFor('states', 'sound').some((l) => l.includes('(rule sound-cues)')));
  for (const topic of TASTE_TOPICS) assert.match(tasteFor('motion', topic).at(-1), /^read taste\/craft\/[a-z-]+\.md$/);
});

test('an unknown topic throws and names the valid ones', () => {
  assert.throws(() => tasteFor('motion', 'smell'), /valid: type colour motion cuts sound layout/);
});
