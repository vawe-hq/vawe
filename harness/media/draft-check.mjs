// The draft check's I/O: text sampled from the live page and the ship final check run on the draft mp4.
// The decisions are in harness/lib/draft-check.mjs; the mix level is measureMixLevel in page-audio.mjs.
import { spawnSync } from 'node:child_process';
import { readFeatures, summarize, probeSize } from './scene-stats.mjs';
import { blankRuns, isFlat, problemsOf } from '../lib/ship-status.mjs';
import { sampleTimes, settledSamples, DECORATIVE, CHROME, TEXTURE } from '../lib/draft-check.mjs';
import { draftLowContrast, shownAndHidden } from '../lib/text-contrast.mjs';
import { readHolds } from '../lib/worlds.mjs';
import { sheetFps, tileProblems, TILE_W } from '../lib/sheet-tiles.mjs';
import { specTimes, wordTimes, objectChecks } from '../lib/spec-conformance.mjs';
import { sampleBoxTracks } from '../lib/box-track.mjs';
import { frameMotion } from './motion-curve.mjs';
import { decodeGray } from './see/frame.mjs';
import { withCameraStills } from '../lib/camera-moves.mjs';
import { withoutTypingStills } from '../lib/still-limit.mjs';

/** What one pass over a draft video reads: its scene features, the judge sheet's tile differences and its frame motion. Throws when ffmpeg fails. */
export function readVideo(mp4) {
  return { feats: readFeatures(mp4), tiles: sheetTileDiffs(mp4), motion: frameMotion(mp4) };
}

/** Static windows, held worlds and blank runs of one video, worst first, then the judge's sheet runs. `page` is what the live page says: { worlds (the measured data-world spans, or null), tailMoving, canvasFilm, cameraOnly (the [a, b] seconds where only a whole-frame move runs), typing (the [a, b] seconds where the text keeps changing) }. */
export function videoProblems({ feats, tiles }, authoring = {}, page = {}) {
  return [...problemsOf(statsWithCamera(summarize(feats), page.cameraOnly, page.typing), blankRuns(feats, isFlat), undefined, authoring, page.worlds, page.canvasFilm), ...tileProblems(tiles.diffs, tiles.fps, authoring, page.tailMoving, readHolds(page.worlds ?? []))];
}

/** scene-stats with the seconds where only the camera moves counted as still (harness/lib/camera-moves.mjs). */
export const statsWithCamera = (stats, cameraOnly = [], typing = []) => ({ ...stats, static: withoutTypingStills(withCameraStills(stats.static, cameraOnly), typing) });

/** The judge's sheet tiles (harness/media/judge-fresh.mjs contactSheet, without labels): adjacent mean grey differences. */
export function sheetTileDiffs(mp4) {
  const dur = parseFloat(spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp4], { encoding: 'utf8' }).stdout);
  if (!(dur > 0)) throw new Error(`cannot read the duration of ${mp4}`);
  const src = probeSize(mp4);
  const w = TILE_W, h = Math.round((src.h * w) / src.w / 2) * 2;
  const fps = sheetFps(dur);
  const { data, error } = decodeGray(mp4, { w, h, fps });
  if (error !== null) throw new Error(`sheet tiles: ffmpeg failed on ${mp4}: ${error}`);
  const size = w * h, n = Math.floor(data.length / size), diffs = [];
  for (let i = 1; i < n; i++) {
    let sum = 0;
    for (let p = 0; p < size; p++) sum += Math.abs(data[i * size + p] - data[(i - 1) * size + p]);
    diffs.push(sum / size);
  }
  return { diffs, fps };
}

// Runs inside the page. { lines, blocks }: lines is one { text, fontPx, family, weight, box, rects?, world?, color, opacity, block, chrome? } per visible text
// node (fontPx includes ancestor transform scale; rects is the box of each wrapped line when the text wraps; world is its data-world;
// block is the document-order index of its nearest block-level ancestor, the element a reader sees as one line, the same at every sample); blocks is the joined visible text of each element that holds
// two or more such nodes, so a word split into per-letter spans reads as one text. Text inside `decorative` is left out, and text inside `chrome` is
// flagged, only when it is texture by measure (`texture`: a cap height under capFrac, the same words repeatsMin times on the page, or a data-texture
// attribute of reasonMin characters); any other marked text is read as copy. `hidden` counts the marked nodes: { total, marked, reads, sample }.
export function visibleLines(decorative, chrome, lineage = false, texture = { capFrac: 0, repeatsMin: Infinity, reasonMin: Infinity }) {
  const out = [];
  const norm = (s) => s.replace(/\s+/g, ' ').trim().toLowerCase();
  const textNodes = [];
  const repeats = new Map();
  const pre = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node = pre.nextNode(); node; node = pre.nextNode()) {
    const el = node.parentElement;
    if (!norm(node.nodeValue) || !el || /^(SCRIPT|STYLE|NOSCRIPT|TITLE)$/.test(el.tagName)) continue;
    textNodes.push(node);
    repeats.set(norm(node.nodeValue), (repeats.get(norm(node.nodeValue)) || 0) + 1);
  }
  const isTexture = (node) => {
    const el = node.parentElement;
    const reason = (el.closest('[data-texture]')?.getAttribute('data-texture') || '').trim();
    return reason.length >= texture.reasonMin || repeats.get(norm(node.nodeValue)) >= texture.repeatsMin || (0.7 * parseFloat(getComputedStyle(el).fontSize)) / innerHeight < texture.capFrac;
  };
  const marked = (node) => Boolean(node.parentElement.closest(decorative) || node.parentElement.closest(chrome));
  const reading = textNodes.filter((n) => marked(n) && !isTexture(n));
  const hidden = { total: textNodes.length, marked: textNodes.filter(marked).length, reads: reading.length, sample: [...new Set(reading.map((n) => n.nodeValue.replace(/\s+/g, ' ').trim()))].slice(0, 3) };
  const owners = new Map();
  const docOrder = new Map([...document.getElementsByTagName('*')].map((e, i) => [e, i]));
  const blockOf = (el) => {
    let b = el;
    while (b !== document.body && /^(inline|contents)/.test(getComputedStyle(b).display)) b = b.parentElement;
    return docOrder.get(b);
  };
  const ancestorsOf = (el) => { const up = []; for (let a = el; a && a !== document.documentElement; a = a.parentElement) up.push(docOrder.get(a)); return up; };
  const sourceOf = (el) => {
    const name = getComputedStyle(el).viewTransitionName;
    if (el.dataset.id) return `id:${el.dataset.id}`;
    return name && name !== 'none' ? `vt:${name}` : null;
  };
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.nodeValue.replace(/\s+/g, ' ').trim();
    const el = node.parentElement;
    if (!text || !el || /^(SCRIPT|STYLE|NOSCRIPT|TITLE)$/.test(el.tagName) || (el.closest(decorative) && isTexture(node))) continue;
    const cs = getComputedStyle(el);
    const clipped = cs.webkitBackgroundClip === 'text' || cs.backgroundClip === 'text';
    if (cs.visibility === 'hidden' || (/^rgba\(.*, 0\)$/.test(cs.color) && !clipped)) continue;
    let opacity = 1;
    let scale = 1;
    for (let n = el; n; n = n.parentElement) {
      const s = getComputedStyle(n);
      if (s.display === 'none') { opacity = 0; break; }
      opacity *= Number(s.opacity);
      if (s.transform !== 'none') {
        const m = new DOMMatrix(s.transform);
        scale *= Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)) || 1;
      }
    }
    const range = document.createRange();
    range.selectNodeContents(node);
    const r = range.getBoundingClientRect();
    const inside = r.width > 0 && r.height > 0 && r.right > 0 && r.bottom > 0 && r.left < innerWidth && r.top < innerHeight;
    if (!(opacity > 0.5 && inside)) continue;
    const fontPx = parseFloat(cs.fontSize) * scale;
    const rects = [...range.getClientRects()].filter((q) => q.width > 0 && q.height > 0).map((q) => [q.x, q.y, q.width, q.height]);
    const world = el.closest('[data-world]')?.dataset.world;
    const source = lineage ? sourceOf(el) : null;
    out.push({ text, fontPx, family: cs.fontFamily, weight: cs.fontWeight, box: [r.x, r.y, r.width, r.height], color: cs.color, opacity, block: blockOf(el),
      ...(rects.length > 1 ? { rects } : {}), ...(world ? { world } : {}), ...(el.closest(chrome) && isTexture(node) ? { chrome: true } : {}), ...(el.closest('[data-ui]') ? { ui: true } : {}),
      ...(lineage ? { own: docOrder.get(el), up: ancestorsOf(el), ...(source ? { source } : {}) } : {}) });
    for (let a = el; a && a !== document.documentElement; a = a.parentElement) {
      const o = owners.get(a) || { raw: '', n: 0, fontPx, x0: r.left, y0: r.top, x1: r.right, y1: r.bottom };
      o.raw += node.nodeValue;
      o.n += 1;
      o.x0 = Math.min(o.x0, r.left); o.y0 = Math.min(o.y0, r.top); o.x1 = Math.max(o.x1, r.right); o.y1 = Math.max(o.y1, r.bottom);
      owners.set(a, o);
    }
  }
  const blocks = [...owners.values()].filter((o) => o.n > 1)
    .map((o) => ({ text: o.raw.replace(/\s+/g, ' ').trim(), fontPx: o.fontPx, box: [o.x0, o.y0, o.x1 - o.x0, o.y1 - o.y0] }));
  return { lines: out, blocks, hidden };
}

// The layout reader runs inside the page: layoutColours, layoutFrame, layoutTexts, layoutBoxes and layoutSample are bundled as source
// (like the motion collector), so each is self-contained and takes what it needs as arguments.
function layoutColours() {
  const memo = new Map();
  const canvas = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  const fromCanvas = (css) => {
    canvas.clearRect(0, 0, 1, 1);
    canvas.fillStyle = '#000';
    canvas.fillStyle = css;
    canvas.fillRect(0, 0, 1, 1);
    const d = canvas.getImageData(0, 0, 1, 1).data;
    return [d[0], d[1], d[2], d[3] / 255];
  };
  const fromRgb = (m) => {
    const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
    return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
  };
  return (css) => {
    if (!memo.has(css)) { const m = /^rgba?\(([^)]+)\)$/.exec(css); memo.set(css, m ? fromRgb(m) : fromCanvas(css)); }
    return memo.get(css);
  };
}

function layoutFrame(w, h) {
  const inFrame = (r) => r.width > 0 && r.height > 0 && r.right > 0 && r.bottom > 0 && r.left < w && r.top < h;
  const clipTo = (clip, n) => {
    const c = n.getBoundingClientRect();
    return clip ? [Math.max(clip[0], c.left), Math.max(clip[1], c.top), Math.min(clip[2], c.right), Math.min(clip[3], c.bottom)] : [c.left, c.top, c.right, c.bottom];
  };
  const fadeAndScale = (el) => {
    let opacity = 1, scale = 1, clip = null;
    for (let n = el; n && opacity > 0; n = n.parentElement) {
      const s = getComputedStyle(n);
      opacity *= s.display === 'none' ? 0 : Number(s.opacity);
      if (s.transform !== 'none') { const m = new DOMMatrix(s.transform); scale *= Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)) || 1; }
      if (n !== el && n !== document.documentElement && /(hidden|clip|scroll|auto)/.test(s.overflowX + s.overflowY)) clip = clipTo(clip, n);
    }
    return { opacity, scale, clip };
  };
  const visibleRect = (r, clip) => {
    if (!clip) return r;
    const [l, t, rt, b] = [Math.max(r.left, clip[0]), Math.max(r.top, clip[1]), Math.min(r.right, clip[2]), Math.min(r.bottom, clip[3])];
    return { left: l, top: t, right: rt, bottom: b, x: l, y: t, width: rt - l, height: b - t };
  };
  return { inFrame, fadeAndScale, visibleRect };
}

function layoutTexts(env) {
  const { rgba, frame, decorative, chrome } = env;
  const blocks = [], blockIndex = new Map();
  const blockElement = (el) => {
    let b = el;
    while (b !== document.body && /^(inline|contents)/.test(getComputedStyle(b).display)) b = b.parentElement;
    return b;
  };
  const joinBlock = (el, r) => {
    const b = blockElement(el);
    if (!blockIndex.has(b)) { blockIndex.set(b, blocks.length); blocks.push({ x0: r.left, y0: r.top, x1: r.right, y1: r.bottom }); }
    const k = blockIndex.get(b), bk = blocks[k];
    bk.x0 = Math.min(bk.x0, r.left); bk.y0 = Math.min(bk.y0, r.top); bk.x1 = Math.max(bk.x1, r.right); bk.y1 = Math.max(bk.y1, r.bottom);
    return k;
  };
  const textOf = (node) => {
    const text = node.nodeValue.replace(/\s+/g, ' ').trim();
    const el = node.parentElement;
    if (!text || !el || /^(SCRIPT|STYLE|NOSCRIPT|TITLE)$/.test(el.tagName) || el.closest(decorative)) return null;
    const cs = getComputedStyle(el);
    const { opacity, scale, clip } = frame.fadeAndScale(el);
    const range = document.createRange();
    range.selectNodeContents(node);
    const r = frame.visibleRect(range.getBoundingClientRect(), clip);
    if (cs.visibility === 'hidden' || opacity <= 0.5 || !frame.inFrame(r)) return null;
    const own = parseFloat(cs.fontSize);
    return {
      text: text.slice(0, 60), box: [r.x, r.y, r.width, r.height], fontPx: own * scale, block: joinBlock(el, r),
      family: cs.fontFamily.split(',')[0].trim().replace(/^["']|["']$/g, '').toLowerCase(), weight: Number(cs.fontWeight) || 400,
      trackingEm: cs.letterSpacing === 'normal' ? 0 : parseFloat(cs.letterSpacing) / own,
      caps: cs.textTransform === 'uppercase' || (/[A-Z]/.test(text) && text === text.toUpperCase()),
      color: rgba(cs.color), chrome: Boolean(el.closest(chrome)),
    };
  };
  const texts = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const t = textOf(node);
    if (t) texts.push(t);
  }
  return { texts, blocks: blocks.map((b) => ({ box: [b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0] })) };
}

function layoutBoxes(env) {
  const { rgba, frame, decorative } = env;
  const listed = new WeakMap(), opOf = new WeakMap(), boxes = [];
  const side = (cs, s) => (cs[`border${s}Style`] !== 'none' && parseFloat(cs[`border${s}Width`]) > 0 ? [parseFloat(cs[`border${s}Width`]), rgba(cs[`border${s}Color`])] : [0, null]);
  const nearestListed = (el) => {
    let up = el.parentElement;
    while (up && !listed.has(up)) up = up.parentElement;
    return up ? listed.get(up) : -1;
  };
  const boxOf = (el) => {
    const cs = getComputedStyle(el);
    const op = cs.display === 'none' ? 0 : (el.parentElement ? (opOf.get(el.parentElement) ?? 1) : 1) * Number(cs.opacity);
    opOf.set(el, op);
    const r = el.getBoundingClientRect();
    if (op <= 0.05 || cs.visibility === 'hidden' || !frame.inFrame(r)) return null;
    const bg = rgba(cs.backgroundColor);
    return {
      tag: el.tagName.toLowerCase(), p: nearestListed(el), box: [r.x, r.y, r.width, r.height], op,
      bg: bg[3] > 0 ? bg : null, image: cs.backgroundImage !== 'none', blurred: cs.filter.includes('blur'),
      paint: cs.backgroundImage === 'none' ? null : cs.backgroundImage.slice(0, 600), blend: cs.mixBlendMode, tilePx: cs.backgroundRepeat.startsWith('no-repeat') ? 0 : parseFloat(cs.backgroundSize) || 0, canvasVaries: el.tagName === 'CANVAS' ? canvasVaries(el) : null,
      border: { l: side(cs, 'Left'), r: side(cs, 'Right'), t: side(cs, 'Top'), b: side(cs, 'Bottom') },
      radius: parseFloat(cs.borderTopLeftRadius) || 0, shadow: cs.boxShadow !== 'none', decorative: Boolean(el.closest(decorative)),
    };
  };
  // The spread of a canvas's painted cells, 0 to 1, or null when it cannot be read (a tainted or GPU canvas).
  const canvasVaries = (el) => {
    try {
      const probe = document.createElement('canvas');
      probe.width = 16; probe.height = 9;
      const ctx = probe.getContext('2d');
      ctx.drawImage(el, 0, 0, 16, 9);
      const d = ctx.getImageData(0, 0, 16, 9).data;
      const cells = [];
      for (let i = 0; i < d.length; i += 4) cells.push([d[i], d[i + 1], d[i + 2]].map((v) => (v * d[i + 3]) / 255 / 255));
      return Math.max(...[0, 1, 2].map((c) => Math.max(...cells.map((x) => x[c])) - Math.min(...cells.map((x) => x[c]))));
    } catch { return null; }
  };
  const skipTag = (el) => /^(SCRIPT|STYLE|NOSCRIPT|TITLE|LINK|META)$/.test(el.tagName) || el instanceof SVGElement;
  // A ::before or ::after that paints a gradient, image or blur is its own box with no parent, so only the living-ground lint counts it.
  const pseudoBoxes = (el, host) => ['::before', '::after'].map((which) => {
    const cs = getComputedStyle(el, which);
    const blurred = cs.filter.includes('blur');
    if (cs.content === 'none' || (cs.backgroundImage === 'none' && !blurred)) return null;
    const placed = /^(absolute|fixed)$/.test(cs.position);
    const [w, h] = [parseFloat(cs.width), parseFloat(cs.height)];
    return {
      tag: which, p: -1, box: [host.box[0] + (placed ? parseFloat(cs.left) || 0 : 0), host.box[1] + (placed ? parseFloat(cs.top) || 0 : 0), w > 0 ? w : host.box[2], h > 0 ? h : host.box[3]],
      op: host.op * Number(cs.opacity), bg: null, image: cs.backgroundImage !== 'none', blurred,
      paint: cs.backgroundImage === 'none' ? null : cs.backgroundImage.slice(0, 600), blend: cs.mixBlendMode, tilePx: cs.backgroundRepeat.startsWith('no-repeat') ? 0 : parseFloat(cs.backgroundSize) || 0, canvasVaries: null,
      border: { l: [0, null], r: [0, null], t: [0, null], b: [0, null] }, radius: 0, shadow: false, decorative: host.decorative,
    };
  }).filter(Boolean);
  for (const el of [document.documentElement, document.body, ...document.body.querySelectorAll('*')]) {
    if (boxes.length >= 300) break;
    const b = skipTag(el) ? null : boxOf(el);
    if (b) { listed.set(el, boxes.length); boxes.push(b, ...pseudoBoxes(el, b)); }
  }
  return boxes;
}

// The colours the :root custom properties declare AND the page paints with (a var() in a colour or background declaration, directly or through
// another custom property), as [r, g, b, a]. A property nothing uses, or that is no colour (--weight: bold), is left out.
function rootPalette(rgba) {
  const root = getComputedStyle(document.documentElement);
  const isColour = (v) => /^(#[0-9a-f]{3,8}|(rgb|hsl|hwb|lab|lch|oklab|oklch|color)a?\(|black$|white$)/i.test(v);
  const rulesOf = (sheet) => { try { return [...sheet.cssRules].filter((r) => r.style); } catch { return []; } };
  const refs = (value) => [...value.matchAll(/var\(\s*(--[\w-]+)/g)].map((m) => m[1]);
  const paints = (css) => [...css.matchAll(/(?:^|[;\s])(?:color|background[\w-]*)\s*:\s*([^;]*)/g)].flatMap((m) => refs(m[1]));
  const rules = [...document.styleSheets].flatMap(rulesOf);
  const declared = rules.filter((r) => r.selectorText === ':root').flatMap((r) => [...r.style].filter((n) => n.startsWith('--')).map((name) => ({ name, value: r.style.getPropertyValue(name) })));
  const used = new Set([...rules.map((r) => r.style.cssText), ...[...document.querySelectorAll('[style]')].map((el) => el.getAttribute('style'))].flatMap(paints));
  for (let pass = 0; pass < declared.length; pass++) declared.filter((d) => used.has(d.name)).forEach((d) => refs(d.value).forEach((n) => used.add(n)));
  return [...new Set(declared.filter((d) => used.has(d.name)).map((d) => d.name))].map((n) => root.getPropertyValue(n).trim()).filter(isColour).map(rgba);
}

// One moment's layout for the layout lint (harness/lib/layout-lint.mjs): { w, h, accent, texts, blocks, boxes }. texts is one entry per
// visible text node (colour as [r, g, b, a], tracking in em, `block` the index of its block-level ancestor in blocks); boxes is one entry
// per painted HTML element (SVG is not read; at most 300), `p` the index of its nearest listed ancestor. accent is :root --accent, or null; palette is every colour the :root custom properties declare.
function layoutSample(decorative, chrome) {
  const [w, h] = [innerWidth, innerHeight];
  const rgba = layoutColours();
  const env = { rgba, frame: layoutFrame(w, h), decorative, chrome };
  const root = getComputedStyle(document.documentElement);
  const accent = root.getPropertyValue('--accent').trim();
  const palette = rootPalette(rgba);
  return { w, h, accent: accent ? rgba(accent) : null, palette, ...layoutTexts(env), boxes: layoutBoxes(env) };
}

const LAYOUT_SOURCE = [layoutColours, layoutFrame, layoutTexts, layoutBoxes, rootPalette, layoutSample].map((fn) => fn.toString()).join('\n');
const readLayout = (page) => page.evaluate((src, d, c) => new Function(`${src}\nreturn layoutSample(${JSON.stringify(d)}, ${JSON.stringify(c)});`)(), LAYOUT_SOURCE, DECORATIVE, CHROME);

/** Seek to each time and read the page's layout there. `seek(ms)` is a layout seek: layout needs no paint. */
export async function sampleLayout(page, times, seek) {
  const samples = [];
  for (const t of times) {
    await seek(t * 1000);
    samples.push({ t, ...(await readLayout(page)) });
  }
  return samples;
}

/** Seek to each sample time (film seconds from `from`) and list the visible text. `seek(ms)` is a layout seek: text needs no paint. */
export async function sampleText(page, dur, seek, from = 0) {
  const { step, times } = sampleTimes(dur);
  const samples = [];
  let hidden = null;
  for (const rel of times) {
    const t = +(from + rel).toFixed(3);
    await seek(t * 1000);
    const read = await page.evaluate(visibleLines, DECORATIVE, CHROME, false, TEXTURE);
    samples.push({ t, lines: read.lines });
    hidden = read.hidden;
  }
  return { samples, step, frameH: await page.evaluate(() => innerHeight), hidden };
}

const MOTION_TEXT_HZ = 30;
const MOTION_TEXT_MAX = 600;

/** The visible text at 30 samples a second (at most 600 over the film), each line with its element lineage: the input of the mid-move collision check. `seek(ms)` is a layout seek. */
export async function sampleTextMotion(page, dur, seek, from = 0) {
  const step = Math.max(1 / MOTION_TEXT_HZ, dur / MOTION_TEXT_MAX);
  const n = Math.floor(dur / step + 1e-9);
  const samples = [];
  for (let i = 0; i <= n; i++) {
    const t = +(from + i * step).toFixed(4);
    await seek(t * 1000);
    samples.push({ t, lines: (await page.evaluate(visibleLines, DECORATIVE, CHROME, true, TEXTURE)).lines });
  }
  return { samples, step };
}

/** The texts under the draft contrast floor, read from two screenshots at each settled sample only. `seek(ms)` must paint. */
export async function sampleContrast(page, samples, seek) {
  const withShots = [];
  for (const s of settledSamples(samples)) {
    await seek(s.t * 1000);
    withShots.push({ ...s, shots: await shownAndHidden(page) });
  }
  return draftLowContrast(withShots);
}

/**
 * The brief's SPEC Words rows read off the live page: { samples (the text at each settle time), times (per Words row,
 * when it appears and settles), objects (the Objects checks, or null when `objects` is false), frameW, frameH }.
 * Null when the tables name neither. The Words times are searched around the spec times, a few seeks each.
 */
export async function sampleSpec(page, tables, seek, dur, { objects = true } = {}) {
  if (!tables.words.length && !tables.objects.length) return null;
  const [frameW, frameH] = await page.evaluate(() => [innerWidth, innerHeight]);
  const frame = { frameW, frameH };
  const linesAt = async (t) => { await seek(t * 1000); return page.evaluate(visibleLines, DECORATIVE, CHROME, false, TEXTURE); };
  const times = specTimes(tables, dur);
  const samples = [];
  for (const t of times.text) samples.push({ t, ...(await linesAt(t)) });
  const wordTimesOf = [];
  for (const w of tables.words) wordTimesOf.push(await wordTimes(w, linesAt, { dur, frame }));
  return { samples, times: wordTimesOf, objects: objects ? await sampleObjects(page, tables, frame, dur) : null, frameW, frameH };
}

/** The Objects checks: every frame of the film boxed per named selector, then in/settle/out found. Null when no Objects rows. */
export async function sampleObjects(page, tables, frame, dur) {
  if (!tables.objects.length) return null;
  const boxes = await sampleBoxTracks(page, specTimes(tables, dur).boxes, { selectors: tables.objects.map((o) => o.selector) });
  return objectChecks(tables.objects, boxes, frame);
}

/** A stored Objects result with the "not found" distance back as Infinity (JSON writes it as null). */
export const reviveObjects = (checks) => checks && checks.map((c) => (c.dev === null ? { ...c, dev: Infinity } : c));
