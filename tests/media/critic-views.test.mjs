import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pngsSince, MAX_CUT_STRIPS } from '../../harness/lib/critique-summary.mjs';

const touch = (f, ageS) => { fs.writeFileSync(f, 'x'); const t = new Date(Date.now() - ageS * 1000); fs.utimesSync(f, t, t); };

test('pngsSince keeps the strips written at or after the draft, sorted, capped', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'critic-views-'));
  const mp4 = path.join(dir, 'film-draft.mp4');
  touch(mp4, 100);
  touch(path.join(dir, 'old.png'), 500);
  for (let i = 1; i <= MAX_CUT_STRIPS + 3; i++) touch(path.join(dir, `cut-${String(i).padStart(2, '0')}.png`), 10);
  touch(path.join(dir, 'notes.md'), 10);
  const got = pngsSince(dir, mp4);
  assert.equal(got.length, MAX_CUT_STRIPS);
  assert.ok(got.every((f) => f.endsWith('.png') && !f.endsWith('old.png')));
  assert.deepEqual(got, [...got].sort());
});

test('pngsSince is empty without a draft', () => {
  assert.deepEqual(pngsSince(os.tmpdir(), null), []);
  assert.deepEqual(pngsSince(os.tmpdir(), '/no/such/draft.mp4'), []);
});

test('pngsSince orders strips by film second, not by path', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'critic-views-'));
  const mp4 = path.join(dir, 'film-draft.mp4');
  touch(mp4, 100);
  for (const s of ['10.5-12.5', '2-4', '9-11']) { fs.mkdirSync(path.join(dir, `shot-${s}`)); touch(path.join(dir, `shot-${s}`, 'grid-01.png'), 10); }
  assert.deepEqual(pngsSince(dir, mp4).map((f) => path.basename(path.dirname(f))), ['shot-2-4', 'shot-9-11', 'shot-10.5-12.5']);
});
