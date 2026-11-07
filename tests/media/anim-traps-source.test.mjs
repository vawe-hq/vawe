// The page-source traps of quality/gates/anim-traps.mjs and the auto-length finding. The last test needs Chrome.
//   node --test tests/media/anim-traps-source.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pageTraps } from '../../quality/gates/anim-traps.mjs';

const found = (src, opts) => {
  const out = [];
  pageTraps(src, (what, where, fix) => out.push({ what, where, fix }), opts);
  return out;
};
const module_ = (body) => `<script type="module">${body}</script>`;

test('an absolute or local-server path in a film names the attribute and the fix', () => {
  const bad = ['<img src="/Users/me/a.png">', '<link href="file:///tmp/a.css">', '<video src="http://localhost:3000/a.mp4">', '<div style="background:url(/assets/a.png)">'];
  for (const html of bad) {
    const [f, ...rest] = found(html, { film: true });
    assert.equal(rest.length, 0, html);
    assert.match(f.what, /absolute or local-server path/);
    assert.match(f.fix, /relative to the page/);
  }
  assert.match(found('<img src="/Users/me/a.png">', { film: true })[0].what, /^src="\/Users\/me\/a\.png"/);
});

test('relative paths, data URIs and fragments in a film are clean; a demo page is not checked', () => {
  assert.deepEqual(found('<img src="assets/a.png"><svg><use href="#x"/></svg><div style="background:url(data:image/png;base64,AA)"></div>', { film: true }), []);
  assert.deepEqual(found('<link href="/prompts/moves/demo/demo.css">'), []);
});

test('a px multiple of --vw or --vh names the calc fix', () => {
  const [f] = found('<style>h1 { font-size: calc(var(--vh) * 0.11px); }</style>');
  assert.match(f.what, /--vw\/--vh by a number with px/);
  assert.match(f.fix, /calc\(var\(--vh\) \* 0.11\)/);
  assert.deepEqual(found('<style>h1 { font-size: calc(var(--vh) * 0.11); width: 10px; }</style>'), []);
});

test('a module-level await of something the renderer does not wait for is a finding', () => {
  for (const body of ['await import("./x.js");', 'const x = await new Promise((r) => r());', 'await sleep(10);']) {
    const [f, ...rest] = found(module_(body));
    assert.equal(rest.length, 0, body);
    assert.match(f.what, /module-level "/);
    assert.match(f.fix, /register the hook first/);
  }
});

test('an await the renderer waits for, or one inside a function, is clean', () => {
  const clean = [
    'await document.fonts.ready;',
    'const r = await fetch("data.json");',
    'await img.decode();',
    'window.vawe.onFrame(async () => { await new Promise((r) => r()); });',
    'async function load() { await import("./x.js"); }',
  ];
  for (const body of clean) assert.deepEqual(found(module_(body)), [], body);
  assert.deepEqual(found('<script>const x = 1; // await later</script>'), []);
});

test('a window.seek-only page with auto length gets the add-the-number finding', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vawe-traps-'));
  try {
    const page = path.join(dir, 'page.html');
    fs.writeFileSync(page, '<!doctype html><html><head><meta charset="utf-8"><meta name="duration" content="auto"></head><body><div data-world="a"><h1 id="t">Hi</h1></div><script>window.seek = (t) => { document.getElementById("t").style.opacity = String(Math.min(1, t)); };</script></body></html>');
    const run = spawnSync('node', ['quality/gates/anim-traps.mjs', page], { encoding: 'utf8', env: { ...process.env, VAWE_AGENT: 'page-lints' } });
    assert.equal(run.status, 0, run.stderr);
    assert.match(run.stdout, /the auto length cannot be measured \| <meta name="duration"> \| fix: add <meta name="duration" content="N">/);
    fs.writeFileSync(page, fs.readFileSync(page, 'utf8').replace('content="auto"', 'content="3"'));
    const clean = spawnSync('node', ['quality/gates/anim-traps.mjs', page], { encoding: 'utf8', env: { ...process.env, VAWE_AGENT: 'page-lints' } });
    assert.doesNotMatch(clean.stdout, /auto length/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
