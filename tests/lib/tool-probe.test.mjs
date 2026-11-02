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

test('a missing doctor.json runs the probe once and prints its line only when a tool is missing', () => {
  let runs = 0;
  const root = rootWith(null);
  const run = () => { runs += 1; fs.mkdirSync(path.join(root, '.vawe')); fs.writeFileSync(path.join(root, '.vawe', 'doctor.json'), JSON.stringify(CHECKS)); };
  assert.match(toolProbeLine(root, { run }), /ffmpeg: brew install ffmpeg/);
  assert.equal(runs, 1);
  assert.match(toolProbeLine(root, { run }), /ffmpeg/);
  assert.equal(runs, 1, 'a fresh result is not probed again');
});

test('a clean fresh probe prints nothing and runs nothing; a stale one probes again', () => {
  let runs = 0;
  const run = () => { runs += 1; };
  assert.equal(toolProbeLine(rootWith([CHECKS[1]]), { run }), null);
  assert.equal(runs, 0);
  assert.equal(toolProbeLine(rootWith([CHECKS[1]], PROBE_MAX_AGE_MS + 1000), { run }), null);
  assert.equal(runs, 1);
});
