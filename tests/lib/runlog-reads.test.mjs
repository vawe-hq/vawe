import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { appendRun, looksSince, readHookSeen } from '../../harness/lib/runlog.mjs';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'vawe-reads-'));
const log = (root, film, rows) => {
  fs.mkdirSync(path.join(root, 'out'), { recursive: true });
  fs.writeFileSync(path.join(root, 'out', `${film}.runs.jsonl`), rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
};
const T = Date.parse('2026-11-01T10:00:00Z');
const iso = (ms) => new Date(T + ms).toISOString();

test('looksSince: printed strips minus the images Read since, across every film log', () => {
  const root = tmp();
  log(root, 'f', [
    { cmd: 'verb', verb: 'strip', exitCode: 0, start: iso(1000), images: ['out/strip/f/a.png', 'out/strip/f/b.png'] },
    { cmd: 'verb', verb: 'strip', exitCode: 1, start: iso(1500), images: ['out/strip/f/failed.png'] },
    { cmd: 'verb', verb: 'strip', exitCode: 0, start: iso(-5000), images: ['out/strip/f/old.png'] },
  ]);
  log(root, 'f-cut-3', [
    { cmd: 'read', image: path.join(root, 'out/strip/f/a.png'), at: iso(2000) },
    { cmd: 'read', image: path.join(root, 'out/strip/f/b.png'), at: iso(-9000) },
  ]);
  const r = looksSince('f', 'strip', T, root);
  assert.deepEqual(r.printed.map((p) => path.relative(root, p)), ['out/strip/f/a.png', 'out/strip/f/b.png']);
  assert.deepEqual(r.unread.map((p) => path.relative(root, p)), ['out/strip/f/b.png']);
});

test('readHookSeen: a read event in any log or a settings file naming the hook; else false', () => {
  const root = tmp();
  const home = tmp();
  assert.equal(readHookSeen(root, home), false);
  log(root, 'f', [{ cmd: 'verb', verb: 'strip', exitCode: 0, start: iso(0), images: [] }]);
  assert.equal(readHookSeen(root, home), false);
  fs.mkdirSync(path.join(home, '.claude'));
  fs.writeFileSync(path.join(home, '.claude', 'settings.json'), '{"hooks":{"PostToolUse":[{"matcher":"Read","hooks":[{"command":"node harness/live/log-read.mjs"}]}]}}');
  assert.equal(readHookSeen(root, home), true);
  fs.rmSync(path.join(home, '.claude'), { recursive: true });
  log(root, 'g', [{ cmd: 'read', image: 'x.png', at: iso(0) }]);
  assert.equal(readHookSeen(root, home), true);
});

test('readHookSeen: a read event older than the draft does not count, one since it does', () => {
  const root = tmp();
  const home = tmp();
  log(root, 'f', [{ cmd: 'read', image: 'x.png', at: iso(-5000) }]);
  assert.equal(readHookSeen(root, home, T), false);
  log(root, 'f', [{ cmd: 'read', image: 'x.png', at: iso(-5000) }, { cmd: 'read', image: 'y.png', at: iso(10) }]);
  assert.equal(readHookSeen(root, home, T), true);
});
