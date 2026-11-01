import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { appendRun, looksSince, isStripRun, isBoardRun, readHookSeen, lastDraft } from '../../harness/lib/runlog.mjs';

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
  const r = looksSince('f', T, root);
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

test('a strip is a frame call with --cuts or --moment, a board is --board, --directions or see --plan; the old verb rows count too', () => {
  const row = (verb, ...args) => ({ cmd: 'verb', verb, args });
  assert.deepEqual([row('frame', 'p', '--cuts'), row('frame', 'p', '--moment', '2'), row('strip', 'p', '--cuts'), row('frame', 'p', '--at', '2'), row('frame', 'p', '--world', 'all')].map(isStripRun), [true, true, true, false, false]);
  assert.deepEqual([row('frame', 'p', '--board'), row('frame', 'p', '--directions'), row('see', 'p', '--plan'), row('storyboard', 'p'), row('see', 'p'), row('frame', 'p', '--cuts')].map(isBoardRun), [true, true, true, true, false, false]);
});

test('looksSince: a Read of a printed image counts through a symlinked path and outside the checkout', () => {
  const root = tmp();
  const real = fs.realpathSync(tmp());
  const link = path.join(tmp(), 'link');
  fs.symlinkSync(real, link);
  fs.writeFileSync(path.join(real, 'a.png'), '');
  log(root, 'f', [{ cmd: 'verb', verb: 'strip', exitCode: 0, start: iso(1000), images: [path.join(real, 'a.png')] }]);
  log(root, '_unfiled', [{ cmd: 'read', image: path.join(link, 'a.png'), at: iso(2000) }]);
  assert.deepEqual(looksSince('f', T, root).unread, []);
});

test('lastDraft skips a plan-window render', () => {
  const root = tmp();
  const file = path.join(root, 'full.mp4');
  const win = path.join(root, 'f-plan-window.mp4');
  fs.writeFileSync(file, ''); fs.writeFileSync(win, '');
  log(root, 'f', [{ cmd: 'dev', file }, { cmd: 'dev', file: win, planWindow: true }]);
  assert.equal(lastDraft('f', root), file);
});
