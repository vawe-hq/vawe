// Edges of an auto length: late motion, the aspect, a linked file, a lane, a refusal, the starter in a plain browser. Needs Chrome.
//   node --test tests/media/page-duration-edges.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resolveLength } from '../../harness/media/page-duration.mjs';
import { renderPage, RenderError, openPage, gotoLoaded, settle, resolveFrame } from '../../harness/media/render-page.mjs';
import { lengthNote } from '../../harness/live/dev-warn.mjs';
import { createEditor } from '../../studio/save-edits.mjs';
import { starterPage, starterFace } from '../../harness/cli/new.mjs';

const html = (body, head = '') => `<!doctype html><html><head><meta charset="utf-8"><meta name="duration" content="auto">${head}</head>
<body><section data-world="a"><h1 id="t">Hello</h1></section><script>${body}</script></body></html>`;
const arrive = "document.getElementById('t').animate([{ opacity: 0 }, { opacity: 1 }], { duration: 2000, fill: 'both' });";

const inDir = async (files, fn) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vawe-duration-edge-'));
  for (const [name, text] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), text);
  try { return await fn(path.join(dir, 'page.html'), dir); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
};

test('an auto page that can add motion after load is refused', async () => {
  const refusal = /auto needs every animation to exist at load; state a number/;
  await inDir({ 'page.html': html(`${arrive} window.seek = () => {};`) }, (file) => assert.rejects(resolveLength(file), refusal));
  await inDir({ 'page.html': html(`${arrive} window.vawe.onFrame(() => {});`) }, (file) => assert.rejects(resolveLength(file), refusal));
});

test('the length is measured at the aspect the render uses', async () => {
  const wide = "const tall = window.vawe.aspect === '9:16'; document.getElementById('t').animate([{ opacity: 0 }, { opacity: 1 }], { duration: tall ? 5000 : 2000 });";
  await inDir({ 'page.html': html(wide) }, async (file) => {
    assert.equal((await resolveLength(file, { aspect: '16:9' })).endS, 2);
    assert.equal((await resolveLength(file, { aspect: '9:16' })).endS, 5);
  });
});

test('an edit to a linked script changes the length', async () => {
  const kit = (ms) => `document.getElementById('t').animate([{ opacity: 0 }, { opacity: 1 }], { duration: ${ms} });`;
  await inDir({ 'page.html': html('', '<script defer src="kit.js"></script>'), 'kit.js': kit(2000) }, async (file, dir) => {
    assert.equal((await resolveLength(file)).endS, 2);
    fs.writeFileSync(path.join(dir, 'kit.js'), kit(4000));
    assert.equal((await resolveLength(file)).endS, 4);
  });
});

async function endsIn(file, frame) {
  const { page, url, close } = await openPage(file, frame, { final: false });
  try {
    await gotoLoaded(page, url, file);
    await settle(page);
    return await page.evaluate(() => document.getAnimations().map((a) => a.effect.getComputedTiming().endTime).sort((a, b) => a - b));
  } finally { await close(); }
}

test('a lane takes the length the render resolved and does not measure again', async () => {
  const sized = 'document.body.animate([{ opacity: 0.5 }, { opacity: 1 }], { duration: window.vawe.duration * 1000 });';
  await inDir({ 'page.html': html(arrive + sized) }, async (file) => {
    assert.deepEqual(await endsIn(file, { ...resolveFrame(file, {}), duration: 9 }), [2000, 9000]);
  });
});

test('a refused auto page fails the render with a render error, not a stack trace', async () => {
  await inDir({ 'page.html': html('window.seek = () => {};') }, async (file, dir) => {
    await assert.rejects(renderPage(file, path.join(dir, 'out.mp4'), { fps: 30, workers: 1 }), (e) => e instanceof RenderError && /state a number/.test(e.message));
  });
});

test('the starter reads its length in a plain browser, where window.vawe is missing', async () => {
  const line = starterPage({ length: 7, face: starterFace('zz-demo') }).split('\n').find((l) => l.startsWith('const end ='));
  const { default: puppeteer } = await import('puppeteer');
  const browser = await puppeteer.launch({ headless: true });
  try {
    const tab = await browser.newPage();
    await tab.setContent('<meta name="duration" content="7">');
    assert.equal(await tab.evaluate((code) => new Function(`${code}\nreturn end;`)(), line), 7);
  } finally { await browser.close(); }
});

test('the dev warning names an auto length and says nothing for a stated one', () => {
  assert.match(lengthNote('<meta name="duration" content="auto">')[0], /^length: auto/);
  assert.deepEqual(lengthNote('<meta name="duration" content="5">'), []);
});

test('a studio edit the check rejects leaves the file and the undo stack as they were', async () => {
  await inDir({ 'page.html': '<meta name="duration" content="5"><div style="color: red"></div>' }, async (file) => {
    const before = fs.readFileSync(file, 'utf8');
    const at = before.indexOf('red');
    const editor = createEditor(file);
    const edit = [{ start: at, end: at + 3, expect: 'red', text: 'blue' }];
    await assert.rejects(editor.save(edit, async () => { throw new Error('no length'); }), /no length/);
    assert.equal(fs.readFileSync(file, 'utf8'), before);
    assert.equal(editor.depth(), 0);
    await editor.save(edit, async () => 'ok');
    assert.match(fs.readFileSync(file, 'utf8'), /blue/);
    assert.equal(editor.depth(), 1);
  });
});
