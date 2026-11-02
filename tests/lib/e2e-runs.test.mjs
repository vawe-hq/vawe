import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { oldRuns, pruneRuns, trackedPages, trackedFiles } from '../../harness/lib/e2e-runs.mjs';

const stamps = ['2026-10-01T10-00-00-000Z', '2026-10-03T10-00-00-000Z', '2026-10-02T10-00-00-000Z', '2026-10-04T10-00-00-000Z'];

test('oldRuns names every run but the newest keep, whatever the list order', () => {
  assert.deepEqual(oldRuns(stamps, 2), ['2026-10-01T10-00-00-000Z', '2026-10-02T10-00-00-000Z']);
});

test('oldRuns names nothing when there are at most keep runs', () => {
  assert.deepEqual(oldRuns(stamps, 4), []);
  assert.deepEqual(oldRuns(stamps, 9), []);
});

test('oldRuns never names latest.json or any other entry', () => {
  assert.deepEqual(oldRuns(['latest.json', 'notes', ...stamps], 1), [...stamps].sort().slice(0, 3));
});

test('pruneRuns deletes only the old run directories and keeps latest.json', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-runs-'));
  try {
    for (const s of stamps) fs.mkdirSync(path.join(dir, s, 'renders'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'latest.json'), '{}');
    pruneRuns(dir, 2);
    assert.deepEqual(fs.readdirSync(dir).sort(), ['2026-10-03T10-00-00-000Z', '2026-10-04T10-00-00-000Z', 'latest.json']);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('e2e renders tracked pages only, not an untracked work-in-progress film', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-tracked-'));
  const write = (f) => { fs.mkdirSync(path.dirname(path.join(root, f)), { recursive: true }); fs.writeFileSync(path.join(root, f), '<p>x</p>'); };
  write('films/examples/kept/page.html');
  write('films/wip/page.html');
  const git = (...a) => execFileSync('git', a, { cwd: root });
  git('init', '-q');
  git('add', 'films/examples/kept/page.html');
  const pages = ['films/examples/kept/page.html', 'films/wip/page.html'];
  assert.deepEqual(trackedPages(pages, trackedFiles(root, ['films'])), ['films/examples/kept/page.html']);
});
