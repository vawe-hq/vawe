import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { drawtextFont, filterPath } from '../../harness/lib/scratch.mjs';

test('drawtextFont is a whole fontfile option with the drive colon escaped for a filtergraph, or empty', () => {
  if (!drawtextFont) return;
  assert.match(drawtextFont, /^fontfile=[^\\]*(?:\\\\:[^\\]*)*:$/);
  if (process.platform === 'win32') assert.match(drawtextFont, /^fontfile=[A-Za-z]\\\\:\/.+\.tt[fc]:$/i);
});

test('ffmpeg draws text with drawtextFont and no fontconfig config', (t) => {
  if (spawnSync('ffmpeg', ['-version']).error) { t.skip('no ffmpeg'); return; }
  const env = { ...process.env };
  delete env.FONTCONFIG_FILE;
  const r = spawnSync('ffmpeg', ['-hide_banner', '-v', 'error', '-f', 'lavfi', '-i', 'color=c=black:s=64x64:d=0.1',
    '-vf', `drawtext=${drawtextFont}text='%{pts\\:flt}s'`, '-frames:v', '1', '-f', 'null', '-'], { encoding: 'utf8', env });
  assert.equal(r.status, 0, r.stderr);
  if (drawtextFont) assert.doesNotMatch(r.stderr, /fontconfig/i);
});

test('filterPath writes a Windows path as a filtergraph option value and leaves a POSIX one alone', () => {
  assert.equal(filterPath(String.raw`C:\Users\a b\x.txt`), String.raw`C\\:/Users/a b/x.txt`);
  assert.equal(filterPath('/tmp/a b/x.txt'), '/tmp/a b/x.txt');
});
