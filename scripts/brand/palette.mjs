// palette.mjs: EYEDROP a brand's real pixels → dominant colours + LIGHT/DARK dominance. The taste
// system depends on this being ACCURATE (a wrong dominance is how bad videos happen), so it samples
// the WHOLE page (every captured section, not just the hero) aggregating a real pixel histogram.
// That way white-body-text + a blue hero + purple accent all get seen, and dominance = the page's
// true average luminance, not one section's. Writes a swatch card to /tmp/palette.png. NOT a
// substitute for looking: confirm against the screenshots + the make dev-tool X=beats VS=<brand> fidelity gate.
//
//   node scripts/brand/palette.mjs assets/brands/<brand>/sections   # whole page (recommended)
//   node scripts/brand/palette.mjs path/to/one-screenshot.png              # single image
import puppeteer from 'puppeteer';
import { SANDBOX_ARGS } from '../../harness/lib/render-harness.mjs';
import fs from 'node:fs';
import path from 'node:path';

const hex = ({ r, g, b }) => '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
const lum = ({ r, g, b }) => (0.299 * r + 0.587 * g + 0.114 * b) / 255;
const sat = ({ r, g, b }) => { const mx = Math.max(r, g, b), mn = Math.min(r, g, b); return mx === 0 ? 0 : (mx - mn) / mx; };

// eyedrop(files) → { light, avgLum, bg, text, accents, top, cols } (hex strings). The one pixel-histogram
// pass, shared by the CLI below and `node scripts/brand/kit.mjs` (scripts/brand/kit.mjs), so a themed manifest and a
// human eyedrop read the same numbers.
export async function eyedrop(files) {
  const uris = files.map((f) => `data:image/${f.match(/jpe?g$/i) ? 'jpeg' : 'png'};base64,` + fs.readFileSync(f).toString('base64'));
  const browser = await puppeteer.launch({ headless: true, args: [...SANDBOX_ARGS, '--force-color-profile=srgb'] });
  const page = await browser.newPage();
  const result = await page.evaluate(async (uris) => {
  const bins = new Map(); let lumSum = 0, n = 0;
  const q = (v) => Math.round(v / 24) * 24;
  for (const uri of uris) {
    const img = new Image(); img.src = uri; await img.decode();
    // 130px wide rendered a button 6px across and blended it into the white beside it. A brand's accent
    // often lives on nothing bigger than a button, so the sample has to be able to hold one.
    const S = 260, H = Math.round(S * (img.height / img.width));
    const c = document.createElement('canvas'); c.width = S; c.height = H;
    const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0, S, H);
    const d = ctx.getImageData(0, 0, S, H).data;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2];
      lumSum += (0.299 * r + 0.587 * g + 0.114 * b) / 255; n++;
      const key = `${q(r)},${q(g)},${q(b)}`;
      const e = bins.get(key) || { r: 0, g: 0, b: 0, c: 0 };
      e.r += r; e.g += g; e.b += b; e.c++; bins.set(key, e);
    }
  }
  const cols = [...bins.values()].map((e) => ({ r: Math.round(e.r / e.c), g: Math.round(e.g / e.c), b: Math.round(e.b / e.c), c: e.c })).sort((a, b) => b.c - a.c);
  // 16 was the real reason a sparse accent could never be found: the accent pass ran over the sixteen
  // MOST FREQUENT bins, which on any white-first site are sixteen neutrals. Ranking could not fix what
  // was never in the list. The extra bins cost nothing, they are counted either way.
  return { cols: cols.slice(0, 400), total: n, avgLum: lumSum / n };
  }, uris);
  await browser.close();

  const cols = result.cols;
  const light = result.avgLum > 0.5;
  // bg = the most-frequent LOW-saturation colour on the dominant side (real backdrop, not a photo blob)
  const bg = cols.filter((c) => sat(c) < 0.2 && (light ? lum(c) > 0.7 : lum(c) < 0.28))[0] || cols[0];
  // text = the EXTREME neutral, not the most-frequent: text is thin (few pixels) so it loses a
  // frequency vote to fills, but it IS the darkest (light page) / lightest (dark page) near-neutral
  // that's actually present. Pick that among colours above a tiny presence floor.
  const textCands = cols.filter((c) => sat(c) < 0.28 && c.c > result.total * 0.001);
  const text = (light ? textCands.sort((a, b) => lum(a) - lum(b)) : textCands.sort((a, b) => lum(b) - lum(a)))[0] || cols[cols.length - 1];
  // An accent is the colour a brand SPENDS sparingly, so ranking candidates by how much of the page they
  // cover finds the opposite of one. Ramp's lime lives on two buttons, well under 1% of the pixels, and
  // frequency-ranking handed back #111605 instead: near-black antialiasing noise that is technically
  // saturated and completely invisible. Two changes: an accent must be VISIBLE (not near-black, not
  // near-white, or it is a shadow or a highlight), and candidates rank by vividness weighted by presence
  // rather than by presence alone, so a small vivid colour beats a large dull one. Good design uses
  // accents sparingly, so the old ranking failed hardest on exactly the brands worth reflecting
  const accents = cols
    .filter((c) => sat(c) > 0.4 && lum(c) > 0.12 && lum(c) < 0.95 && c.c > result.total * 0.0002)
    .sort((a, b) => (sat(b) * Math.sqrt(b.c)) - (sat(a) * Math.sqrt(a.c)))
    .slice(0, 3);

  return { light, avgLum: result.avgLum, bg: hex(bg), text: hex(text), accents: accents.map(hex), top: cols.slice(0, 12).map(hex), cols };
}

// writeSwatch(path, { light, bg, text, accents, cols }) → a swatch card PNG, the same one the CLI below
// writes to /tmp/palette.png. Split out so `node scripts/brand/kit.mjs` can drop it beside kit.json without a second render.
export async function writeSwatch(outPath, { light, bg, text, accents, cols }) {
  const sw = cols.map((c) => `<div style="flex:1;background:${hex(c)}"></div>`).join('');
  const html = `<body style="margin:0"><div style="display:flex;height:120px;width:1280px">${sw}</div>
  <div style="font:600 20px monospace;padding:14px 8px">${light ? 'LIGHT / white-first' : 'DARK-first'} · bg ${bg} · text ${text} · accents ${accents.join(' ')}</div></body>`;
  const browser = await puppeteer.launch({ headless: true, args: SANDBOX_ARGS });
  const page = await browser.newPage(); await page.setViewport({ width: 1296, height: 190 });
  await page.setContent(html); await page.screenshot({ path: outPath }); await browser.close();
}

// ---------- CLI ----------
const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (isMain) {
  const arg = process.argv[2];
  if (!arg || !fs.existsSync(arg)) { console.error('usage: node scripts/brand/palette.mjs <sections-dir | screenshot.png>'); process.exit(1); }
  const files = fs.statSync(arg).isDirectory()
    ? fs.readdirSync(arg).filter((f) => /\.(png|jpe?g)$/i.test(f)).map((f) => path.join(arg, f))
    : [arg];
  if (!files.length) { console.error('no images found'); process.exit(1); }

  const p = await eyedrop(files);
  console.log(`\nEYEDROP · ${files.length} image(s) · ${path.basename(arg)}`);
  console.log(`  DOMINANCE : ${p.light ? 'LIGHT / white-first' : 'DARK-first'}  (whole-page avg luminance ${p.avgLum.toFixed(2)})`);
  console.log(`  bg        : ${p.bg}`);
  console.log(`  text      : ${p.text}`);
  console.log(`  accents   : ${p.accents.join('  ') || '(none saturated)'}`);
  console.log(`  top       : ${p.top.join(' ')}`);
  console.log(`  → author themes/<brand>.json from these, then CONFIRM with make dev-tool X=beats VS=<brand>.\n`);

  await writeSwatch('/tmp/palette.png', p);
  console.log('  swatch card → /tmp/palette.png\n');
}
