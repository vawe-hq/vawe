// Small lifecycle fixes: a slot taken after it was read, a lock left by a dead render, partial registry files, dead markers, taken critique numbers.
//   node --test tests/lib/state-races.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { reapSlot } from '../../harness/lib/render-slots.mjs';
import { recordClips } from '../../harness/media/render-moves.mjs';
import { reapOrphanBrowsers } from '../../harness/lib/render-harness.mjs';
import { runningVerbs } from '../../harness/lib/render-wait.mjs';
import { writeCritique } from '../../harness/lib/critic-prompt.mjs';

const tmp = (name) => fs.mkdtempSync(path.join(os.tmpdir(), `vawe-${name}-`));

async function deadPid() {
  const child = spawn(process.execPath, ['-e', '']);
  await new Promise((r) => child.once('exit', r));
  return child.pid;
}

test('reapSlot removes the dead render it read and keeps a slot another render took since', async () => {
  const dir = tmp('slot');
  const file = path.join(dir, 'slot-0.json');
  const dead = { pid: await deadPid(), start: '2026-01-01T00:00:00.000Z', kind: 'draft', who: 'a' };
  fs.writeFileSync(file, JSON.stringify(dead));
  reapSlot(file, dead);
  assert.equal(fs.existsSync(file), false);
  fs.writeFileSync(file, JSON.stringify({ pid: process.pid, start: '2026-01-02T00:00:00.000Z', kind: 'final', who: 'b' }));
  reapSlot(file, dead);
  assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).pid, process.pid);
});

test('recordClips takes over a lock whose holder died instead of waiting out the limit', async () => {
  const dir = tmp('clips');
  const lock = path.join(dir, 'clips.lock.json');
  fs.mkdirSync(`${lock}.d`);
  fs.writeFileSync(path.join(`${lock}.d`, 'pid'), String(await deadPid()));
  const t0 = Date.now();
  await recordClips({ a: { hash: 'h' } }, lock);
  assert.ok(Date.now() - t0 < 5000);
  assert.deepEqual(JSON.parse(fs.readFileSync(lock, 'utf8')), { a: { hash: 'h' } });
  assert.equal(fs.existsSync(`${lock}.d`), false);
});

test('the Chrome reaper leaves a half-written entry and a temp file alone', async () => {
  const dir = tmp('chrome');
  fs.writeFileSync(path.join(dir, '999999'), '');
  fs.writeFileSync(path.join(dir, '999998.tmp'), String(await deadPid()));
  assert.equal(reapOrphanBrowsers(dir, ''), 0);
  assert.deepEqual(fs.readdirSync(dir).sort(), ['999998.tmp', '999999']);
});

test('runningVerbs deletes the marker of a dead process', async () => {
  const root = tmp('marker');
  fs.mkdirSync(path.join(root, 'out'));
  const file = path.join(root, 'out', 'demo.running-1-2-abc.json');
  fs.writeFileSync(file, JSON.stringify({ pid: await deadPid(), kind: 'critique', who: 'demo', start: new Date().toISOString() }));
  assert.deepEqual(runningVerbs('demo', root), []);
  assert.equal(fs.existsSync(file), false);
});

test('writeCritique never overwrites a critique another run wrote first', () => {
  const out = tmp('critique');
  fs.writeFileSync(path.join(out, 'f.critique-1.md'), 'first');
  assert.equal(writeCritique(out, 'f', 'second'), path.join(out, 'f.critique-2.md'));
  assert.equal(writeCritique(out, 'f', 'third'), path.join(out, 'f.critique-3.md'));
  assert.equal(fs.readFileSync(path.join(out, 'f.critique-1.md'), 'utf8'), 'first');
  assert.equal(fs.readFileSync(path.join(out, 'f.critique-2.md'), 'utf8'), 'second');
});

test('writeFileAtomic replaces the file and leaves no temp file', async () => {
  const { writeFileAtomic } = await import('../../harness/lib/atomic-write.mjs');
  const dir = tmp('atomic');
  const file = path.join(dir, 'x.json');
  writeFileAtomic(file, 'one');
  writeFileAtomic(file, 'two');
  assert.equal(fs.readFileSync(file, 'utf8'), 'two');
  assert.deepEqual(fs.readdirSync(dir), ['x.json']);
});

test('newFilm writes page.html last, so a failed scaffold can be retried', async () => {
  const { newFilm } = await import('../../harness/cli/new.mjs');
  const ROOT = path.resolve(import.meta.dirname, '../..');
  const root = tmp('new');
  for (const dir of ['prompts', 'guides', 'assets/fonts']) {
    fs.mkdirSync(path.dirname(path.join(root, dir)), { recursive: true });
    fs.symlinkSync(path.join(ROOT, dir), path.join(root, dir));
  }
  const written = [];
  const real = fs.writeFileSync;
  fs.writeFileSync = (f, ...a) => { written.push(path.basename(String(f))); return real(f, ...a); };
  const log = console.log;
  console.log = () => {};
  try { newFilm('zz', { root, defaults: true }); } finally { fs.writeFileSync = real; console.log = log; }
  assert.equal(written.at(-1), 'page.html');
  assert.ok(written.includes('brief.md'));
});

test('study refuses to clear a filled pages.md unless --force', () => {
  const ROOT = path.resolve(import.meta.dirname, '../..');
  const name = `zz-state-${process.pid}`;
  const refs = path.join(ROOT, 'refs', name);
  const clip = path.join(tmp('study'), 'clip.mp4');
  const made = spawnSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'testsrc=size=160x90:rate=10:duration=1', '-pix_fmt', 'yuv420p', clip]);
  assert.equal(made.status, 0);
  fs.mkdirSync(refs, { recursive: true });
  fs.writeFileSync(path.join(refs, 'pages.md'), 'filled in by hand');
  try {
    const run = spawnSync(process.execPath, ['harness/media/study.mjs', clip, name], { cwd: ROOT, encoding: 'utf8' });
    assert.notEqual(run.status, 0);
    assert.match(run.stderr + run.stdout, /--force/);
    assert.equal(fs.readFileSync(path.join(refs, 'pages.md'), 'utf8'), 'filled in by hand');
  } finally { fs.rmSync(refs, { recursive: true, force: true }); }
});
