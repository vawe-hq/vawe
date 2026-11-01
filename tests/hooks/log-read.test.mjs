import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { rootOfImage, filmOfImage } from '../../harness/live/log-read.mjs';
import { readRuns } from '../../harness/lib/runlog.mjs';

const HOOK = path.resolve('harness/live/log-read.mjs');

const checkout = (dir) => { fs.mkdirSync(path.join(dir, 'bin'), { recursive: true }); fs.writeFileSync(path.join(dir, 'bin', 'vawe'), ''); return dir; };

test('rootOfImage: the vawe checkout before the last /out/; the fallback for a path with none or outside vawe', () => {
  const w = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'vawe-root-')));
  const a = checkout(path.join(w, 'a'));
  const b = checkout(path.join(w, 'out', 'b'));
  assert.equal(rootOfImage(path.join(a, 'out/strip/f/g.png'), '/hook'), a);
  assert.equal(rootOfImage(path.join(b, 'out/strip/f/g.png'), '/hook'), b);
  assert.equal(rootOfImage(path.join(w, 'site/out/_next/logo.png'), '/hook'), '/hook');
  assert.equal(rootOfImage('/elsewhere/g.png', '/hook'), '/hook');
});

test('a Read of an image in another checkout is logged in that checkout, as its film', () => {
  const other = checkout(fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'vawe-readroot-'))));
  const image = path.join(other, 'out', 'strip', 'f', 'a.png');
  const r = spawnSync(process.execPath, [HOOK], { input: JSON.stringify({ tool_input: { file_path: image } }), encoding: 'utf8' });
  assert.equal(r.status, 0);
  assert.equal(filmOfImage(image, other), 'f');
  assert.deepEqual(readRuns('f', other).map((x) => [x.cmd, x.image]), [['read', image]]);
});
