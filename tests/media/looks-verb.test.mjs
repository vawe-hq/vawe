// `vawe frame --looks` on the lens fixture page: one grid per second, a tile per look plus as-is; a page without the lens stops.
//   node --test tests/media/looks-verb.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync, execFileSync } from 'node:child_process';
import { REPO_ROOT } from '../../harness/lib/render-harness.mjs';

const SCRIPT = path.join(REPO_ROOT, 'harness/media/looks.mjs');
const run = (args) => spawnSync('node', [SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });

test('looks renders one labelled grid per second with a tile for as-is and each look', () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'looks-verb-'));
  try {
    const r = run(['tests/fixtures/pages/lens.html', '--at', '0.2,0.6', '--only', 'clean,crt,anamorphic', '--out', out]);
    assert.equal(r.status, 0, r.stderr);
    assert.deepEqual(fs.readdirSync(out).sort(), ['looks-0.2s.png', 'looks-0.6s.png']);
    for (const t of ['0.2', '0.6']) assert.match(r.stdout, new RegExp(`looks: ${t}s  ${out.replace(/[/.]/g, '\\$&')}/looks-${t}s\\.png`));
    const [w, h] = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', path.join(out, 'looks-0.2s.png')], { encoding: 'utf8' }).trim().split(',').map(Number);
    assert.equal(h, 360 * 2, 'four tiles, three per row: two rows of 360 px');
    assert.equal(w, 3 * 576, 'three 16:9 tiles of 324 px under a 36 px label');
  } finally { fs.rmSync(out, { recursive: true, force: true }); }
});

test('looks stops and says so for a page that does not use the lens', () => {
  const r = run(['tests/fixtures/pages/seek-canvas.html', '--at', '0.2']);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /does not use the lens/);
});

test('looks names an unknown look and the valid ones', () => {
  const r = run(['tests/fixtures/pages/lens.html', '--at', '0.2', '--only', 'nope']);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /no look "nope"; valid: clean/);
});
