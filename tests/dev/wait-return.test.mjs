import test from 'node:test';
import assert from 'node:assert/strict';
import { waitForFilm, stillRunningLine, waitExitCode, WAIT_CAP_DEFAULT_MS } from '../../harness/lib/render-wait.mjs';

const slot = { who: 'brindle', kind: 'draft', start: new Date(0).toISOString(), pid: 1 };

test('the default cap is under 120 s so the wait call never moves to the background', () => {
  assert.ok(WAIT_CAP_DEFAULT_MS <= 110_000);
  assert.ok(WAIT_CAP_DEFAULT_MS >= 60_000);
});

test('a render that outlives the cap returns running, within the cap', async () => {
  let t = 0;
  const out = await waitForFilm('brindle', { capMs: WAIT_CAP_DEFAULT_MS, progressMs: 60_000, slots: () => [slot], runs: () => [], now: () => t, sleep: async (ms) => { t += ms; }, log: () => {} });
  assert.deepEqual(out, { running: true, result: null });
  assert.ok(t <= WAIT_CAP_DEFAULT_MS + 1000);
});

test('the still running line names the command to call again', () => {
  const line = stillRunningLine('bin/vawe wait brindle', 100_000);
  assert.match(line, /STILL RUNNING after 100s/);
  assert.match(line, /Call again: bin\/vawe wait brindle$/);
});

test('exit code: 1 for a failed render, 0 for done and for still running', () => {
  assert.equal(waitExitCode({ running: false, result: 'vawe: dev FAILED (exit 1: boom) in 12.3s' }), 1);
  assert.equal(waitExitCode({ running: false, result: 'vawe: dev ok in 12.3s' }), 0);
  assert.equal(waitExitCode({ running: true, result: null }), 0);
  assert.equal(waitExitCode({ running: false, result: null }), 0);
});
