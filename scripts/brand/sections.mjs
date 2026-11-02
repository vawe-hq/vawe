// sections.mjs: inventory a page as SECTIONS so nothing gets ignored. Where lookbook.mjs gives you
// a few scroll shots to study, this enumerates every major block on the page, screenshots each one on
// its own, and writes a manifest with a STABLE selector + a ready-to-paste capture command per block.
// The point is the doctrine flip: don't rewrite the site by hand, capture its real sections (real
// assets, real taste) and re-animate them. This tool tells you exactly what's there and how to grab it.
//
//   node scripts/brand/sections.mjs <url> <brand>     →  assets/brands/<brand>/sections/NN-*.png + sections.json
//   make sections URL=https://linear.app NAME=linear
//
// Each manifest entry: { i, label, sel, x, y, w, h, kind, note, capture } where `sel` is a nth-of-type
// path that document.querySelector always resolves, and `capture` is the exact make command to lift it.
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer';
import { SANDBOX_ARGS } from '../../harness/lib/render-harness.mjs';
import { dismissOverlays } from './dismiss-overlays.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const [url, brand] = argv.filter((a, i) => !a.startsWith('--') && !(argv[i - 1] || '').startsWith('--'));
if (!url || !brand) { console.error('usage: node scripts/brand/sections.mjs <url> <brand> [--viewport WxH]'); process.exit(1); }
const [VW, VH] = flag('--viewport', '1512x950').split('x').map(Number);

const dir = path.join(ROOT, 'assets/brands', brand, 'sections');
// Clear the directory first. Section names come from their headings, so a re-crawl of a changed page
// writes DIFFERENT filenames and the old shots survive beside the new ones, `palette` then eyedrops a
// mix of two crawls and the storyboard shows sections that are no longer on the site.
if (fs.existsSync(dir)) for (const f of fs.readdirSync(dir)) if (/\.(png|json)$/.test(f)) fs.rmSync(path.join(dir, f));
fs.mkdirSync(dir, { recursive: true });

const browser = await puppeteer.launch({ headless: true, args: SANDBOX_ARGS });
const page = await browser.newPage();
// A real browser's User-Agent, because a growing number of marketing sites CONTENT-NEGOTIATE on it and
// serve automated clients something else entirely. ramp.com answers puppeteer's default (which says
// "HeadlessChrome") with a markdown "Machine Version" written for AI agents, no <section> tags, no
// layout, no product UI, and therefore nothing to reflect. With this line it serves the real page: 8
// sections instead of 0. Reflecting a brand means capturing what a PERSON sees.
await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36');
await page.setViewport({ width: VW, height: VH, deviceScaleFactor: 2 });
try { await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 }); }
catch (e) { console.error(`  · networkidle timed out (${e.message}), retrying with domcontentloaded`); await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 }); }
// clear newsletter modals / cookie walls / chat bubbles BEFORE measuring, or every section shot is
// taken through them and every capture command below inherits the same furniture.
await dismissOverlays(page);
// mount lazy sections + settle fonts, then return to top for consistent coordinates
await page.evaluate(async () => {
  await document.fonts.ready;
  for (let y = 0; y < document.body.scrollHeight; y += 700) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 110)); }
  scrollTo(0, 0); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
});

const found = await page.evaluate((VW) => {
  // a stable selector any querySelector resolves: tag:nth-of-type path up to body
  function cssPath(el) {
    const seg = [];
    for (let n = el; n && n.nodeType === 1 && n.tagName !== 'BODY'; n = n.parentElement) {
      const tag = n.tagName.toLowerCase();
      let i = 1; for (let s = n.previousElementSibling; s; s = s.previousElementSibling) if (s.tagName === n.tagName) i++;
      seg.unshift(`${tag}:nth-of-type(${i})`);
    }
    return 'body > ' + seg.join(' > ');
  }
  const doc = document.documentElement;
  const scrollY = () => window.scrollY || doc.scrollTop || 0;
  // candidates: real landmarks + big direct children of the main content column
  const roots = [document.body, document.querySelector('main'), ...document.querySelectorAll('main > *, body > *')].filter(Boolean);
  const cand = new Set();
  for (const r of roots) {
    if (r === document.body) { for (const c of r.children) cand.add(c); continue; }
    cand.add(r);
  }
  for (const s of document.querySelectorAll('section, header, footer')) cand.add(s);
  const rows = [];
  for (const el of cand) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) continue;
    const r = el.getBoundingClientRect();
    const w = r.width, h = r.height;
    if (w < VW * 0.4 || h < 200) continue;            // must be a real band, not a widget
    if (h > 4000) continue;                             // page-wrapper, not a section
    rows.push({ el, top: r.top + scrollY(), left: r.left, w: Math.round(w), h: Math.round(h) });
  }
  // drop any candidate fully containing another candidate (keep the finer-grained section)
  const keep = rows.filter((a) => !rows.some((b) => b !== a && b.top >= a.top - 2 && b.top + b.h <= a.top + a.h + 2 && b.h < a.h * 0.92));
  keep.sort((a, b) => a.top - b.top);
  const seen = new Set();
  const out = [];
  for (const row of keep) {
    const { el } = row;
    if (seen.has(el)) continue; seen.add(el);
    // human label: aria-label > first heading > tag
    const heading = el.querySelector('h1, h2, h3');
    const raw = (el.getAttribute('aria-label') || heading?.textContent || el.tagName.toLowerCase()).replace(/\s+/g, ' ').trim();
    const label = raw.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 28) || el.tagName.toLowerCase();
    // kind hint: what's inside decides how to capture it
    const hasCanvasGl = !!el.querySelector('canvas, video, [style*="webgl"], iframe');
    const imgs = el.querySelectorAll('img, svg').length;
    const kind = hasCanvasGl ? 'canvas' : imgs >= 3 ? 'rich' : 'text';
    const note = hasCanvasGl ? 'canvas/video, capture as clipped screenshot image layer + ken, DOM capture will miss it'
      : imgs >= 3 ? 'image-rich, capture-component keeps its real assets; animate as one component'
      : 'mostly text, capture-component, then overlay our own type layer to re-type the copy';
    // `label` is sliced to 28 chars because it names a FILE. `title` is the heading as the site actually
    // wrote it, kept because a question that quotes the site back cannot quote a filename: the label for
    // "Move work forward across teams and agents" truncates to "move-work-forward-across-tea", and asking
    // somebody to choose "Move work forward across tea" is not quoting them, it is showing them a slug.
    out.push({ label, title: raw, sel: cssPath(el), x: Math.round(row.left), y: Math.round(row.top), w: row.w, h: row.h, kind, note });
  }
  return out;
}, VW);

// screenshot each section on its own (full block, even taller than the viewport)
const manifest = [];
for (let i = 0; i < found.length; i++) {
  const s = found[i];
  const idx = String(i + 1).padStart(2, '0');
  const file = path.join(dir, `${idx}-${s.label}.png`);
  try {
    await page.evaluate((y) => scrollTo(0, Math.max(0, y - 40)), s.y);
    await new Promise((r) => setTimeout(r, 150));
    const r2 = await page.evaluate((sel) => { const el = document.querySelector(sel); if (!el) return null; const b = el.getBoundingClientRect(); return { x: b.left + scrollX, y: b.top + scrollY, w: b.width, h: b.height }; }, s.sel);
    const clip = r2 || { x: s.x, y: s.y, w: s.w, h: s.h };
    await page.screenshot({ path: file, captureBeyondViewport: true, clip: { x: Math.max(0, clip.x), y: Math.max(0, clip.y), width: Math.min(clip.w, VW), height: Math.min(clip.h, 4000) } });
  } catch (e) { console.warn(`  ⚠ shot failed for ${s.label}: ${e.message}`); continue; }
  const capture = s.kind === 'canvas'
    ? `# canvas, screenshot ${path.relative(ROOT, file)} into a clipped image layer (ken burns)`
    : `make media X=capture URL="${url}" SEL='${s.sel}' NAME=${brand} LABEL=${s.label.replace(/-/g, '') || 'sec' + (i + 1)}`;
  manifest.push({ i: i + 1, label: s.label, title: s.title, sel: s.sel, x: s.x, y: s.y, w: s.w, h: s.h, kind: s.kind, note: s.note, shot: path.relative(ROOT, file), capture });
}
await browser.close();

const manPath = path.join(dir, 'sections.json');
fs.writeFileSync(manPath, JSON.stringify({ url, brand, viewport: `${VW}x${VH}`, sections: manifest }, null, 2) + '\n');
// Zero sections is a FAILURE, not a quiet success. It printed a green tick and an empty storyboard, and
// the only reason it was caught is that a human asked why the inventory was blank. A crawl that finds
// nothing has told you nothing.
if (!manifest.length) {
  console.error(`✗ 0 sections found at ${url}`);
  console.error('  The page rendered but nothing matched. Usually one of:');
  console.error('   · the site served a non-HTML version (some sites answer automated clients with a');
  console.error('     markdown "machine" page: check by opening the URL in a real browser and comparing)');
  console.error('   · the content is behind a consent wall or bot check that did not clear');
  console.error('   · the layout uses no <section>/landmark elements, try --viewport, or target a subpage');
  process.exit(1);
}
console.log(`✓ ${manifest.length} sections → ${path.relative(ROOT, dir)}/  (NN-*.png + sections.json)`);
console.log('  storyboard = one beat per section, in this order. capture the real thing, animate OUR way:\n');
for (const m of manifest) {
  console.log(`  ${String(m.i).padStart(2, ' ')}. ${m.label.padEnd(28)} ${m.w}×${m.h}  [${m.kind}]`);
  console.log(`      ${m.capture}`);
}
console.log('\n  then stage each as a `component` layer and give it a window/cut/camera. verify with `make dev-tool X=beats`.');
