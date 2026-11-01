// tests/media/preview-warm-isolation.test.mjs: house-rule self-check, no framework.
//   node tests/media/preview-warm-isolation.test.mjs
// Two processes share the preview browser: one captures a film, another (`vawe frame --vs`) looks for its
// warm tab. The look must never touch the capture's tab: listing every tab gave it puppeteer's default
// 800x600 viewport, and the film got frames laid out at 800x600 in the top-left corner. Launches Chrome.
import puppeteer from 'puppeteer';
import { pageArgs } from '../../harness/lib/render-harness.mjs';
import { takeWarmPage, WARM_HASH } from '../../harness/media/preview-server.mjs';

function assert(cond, msg) { if (!cond) throw new Error(`FAIL: ${msg}`); }

const browser = await puppeteer.launch({ headless: true, args: pageArgs(true) });
try {
  const render = await puppeteer.connect({ browserWSEndpoint: browser.wsEndpoint() });
  const capture = await render.newPage();
  await capture.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 0.5 });
  await capture.setContent('<p>a render tab</p>');

  const look = await puppeteer.connect({ browserWSEndpoint: browser.wsEndpoint() });
  const url = `about:blank${WARM_HASH}`;
  const warmTab = await look.newPage();
  await warmTab.goto(url);
  await warmTab.evaluate(() => { window.__warmSig = 'sig'; });
  const { page, reused } = await takeWarmPage(look, url, 'sig');
  assert(reused && page.url() === url, `the warm tab was not found again (reused ${reused}, url ${page.url()})`);

  const size = await capture.evaluate(() => `${innerWidth}x${innerHeight}`);
  assert(size === '1920x1080', `looking for a warm tab re-laid-out the render tab at ${size}`);
  look.disconnect();
  render.disconnect();
  console.log('ok: a warm-tab lookup leaves another process\'s render tab at its own viewport');
} finally {
  await browser.close();
}
