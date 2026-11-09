import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { aggregate } from '../../harness/lib/trace/aggregate.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ledger = JSON.parse(fs.readFileSync(path.join(root, 'quality/baselines/retro-ledger.json'), 'utf8'));
const STATUS = new Set(['proposed', 'trial', 'kept', 'revised', 'removed']);
const TRIAL_KEYS = ['occurred', 'consulted', 'changed'];

/** The metric paths trace-review prints: rows.<id>, numbers.<id>, routing.<key>. */
function metricPaths() {
  const agg = aggregate([]);
  return new Set([...agg.rows.map((r) => `rows.${r.id}`), ...agg.numbers.map((n) => `numbers.${n.id}`), ...Object.keys(agg.routing).map((k) => `routing.${k}`)]);
}

test('each ledger change has a unique id, evidence, a status and a metric trace-review prints', () => {
  const paths = metricPaths();
  const ids = ledger.changes.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const c of ledger.changes) {
    assert.ok(c.change && c.evidence, c.id);
    assert.ok(STATUS.has(c.status), `${c.id}: status ${c.status}`);
    assert.ok(paths.has(c.metric), `${c.id}: no metric ${c.metric}`);
    assert.equal(typeof c.baseline, 'object', c.id);
  }
});

test('a change past proposed names its sha and answers the three trial questions', () => {
  for (const c of ledger.changes.filter((x) => x.status !== 'proposed')) {
    assert.match(String(c.sha), /^[0-9a-f]{7,40}$/, c.id);
    for (const key of TRIAL_KEYS) assert.equal(typeof c.trial?.[key], 'boolean', `${c.id}: trial.${key}`);
  }
});
