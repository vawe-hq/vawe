import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CHROME_FIX, doctorHint, doctorHintFromFile } from '../../harness/lib/doctor-hint.mjs';

test('a missing puppeteer or Chrome names the install command without a doctor.json', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'doctor-hint-'));
  for (const error of ["Cannot find package 'puppeteer' imported from /x/render-page.mjs", 'Error: Could not find Chrome (ver. 131.0.6778.204).', 'Error: Tried to find the browser at the configured path (/x/chrome), but no executable was found.']) {
    assert.equal(doctorHintFromFile(root, error), `Chrome for puppeteer is missing. fix: ${CHROME_FIX} (bin/vawe-dev doctor checks every tool)`);
  }
  assert.equal(doctorHintFromFile(root, 'TypeError: x is not a function'), null);
});

test('a failed doctor check that the error mentions names its fix', () => {
  assert.equal(doctorHint('ffmpeg exited 1', [{ tool: 'ffmpeg', ok: false, fix: 'brew install ffmpeg' }]), 'doctor found ffmpeg missing: brew install ffmpeg');
  assert.equal(doctorHint('ffmpeg exited 1', [{ tool: 'ffmpeg', ok: true, fix: null }]), null);
});
