import test from 'node:test';
import assert from 'node:assert/strict';
import { looksOf, looksProblem } from '../../harness/lib/looks.mjs';
import { LOOKS } from '../../core/surfaces/lens.js';

test('looksOf: every look by default, a comma list in the order given, an unknown name names the valid ones', () => {
  assert.deepEqual(looksOf(undefined), Object.keys(LOOKS));
  assert.deepEqual(looksOf('crt, anamorphic'), ['crt', 'anamorphic']);
  assert.throws(() => looksOf('crt,nope'), /--only has no look "nope"; valid: clean/);
  assert.throws(() => looksOf(''), /--only is empty/);
});

test('looksProblem: names the first bad flag, null when both are good', () => {
  assert.equal(looksProblem({ at: '4.5,9', only: 'crt' }), null);
  assert.match(looksProblem({ at: undefined }), /missing --at/);
  assert.match(looksProblem({ at: '1', only: 'x' }), /no look "x"/);
});

test('the LOOKS table: eleven looks, clean is empty, every look is plain data the preview can send as JSON', () => {
  assert.equal(Object.keys(LOOKS).length, 11);
  assert.deepEqual(LOOKS.clean, {});
  for (const [name, look] of Object.entries(LOOKS)) assert.deepEqual(JSON.parse(JSON.stringify(look)), look, name);
});
