import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLoop, loopBudget, loopFinding, loopStamp } from '../../harness/lib/read-budget.mjs';

const AGENTS = [
  '| # | stage | the command |',
  '|---|---|---|',
  '| 1 | brief | `bin/vawe new <name>` (`vawe-brief`) |',
  '| 2 | study | `bin/vawe refs list`, then read (`guides/STUDY.md`) |',
  '| 3 | draft | `bin/vawe dev <page>` and `bin/vawe new` (`vawe-brief`, `guides/MISSING.md`) |',
  '',
].join('\n');

const words = (n) => Array(n).fill('w').join(' ');
const files = { 'skills/vawe-brief/SKILL.md': words(10), 'guides/STUDY.md': words(20) };
const deps = {
  read: (rel) => files[rel],
  exists: (rel) => rel in files,
  help: (verb) => words({ null: 5, new: 7, refs: 11, dev: 13 }[verb]),
};

test('parseLoop reads stage numbers, verbs and named files from the table', () => {
  const rows = parseLoop(AGENTS);
  assert.deepEqual(rows.map((r) => r.n), [1, 2, 3]);
  assert.deepEqual(rows[2].verbs, ['dev', 'new']);
});

test('loopBudget counts per stage, each item once in the whole loop, and skips files that do not exist', () => {
  const b = loopBudget(AGENTS, deps);
  assert.deepEqual(b.stages.map((s) => s.words), [5 + 7 + 10, 11 + 20, 13 + 7 + 10]);
  assert.equal(b.words, 5 + 7 + 11 + 20 + 10 + 13);
  assert.equal(b.tokens, Math.round(b.words * 1.33));
  assert.equal(b.firstStage['bin/vawe new --help'], 1);
  assert.ok(!('guides/MISSING.md' in b.files));
});

test('loopFinding holds at 5% over the stamp and names the stage and the biggest growth past it', () => {
  const before = loopBudget(AGENTS, deps);
  const prior = loopStamp(before);
  assert.equal(loopFinding(before, prior), null);
  assert.equal(loopFinding(before, undefined), null);

  files['guides/STUDY.md'] = words(21);
  assert.equal(loopFinding(loopBudget(AGENTS, deps), prior), null, 'about 1.4% growth is inside the allowance');

  files['guides/STUDY.md'] = words(60);
  const message = loopFinding(loopBudget(AGENTS, deps), prior);
  assert.match(message, /grew/);
  assert.match(message, /guides\/STUDY\.md \(\+40w, stage 2\)/);
});
