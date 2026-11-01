import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
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

test('reusableDraft reuses only a fresh, full, same-fps, same-aspect, sounding draft of the page and its kit files', () => {
  const root = tmp();
  const dir = path.join(root, 'films', 'demo');
  fs.mkdirSync(path.join(dir, 'kit'), { recursive: true });
  fs.mkdirSync(path.join(root, 'out'));
  const page = path.join(dir, 'page.html');
  fs.writeFileSync(page, PAGE.replace('<body>', '<body><link rel="stylesheet" href="kit/a.css">'));
  fs.writeFileSync(path.join(dir, 'kit', 'a.css'), 'body{}');
  const draft = path.join(root, 'out', 'demo-draft.mp4');
  const make = (d, r = 30, extra = []) => execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', `testsrc=s=160x90:d=${d}:r=${r}`, ...extra, '-pix_fmt', 'yuv420p', draft]);
  const old = new Date(Date.now() - 60000);
  for (const f of [page, path.join(dir, 'kit', 'a.css')]) fs.utimesSync(f, old, old);
  make(1);
  assert.equal(reusableDraft(page, 1, 30, '16:9', root), draft);
  make(0.5);
  assert.equal(reusableDraft(page, 1, 30, '16:9', root), null, 'a range draft is too short');
  make(1, 24);
  assert.equal(reusableDraft(page, 1, 30, '16:9', root), null, 'a draft at another fps');
  make(1);
  assert.equal(reusableDraft(page, 1, 30, '9:16', root), null, 'a draft of another aspect');
  fs.writeFileSync(page, fs.readFileSync(page, 'utf8').replace('<body>', '<body><audio src="x.wav"></audio>'));
  fs.utimesSync(page, old, old);
  assert.equal(reusableDraft(page, 1, 30, '16:9', root), null, 'a silent draft of a page with audio');
  fs.writeFileSync(page, PAGE.replace('<body>', '<body><link rel="stylesheet" href="kit/a.css">'));
  fs.utimesSync(page, old, old);
  fs.writeFileSync(path.join(dir, 'kit', 'a.css'), 'body{color:red}');
  assert.equal(reusableDraft(page, 1, 30, '16:9', root), null, 'a kit file edited after the draft');
});

test('the render-spec CLI reports a measure timeout in one line, no stack', () => {
  const page = path.join(tmp(), 'page.html');
  fs.writeFileSync(page, PAGE);
  const r = spawnSync('node', [path.resolve('harness/media/render-spec.mjs'), page, '--out', path.join(path.dirname(page), 'o')], { encoding: 'utf8', env: { ...process.env, VAWE_MEASURE_TIMEOUT: '0.001' } });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /measure stopped at frame \d+ of 10 after 0\.001 s: raise the limit with VAWE_MEASURE_TIMEOUT/);
  assert.doesNotMatch(r.stderr, /\n\s+at /);
});
