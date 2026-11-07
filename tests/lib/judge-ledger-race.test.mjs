import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { withFileLock } from '../../harness/lib/file-lock.mjs';

const LEDGER = process.env.VAWE_TEST_LEDGER_MODULE || path.resolve('harness/lib/judge-ledger.mjs');

// The fixes getter holds the merge open for 200 ms, so a second run that is not locked out reads the old file.
const CHILD = `
const { commitLedger } = await import(process.env.LEDGER);
const result = { notes: [] };
Object.defineProperty(result, 'fixes', { set() {}, get() { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 200); return [{ axis: process.env.AXIS, score: 5, at: 1, fix: 'fix ' + process.env.AXIS }]; } });
await commitLedger(process.env.FILE, { fixes: [] }, result);
`;

const runChild = (file, axis) => new Promise((resolve) => {
  const p = spawn(process.execPath, ['--input-type=module', '-e', CHILD], { env: { ...process.env, LEDGER: LEDGER.startsWith('file:') ? LEDGER : `file://${LEDGER}`, FILE: file, AXIS: axis }, stdio: 'inherit' });
  p.on('exit', resolve);
});

test('two judge runs that overlap both keep their items in the ledger', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vawe-ledger-'));
  const file = path.join(dir, 'film.judge.json');
  try {
    assert.deepEqual(await Promise.all([runChild(file, 'hook'), runChild(file, 'pace')]), [0, 0]);
    const items = JSON.parse(fs.readFileSync(file, 'utf8')).items;
    assert.deepEqual(items.map((i) => i.axis).sort(), ['hook', 'pace']);
    assert.equal(new Set(items.map((i) => i.id)).size, 2);
    assert.equal(fs.existsSync(`${file}.lock`), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('a lock left by a dead pid is taken back, and a live holder makes the wait end in an error', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vawe-lock-'));
  const lock = path.join(dir, 'x.lock');
  try {
    const dead = spawnSync(process.execPath, ['-e', '0']);
    assert.equal(dead.status, 0);
    fs.writeFileSync(lock, String(dead.pid));
    assert.equal(await withFileLock(lock, () => 'ran'), 'ran');
    assert.equal(fs.existsSync(lock), false);

    fs.writeFileSync(lock, String(process.ppid));
    await assert.rejects(withFileLock(lock, () => 'ran', { waitMs: 150 }), /held by pid/);
    assert.equal(fs.readFileSync(lock, 'utf8'), String(process.ppid));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
