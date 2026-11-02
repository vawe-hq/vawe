// A page that awaits an image decode at module level registers vawe.onFrame late. The first seek waits for it, so frame 0 is not blank.
// Needs Chrome.   node --test tests/media/page-ready.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { openPage, resolveFrame, gotoLoaded, seekAll } from '../../harness/media/render-page.mjs';
import { awaitReady } from '../../core/engine/page-seek.js';

const PAGE = 'tests/fixtures/pages/module-await-decode.html';

test('the first seek of a page with a module-level image decode runs its hook', async () => {
  const opened = await openPage(PAGE, resolveFrame(PAGE, { aspect: '16:9', final: false }), { final: false });
  try {
    await gotoLoaded(opened.page, opened.url, PAGE);
    assert.equal(await opened.page.evaluate(() => (window.__vaweFrameHooks || []).length), 0, 'the load event fires before the module finishes');
    await seekAll(opened.page, 0);
    assert.equal(await opened.page.evaluate(() => getComputedStyle(document.getElementById('box')).opacity), '1');
    assert.equal(await opened.page.evaluate(() => window.__pageReadyDone), true);
  } finally { await opened.close(); }
});

test('a font load the page starts itself counts as pending until it settles', async () => {
  const opened = await openPage(PAGE, resolveFrame(PAGE, { aspect: '16:9', final: false }), { final: false });
  try {
    await gotoLoaded(opened.page, opened.url, PAGE);
    const pending = await opened.page.evaluate(async () => {
      const loading = new FontFace('PendingFont', 'url(/assets/fonts/Anybody.woff2)').load();
      const setLoading = document.fonts.load('40px PendingFont');
      const seen = window.__pagePending();
      await Promise.all([loading, setLoading]);
      return { seen, after: window.__pagePending() };
    });
    assert.ok(pending.seen.includes('font PendingFont'), pending.seen.join());
    assert.ok(pending.seen.includes('font 40px PendingFont'), pending.seen.join());
    assert.deepEqual(pending.after.filter((w) => w.startsWith('font')), []);
  } finally { await opened.close(); }
});

const withWindow = async (pending, fn) => {
  const had = globalThis.window;
  globalThis.window = { __pagePending: () => pending() };
  try { return await fn(); } finally { if (had === undefined) delete globalThis.window; else globalThis.window = had; }
};

test('awaitReady resolves when nothing is pending and names what is pending when the time is up', async () => {
  await withWindow(() => [], () => awaitReady(200));
  await assert.rejects(
    withWindow(() => ['image big.png'], () => awaitReady(50)),
    /page not ready after 50 ms: still waiting on image big\.png/,
  );
});
