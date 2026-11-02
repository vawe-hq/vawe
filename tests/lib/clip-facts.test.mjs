import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { clipFacts } from '../../scripts/site/clip-facts.mjs';
import { clipHash } from '../../harness/lib/clip-hash.mjs';

const master = () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'clip-facts-')), 'x.mp4');
  fs.writeFileSync(file, 'not a real mp4');
  return file;
};
const recorded = { hash: 'aaaaaaaaaaaa', date: '2026-10-01', duration: 4 };

test('clipFacts: a master older than the lock is not used', () => {
  const file = master();
  const warnings = [];
  const facts = clipFacts(file, recorded, 'bbbbbbbbbbbb', 'x', (w) => warnings.push(w));
  assert.deepEqual(facts, recorded);
  assert.match(warnings[0], /prompts\/moves\/x\.mp4 is older than the lock: bin\/vawe-dev moves --only x/);
});

test('clipFacts: a master that is the lock clip is read', () => {
  const file = master();
  const warnings = [];
  const facts = clipFacts(file, recorded, clipHash(file), 'x', (w) => warnings.push(w));
  assert.equal(facts.hash, clipHash(file));
  assert.deepEqual(warnings, []);
});

test('clipFacts: a lock clip newer than moves.json prints the render command', () => {
  const warnings = [];
  const facts = clipFacts('/no/such/x.mp4', recorded, 'bbbbbbbbbbbb', 'x', (w) => warnings.push(w));
  assert.deepEqual(facts, recorded);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /x: render newer than the site copy: bin\/vawe-dev moves --only x, then node scripts\/site\/moves\.mjs --clips/);
});

test('clipFacts: no master and no lock clip keeps the record without a word', () => {
  const warnings = [];
  assert.deepEqual(clipFacts('/no/such/x.mp4', recorded, undefined, 'x', (w) => warnings.push(w)), recorded);
  assert.deepEqual(warnings, []);
});
