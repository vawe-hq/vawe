#!/usr/bin/env node
// `vawe new [name] --from-url <route|url|page.html>[,more] [--w 1440,390] [--full] [--base url] [--out dir]`: a PNG of a site page, a url or a static html page at each width.
//   node harness/media/shot.mjs /blog,/moves --w 1440,390 --full
// A route needs a site server: a running one at --base is reused; a localhost one that is down is started here (site/ `npm run dev`) and stopped when the shots are done.
// Lazy images are loaded before the shot. Each line also reports page errors, failed requests and sideways overflow, the three things a screenshot hides.
//   node harness/media/shot.mjs https://vawe.dev/easing --tour steps.json --w 1600 --fps 60 --out out/easing-tour.mp4
// --tour drives a scripted cursor through the page and writes an mp4 of it, every frame at its exact second (harness/media/tour.mjs, steps in tour-math.mjs).
import fs from 'node:fs';
import path from 'node:path';
import { launchPage, serveRepo } from '../lib/render-harness.mjs';
import { pageRoot } from './preview-server.mjs';
import { withSite } from '../lib/site-server.mjs';
import { DEFAULT_BASE, DEFAULT_WIDTHS, isFaviconUrl, isRequestNoise, navigationProblem, parseTargets, parseWidths, problemLines, resolveTarget, shotName, shotProblem, viewportHeight } from './shot-math.mjs';
import { parseTour, tourSize } from './tour-math.mjs';
import { captureTour, encodeTour, tourTmpDir } from './tour.mjs';

const die = (m) => { console.error(`error: ${m}`); process.exit(2); };
const NAV_TIMEOUT_MS = 120000;

class ShotError extends Error {}

async function gotoChecked(page, url) {
  const response = await page.goto(url, { waitUntil: 'networkidle2', timeout: NAV_TIMEOUT_MS }).catch((e) => { throw new ShotError(`${url} did not load: ${String(e.message).split('\n')[0]}`); });
  const problem = navigationProblem({ url, status: response?.status() ?? 200, finalUrl: page.url() });
  if (problem) throw new ShotError(problem);
}

/** A static server over the checkout the html file lives in (its own folder when it is in none): { url, close }. Unlike still and dev, which serve this checkout's core/. */
async function serveFile(file) {
  const abs = path.resolve(file);
  const root = pageRoot(abs);
  const { port, close } = await serveRepo({ root });
  return { url: `http://127.0.0.1:${port}/${path.relative(root, abs).split(path.sep).join('/')}`, close };
}

async function loadLazy(page) {
  await page.evaluate(async () => {
    document.querySelectorAll('img[loading=lazy]').forEach((i) => { i.loading = 'eager'; });
    document.documentElement.style.scrollBehavior = 'auto';
    const step = Math.max(200, innerHeight - 100);
    for (let y = 0, n = 0; y < document.documentElement.scrollHeight && n < 80; y += step, n++) {
      scrollTo({ top: y, behavior: 'instant' });
      await new Promise((r) => setTimeout(r, 120));
    }
    await Promise.race([
      Promise.all([document.fonts.ready, ...[...document.images].map((i) => (i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r; })))]),
      new Promise((r) => setTimeout(r, 6000)),
    ]);
    scrollTo({ top: 0, behavior: 'instant' });
  });
}

async function shoot({ url, name, width, full, outDir }) {
  const { page, close } = await launchPage({ width, height: viewportHeight(width) });
  const problems = { errors: [], failed: [] };
  page.on('pageerror', (e) => { problems.errors.push(String(e.message ?? e).split('\n')[0]); });
  page.on('console', (m) => { if (m.type() === 'error' && !isRequestNoise(m.text())) problems.errors.push(m.text().split('\n')[0]); });
  page.on('response', (r) => { if (r.status() >= 400 && !isFaviconUrl(r.url())) problems.failed.push(`${r.url()} (HTTP ${r.status()})`); });
  page.on('requestfailed', (r) => { if (!isFaviconUrl(r.url())) problems.failed.push(`${r.url()} (${r.failure()?.errorText ?? 'failed'})`); });
  try {
    await gotoChecked(page, url);
    await loadLazy(page);
    const { height, overflow } = await page.evaluate(() => ({ height: document.documentElement.scrollHeight, overflow: document.documentElement.scrollWidth - innerWidth }));
    const file = path.join(outDir, name);
    await page.screenshot({ path: file, fullPage: full });
    const notes = [full ? `full page ${height}px tall` : 'first screen'];
    if (problems.errors.length) notes.push(`${problems.errors.length} console error(s)`);
    if (problems.failed.length) notes.push(`${problems.failed.length} failed request(s)`);
    if (overflow > 0) notes.push(`sideways overflow ${overflow}px`);
    console.log(`✓ ${file}: ${width}px wide, ${notes.join(', ')}`);
    for (const line of problemLines(problems)) console.log(line);
  } finally {
    await close();
  }
}

async function tour({ url, file, width, fps, scale, out }) {
  const plan = parseTour(fs.readFileSync(file, 'utf8'));
  const { page, close } = await launchPage({ ...tourSize(width), scale });
  const tmpDir = tourTmpDir();
  try {
    await gotoChecked(page, url);
    await loadLazy(page);
    const frames = await captureTour(page, plan, { fps, tmpDir, width });
    encodeTour(tmpDir, frames, fps, out);
    console.log(`✓ ${out}: ${width}px wide, ${frames} frames at ${fps} fps (${plan.dur.toFixed(2)} s), ${plan.steps.length} steps`);
  } finally {
    await close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

async function tourMain({ targets, base, flag }) {
  const t = resolveTarget(targets[0], base);
  const width = flag('--w') ? parseWidths(flag('--w'))[0] : 1440;
  const given = flag('--out') || 'out/shot';
  const out = path.resolve(given.endsWith('.mp4') ? given : path.join(given, shotName(targets[0], width).replace(/\.png$/, '-tour.mp4')));
  const files = t.kind === 'file' ? await serveFile(t.file) : null;
  const url = files ? files.url : t.url;
  const run = () => tour({ url, file: flag('--tour'), width, fps: Number(flag('--fps') || 60), scale: Number(flag('--scale') || 1), out });
  try {
    await (!files && url.startsWith(base) ? withSite(base, run) : run());
  } finally {
    files?.close();
  }
}

async function main(argv) {
  const flag = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
  const valued = new Set(['--w', '--base', '--out', '--tour', '--fps']);
  const targets = parseTargets(argv.find((a, i) => !a.startsWith('--') && !valued.has(argv[i - 1])));
  const base = flag('--base') || process.env.VAWE_SITE_URL || DEFAULT_BASE;
  const problem = shotProblem({ targets, w: flag('--w'), base });
  if (problem) die(problem);
  if (flag('--tour')) return tourMain({ targets, base, flag });
  const widths = flag('--w') ? parseWidths(flag('--w')) : DEFAULT_WIDTHS;
  const outDir = path.resolve(flag('--out') || 'out/shot');
  fs.mkdirSync(outDir, { recursive: true });
  const full = argv.includes('--full');

  const resolved = targets.map((t) => ({ t, ...resolveTarget(t, base) }));
  const needsSite = resolved.some((r) => r.kind === 'url' && r.url.startsWith(base));
  const shootAll = async () => {
    for (const r of resolved) {
      const files = r.kind === 'file' ? await serveFile(r.file) : null;
      try {
        for (const width of widths) await shoot({ url: files ? files.url : r.url, name: shotName(r.t, width), width, full, outDir });
      } finally {
        files?.close();
      }
    }
  };
  await (needsSite ? withSite(base, shootAll) : shootAll());
}

main(process.argv.slice(2)).catch((e) => {
  if (!(e instanceof ShotError)) die(e.stack || String(e));
  console.error(`vawe: shot failed: ${e.message}`);
  process.exit(1);
});
