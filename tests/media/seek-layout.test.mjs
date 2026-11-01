// A layout seek tells window.seek and the page's frame hooks that no pixels are read: vawe.layoutSeek is true inside a hook and false after,
// and a full seek leaves it false. Launches Chrome.
//   node --test tests/media/seek-layout.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer';
import { pageArgs } from '../../harness/lib/render-harness.mjs';
import { seekTo, installPageFrame } from '../../core/engine/page-seek.js';

const html = `<!doctype html><script>
window.seen = [];
window.seek = () => { seen.push('seek:' + vawe.layoutSeek); };
vawe.onFrame(() => { seen.push(vawe.layoutSeek); });
</script>`;

test('window.seek and hooks see layoutSeek only during a layout seek', async () => {
  const browser = await puppeteer.launch({ headless: true, args: pageArgs(true) });
  try {
    const page = await browser.newPage();
    await page.evaluateOnNewDocument(`window.__pageSeek = ${seekTo}; (${installPageFrame})(${JSON.stringify({ aspect: '16:9', width: 1920, height: 1080 })});`);
    await page.goto(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    await page.evaluate(() => window.__pageSeek(0.1));
    await page.evaluate(() => window.__pageSeek(0.2, window, true));
    await page.evaluate(() => window.__pageSeek(0.3));
    assert.deepEqual(await page.evaluate(() => window.seen), ['seek:false', false, 'seek:true', true, 'seek:false', false]);
    assert.equal(await page.evaluate(() => vawe.layoutSeek), false);
  } finally { await browser.close(); }
});
