import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { nextSeen, resetShown } from '../../harness/lib/next-once.mjs';
import { tasteOnce } from '../../harness/live/stage-say.mjs';
import { appendRun } from '../../harness/lib/runlog.mjs';

const ROOT = path.resolve(import.meta.dirname, '../..');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'vawe-next-'));

test('a next line is seen once per film, session and agent; a new why or next shows again; no session means no memory', () => {
  const root = tmp();
  const seen = (film, next, sessionId, agent = null, why = '') => nextSeen(film, { next, why }, { root, sessionId, agent });
  assert.equal(seen('f', 'a', 's1'), false);
  assert.equal(seen('f', 'a', 's1'), true);
  assert.equal(seen('f', 'a', 's1', null, 'new reason'), false, 'the why changed');
  assert.equal(seen('f', 'b', 's1'), false);
  assert.equal(seen('f', 'a', 's1'), false);
  assert.equal(seen('f', 'a', 's2'), false);
  assert.equal(seen('g', 'a', 's1'), false);
  assert.equal(seen('f', 'a', 's1', 'judge-f'), false, 'a fresh agent sees the full line first');
  assert.equal(seen('f', 'a', 's1', 'judge-f'), true);
  assert.equal(seen('f', 'a', null), false);
  assert.equal(seen('f', 'a', null), false);
});

test('a reset (the PreCompact hook) makes this session see its lines again, and the taste lines too', () => {
  const root = tmp();
  const seen = () => nextSeen('f', { next: 'a' }, { root, sessionId: 's1', agent: null });
  seen();
  appendRun('f', { cmd: 'taste-shown', stage: 'motion', shownTo: 's1' }, { root });
  assert.equal(seen(), true);
  assert.deepEqual(tasteOnce('motion', 'f', root, 's1'), []);
  resetShown(root, 's1');
  assert.equal(seen(), false);
  assert.ok(tasteOnce('motion', 'f', root, 's1').length > 0);
  const other = nextSeen('f', { next: 'a' }, { root, sessionId: 's2', agent: null });
  resetShown(root, 's1');
  assert.equal(nextSeen('f', { next: 'a' }, { root, sessionId: 's2', agent: null }), true, 'another session keeps its memory');
  assert.equal(other, false);
});

test('a failed log write never fails the call', () => {
  const root = tmp();
  fs.writeFileSync(path.join(root, 'out'), 'a file where the folder should be');
  assert.equal(nextSeen('f', { next: 'a' }, { root, sessionId: 's1', agent: null }), false);
});

test('the stage hook says "unchanged" for a repeated next line', () => {
  const root = tmp();
  const git = (...a) => spawnSync('git', a, { cwd: root, encoding: 'utf8' });
  git('init', '-q');
  fs.mkdirSync(path.join(root, 'films', 'f'), { recursive: true });
  fs.writeFileSync(path.join(root, 'films', 'f', 'page.html'), '<p>x</p>');
  const hook = () => spawnSync(process.execPath, [path.join(ROOT, 'harness/live/stage-say.mjs')], { cwd: root, input: JSON.stringify({ session_id: 's1' }), encoding: 'utf8' }).stdout;
  assert.match(hook(), /next: .*brief/);
  assert.match(hook().trim(), /^vawe: f \[brief\]: next: unchanged, see above$/);
  spawnSync(process.execPath, [path.join(ROOT, 'harness/live/stage-say.mjs'), '--reset'], { cwd: root, input: JSON.stringify({ session_id: 's1' }), encoding: 'utf8' });
  assert.match(hook(), /next: .*brief/);
});

test('a verb prints its next line once per session, then "unchanged"', () => {
  const log = path.join(ROOT, 'out', '_unfiled.runs.jsonl');
  const before = fs.existsSync(log) ? fs.readFileSync(log) : null;
  const run = () => spawnSync(process.execPath, [path.join(ROOT, 'bin/vawe'), 'palette', '--id', 'seed-200'], { cwd: ROOT, encoding: 'utf8', env: { ...process.env, CLAUDE_CODE_SESSION_ID: `next-once-${process.pid}`, VAWE_AGENT: '' } }).stdout;
  try {
    assert.match(run(), /\nnext: write the palette/);
    const again = run();
    assert.match(again, /\nnext: unchanged, see above/);
    assert.doesNotMatch(again, /write the palette/);
  } finally {
    if (before) fs.writeFileSync(log, before); else fs.rmSync(log, { force: true });
  }
});
