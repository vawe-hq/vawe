import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { measurePage, MeasureTimeout, measureLimitS } from '../../harness/media/render-spec.mjs';
import { reusableDraft } from '../../harness/media/see/compare.mjs';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'measure-page-'));
const PAGE = `<!doctype html><html><head><meta name="duration" content="1"><meta name="fps" content="10"></head>
<body><div id="box" style="position:absolute;left:0;top:0;height:20px;width:200px"></div>
<script>window.seek = () => { document.getElementById('box').style.width = window.vawe.layoutSeek ? '100px' : '200px'; };</script></body></html>`;

test('measurePage seeks as a layout seek, so a canvas painted in window.seek is not drawn', async () => {
  const page = path.join(tmp(), 'page.html');
  fs.writeFileSync(page, PAGE);
  const m = await measurePage(page, { log: () => {} });
  const box = m.table.findIndex((t) => t.id === 'box');
  assert.equal(m.frames.length, 10);
  assert.ok(m.frames.every((f) => f[box][3] === 100), 'every frame was a layout seek');
});

test('measurePage stops with MeasureTimeout when the limit passes', async () => {
  const page = path.join(tmp(), 'page.html');
  fs.writeFileSync(page, PAGE);
  await assert.rejects(measurePage(page, { log: () => {}, limitS: 5, now: (() => { let t = 0; return () => (t += 3000); })() }), MeasureTimeout);
});

test('measureLimitS reads VAWE_MEASURE_TIMEOUT and defaults to 300', () => {
  assert.equal(measureLimitS({}), 300);
  assert.equal(measureLimitS({ VAWE_MEASURE_TIMEOUT: '45' }), 45);
});

test('reusableDraft takes a draft newer than the page and as long as the page, and nothing else', () => {
  const dir = tmp();
  const page = path.join(dir, 'page.html');
  fs.writeFileSync(page, PAGE);
  const make = (name, d) => {
    const f = path.join(dir, name);
    execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', `testsrc=s=160x90:d=${d}:r=10`, '-pix_fmt', 'yuv420p', f]);
    return f;
  };
  const full = make('full.mp4', 1), short = make('short.mp4', 0.5);
  const old = new Date(Date.now() - 60000);
  fs.utimesSync(page, old, old);
  assert.equal(reusableDraft(page, 1, 10, full), full);
  assert.equal(reusableDraft(page, 1, 10, short), null);
  assert.equal(reusableDraft(page, 1, 10, null), null);
  fs.utimesSync(full, old, old);
  fs.utimesSync(page, new Date(), new Date());
  assert.equal(reusableDraft(page, 1, 10, full), null);
});
