// A failing bin/vawe call exits with a code that names the cause.   node --test tests/lib/exit-codes.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { EXIT, EXIT_CAUSE, exitCodeOf, ExitError } from '../../harness/lib/exit-codes.mjs';
import { causeOf } from '../../harness/lib/verb-log.mjs';
import { UsageError, topHelp } from '../../harness/cli/parse.mjs';
import { InvariantError, RenderError } from '../../harness/media/render-page.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const env = { ...process.env, VAWE_AGENT: 'exit-codes-test' };

function vawe(...args) {
  return spawnSync(process.execPath, [path.join(ROOT, 'bin/vawe'), ...args], { cwd: ROOT, encoding: 'utf8', env });
}

function withFilm(fn, aspect = '16:9') {
  const name = `zz-exit-codes-${process.pid}`;
  const dir = path.join(ROOT, 'films', name);
  const unfiled = path.join(ROOT, 'out', '_unfiled.runs.jsonl');
  const before = fs.existsSync(unfiled) ? fs.readFileSync(unfiled) : null;
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'page.html'), `<!doctype html><title>x</title><meta name="aspect" content="${aspect}">`);
  try { return fn(path.relative(ROOT, path.join(dir, 'page.html'))); } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(path.join(ROOT, 'out', `${name}.runs.jsonl`), { force: true });
    if (before) fs.writeFileSync(unfiled, before); else fs.rmSync(unfiled, { force: true });
  }
}

test('the codes are distinct and each failure code names a cause', () => {
  assert.equal(new Set(Object.values(EXIT)).size, Object.keys(EXIT).length);
  for (const code of [EXIT.USAGE, EXIT.CONTRACT, EXIT.BROWSER, EXIT.IO, EXIT.REFUSED]) assert.ok(EXIT_CAUSE[code], `code ${code}`);
});

test('an error asks for its own code, a lost browser or a navigation timeout asks for 4, else 1', () => {
  assert.equal(exitCodeOf(new ExitError(EXIT.IO, 'x')), EXIT.IO);
  assert.equal(exitCodeOf(new UsageError('x')), EXIT.USAGE);
  assert.equal(exitCodeOf(new RenderError('x')), EXIT.CONTRACT);
  assert.equal(exitCodeOf(new InvariantError(['x'], EXIT.BROWSER)), EXIT.BROWSER);
  assert.equal(exitCodeOf(Object.assign(new Error('Navigation timeout of 30000 ms exceeded'), { name: 'TimeoutError' })), EXIT.BROWSER);
  assert.equal(exitCodeOf(new Error('Protocol error (Runtime.evaluate): Target closed')), EXIT.BROWSER);
  assert.equal(exitCodeOf(new Error('boom')), EXIT.ERROR);
  assert.equal(exitCodeOf(Object.assign(new Error('boom'), { exitCode: 99 })), EXIT.ERROR);
});

test('causeOf reads the code first and the reason text only for exit 1 or an old log line', () => {
  assert.equal(causeOf('exit 5: anything', EXIT.IO), 'file or IO');
  assert.equal(causeOf('exit 6: vawe: ship refused: x', EXIT.REFUSED), 'refused by a gate');
  assert.equal(causeOf('exit 4: lost', EXIT.BROWSER), 'browser or render slot');
  assert.equal(causeOf('exit 4: Navigation timeout of 30000 ms', EXIT.BROWSER), 'render slot or navigation timeout');
  assert.equal(causeOf('exit 4: detached Frame', EXIT.BROWSER), 'browser lost');
  assert.equal(causeOf('exit 1: detached Frame', EXIT.ERROR), 'browser lost');
  assert.equal(causeOf('exit 1: no such page: a.html'), 'bad arguments');
  assert.equal(causeOf('killed by SIGKILL', 137), 'killed');
});

test('vawe --help lists the exit codes', () => {
  assert.match(topHelp([{ name: 'a', summary: 's', tier: 'core' }]), /exit codes: 0 ok, 1 other error, 2 bad flag or argument, 3 .*, 6 refused by a gate/);
});

test('a bad flag exits 2', () => {
  const r = vawe('wait', '--bogus');
  assert.equal(r.status, EXIT.USAGE);
  assert.match(r.stdout, /vawe: wait FAILED \(unknown flag --bogus/);
});

test('a page that does not exist exits 5', () => {
  const r = vawe('frame', 'films/zz-no-such-film/page.html', '--world', 'all');
  assert.equal(r.status, EXIT.IO);
  assert.match(r.stdout, /vawe: frame FAILED \(no such page/);
  const ship = vawe('ship', 'films/zz-no-such-film/page.html');
  assert.equal(ship.status, EXIT.IO);
});

test('ship without a review and the approval exits 6 and keeps its footer', () => {
  withFilm((page) => {
    const r = vawe('ship', page);
    assert.equal(r.status, EXIT.REFUSED);
    assert.match(r.stderr, /vawe: ship refused: /);
    assert.match(r.stdout, /^vawe: ship FAILED \(.*ship refused.*\) in \d+\.\ds$/m);
  });
});

test('a page whose meta breaks the contract exits 3', () => {
  withFilm((page) => {
    const r = spawnSync(process.execPath, [path.join(ROOT, 'harness/media/render-page.mjs'), page, path.join(os.tmpdir(), `zz-exit-codes-${process.pid}.mp4`)], { cwd: ROOT, encoding: 'utf8', env });
    assert.equal(r.status, EXIT.CONTRACT);
    assert.match(r.stderr, /unknown aspect/);
  }, '7:0');
});

test('a browser lost on every attempt exits 4', () => {
  const out = path.join(os.tmpdir(), `zz-exit-codes-lost-${process.pid}.mp4`);
  const r = spawnSync(process.execPath, [path.join(ROOT, 'harness/media/render-page.mjs'), 'tests/fixtures/pages/seek-canvas.html', out, '--fps', '240', '--dur', '0.5', '--w', '160', '--h', '90', '--workers', '1'],
    { cwd: ROOT, encoding: 'utf8', env: { ...env, VAWE_TEST_SLICE_FAULT: '60:9' } });
  try {
    assert.equal(r.status, EXIT.BROWSER, r.stderr);
    assert.match(r.stderr, /lost its page/);
  } finally {
    fs.rmSync(out, { force: true });
    for (const n of fs.readdirSync(os.tmpdir()).filter((f) => f.includes('zz-exit-codes-lost'))) fs.rmSync(path.join(os.tmpdir(), n), { recursive: true, force: true });
  }
});
