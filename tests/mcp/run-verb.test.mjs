import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readResult, runVerb } from '../../harness/mcp/run-verb.mjs';
import { resultOf } from '../../harness/lib/verb-log.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('resultOf turns printed text into data: next, absolute images and files', () => {
  const text = 'wrote out/a-draft.mp4\nlook at /abs/x.png and out/y.png\nnext: bin/vawe frame films/a\n';
  const r = resultOf({ verb: 'dev', code: 0, reason: 'ignored on success', text, work: '/w' });
  assert.deepEqual(r, {
    ok: true, verb: 'dev', reason: null, next: 'bin/vawe frame films/a',
    images: ['/abs/x.png', '/w/out/y.png'], files: ['/w/out/a-draft.mp4'], exitCode: 0,
  });
});

test('resultOf keeps the reason and no next for a failed call', () => {
  const r = resultOf({ verb: 'dev', code: 1, reason: 'exit 1: boom', text: 'nothing', work: '/w' });
  assert.deepEqual(r, { ok: false, verb: 'dev', reason: 'exit 1: boom', next: null, images: [], files: [], exitCode: 1 });
});

test('bin/vawe writes the result file named by VAWE_RESULT and prints the same text without it', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vawe-result-test-'));
  const file = path.join(dir, 'r.json');
  try {
    const run = (env) => spawnSync(process.execPath, [path.join(ROOT, 'bin/vawe'), 'nosuch-verb'], { cwd: ROOT, encoding: 'utf8', env: { ...process.env, ...env } });
    const withFile = run({ VAWE_RESULT: file });
    const without = run({ VAWE_RESULT: '' });
    assert.equal(withFile.status, 2);
    assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), {
      ok: false, verb: 'nosuch-verb', reason: 'unknown verb nosuch-verb', next: null, images: [], files: [], exitCode: 2,
    });
    const strip = (t) => t.replace(/ in [\d.]+s/, '');
    assert.equal(strip(withFile.stdout), strip(without.stdout));
    assert.equal(withFile.stderr, without.stderr);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('bin/vawe --help writes an ok result', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vawe-result-test-'));
  const file = path.join(dir, 'r.json');
  try {
    spawnSync(process.execPath, [path.join(ROOT, 'bin/vawe'), 'refs', '--help'], { cwd: ROOT, encoding: 'utf8', env: { ...process.env, VAWE_RESULT: file } });
    assert.equal(readResult(file).ok, true);
    assert.equal(readResult(file).verb, 'refs');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('readResult is null for a missing or half-written file', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vawe-result-test-'));
  try {
    assert.equal(readResult(path.join(dir, 'none.json')), null);
    fs.writeFileSync(path.join(dir, 'half.json'), '{"ok":');
    assert.equal(readResult(path.join(dir, 'half.json')), null);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('runVerb returns the verb result and a failed verb its reason', async () => {
  const ok = await runVerb(['refs', '--help'], { work: ROOT });
  assert.equal(ok.ok, true);
  assert.equal(ok.code, 0);
  const bad = await runVerb(['nosuch-verb'], { work: ROOT });
  assert.equal(bad.ok, false);
  assert.equal(bad.code, 2);
  assert.equal(bad.reason, 'unknown verb nosuch-verb');
  assert.match(bad.output, /FAILED/);
});
