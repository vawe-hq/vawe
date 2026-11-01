import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { rootOfImage, filmOfImage } from '../../harness/live/log-read.mjs';
import { readRuns } from '../../harness/lib/runlog.mjs';

const HOOK = path.resolve('harness/live/log-read.mjs');

test('rootOfImage: the path before the last /out/; the fallback when the path has none', () => {
  assert.equal(rootOfImage('/w/a/out/strip/f/g.png', '/hook'), '/w/a');
  assert.equal(rootOfImage('/w/out/b/out/strip/f/g.png', '/hook'), '/w/out/b');
  assert.equal(rootOfImage('/elsewhere/g.png', '/hook'), '/hook');
});

test('a Read of an image in another checkout is logged in that checkout, as its film', () => {
  const other = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'vawe-readroot-')));
  const image = path.join(other, 'out', 'strip', 'f', 'a.png');
  const r = spawnSync(process.execPath, [HOOK], { input: JSON.stringify({ tool_input: { file_path: image } }), encoding: 'utf8' });
  assert.equal(r.status, 0);
  assert.equal(filmOfImage(image, other), 'f');
  assert.deepEqual(readRuns('f', other).map((x) => [x.cmd, x.image]), [['read', image]]);
});
