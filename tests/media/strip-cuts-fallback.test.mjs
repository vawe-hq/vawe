// `vawe frame --cuts` on a page whose dev skipped the world measure (a canvas film) reads the spans the page declares.
//   node --test tests/media/strip-cuts-fallback.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resolveInput } from '../../harness/media/see/input.mjs';

const PAGE = `<!doctype html><html><head><meta charset="utf-8"><meta name="duration" content="2">
<style>*{margin:0}body{width:160px;height:90px;background:#000}
.w{position:absolute;inset:0;opacity:0}
#a{background:#c00;animation:a 2s linear both}#b{background:#06c;animation:b 2s linear both}
@keyframes a{0%{opacity:1}49%{opacity:1}50%{opacity:0}100%{opacity:0}}
@keyframes b{0%{opacity:0}49%{opacity:0}50%{opacity:1}100%{opacity:1}}</style></head>
<body><div class="w" id="a" data-world="a"></div><div class="w" id="b" data-world="b"></div></body></html>`;

test('cuts() falls back to the page\'s declared worlds when the last draft recorded none', async () => {
  const dir = path.join(os.tmpdir(), `stripcuts${process.pid}`, 'films', `stripcuts${process.pid}`);
  fs.mkdirSync(dir, { recursive: true });
  const page = path.join(dir, 'page.html');
  fs.writeFileSync(page, PAGE);
  try {
    const input = await resolveInput(page);
    const cuts = await input.cuts();
    assert.equal(cuts.length, 1);
    assert.deepEqual([cuts[0].from, cuts[0].to], ['a', 'b']);
    assert.ok(Math.abs(cuts[0].at - 1) < 0.2, `cut at ${cuts[0].at}`);
  } finally { fs.rmSync(path.dirname(path.dirname(dir)), { recursive: true, force: true }); }
});
