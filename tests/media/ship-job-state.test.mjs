// A ship job moves only along the allowed table, and a dead runner never leaves a job live.
//   node --test --test-concurrency=1 tests/media/ship-job-state.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { transition, runnerLost } from '../../harness/lib/job-state.mjs';

const SHIP_JOB = path.resolve('harness/media/ship-job.mjs');
const PAGE = 'films/demo/page.html';

function workdir(job) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'vawe-shipstate-'));
  fs.mkdirSync(path.join(cwd, 'out', 'ship-jobs'), { recursive: true });
  fs.mkdirSync(path.join(cwd, 'films', 'demo'), { recursive: true });
  fs.writeFileSync(path.join(cwd, PAGE), '<html></html>');
  if (job) writeJob(cwd, job);
  return cwd;
}
function cleanup(cwd) {
  const dir = path.join(cwd, 'out', 'ship-jobs');
  for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.json'))) {
    const { pid } = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    if (pid) { try { process.kill(-pid, 'SIGKILL'); } catch { /* already gone */ } }
  }
  fs.rmSync(cwd, { recursive: true, force: true });
}
const jobFile = (cwd, id) => path.join(cwd, 'out', 'ship-jobs', `${id}.json`);
const writeJob = (cwd, job) => fs.writeFileSync(jobFile(cwd, 'demo-1'), JSON.stringify({ id: 'demo-1', page: PAGE, film: 'demo', args: [], query: '', log: path.join(cwd, 'out', 'ship-jobs', 'demo-1.log'), startedAt: Date.now(), ...job }));
const readJob = (cwd, id = 'demo-1') => JSON.parse(fs.readFileSync(jobFile(cwd, id), 'utf8'));
const ship = (cwd, args, env = {}, execArgv = []) => spawnSync(process.execPath, [...execArgv, SHIP_JOB, ...args], { cwd, env: { ...process.env, VAWE_SHIP_JUDGE: '0', ...env }, encoding: 'utf8' });

async function deadPid() {
  const child = spawn(process.execPath, ['-e', '']);
  await new Promise((r) => child.once('exit', r));
  return child.pid;
}

test('transition follows the table and refuses every other move', () => {
  const allowed = { starting: ['running', 'cancelled'], running: ['judging', 'done', 'failed', 'cancelled'], judging: ['done', 'failed'] };
  const all = ['starting', 'running', 'judging', 'done', 'failed', 'cancelled'];
  for (const from of all) {
    for (const to of all) {
      const moved = transition({ status: from }, to);
      assert.equal(moved?.status ?? null, (allowed[from] ?? []).includes(to) ? to : null, `${from} to ${to}`);
    }
  }
});

test('runnerLost covers every live status and no terminal one', () => {
  const dead = () => false;
  for (const status of ['starting', 'running', 'judging']) assert.equal(runnerLost({ status, pid: 1 }, dead), true, status);
  for (const status of ['done', 'failed', 'cancelled']) assert.equal(runnerLost({ status, pid: 1 }, dead), false, status);
  assert.equal(runnerLost({ status: 'starting' }, dead), false, 'no pid yet');
});

test('the runner does not start a render for a job that was cancelled while starting', () => {
  const cwd = workdir({ status: 'cancelled', endedAt: Date.now() });
  try {
    ship(cwd, ['run', 'demo-1']);
    assert.equal(readJob(cwd).status, 'cancelled');
    assert.equal(readJob(cwd).pid, undefined);
    assert.equal(fs.existsSync(path.join(cwd, 'out', 'ship-jobs', 'demo-1.log')), false, 'the runner opened the render log');
  } finally { cleanup(cwd); }
});

test('start records the runner pid, so a starting job can be cancelled', () => {
  const cwd = workdir();
  try {
    const out = ship(cwd, ['start', PAGE]).stdout;
    const id = /^job (\S+) started/m.exec(out)[1];
    assert.equal(typeof readJob(cwd, id).pid, 'number');
    process.kill(-readJob(cwd, id).pid, 'SIGKILL');
  } finally { cleanup(cwd); }
});

test('a new start kills the runner of a starting job it cancels', async () => {
  const sleeper = spawn('sleep', ['30'], { detached: true, stdio: 'ignore' });
  const exited = new Promise((r) => sleeper.once('exit', r));
  const cwd = workdir({ status: 'starting', pid: sleeper.pid });
  try {
    ship(cwd, ['start', PAGE]);
    const result = await Promise.race([exited, new Promise((r) => setTimeout(() => r('alive'), 3000))]);
    assert.notEqual(result, 'alive');
    assert.equal(readJob(cwd).status, 'cancelled');
  } finally { sleeper.kill('SIGKILL'); cleanup(cwd); }
});

for (const status of ['starting', 'running', 'judging']) {
  test(`a ${status} job whose runner died is reported failed and ends the wait`, async () => {
    const cwd = workdir({ status, pid: await deadPid(), renderMs: 1000, outputs: [] });
    try {
      const t0 = Date.now();
      const out = ship(cwd, ['status', 'demo-1', '--wait'], { VAWE_SHIP_WAIT_MS: '4000', VAWE_SHIP_PROGRESS_MS: '1000' }).stdout;
      assert.ok(Date.now() - t0 < 3500, 'the wait ran to its cap');
      assert.match(out, /died without a result/);
      assert.doesNotMatch(out, /STILL RUNNING/);
    } finally { cleanup(cwd); }
  });
}

test('a state file is never written in place: every write goes to a temp file and is renamed', () => {
  const cwd = workdir();
  const log = path.join(cwd, 'writes.log');
  const preload = path.join(cwd, 'preload.mjs');
  fs.writeFileSync(preload, `import fs from 'node:fs';\nconst w = fs.writeFileSync;\nfs.writeFileSync = (f, ...a) => { const fd = fs.openSync(${JSON.stringify(log)}, 'a'); fs.writeSync(fd, String(f) + '\\n'); fs.closeSync(fd); return w(f, ...a); };\n`);
  try {
    const out = ship(cwd, ['start', PAGE], {}, ['--import', preload]).stdout;
    const id = /^job (\S+) started/m.exec(out)[1];
    process.kill(-readJob(cwd, id).pid, 'SIGKILL');
    const writes = fs.readFileSync(log, 'utf8').split('\n').filter((f) => f.includes('ship-jobs'));
    assert.ok(writes.length > 0);
    for (const f of writes) assert.doesNotMatch(f, /\.json$/, f);
  } finally { cleanup(cwd); }
});
