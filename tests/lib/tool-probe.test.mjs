import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { missingLine, toolProbeLine, PROBE_MAX_AGE_MS } from '../../harness/lib/tool-probe.mjs';

const CHECKS = [
  { tool: 'ffmpeg', required: true, ok: false, fix: 'brew install ffmpeg' },
  { tool: 'chrome', required: true, ok: true, fix: null },
  { tool: 'tesseract', required: false, ok: false, fix: 'brew install tesseract' },
];

const rootWith = (checks, ageMs = 0) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vawe-probe-'));
  if (checks) {
    const file = path.join(root, '.vawe', 'doctor.json');
    fs.mkdirSync(path.dirname(file));
    fs.writeFileSync(file, JSON.stringify(checks));
    const then = new Date(Date.now() - ageMs);
    fs.utimesSync(file, then, then);
  }
  return root;
};

test('one line names each required tool that is missing and its fix; an optional tool adds nothing', () => {
  assert.equal(missingLine(CHECKS), 'install the missing tool before dev: ffmpeg: brew install ffmpeg');
  assert.equal(missingLine(CHECKS.slice(1)), null);
});

test('a missing doctor.json runs the probe and prints its line when a tool is missing; a result with a missing tool is probed again', () => {
  let runs = 0;
  const root = rootWith(null);
  const run = () => { runs += 1; fs.mkdirSync(path.join(root, '.vawe'), { recursive: true }); fs.writeFileSync(path.join(root, '.vawe', 'doctor.json'), JSON.stringify(CHECKS)); return { status: 1 }; };
  assert.match(toolProbeLine(root, { run }), /ffmpeg: brew install ffmpeg/);
  assert.equal(runs, 1);
  assert.match(toolProbeLine(root, { run }), /ffmpeg/);
  assert.equal(runs, 2, 'the user may have installed the tool since');
});

test('a doctor that crashed, timed out or left no list gives one line that names the exit and bin/vawe-dev doctor', () => {
  const line = (result, content) => {
    const root = rootWith(null);
    return toolProbeLine(root, { run: () => { if (content !== undefined) { fs.mkdirSync(path.join(root, '.vawe')); fs.writeFileSync(path.join(root, '.vawe', 'doctor.json'), content); } return result; } });
  };
  assert.equal(line({ status: 2 }), 'tool probe could not run (doctor exit 2): run bin/vawe-dev doctor');
  assert.equal(line({ status: null, signal: 'SIGTERM' }), 'tool probe could not run (doctor exit SIGTERM): run bin/vawe-dev doctor');
  assert.match(line({ status: 0 }, '{"not":"a list"}'), /^tool probe could not run \(doctor exit 0\)/);
  assert.match(line({ status: 0 }, 'not json'), /^tool probe could not run/);
  assert.equal(line({ status: 0 }, JSON.stringify([CHECKS[1]])), null);
});

test('a clean fresh probe prints nothing and runs nothing; a stale one probes again', () => {
  let runs = 0;
  const run = () => { runs += 1; return { status: 0 }; };
  assert.equal(toolProbeLine(rootWith([CHECKS[1]]), { run }), null);
  assert.equal(runs, 0);
  const stale = rootWith([CHECKS[1]], PROBE_MAX_AGE_MS + 1000);
  const rewrite = () => { runs += 1; fs.writeFileSync(path.join(stale, '.vawe', 'doctor.json'), JSON.stringify([CHECKS[1]])); return { status: 0 }; };
  assert.equal(toolProbeLine(stale, { run: rewrite }), null);
  assert.equal(runs, 1);
});
