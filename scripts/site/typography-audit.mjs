#!/usr/bin/env node
// scripts/site/typography-audit.mjs: measure the rendered site against site/DESIGN.md "Typography rules".
//
//   node scripts/site/typography-audit.mjs --base http://localhost:3987 [--shots out/dir] [--json file] [--only /,/video-components]
//
// Reads computed styles in a real browser (the measuring code is typography-audit.browser.js): body size,
// line height, line length (characters per line, by character rects), heading levels and weights, caps
// tracking, and the punctuation left in text nodes. Needs a running dev or start server. It measures; the
// gate is quality/gates/site-typography.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const BASE = arg('--base', 'http://localhost:3000');
const SHOTS = arg('--shots', '');
const JSON_OUT = arg('--json', '');
const ONLY = arg('--only', '');
const SHOT_ROUTES = ['/', '/features', '/video-components', '/video-components/mask-rise', '/easing', '/blog', '/vs/remotion', '/blog/weaker-model'];
const BROWSER_SRC = fs.readFileSync(path.join(ROOT, 'scripts/site/typography-audit.browser.js'), 'utf8');

function routeList() {
  if (ONLY) return ONLY.split(',');
  const pages = JSON.parse(fs.readFileSync(path.join(ROOT, 'site/lib/site-pages.json'), 'utf8')).routes.map((r) => r.path);
  const post = fs.readdirSync(path.join(ROOT, 'site/content/blog')).sort()[0].replace(/\.md$/, '');
  return [...new Set([...pages, '/video-components/mask-rise', '/easing/land', `/blog/${post}`])];
}

const median = (a) => (a.length ? [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] : 0);

function summarize(r) {
  const bl = r.blocks;
  const multi = bl.filter((b) => b.lines >= 2);
  return {
    n: bl.length,
    size: median(bl.map((b) => b.size)),
    lh: median(bl.map((b) => b.lh)),
    medChars: median(multi.map((b) => b.widest)),
    maxChars: Math.max(0, ...bl.map((b) => b.widest)),
    wide: bl.filter((b) => b.widest > 90).length,
    short: multi.filter((b) => b.widest < 45).length,
    h1: r.headings.items.find((h) => h.t === 'H1'),
    levels: r.headings.levels.join(''),
    punct: r.punct,
    misc: r.misc,
  };
}

async function shoot(page, route, vw, height) {
  fs.mkdirSync(SHOTS, { recursive: true });
  const name = `${route === '/' ? 'landing' : route.slice(1).replace(/\//g, '-')}-${vw}.png`;
  await page.screenshot({ path: path.join(SHOTS, name), clip: { x: 0, y: 0, width: vw, height: Math.min(height, 5000) }, captureBeyondViewport: true });
}

async function auditRoute(page, route, vw) {
  await page.goto(BASE + route, { waitUntil: 'load', timeout: 60000 });
  await new Promise((r) => setTimeout(r, 1200));
  await page.addScriptTag({ content: BROWSER_SRC });
  const r = await page.evaluate(() => window.typoAudit());
  if (SHOTS && SHOT_ROUTES.includes(route)) await shoot(page, route, vw, r.docH);
  return { ...r, sum: summarize(r) };
}

function line(key, v) {
  if (v.error) return `${key} ERROR ${v.error}`;
  const s = v.sum;
  const h1 = s.h1 ? `${s.h1.size.toFixed(0)}px w${s.h1.w} ls ${s.h1.ls}` : '-';
  return `${key.padEnd(34)} blocks ${String(s.n).padStart(3)} size ${s.size} lh ${s.lh} chars med ${s.medChars} max ${s.maxChars} >90:${s.wide} <45:${s.short} | h1 ${h1} lv ${s.levels} | ${JSON.stringify(s.punct)} ${s.misc.join(',')}`;
}

function offenders(v) {
  if (v.error || !process.argv.includes('--detail')) return [];
  const gaps = v.gaps.slice(0, 4).map((g) => `    GAP above ${g.above} <= below ${g.below} "${g.txt}"`);
  return gaps.concat(v.blocks.filter((b) => b.size >= 15 && b.lines >= 2 && (b.widest > 72 || b.widest < 43)).slice(0, 6)
    .map((b) => `    ${b.tag}.${b.cls} ${b.size}px ${b.widest}ch x${b.lines} "${b.txt}"`));
}

const browser = await puppeteer.launch({ headless: true });
const out = {};
for (const vw of [1440, 390]) {
  const page = await browser.newPage();
  await page.setViewport({ width: vw, height: 900, deviceScaleFactor: 1 });
  for (const route of routeList()) {
    try { out[`${vw} ${route}`] = await auditRoute(page, route, vw); } catch (e) { out[`${vw} ${route}`] = { error: String(e).slice(0, 120) }; }
  }
  await page.close();
}
await browser.close();
if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify(out));
for (const [k, v] of Object.entries(out)) console.log(line(k, v), ...offenders(v).map((o) => '\n' + o));
