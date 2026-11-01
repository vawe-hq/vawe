// `vawe frame /abs/other/page.html` loads core/ and assets/ from the running checkout and the page's own files from its folder.
// Needs Chrome.   node --test tests/media/still-outside-checkout.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { servedFile } from '../../harness/lib/render-harness.mjs';

const VAWE = path.resolve('bin/vawe');
const px = (f, x, y) => [...spawnSync('ffmpeg', ['-v', 'error', '-i', f, '-vf', `crop=1:1:${x}:${y},format=rgb24`, '-f', 'rawvideo', '-'], { encoding: 'buffer' }).stdout];

// green when core/layout/aspects.js is this checkout's, red when it is the stale one beside the page
const PAGE = `<!doctype html><html><head><meta charset="utf-8"><meta name="duration" content="1">
<link rel="stylesheet" href="own.css"><style>html,body{margin:0;height:100%}</style></head>
<body><div id="own"></div>
<script type="module">
import { ASPECTS } from '../../core/layout/aspects.js';
document.body.style.background = ASPECTS['16:9'] ? '#00ff00' : '#ff0000';
</script></body></html>`;

function stillOf(page, dir) {
  const out = path.join(dir, 'out.png');
  const r = spawnSync(process.execPath, [VAWE, 'still', page, '--at', '0', '--out', out], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  return out;
}

test('a page in another checkout is served that checkout\'s folder for the page and this checkout\'s core/', () => {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'vawe-other-')));
  try {
    fs.mkdirSync(path.join(dir, 'core/layout'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'core/layout/aspects.js'), 'export const ASPECTS = {};\n');
    fs.mkdirSync(path.join(dir, 'films/x'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'films/x/page.html'), PAGE);
    fs.writeFileSync(path.join(dir, 'films/x/own.css'), '#own{width:100px;height:100px;background:#0000ff}');
    assert.equal(spawnSync('git', ['init', '-q'], { cwd: dir }).status, 0);
    const out = stillOf(path.join(dir, 'films/x/page.html'), dir);
    assert.deepEqual(px(out, 500, 500), [0, 255, 0], 'core/ came from the other checkout');
    assert.deepEqual(px(out, 10, 10), [0, 0, 255], 'the page\'s own stylesheet did not load');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('a page in no repo, at any depth, gets this checkout\'s core/ and its own files', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vawe-norepo-'));
  try {
    fs.writeFileSync(path.join(dir, 'page.html'), PAGE);
    fs.writeFileSync(path.join(dir, 'own.css'), '#own{width:100px;height:100px;background:#0000ff}');
    const out = stillOf(path.join(dir, 'page.html'), dir);
    assert.deepEqual(px(out, 500, 500), [0, 255, 0], 'core/ did not load');
    assert.deepEqual(px(out, 10, 10), [0, 0, 255], 'the page\'s own stylesheet did not load');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('servedFile prefers the mount folder under its prefix, falls back to root, and never leaves either', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vawe-root-'));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vawe-mount-'));
  try {
    fs.mkdirSync(path.join(root, 'core'));
    fs.writeFileSync(path.join(root, 'core/a.js'), 'root');
    fs.writeFileSync(path.join(dir, 'a.js'), 'mount');
    fs.writeFileSync(path.join(dir, 'b.css'), 'mount');
    const mounts = [{ prefix: 'films/x', dir }];
    assert.equal(servedFile(root, mounts, 'films/x/b.css'), path.join(dir, 'b.css'));
    assert.equal(servedFile(root, mounts, 'core/a.js'), path.join(root, 'core/a.js'));
    assert.equal(servedFile(root, mounts, 'films/x/../../../etc/passwd'), null);
    assert.equal(servedFile(root, mounts, 'films/x'), null);
    assert.equal(servedFile(root, [{ prefix: '', dir }], 'b.css'), path.join(dir, 'b.css'));
    assert.equal(servedFile(root, [{ prefix: '', dir }], 'core/a.js'), path.join(root, 'core/a.js'));
  } finally { fs.rmSync(root, { recursive: true, force: true }); fs.rmSync(dir, { recursive: true, force: true }); }
});
