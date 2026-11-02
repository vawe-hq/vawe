// Three renders started at once with two render slots: one waits, says so in one line, and all three finish.
// Needs Chrome and ffmpeg.   node --test tests/media/render-slots.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const PAGE = 'tests/fixtures/pages/seek-canvas.html';

const render = (out, env) => new Promise((resolve) => {
  const child = spawn(process.execPath, ['harness/media/render-page.mjs', PAGE, out, '--fps', '120', '--w', '160', '--h', '90', '--workers', '1', '--fast'], { env });
  let stdout = '', stderr = '';
  child.stdout.on('data', (d) => { stdout += d; });
  child.stderr.on('data', (d) => { stderr += d; });
  child.on('close', (code) => resolve({ code, stdout, stderr }));
});

test('three concurrent renders with two slots: the third waits and all finish', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vawe-slot-renders-'));
  const env = { ...process.env, VAWE_RENDER_SLOTS: '2', VAWE_RENDER_SLOT_DIR: path.join(dir, 'slots') };
  try {
    const runs = await Promise.all([1, 2, 3].map((n) => render(path.join(dir, `r${n}.mp4`), env)));
    for (const r of runs) assert.equal(r.code, 0, r.stderr);
    const waited = runs.filter((r) => /waiting for a render slot \(2 in use: seek-canvas \(draft, pid \d+(?:, running \d+s)?\), seek-canvas \(draft, pid \d+(?:, running \d+s)?\)\)/.test(r.stdout));
    assert.ok(waited.length >= 1, runs.map((r) => r.stdout).join('\n---\n'));
    for (const n of [1, 2, 3]) assert.ok(fs.statSync(path.join(dir, `r${n}.mp4`)).size > 0);
    assert.deepEqual(fs.readdirSync(path.join(dir, 'slots')), [], 'every slot is released');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
