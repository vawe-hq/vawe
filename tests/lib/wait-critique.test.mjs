import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { markRunning, runningVerbs, waitingLine, waitForFilm } from '../../harness/lib/render-wait.mjs';

test('a marked critique shows as running for its film until it is cleared', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wait-critique-'));
  const clear = markRunning('films/riso/page.html', 'critique', root);
  const rows = runningVerbs('riso', root);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].kind, 'critique');
  assert.deepEqual(runningVerbs('other', root), []);
  clear();
  assert.deepEqual(runningVerbs('riso', root), []);
});

test('two critiques of one film keep their own markers, and an old marker is ignored', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wait-critique-'));
  const a = markRunning('riso', 'critique', root);
  const b = markRunning('riso', 'critique', root);
  assert.equal(runningVerbs('riso', root).length, 2);
  a();
  assert.equal(runningVerbs('riso', root).length, 1);
  assert.deepEqual(runningVerbs('riso', root, Date.now() + 31 * 60 * 1000), []);
  b();
});

test('a marker whose process is dead is ignored', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wait-critique-'));
  fs.mkdirSync(path.join(root, 'out'));
  fs.writeFileSync(path.join(root, 'out', 'riso.running-1-1.json'), JSON.stringify({ pid: 2 ** 22 + 1, kind: 'critique', who: 'riso', start: new Date().toISOString() }));
  assert.deepEqual(runningVerbs('riso', root), []);
});

test('wait names a critique in its progress line and waits while it runs', async () => {
  const held = [{ kind: 'critique', who: 'riso', start: new Date(0).toISOString() }];
  assert.equal(waitingLine('riso', held, 65_000), 'vawe wait: riso has a critique running, 65s in');
  let t = 0;
  const out = await waitForFilm('riso', { capMs: 5_000, progressMs: 60_000, slots: () => held, runs: () => [], now: () => t, sleep: async (ms) => { t += ms * 100; }, log: () => {} });
  assert.deepEqual(out, { running: true, result: null });
});
