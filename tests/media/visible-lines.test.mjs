// tests/media/visible-lines.test.mjs: the draft's text probe leaves out aria-hidden text, flags data-chrome text
// and gives the joined text of an element whose letters sit in separate spans. Needs Chrome.
//   node --test tests/media/visible-lines.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openPage, settle, resolveFrame } from '../../harness/media/render-page.mjs';
import { readLines } from '../../harness/media/draft-check.mjs';
import { lineFor } from '../../harness/lib/spec-conformance.mjs';

const PAGE = 'tests/fixtures/pages/decorative-text.html';

test('a line keeps its block id when lines before it come and go, wrapped text lists its line boxes, and a line names its world', async () => {
  const stable = 'tests/fixtures/pages/stable-blocks.html';
  const opened = await openPage(stable, resolveFrame(stable, {}));
  try {
    await opened.page.goto(opened.url, { waitUntil: 'load' });
    await settle(opened.page);
    const read = () => readLines(opened.page);
    const before = (await read()).lines;
    await opened.page.evaluate(() => { document.getElementById('early').style.visibility = 'hidden'; });
    const after = (await read()).lines;
    const block = (lines, text) => lines.find((l) => l.text === text).block;
    assert.equal(block(after, 'Reads it'), block(before, 'Reads it'));
    assert.equal(before.find((l) => l.text === 'Reads it').world, 'a');
    const wrapped = before.find((l) => l.text.startsWith('one two'));
    assert.ok(wrapped.rects.length > 1);
    assert.ok(wrapped.rects.every((r) => r[3] < wrapped.box[3]));
    assert.equal(before.find((l) => l.text === 'Reads it').rects, undefined);
  } finally { await opened.close(); }
});

test('a flex row is one line: tilted letters that touch are glued into one word, spaced items share the line but stay separate words', async () => {
  const fixture = 'tests/fixtures/pages/flex-letters.html';
  const opened = await openPage(fixture, resolveFrame(fixture, {}));
  try {
    await opened.page.goto(opened.url, { waitUntil: 'load' });
    await settle(opened.page);
    const { lines } = await readLines(opened.page);
    const [s, h, i, p] = ['S', 'H', 'I', 'P'].map((t) => lines.find((l) => l.text === t));
    assert.equal(new Set([s, h, i, p].map((l) => l.block)).size, 1);
    assert.deepEqual([s, h, i, p].map((l) => Boolean(l.glued)), [false, true, true, true]);
    const [home, pricing] = ['Home', 'Pricing'].map((t) => lines.find((l) => l.text === t));
    assert.equal(home.block, pricing.block);
    assert.equal(pricing.glued, undefined);
  } finally { await opened.close(); }
});

test('texture by measure is not probed and chrome texture is flagged; hidden text that reads as copy is probed and counted; split letters join into one text', async () => {
  const opened = await openPage(PAGE, resolveFrame(PAGE, {}));
  try {
    await opened.page.goto(opened.url, { waitUntil: 'load' });
    await settle(opened.page);
    const sample = await readLines(opened.page);
    const texts = sample.lines.map((l) => l.text);
    assert.ok(texts.includes('Read this'));
    assert.ok(!texts.some((t) => /invoices|flood/.test(t)), 'aria-hidden text with a texture reason must be skipped');
    assert.ok(texts.includes('Quarterly total'), 'aria-hidden text that reads as copy is checked as copy');
    assert.deepEqual([sample.hidden.total, sample.hidden.marked, sample.hidden.reads, sample.hidden.sample], [10, 5, 1, ['Quarterly total']]);
    assert.deepEqual(sample.lines.filter((l) => l.chrome).map((l) => l.text), ['Inbox', '(3)']);
    assert.ok(!sample.lines.find((l) => l.text === 'Read this').chrome);
    assert.equal(lineFor(sample, 'Ship').text, 'Ship');
    assert.equal(lineFor(sample, 'Inbox (3)').text, 'Inbox (3)');
  } finally { await opened.close(); }
});

test('text under an overflow clip counts only while the clip shows it, and a line carries the ink of its font unless it is turned', async () => {
  const page = 'tests/fixtures/pages/clipped-text.html';
  const opened = await openPage(page, resolveFrame(page, {}));
  try {
    await opened.page.goto(opened.url, { waitUntil: 'load' });
    await settle(opened.page);
    const { lines } = await readLines(opened.page);
    assert.deepEqual(lines.map((l) => l.text), ['Shown inside', 'Tilted']);
    const [shown, tilted] = lines;
    assert.ok(shown.ink.top > 0 && shown.ink.top < 0.6 && shown.ink.bottom > 0 && shown.ink.bottom < 0.5, JSON.stringify(shown.ink));
    assert.equal(tilted.ink, undefined);
  } finally { await opened.close(); }
});
