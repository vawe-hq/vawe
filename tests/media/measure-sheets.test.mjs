import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { writeSheets } from '../../harness/media/see/compare.mjs';

test('writeSheets awaits the frame compare and records the sheet path of each low-confidence delta', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'measure-sheets-'));
  const clip = path.join(dir, 'clip.mp4');
  execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc=s=160x90:d=2:r=24', '-pix_fmt', 'yuv420p', clip]);
  const result = { deltas: [{ confidence: 'low', refT: 0.5, t: 1 }, { confidence: 'high', refT: 0.2, t: 0.2 }] };
  await writeSheets(result, clip, clip, dir, 1.9);
  assert.equal(typeof result.deltas[0].sheet, 'string');
  assert.ok(fs.existsSync(path.resolve(result.deltas[0].sheet)));
  assert.equal(result.deltas[1].sheet, undefined);
});
