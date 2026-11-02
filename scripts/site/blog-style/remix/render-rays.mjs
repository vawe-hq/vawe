// Renders every post's dithered-rays cover to WebP beside the review page, then the review page (the site's covers are the share cards):
// node scripts/site/blog-style/remix/render-rays.mjs <page.html> [slug ...] [--panel solid]
// --panel solid renders the flat panel (thumb.css .solid).
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { spawnSync } from 'node:child_process';
import puppeteer from 'puppeteer';
import { serveRepo, RENDER_ARGS } from '../../../../harness/lib/render-harness.mjs';

const STRIP = ['read-load', 'run-logs', 'image-points', 'weaker-model', 'render-html-to-mp4', 'determinism'];
const here = path.dirname(new URL(import.meta.url).pathname);
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(here, 'data.js'), 'utf8'), sandbox);
const { POSTS } = sandbox.window;

const argv = process.argv.slice(2);
const panelIdx = argv.indexOf('--panel');
const panel = panelIdx >= 0 ? argv.splice(panelIdx, 2)[1] : '';
const [pageFile, ...picked] = argv;
if (!pageFile) throw new Error('usage: render-rays.mjs <page.html> [slug ...]');
const imgDirName = path.basename(pageFile, '.html');
const imgDir = path.join(path.dirname(pageFile), imgDirName);
fs.mkdirSync(imgDir, { recursive: true });

const toWebp = (png) => {
  const webp = png.replace(/\.png$/, '.webp');
  if (spawnSync('cwebp', ['-quiet', '-q', '90', png, '-o', webp]).status !== 0) throw new Error(`cwebp failed on ${png}`);
  fs.unlinkSync(png);
  return webp;
};

const { port, close } = await serveRepo();
const browser = await puppeteer.launch({ headless: true, args: RENDER_ARGS });
try {
  for (const p of POSTS.filter((x) => !picked.length || picked.includes(x.slug))) {
    const page = await browser.newPage();
    page.on('pageerror', (e) => { throw new Error(`${p.slug}: ${e.message}`); });
    await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
    await page.goto(`http://127.0.0.1:${port}/scripts/site/blog-style/remix/thumb.html?post=${p.slug}${panel ? `&panel=${panel}` : ''}`, { waitUntil: 'load' });
    await page.waitForFunction('window.__ready === true', { timeout: 30000 });
    const png = path.join(imgDir, `dither-rays-${p.slug}.png`);
    await page.screenshot({ path: png });
    await page.close();
    const webp = toWebp(png);
    console.log(webp);
  }
} finally {
  await browser.close();
  await close();
}

const img = (p, width) => `<img src="${imgDirName}/dither-rays-${p.slug}.webp" alt="${p.line} ${p.sub}" width="${width}" height="${Math.round(width * 630 / 1200)}">`;
const bySlug = Object.fromEntries(POSTS.map((p) => [p.slug, p]));

fs.writeFileSync(pageFile, `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Blog covers</title>
<style>
  body { margin: 0; background: #16151a; color: #fff; font: 15px/1.5 system-ui, sans-serif; }
  main { max-width: 1320px; margin: 0 auto; padding: 56px 24px 80px; }
  h1 { font-size: 30px; letter-spacing: -0.02em; margin: 0 0 6px; }
  h2 { font-size: 19px; margin: 48px 0 2px; }
  p { color: #97969b; margin: 0; }
  .strip { display: flex; flex-wrap: wrap; gap: 14px; margin-top: 16px; }
  .strip img { width: 360px; height: auto; border-radius: 8px; display: block; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(360px, 1fr)); gap: 14px; margin-top: 16px; }
  .grid img { width: 100%; height: auto; border-radius: 10px; display: block; }
</style>
</head>
<body>
<main>
<header><h1>Blog covers</h1><p>Dithered rays in Geist 600, one number and at most four words per post, set large enough to read on a 360 px card.</p></header>
<h2>At 360 px</h2>
<p>The size of a card on the blog index or a phone feed.</p>
<div class="strip">${STRIP.map((s) => img(bySlug[s], 360)).join('')}</div>
<h2>All ${POSTS.length}</h2>
<div class="grid">${POSTS.map((p) => img(p, 1200)).join('')}</div>
</main>
</body>
</html>
`);
console.log(pageFile);
