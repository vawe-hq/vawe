import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { refusalOf, verbEvent } from '../../harness/lib/verb-log.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('refusalOf reads the reason of a refused verb from stderr, else null; verbEvent carries help, usage and refused', () => {
  assert.equal(refusalOf('x\nvawe: ship refused: no approval for hud\n'), 'no approval for hud');
  assert.equal(refusalOf('vawe: ship failed'), null);
  const base = { verb: 'ship', args: [], startMs: 0, endMs: 1000, exitCode: 1 };
  assert.equal(verbEvent({ ...base, refused: 'no approval' }).refused, 'no approval');
  assert.equal(verbEvent({ ...base, help: true }).help, true);
  assert.equal(verbEvent({ ...base, usage: true }).usage, true);
  const plain = verbEvent(base);
  assert.ok(!('help' in plain) && !('usage' in plain) && !('refused' in plain));
});

test('help lookups and usage errors are logged with the film, its stage and the page hash', () => {
  const name = `zz-runlog-${process.pid}`;
  const dir = path.join(ROOT, 'films', name);
  const logPath = path.join(ROOT, 'out', `${name}.runs.jsonl`);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'page.html'), '<!doctype html><title>x</title>');
  // An old mtime keeps this page from being the "edited last" film that a parallel test's film-less verb is filed under.
  fs.utimesSync(path.join(dir, 'page.html'), new Date(2000, 0, 1), new Date(2000, 0, 1));
  const vawe = (...args) => spawnSync(process.execPath, [path.join(ROOT, 'bin/vawe'), ...args], { cwd: ROOT, encoding: 'utf8' });
  try {
    vawe('dev', path.join('films', name, 'page.html'), '--help');
    vawe('still', `out/${name}.mp4`, '--at', '1');
    // A hook test running in parallel may log next-shown or taste-shown rows for this film too.
    const [help, usage] = fs.readFileSync(logPath, 'utf8').trim().split('\n').map((l) => JSON.parse(l)).filter((r) => r.cmd === 'verb');
    assert.deepEqual([help.film, help.verb, help.help, help.stage], [name, 'dev', true, 'dev']);
    assert.match(help.pageHash, /^[0-9a-f]{40}$/);
    assert.deepEqual([usage.film, usage.verb, usage.alias, usage.usage, usage.exitCode, usage.stage], [name, 'frame', 'still', true, 2, 'brief']);
    assert.equal(usage.pageHash, help.pageHash);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(logPath, { force: true });
  }
});
