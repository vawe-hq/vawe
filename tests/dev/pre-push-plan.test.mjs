import test from 'node:test';
import assert from 'node:assert/strict';
import { planChecks, e2eKey, renderEntries } from '../../harness/lib/pre-push-plan.mjs';

const checksOf = (files) => planChecks(files).checks;

test('docs-only changes run no optional check', () => {
  assert.deepEqual(checksOf(['README.md', 'guides/ROUTING.md', 'research_notes/a.md']), []);
});

test('agent docs run the unit tests but not e2e', () => {
  assert.deepEqual(checksOf(['AGENTS.md', 'skills/vawe-page/SKILL.md', 'prompts/moves/RECIPES.md']), ['unit']);
});

test('engine, harness and core changes run unit tests and e2e', () => {
  for (const f of ['core/engine/page-clock.js', 'harness/media/render-page.mjs', 'taste/build/limits.json', 'package-lock.json', '.githooks/pre-push']) {
    assert.deepEqual(checksOf([f]), ['unit', 'e2e'], f);
  }
});

test('film and asset changes run e2e only', () => {
  assert.deepEqual(checksOf(['films/brindle/page.html', 'assets/plinth/a.png']), ['e2e']);
});

test('a mixed push runs the union', () => {
  assert.deepEqual(checksOf(['films/brindle/page.html', 'AGENTS.md']), ['unit', 'e2e']);
});

test('an unknown path or an empty list runs everything', () => {
  assert.deepEqual(checksOf(['mystery/file.bin']), ['unit', 'e2e']);
  assert.deepEqual(checksOf(['README.md', 'mystery/file.bin']), ['unit', 'e2e']);
  assert.deepEqual(checksOf([]), ['unit', 'e2e']);
});

test('each chosen check carries a reason naming a path', () => {
  const { reasons } = planChecks(['harness/media/render-page.mjs']);
  assert.match(reasons.e2e, /engine: harness\/media\/render-page\.mjs/);
});

const tree = (entries) => entries.map(([name, oid]) => `040000 tree ${oid}\t${name}`).join('\n');

test('the e2e key ignores directories no render reads and follows every other one', () => {
  const base = [['core', 'aaa'], ['films', 'bbb'], ['guides', 'ccc'], ['README.md', 'ddd'], ['skills', 'eee']];
  const key = e2eKey(tree(base));
  assert.equal(e2eKey(tree([['core', 'aaa'], ['films', 'bbb'], ['guides', 'zzz'], ['README.md', 'yyy'], ['skills', 'xxx']])), key);
  assert.notEqual(e2eKey(tree([['core', 'changed'], ['films', 'bbb'], ['guides', 'ccc'], ['README.md', 'ddd'], ['skills', 'eee']])), key);
  assert.notEqual(e2eKey(tree([...base, ['newdir', 'fff']])), key, 'a new top-level entry is a render input until listed as not');
});

test('renderEntries drops the doc entries by name', () => {
  const names = renderEntries(tree([['guides', '1'], ['guides', '3'], ['harness', '4'], ['AGENTS.md', '5'], ['package.json', '6']])).map((e) => e.name);
  assert.deepEqual(names, ['harness', 'package.json']);
});
