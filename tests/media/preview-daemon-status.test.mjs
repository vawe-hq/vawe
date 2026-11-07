// daemonStatus tells a live daemon from the file a SIGKILLed one leaves, and a client ignores and replaces the stale file.
//   node --test --test-concurrency=1 tests/media/preview-daemon-status.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { stateFile, daemonStatus, openPreview } from '../../harness/media/preview-server.mjs';
import { loadPuppeteer } from '../../harness/lib/render-harness.mjs';

const DRAFT = false;
const DAEMON = 'harness/media/preview-server.mjs';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const lockFile = () => `${stateFile(DRAFT)}.lock`;
const clean = () => { fs.rmSync(stateFile(DRAFT), { force: true }); fs.rmSync(lockFile(), { force: true }); };

async function deadPid() {
  const child = spawn(process.execPath, ['-e', '']);
  await new Promise((r) => child.once('exit', r));
  return child.pid;
}

test('daemonStatus: absent, starting, up and stale', async () => {
  assert.ok(!fs.existsSync(stateFile(DRAFT)), 'a real draft daemon is running: stop it first');
  try {
    assert.equal(daemonStatus(DRAFT).status, 'absent');
    fs.writeFileSync(lockFile(), String(process.pid));
    assert.equal(daemonStatus(DRAFT).status, 'starting');
    fs.writeFileSync(lockFile(), String(await deadPid()));
    assert.equal(daemonStatus(DRAFT).status, 'absent', 'a dead lock holder is not starting');
    fs.writeFileSync(stateFile(DRAFT), JSON.stringify({ pid: process.pid, port: 1, wsEndpoint: 'ws://x' }));
    assert.equal(daemonStatus(DRAFT).status, 'up');
    fs.writeFileSync(stateFile(DRAFT), JSON.stringify({ pid: await deadPid(), port: 1, wsEndpoint: 'ws://x' }));
    assert.equal(daemonStatus(DRAFT).status, 'stale');
  } finally { clean(); }
});

test('after a SIGKILLed daemon the next call launches a new one instead of falling back to a cold browser', async () => {
  assert.ok(!fs.existsSync(stateFile(DRAFT)), 'a real draft daemon is running: stop it first');
  const daemon = spawn(process.execPath, [DAEMON, '--daemon', '--draft'], { stdio: 'ignore' });
  let dead = null;
  let preview = null;
  try {
    const until = Date.now() + 20000;
    while (!fs.existsSync(stateFile(DRAFT)) && Date.now() < until) await sleep(100);
    dead = JSON.parse(fs.readFileSync(stateFile(DRAFT), 'utf8'));
    assert.equal(dead.pid, daemon.pid);
    daemon.kill('SIGKILL');
    await new Promise((r) => daemon.once('exit', r));
    preview = await openPreview('tests/fixtures/pages/word-at-2-5.html', { final: false });
    assert.equal(preview.persistent, true, 'the call fell back to a cold browser');
    assert.equal(preview.chrome, 'launched');
    const fresh = JSON.parse(fs.readFileSync(stateFile(DRAFT), 'utf8'));
    assert.notEqual(fresh.pid, dead.pid);
  } finally {
    await preview?.close().catch(() => {});
    try { process.kill(JSON.parse(fs.readFileSync(stateFile(DRAFT), 'utf8')).pid, 'SIGTERM'); } catch { /* none left */ }
    if (dead) {
      const puppeteer = await loadPuppeteer();
      await puppeteer.connect({ browserWSEndpoint: dead.wsEndpoint }).then((b) => b.close(), () => {});
    }
    await sleep(1500);
    clean();
  }
});
