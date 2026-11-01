import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { refSpanLine } from '../../harness/media/see/core.mjs';

const SEE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../harness/media/see.mjs');

test('refSpanLine names both lengths past two frames and is silent within them', () => {
  assert.equal(refSpanLine(5.5, 15, 30), 'the reference is 5.5 s and the film 15.0 s');
  assert.equal(refSpanLine(15.05, 15, 30), null);
});

test('measure with a reference shorter than the film stops in under a second and names both lengths', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'measure-span-'));
  const page = path.join(dir, 'page.html');
  fs.writeFileSync(page, '<!doctype html><html><head><meta name="duration" content="15"></head><body></body></html>');
  const ref = path.join(dir, 'ref.mp4');
  execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc=s=160x90:d=5:r=24', '-pix_fmt', 'yuv420p', ref]);
  const t0 = Date.now();
  const r = spawnSync('node', [SEE, page, path.join(dir, 'out'), '--measure', '--ref', ref], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /measured deltas skipped: the reference is 5\.0 s and the film 15\.0 s/);
  assert.ok(Date.now() - t0 < 5000, 'no render started');
});
