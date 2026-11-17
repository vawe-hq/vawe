// Text colour against the pixels behind it: one screenshot with the text shown and one with every glyph
// transparent, so the ground is read without the glyphs. The critique (quality/gates/page-check.mjs) and
// the draft (harness/media/render-page.mjs, on the text probe's samples) share it.
import { spawnSync } from 'node:child_process';
import LIMITS from '../../taste/build/limits.json' with { type: 'json' };
import { contrastRatio, ensureContrast } from '../../core/color/index.js';
import { isWaived } from './waivers.mjs';

const RATIO = LIMITS['text-contrast'];
export const DRAFT_MIN_RATIO = RATIO.body_ratio;
const HIDE_TEXT = '*{color:transparent!important;text-shadow:none!important;-webkit-text-stroke:0!important;caret-color:transparent!important}';

export const rawRgb = (png) => spawnSync('ffmpeg', ['-v', 'error', '-f', 'image2pipe', '-i', '-', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'],
  { input: png, maxBuffer: 1 << 28 }).stdout;

export const parseRgb = (s) => { const m = /rgba?\(([^)]+)\)/.exec(s); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p[3] == null ? 1 : p[3] }; };

export const hexOf = (c) => `#${[c.r, c.g, c.b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

/** The page at its current seek, as { shown, raw } rgb24 buffers plus the capture size. */
export async function shownAndHidden(page) {
  const [cssW, cssH, scale] = await page.evaluate(() => [innerWidth, innerHeight, devicePixelRatio]);
  const shown = rawRgb(await page.screenshot({ type: 'png' }));
  const hide = await page.addStyleTag({ content: HIDE_TEXT });
  const raw = rawRgb(await page.screenshot({ type: 'png' }));
  await hide.evaluate((el) => el.remove());
  return { shown, raw, scale, width: Math.round(cssW * scale), height: Math.round(cssH * scale) };
}

function bgAround(raw, w, h, it) {
  const x0 = Math.max(0, Math.floor(it.x)), y0 = Math.max(0, Math.floor(it.y));
  const x1 = Math.min(w, Math.ceil(it.x + it.w)), y1 = Math.min(h, Math.ceil(it.y + it.h));
  let r = 0, g = 0, b = 0, n = 0;
  for (let y = y0; y < y1; y += 2) for (let x = x0; x < x1; x += 2) { const i = (y * w + x) * 3; r += raw[i]; g += raw[i + 1]; b += raw[i + 2]; n++; }
  return n ? { r: r / n, g: g / n, b: b / n } : null;
}

// A text run the page reports but never paints (clipped, covered, or still off its mask) changes no pixel
// when its colour is hidden, so it has no contrast to measure.
const PAINT_DELTA = 24;
const PAINT_MIN_PIXELS = 3;
function isPainted(row, frame, it) {
  const x0 = Math.max(0, Math.floor(it.x)), y0 = Math.max(0, Math.floor(it.y));
  const x1 = Math.min(frame.width, Math.ceil(it.x + it.w)), y1 = Math.min(frame.height, Math.ceil(it.y + it.h));
  let changed = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const i = (y * frame.width + x) * 3;
    if (Math.max(Math.abs(row.shown[i] - row.raw[i]), Math.abs(row.shown[i + 1] - row.raw[i + 1]), Math.abs(row.shown[i + 2] - row.raw[i + 2])) > PAINT_DELTA && ++changed >= PAINT_MIN_PIXELS) return true;
  }
  return false;
}

// One text run against the frame with its own text hidden: the ratio the viewer gets, alpha included.
// With no `min`, large type needs 3:1 and the rest 4.5:1 (WCAG); a `min` applies to every size.
function contrastOf(row, frame, it, min) {
  const fg = parseRgb(it.color), bg = bgAround(row.raw, frame.width, frame.height, it);
  if (!fg || !bg) return null;
  const a = fg.a * it.opacity;
  const eff = { r: fg.r * a + bg.r * (1 - a), g: fg.g * a + bg.g * (1 - a), b: fg.b * a + bg.b * (1 - a) };
  const large = it.size >= 0.022 * row.vh || (it.size >= 0.017 * row.vh && Number(it.weight) >= 700);
  const need = min ?? (large ? RATIO.large_ratio : RATIO.body_ratio);
  return { ratio: contrastRatio(hexOf(eff), hexOf(bg)), need, fg: eff, bg };
}

/** Texts under their need in two samples (or their only sample), each with its worst sample. Pure. */
export function lowContrast(rows, frame, min = null) {
  const seen = new Map();
  for (const row of rows) {
    if (!row.raw || !row.shown || row.raw.length < frame.width * frame.height * 3 || row.shown.length !== row.raw.length) continue;
    for (const it of row.items) {
      if (!isPainted(row, frame, it)) continue;
      const c = contrastOf(row, frame, it, min);
      if (!c) continue;
      const rec = seen.get(it.text) || { seen: 0, fails: 0, worst: null };
      rec.seen++;
      if (c.ratio < c.need) {
        rec.fails++;
        if (!rec.worst || c.ratio < rec.worst.ratio) rec.worst = { ...c, t: row.t };
      }
      seen.set(it.text, rec);
    }
  }
  return [...seen].filter(([, r]) => r.fails >= 2 || (r.seen === 1 && r.fails === 1)).map(([text, r]) => ({ text, seen: r.seen, fails: r.fails, ...r.worst }));
}

/** A colour for the text that reaches the need on that ground. */
export const passingColour = (c) => ensureContrast(hexOf(c.fg), hexOf(c.bg), { min: c.need });

/** The draft's probe samples (lines with a CSS px box, each sample with shownAndHidden) as contrast rows. Pure. */
export function probeRows(samples) {
  return samples.filter((s) => s.shots).map(({ t, lines, shots }) => ({
    t, vh: shots.height, shown: shots.shown, raw: shots.raw,
    items: lines.filter((l) => l.box).map((l) => ({ text: l.text, color: l.color, opacity: l.opacity ?? 1, size: l.fontPx,
      x: l.box[0] * shots.scale, y: l.box[1] * shots.scale, w: l.box[2] * shots.scale, h: l.box[3] * shots.scale })),
  }));
}

/** The texts under DRAFT_MIN_RATIO in the draft's probe samples, each with its worst sample; null when no sample has pixels. Pure. */
export function draftLowContrast(samples) {
  const rows = probeRows(samples);
  if (!rows.length) return null;
  const first = samples.find((s) => s.shots).shots;
  return lowContrast(rows, { width: first.width, height: first.height }, DRAFT_MIN_RATIO);
}

/** One advice line per text under DRAFT_MIN_RATIO in the draft's probe samples. Pure. */
export const draftContrastLines = (samples) => contrastLines(draftLowContrast(samples));

/** One advice line per low-contrast text (draftLowContrast's list). Pure. */
export function contrastLines(low) {
  return (low ?? []).map((c) => `text "${c.text}" at ${c.t.toFixed(2)} s reads ${c.ratio.toFixed(1)}:1 on the pixels behind it (${hexOf(c.fg)} on ${hexOf(c.bg)}, needs ${c.need}:1): ${contrastFix(c)}`);
}

const contrastFix = (c) => `use ${passingColour(c)}, or change the ground behind it, or waive "text-low-contrast@${c.t.toFixed(2)}" with a _why`;

/** One { kind, at, measured, fix } per low-contrast text (draftLowContrast's list), for out/<film>.checks.json. Pure. */
export const contrastItems = (low) => (low ?? []).map((c) => ({ kind: 'contrast', at: c.t, measured: `"${c.text}" at ${c.t.toFixed(1)} s reads ${c.ratio.toFixed(1)}:1 (needs ${c.need}:1)`, fix: contrastFix(c) }));

/** The low-contrast texts the page does not waive: a waiver is `text-low-contrast@<second>` or a range "a-b" that holds the sample's second. Null stays null (not sampled). */
export const unwaivedContrast = (low, authoring) => (low ? low.filter((c) => !isWaived(authoring, 'text-low-contrast', c.t.toFixed(2))) : low);
