// The world reader's I/O: which data-world elements show at each sample time, read from the live page
// (pure span math: harness/lib/worlds.mjs). It runs in the draft check's text sample times.
import { worldSpans } from '../lib/worlds.mjs';
import { FPS } from './motion-curve.mjs';

const round = (n) => +n.toFixed(3);

export const SEEN_MIN_OPACITY = 0.05;
const GROUND_MIN_SHARE = 0.5;

// Runs inside the page, bundled as source with the readers that use it (tail-sample.mjs too): no display:none or visibility:hidden,
// opacity (with its ancestors') above minOpacity, and a box that meets the viewport.
export function elementShows(el, minOpacity) {
  let opacity = 1;
  for (let n = el; n; n = n.parentElement) {
    const s = getComputedStyle(n);
    if (s.display === 'none') return false;
    opacity *= Number(s.opacity);
  }
  const r = el.getBoundingClientRect();
  const inside = r.width > 0 && r.height > 0 && r.right > 0 && r.bottom > 0 && r.left < innerWidth && r.top < innerHeight;
  return getComputedStyle(el).visibility !== 'hidden' && opacity > minOpacity && inside;
}

// Runs inside the page: [{ id, visible, ground, texts, shape, clips }] for every [data-world] element. visible: elementShows. ground: the first
// non-transparent background of the element, its ancestors, then a descendant covering over GROUND_MIN_SHARE of the frame, as #rrggbb, or null.
function worldsSample(minOpacity, minShare) {
  const hex = (css) => {
    const m = /^rgba?\(([^)]+)\)$/.exec(css);
    if (!m) return null;
    const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
    if ((p.length > 3 ? p[3] : 1) <= 0) return null;
    return `#${p.slice(0, 3).map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
  };
  const hash = (text) => { let h = 5381; for (let i = 0; i < text.length; i++) h = ((h * 33) ^ text.charCodeAt(i)) >>> 0; return h.toString(36); };
  const bgOf = (el) => hex(getComputedStyle(el).backgroundColor);
  const covers = (el) => {
    const r = el.getBoundingClientRect();
    const w = Math.max(0, Math.min(r.right, innerWidth) - Math.max(r.left, 0));
    const h = Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0));
    return (w * h) / (innerWidth * innerHeight) > minShare;
  };
  const groundOf = (el) => {
    for (let n = el; n; n = n.parentElement) { const c = bgOf(n); if (c) return c; }
    const child = [...el.querySelectorAll('*')].find((n) => covers(n) && bgOf(n));
    return child ? bgOf(child) : null;
  };
  // The texts to read: each visible element with its own words, skipping texture (aria-hidden) and product chrome (data-chrome), as the text checks do.
  const textsOf = (world) => [...world.querySelectorAll('*')]
    .filter((n) => [...n.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim()) && !n.closest('[aria-hidden="true"],[data-chrome]') && elementShows(n, minOpacity))
    .map((n) => n.textContent.replace(/\s+/g, ' ').trim());
  // What the world shows besides words: the world and each visible descendant as tag.class, its background colour and image, a hash of the source of an img or video (a data: url would fill the check files), and its box in twentieths of the frame, so two worlds
  // that hold the same copy of the same things match and two worlds that hold different things do not.
  const shapeOf = (world) => [world, ...world.querySelectorAll('*')].filter((n) => elementShows(n, minOpacity)).slice(0, 80).map((n) => {
    const r = n.getBoundingClientRect();
    const q = (v, whole) => Math.round((v / whole) * 20);
    const cls = typeof n.className === 'string' ? n.className.trim().split(/\s+/)[0] : '';
    const image = getComputedStyle(n).backgroundImage;
    return `${n.tagName.toLowerCase()}.${cls}|${bgOf(n) || ''}|${image === 'none' ? '' : image.slice(0, 160)}|${n.currentSrc ? hash(n.currentSrc) : ''}|${q(r.x, innerWidth)},${q(r.y, innerHeight)},${q(r.width, innerWidth)},${q(r.height, innerHeight)}`;
  }).sort();
  const clipsOf = (world) => [...world.querySelectorAll('video')].filter((v) => elementShows(v, minOpacity)).map((v) => {
    const attr = (name, fallback) => (Number.isNaN(parseFloat(v.getAttribute(name))) ? fallback : parseFloat(v.getAttribute(name)));
    const end = attr('data-trim-end', v.duration);
    return { rate: attr('data-rate', 1), range: Number.isFinite(end) ? Math.max(0, end - attr('data-trim', 0)) : null };
  });
  return [...document.querySelectorAll('[data-world]')].map((el) => {
    const visible = elementShows(el, minOpacity);
    return { id: el.dataset.world, visible, ground: groundOf(el), texts: visible ? textsOf(el) : [], shape: visible ? shapeOf(el) : [], clips: visible ? clipsOf(el) : [] };
  });
}

export const SHOWS_SOURCE = elementShows.toString();
const WORLDS_SOURCE = [elementShows, worldsSample].map((fn) => fn.toString()).join('\n');
export const readWorlds = (page) => page.evaluate((src, o, s) => new Function(`${src}\nreturn worldsSample(${o}, ${s});`)(), WORLDS_SOURCE, SEEN_MIN_OPACITY, GROUND_MIN_SHARE);

// A seek runs the page's own frame hooks (a video decode, a texture upload), so worlds are read every STRIDE frames, and every frame
// between two reads that show different worlds: a world of STRIDE frames (0.1 s) or more always meets a read, and its span stays exact.
const STRIDE = 3;
const shownIds = (sample) => sample.worlds.filter((w) => w.visible).map((w) => w.id).join(' ');

/**
 * Read the worlds on the draft grid; returns [{ id, start, end, ground, readNeed }] in page order. start is the first visible frame
 * and end the first hidden frame after it. `seek(ms)` is a layout seek.
 */
export async function sampleWorlds(page, dur, seek, from = 0, fps = FPS) {
  const last = Math.floor(dur * fps + 1e-9);
  const byFrame = new Map();
  const read = async (j) => {
    const t = +(from + j / fps).toFixed(3);
    await seek(t * 1000);
    byFrame.set(j, { t, worlds: await readWorlds(page) });
    return byFrame.get(j);
  };
  let before = await read(0);
  for (let j = Math.min(STRIDE, last), prev = 0; prev < last; prev = j, j = Math.min(j + STRIDE, last)) {
    const now = await read(j);
    if (shownIds(now) !== shownIds(before)) for (let k = prev + 1; k < j; k++) await read(k);
    before = now;
  }
  const samples = [...byFrame.keys()].sort((a, b) => a - b).map((j) => byFrame.get(j));
  const end = from + dur;
  return worldSpans(samples, { step: 0, dur: end }).map((s) => (s.start == null ? s : { ...s, end: Math.min(end, round(s.end + 1 / fps)) }));
}

const STILL_FRACTIONS = [0.5, 0.65, 0.35, 0.8, 0.2];
// An animation that ends this close to the end of its world is the world's exit, not an entrance.
const EXIT_WINDOW_S = 0.1;
const SETTLE_S = 0.05;

/** [{ world, id, start, end }] in seconds for every finite animation on a [data-world] element or inside one, texture (aria-hidden) left out. Run in the page as it is now. */
export const readWorldAnimations = (page) => page.evaluate(() => document.getAnimations().flatMap((a) => {
  const el = a.effect && a.effect.target;
  const world = el && el.closest && el.closest('[data-world]');
  const t = a.effect && a.effect.getComputedTiming();
  if (!world || el.closest('[aria-hidden="true"]') || !Number.isFinite(t.endTime)) return [];
  const eased = [t.easing, ...a.effect.getKeyframes().map((k) => k.easing)].find((e) => e && e !== 'linear');
  return [{ world: world.dataset.world, id: a.id || a.animationName || '', start: t.delay / 1000, end: t.endTime / 1000, ease: eased || 'linear' }];
}));

/** The second the world's own entrances have all ended, a frame later, or null: animations that end inside the span and not at its end. Pure. */
function settledAt(span, anims) {
  const ends = anims.filter((a) => a.world === span.id && a.end > span.start && a.end < span.end - EXIT_WINDOW_S).map((a) => a.end);
  return ends.length ? +(Math.max(...ends) + SETTLE_S).toFixed(3) : null;
}

/** The seconds to try for one world's still, best first: after the world's entrances end, then the middle of its span and other points inside it. [0] when the page never shows it. Pure. */
export function stillCandidates(span, anims = []) {
  if (!span || span.start == null) return [0];
  const spread = STILL_FRACTIONS.map((f) => +(span.start + (span.end - span.start) * f).toFixed(3));
  const settled = settledAt(span, anims);
  return settled != null && settled < span.end ? [settled, ...spread] : spread;
}

/** True when world `id` shows on the page as it is now. */
export const worldShowsNow = async (page, id) => (await readWorlds(page)).some((w) => w.id === id && w.visible);
