// splitGlyphs (core/text/split.js): the split text rests exactly where the unsplit text does.
//   node --test tests/media/split-glyphs.test.mjs
// tests/fixtures/pages/split-glyphs.html sets one line in Fraunces (a kerned serif) and splits it by `?by=`.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { serveRepo, REPO_ROOT, RENDER_ARGS } from '../../harness/lib/render-harness.mjs';

let server, browser;
before(async () => {
  const { default: puppeteer } = await import('puppeteer');
  server = await serveRepo({ root: REPO_ROOT });
  browser = await puppeteer.launch({ headless: true, args: RENDER_ARGS });
});
after(async () => { await browser?.close(); server?.close(); });

async function open(query) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 600, deviceScaleFactor: 1 });
  await page.goto(`http://127.0.0.1:${server.port}/tests/fixtures/pages/split-glyphs.html?${query}`, { waitUntil: 'load' });
  await page.waitForFunction('window.__ready === true');
  return page;
}

async function shot(query) {
  const page = await open(query);
  try { return await page.screenshot({ type: 'png', encoding: 'base64' }); } finally { await page.close(); }
}

async function diffRatio(a, b) {
  const page = await browser.newPage();
  try {
    return await page.evaluate(async (x, y) => {
      const load = async (b64) => { const bmp = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob()); const c = new OffscreenCanvas(bmp.width, bmp.height); const g = c.getContext('2d'); g.drawImage(bmp, 0, 0); return g.getImageData(0, 0, bmp.width, bmp.height).data; };
      const [p, q] = [await load(x), await load(y)];
      let ink = 0, off = 0;
      for (let i = 0; i < p.length; i += 4) {
        const dark = p[i] < 128 || q[i] < 128;
        if (dark) ink++;
        if (Math.abs(p[i] - q[i]) > 64) off++;
      }
      return { ink, off, ratio: off / ink };
    }, a, b);
  } finally { await page.close(); }
}

test('a word split by char rests pixel for pixel like the unsplit word', async (t) => {
  const d = await diffRatio(await shot('by=char'), await shot(''));
  t.diagnostic(`differing ink pixels ${d.off} of ${d.ink} (${(d.ratio * 100).toFixed(3)} percent)`);
  assert.ok(d.ratio < 0.005, `${d.off} of ${d.ink} ink pixels differ`);
});

test('a text split by word rests like the unsplit text', async () => {
  const d = await diffRatio(await shot('by=word'), await shot(''));
  assert.ok(d.ratio < 0.005, `${d.off} of ${d.ink} ink pixels differ`);
});

test('a wrapped line with nested markup rests like the unsplit one', async () => {
  const html = encodeURIComponent('Two <em>wavy</em> lines of AVATAR To  wrap here');
  const d = await diffRatio(await shot(`by=char&html=${html}`), await shot(`html=${html}`));
  assert.ok(d.ink > 20000 && d.ratio < 0.005, `${d.off} of ${d.ink} ink pixels differ`);
});

test('a split text still rests like the unsplit text after its font size changes (a viewport-sized font)', async () => {
  const d = await diffRatio(await shot('by=char&size=110px'), await shot('size=110px'));
  assert.ok(d.ratio < 0.005, `${d.off} of ${d.ink} ink pixels differ`);
});

// These three run inside the page.
function splitGaps() {
  const [a, v, t, o] = ['A', 'V', 'T', 'o'].map((c) => window.__glyphs.find((s) => s.textContent === c));
  const left = (s) => s.getBoundingClientRect().left;
  return { av: left(v) - left(a), to: left(o) - left(t) };
}
function unsplitGaps() {
  const node = document.getElementById('t').firstChild;
  const x = (i) => { const r = document.createRange(); r.setStart(node, i); r.setEnd(node, i + 1); return r.getBoundingClientRect().left; };
  return { av: x(1) - x(0), to: x(4) - x(3) };
}
function loneAdvance() { const r = document.createRange(); r.selectNodeContents(document.getElementById('t')); return r.getBoundingClientRect().width; }

async function evalOn(query, fn) {
  const page = await open(query);
  try { return await page.evaluate(fn); } finally { await page.close(); }
}

test('a kerning pair keeps its kerned gap: the letter spans are placed at the shaped x, not the unkerned advance', async () => {
  const split = await evalOn('by=char&text=AV To', splitGaps);
  const natural = await evalOn('text=AV To', unsplitGaps);
  const lone = await evalOn('text=A', loneAdvance);
  assert.ok(Math.abs(split.av - natural.av) < 0.05, `AV gap ${split.av} vs unsplit ${natural.av}`);
  assert.ok(Math.abs(split.to - natural.to) < 0.05, `To gap ${split.to} vs unsplit ${natural.to}`);
  assert.ok(split.av < lone - 5, `AV is tighter (${split.av}) than the unkerned A advance (${lone})`);
});

test('a split before the face loads fails loudly', async () => {
  const page = await open('early=1');
  try { assert.match(await page.evaluate(() => window.__early ?? ''), /is not loaded/); } finally { await page.close(); }
});

test('a bad `by` fails loudly', async () => {
  const page = await open('');
  try {
    const msg = await page.evaluate(async () => { const { splitGlyphs } = await import('/core/text/split.js'); try { splitGlyphs(document.body, { by: 'line' }); return ''; } catch (e) { return e.message; } });
    assert.match(msg, /by must be 'char' or 'word'/);
  } finally { await page.close(); }
});
