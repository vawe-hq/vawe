import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { nextOnce, NEXT_UNCHANGED } from '../../harness/lib/next-once.mjs';
import { readRuns } from '../../harness/lib/runlog.mjs';

const ROOT = path.resolve(import.meta.dirname, '../..');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'vawe-next-'));

test('a next line prints in full once per session and film, then as "unchanged" until it changes', () => {
  const root = tmp();
  assert.equal(nextOnce('f', 'next: a', root, 's1'), 'next: a');
  assert.equal(nextOnce('f', 'next: a', root, 's1'), NEXT_UNCHANGED);
  assert.equal(nextOnce('f', 'next: b', root, 's1'), 'next: b');
  assert.equal(nextOnce('f', 'next: a', root, 's1'), 'next: a');
  assert.equal(nextOnce('f', 'next: a', root, 's2'), 'next: a');
  assert.equal(nextOnce('g', 'next: a', root, 's1'), 'next: a');
  assert.equal(readRuns('f', root).filter((r) => r.cmd === 'next-shown').length, 4);
});

test('the stage hook says "unchanged" for a repeated next line', () => {
  const root = tmp();
  const git = (...a) => spawnSync('git', a, { cwd: root, encoding: 'utf8' });
  git('init', '-q');
  fs.mkdirSync(path.join(root, 'films', 'f'), { recursive: true });
  fs.writeFileSync(path.join(root, 'films', 'f', 'page.html'), '<p>x</p>');
  const hook = () => spawnSync(process.execPath, [path.join(ROOT, 'harness/live/stage-say.mjs')], { cwd: root, input: JSON.stringify({ session_id: 's1' }), encoding: 'utf8' }).stdout;
  assert.match(hook(), /next: .*brief/);
  assert.equal(hook().trim(), 'vawe: f: next: unchanged, see above');
});

test('a verb prints its next line once per session, then "unchanged"', () => {
  const log = path.join(ROOT, 'out', '_unfiled.runs.jsonl');
  const before = fs.existsSync(log) ? fs.readFileSync(log) : null;
  const run = () => spawnSync(process.execPath, [path.join(ROOT, 'bin/vawe'), 'palette', '--id', 'seed-200'], { cwd: ROOT, encoding: 'utf8', env: { ...process.env, CLAUDE_CODE_SESSION_ID: `next-once-${process.pid}` } }).stdout;
  try {
    assert.match(run(), /\nnext: write the palette/);
    const again = run();
    assert.match(again, /\nnext: unchanged, see above/);
    assert.doesNotMatch(again, /write the palette/);
  } finally {
    if (before) fs.writeFileSync(log, before); else fs.rmSync(log, { force: true });
  }
});
