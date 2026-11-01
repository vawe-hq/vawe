#!/usr/bin/env node
// harness/media/render-spec.mjs: a page film -> render-spec.json, the same numbers ref-spec.mjs reads
// from a reference's pixels, read here from the DOM: exact, no tracking. `see.mjs <page> --measure`.
//
//   node harness/media/render-spec.mjs <page.html> [--out dir] [--aspect 16:9]
//
// Seeks every authoring frame (page <meta name="fps">, default 30) at the full canvas size and records, per
// element: box centre and size, effective opacity, transform scale, blur, fill and text colour, font size.
// An element that moves or changes becomes a move (frames, overshoot, approach or spring fit through
// harness/lib/move-fit.mjs). Cuts are frames where the set of large visible elements turns over.
import fs from 'node:fs';
import path from 'node:path';
import { summariseMove, r1, r3, median } from '../lib/move-fit.mjs';
import { cssColor } from '../lib/color-delta.mjs';
import { scratch } from '../lib/scratch.mjs';
import { resolveDuration } from './page-duration.mjs';

const ACTIVE = 0.25;            // per-frame change (px, or 1 unit per 0.01 opacity) below which an element is still
const SEG_GAP = 1;              // still frames allowed inside one move
const MAX_MOVERS = 12;
const MAX_TEXT = 40;
const BIG_SHARE = 0.005;        // share of the frame an element covers to count when looking for cuts
const CUT_CHURN = 0.6;
const CUT_MIN_GAP = 3;
const MIN_OPACITY = 0.05;
const MAX_CELLS = 6_000_000;    // frames x elements: the row table is held in memory
const die = (m) => { console.error(`✗ ${m}`); process.exit(2); };

// ── in the page ──────────────────────────────────────────────────────────────────────────────────
function pageInit() {
  const skip = new Set(['SCRIPT', 'STYLE', 'LINK', 'META', 'TITLE', 'HEAD', 'NOSCRIPT', 'AUDIO', 'SOURCE', 'TEMPLATE', 'BR']);
  const els = [document.documentElement, document.body];
  for (const el of document.body.querySelectorAll('*')) {
    if (skip.has(el.tagName)) continue;
    if (el.tagName.toLowerCase() !== 'svg' && el.closest('svg')) continue;
    els.push(el);
  }
  const index = new Map(els.map((el, i) => [el, i]));
  window.__rsEls = els;
  window.__rsPal = [];
  window.__rsPalIndex = new Map();
  const nearest = (el) => { for (let p = el.parentElement; p; p = p.parentElement) if (index.has(p)) return index.get(p); return -1; };
  return els.map((el) => ({
    tag: el.tagName.toLowerCase(), id: el.id || '',
    cls: typeof el.className === 'string' ? el.className.trim().split(/\s+/).filter(Boolean).slice(0, 2).join('.') : '',
    parent: nearest(el),
  }));
}

function pageTexts() {
  return window.__rsEls.map((el) => [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join(' ').replace(/\s+/g, ' ').trim());
}

function pageMeasure() {
  const pal = (s) => {
    let i = window.__rsPalIndex.get(s);
    if (i == null) { i = window.__rsPal.length; window.__rsPal.push(s); window.__rsPalIndex.set(s, i); }
    return i;
  };
  const r2 = (v) => Math.round(v * 100) / 100;
  const blurOf = (f) => { const m = /blur\(([\d.]+)px\)/.exec(f || ''); return m ? parseFloat(m[1]) : 0; };
  const eff = new Map();
  const effOf = (e) => {
    if (!e) return { o: 1, b: 0 };
    let r = eff.get(e);
    if (!r) {
      const cs = getComputedStyle(e), p = effOf(e.parentElement);
      r = { o: p.o * parseFloat(cs.opacity), b: Math.max(p.b, blurOf(cs.filter)) };
      eff.set(e, r);
    }
    return r;
  };
  const scaleOf = (cs) => {
    let s = 1;
    const m = /^matrix(3d)?\(([^)]*)\)/.exec(cs.transform);
    if (m) {
      const v = m[2].split(',').map(parseFloat);
      s = m[1] ? Math.sqrt(Math.abs(v[0] * v[5] - v[1] * v[4])) : Math.sqrt(Math.abs(v[0] * v[3] - v[1] * v[2]));
    }
    const sp = parseFloat(cs.scale);
    return Number.isFinite(sp) ? s * sp : s;
  };
  return window.__rsEls.map((el) => {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    if (cs.display === 'none' || cs.visibility === 'hidden' || r.width <= 0 || r.height <= 0) return 0;
    const e = effOf(el);
    return [1, r2(r.left + r.width / 2), r2(r.top + r.height / 2), r2(r.width), r2(r.height), r2(e.o * 1000) / 1000,
      r2(scaleOf(cs)), r2(e.b), pal(cs.color), pal(cs.backgroundColor), r2(parseFloat(cs.fontSize) || 0)];
  });
}

function pageStatic() {
  const cues = [...document.querySelectorAll('audio')].map((a) => ({
    src: a.getAttribute('src'), synth: a.getAttribute('data-synth'), at: a.getAttribute('data-at'), loop: a.loop,
  }));
  const names = new Set();
  const grab = (style) => { for (const n of style) if (n.startsWith('--')) names.add(n); };
  for (const sheet of document.styleSheets) {
    let rules = [];
    try { rules = [...sheet.cssRules]; } catch { continue; }
    for (const rule of rules) if (rule.style && /(^|,)\s*(:root|html)\s*(,|$)/.test(rule.selectorText || '')) grab(rule.style);
  }
  grab(document.documentElement.style);
  const probe = document.createElement('span');
  document.body.appendChild(probe);
  const root = [];
  for (const name of names) {
    const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    if (!raw || !CSS.supports('color', raw)) continue;
    probe.style.color = '';
    probe.style.color = raw;
    root.push({ name, color: getComputedStyle(probe).color });
  }
  probe.remove();
  return { cues, root, palette: window.__rsPal };
}

// ── measure: seek every frame ───────────────────────────────────────────────────────────────────
export class MeasureTimeout extends Error {}

export const measureLimitS = (env = process.env) => (Number(env.VAWE_MEASURE_TIMEOUT) > 0 ? Number(env.VAWE_MEASURE_TIMEOUT) : 300);

export async function measurePage(pagePath, { aspect, log = console.error, limitS = measureLimitS(), now = Date.now } = {}) {
  const { readPageMeta, resolveFrame, openPage, settle } = await import('./render-page.mjs');
  const dur = await resolveDuration(pagePath);
  if (!(dur > 0)) die(`${pagePath} has no <meta name="duration" content="seconds">`);
  const fps = Number(readPageMeta(pagePath, 'fps')) || 30;
  const frame = resolveFrame(pagePath, { aspect, final: true });
  const n = Math.round(dur * fps);
  const opened = await openPage(pagePath, frame);
  try {
    const { page } = opened;
    await page.goto(opened.url, { waitUntil: 'load' });
    await page.evaluate((t) => window.__pageSeek(t, window, true), 0);
    await settle(page);
    const table = await page.evaluate(pageInit);
    await page.evaluate(`window.__rsMeasure = ${pageMeasure}`);
    if (n * table.length > MAX_CELLS) die(`${n} frames x ${table.length} elements is too large to hold; pass a shorter page or a lower <meta name="fps">`);
    const frames = [], texts = table.map(() => '');
    const step = Math.max(1, Math.floor(n / 8));
    log(`render-spec: ${n} frames at ${fps} fps, ${table.length} elements, ${frame.width}x${frame.height}`);
    const until = now() + limitS * 1000;
    for (let f = 0; f < n; f++) {
      if (now() > until) throw new MeasureTimeout(`stopped at frame ${f} of ${n} after ${limitS} s`);
      frames.push(await page.evaluate(async (t) => { await window.__pageSeek(t, window, true); return window.__rsMeasure(); }, f / fps));
      if (f % step === 0 || f === n - 1) {
        (await page.evaluate(pageTexts)).forEach((s, i) => { if (s.length > texts[i].length) texts[i] = s; });
      }
      if (f % 300 === 299) log(`  frame ${f + 1}/${n}`);
    }
    const st = await page.evaluate(pageStatic);
    return { fps, dur, n, frame, table: table.map((t, i) => ({ ...t, text: texts[i] })), frames, ...st,
      spectacle: readPageMeta(pagePath, 'spectacle') != null ? Number(readPageMeta(pagePath, 'spectacle')) : null };
  } finally { await opened.close(); }
}

// ── build the spec (pure) ───────────────────────────────────────────────────────────────────────
const label = (t) => `${t.tag}${t.id ? `#${t.id}` : ''}${t.cls ? `.${t.cls}` : ''}`;

function series(m) {
  const { n, table, frames, palette, frame } = m;
  const hexOf = palette.map((s) => cssColor(s));
  return table.map((t, id) => {
    const A = { x: new Float64Array(n), y: new Float64Array(n), w: new Float64Array(n), h: new Float64Array(n), o: new Float64Array(n),
      s: new Float64Array(n), b: new Float64Array(n), fs: new Float64Array(n), c: new Array(n).fill(null), bg: new Array(n).fill(null),
      vis: new Uint8Array(n) };
    let first = -1;
    for (let f = 0; f < n; f++) {
      const r = frames[f][id];
      if (r) {
        if (first < 0) first = f;
        A.vis[f] = 1;
        [, A.x[f], A.y[f], A.w[f], A.h[f], A.o[f], A.s[f], A.b[f]] = r;
        A.c[f] = hexOf[r[8]]; A.bg[f] = hexOf[r[9]]; A.fs[f] = r[10];
      } else if (f > 0) {
        for (const k of ['x', 'y', 'w', 'h', 's', 'b', 'fs']) A[k][f] = A[k][f - 1];
        A.c[f] = A.c[f - 1]; A.bg[f] = A.bg[f - 1];
      }
    }
    if (first > 0) for (let f = 0; f < first; f++) for (const k of ['x', 'y', 'w', 'h', 's', 'b', 'fs']) A[k][f] = A[k][first];
    return { id, t, A, seen: first >= 0, frameW: frame.width };
  });
}

// Position, size and opacity relative to the parent, so a child riding a moving card does not count as a mover.
function ownChange(S, E, f) {
  const p = E.t.parent >= 0 ? S[E.t.parent] : null;
  const rel = (g) => {
    const A = E.A;
    if (!p || !p.seen) return { x: A.x[g], y: A.y[g], w: A.w[g], h: A.h[g], o: A.o[g], s: A.s[g] };
    const P = p.A, pw = Math.max(P.w[g], 1), ph = Math.max(P.h[g], 1), po = Math.max(P.o[g], 0.02);
    return { x: ((A.x[g] - P.x[g]) / pw) * E.frameW, y: ((A.y[g] - P.y[g]) / ph) * E.frameW, w: (A.w[g] / pw) * E.frameW,
      h: (A.h[g] / ph) * E.frameW, o: A.o[g] / po, s: A.s[g] / Math.max(P.s[g], 0.01) };
  };
  const a = rel(f - 1), b = rel(f);
  const colour = (E.A.c[f] && E.A.c[f - 1] && E.A.c[f].hex !== E.A.c[f - 1].hex) || (E.A.bg[f] && E.A.bg[f - 1] && E.A.bg[f].hex !== E.A.bg[f - 1].hex);
  return Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y), Math.abs(b.w - a.w), Math.abs(b.h - a.h), Math.abs(b.o - a.o) * 100,
    Math.abs(b.s - a.s) * 100, Math.abs(E.A.b[f] - E.A.b[f - 1]), colour ? 1 : 0);
}

function findCuts(S, m) {
  const area = m.frame.width * m.frame.height * BIG_SHARE;
  const big = (E, f) => E.A.vis[f] && E.A.o[f] >= MIN_OPACITY && E.A.w[f] * E.A.h[f] >= area && E.t.tag !== 'html' && E.t.tag !== 'body';
  const bigSet = (f) => new Set(S.filter((E) => big(E, f)).map((E) => E.id));
  const cuts = [];
  let prev = bigSet(0);
  for (let f = 1; f < m.n; f++) {
    const cur = bigSet(f);
    let both = 0;
    for (const id of cur) if (prev.has(id)) both++;
    const union = prev.size + cur.size - both;
    const churn = union ? (union - both) / union : 0;
    if (union >= 3 && churn >= CUT_CHURN && (!cuts.length || f - cuts[cuts.length - 1].frame >= CUT_MIN_GAP))
      cuts.push({ frame: f, t: r3(f / m.fps), score: r3(churn), spike: r1(churn * 10) });
    prev = cur;
  }
  return cuts;
}

function segmentsOf(S, E, s0, s1) {
  const act = [];
  for (let f = s0 + 1; f < s1; f++) if (ownChange(S, E, f) > ACTIVE) act.push(f);
  const segs = [];
  for (const f of act) {
    const last = segs[segs.length - 1];
    if (last && f - last.f1 <= SEG_GAP + 1) last.f1 = f; else segs.push({ f0: f, f1: f });
  }
  return segs;
}

function channelOf(A, f0, f1) {
  const d = (k) => A[k][f1] - A[k][f0 - 1];
  const dx = d('x'), dy = d('y');
  if (Math.max(Math.abs(dx), Math.abs(dy)) >= 4) return Math.abs(dx) >= Math.abs(dy) ? { axis: 'x', k: 'x', mul: 1 } : { axis: 'y', k: 'y', mul: 1 };
  if (Math.max(Math.abs(d('w')), Math.abs(d('h'))) >= 4) return Math.abs(d('w')) >= Math.abs(d('h')) ? { axis: 'w', k: 'w', mul: 1 } : { axis: 'h', k: 'h', mul: 1 };
  if (Math.abs(d('o')) >= 0.2) return { axis: 'o', k: 'o', mul: 100 };
  if (Math.abs(d('s')) >= 0.05) return { axis: 's', k: 's', mul: 100 };
  return { axis: 'x', k: 'x', mul: 1 };
}

function moveOf(E, seg, shot, j, fps) {
  const { A } = E;
  const { f0, f1 } = seg;
  const ch = channelOf(A, f0, f1);
  const pos = [];
  for (let f = f0; f <= f1; f++) pos.push(A[ch.k][f] * ch.mul);
  const p0 = A[ch.k][f0 - 1] * ch.mul, p1 = A[ch.k][f1] * ch.mul;
  const speeds = pos.map((v, i) => Math.abs(v - (i ? pos[i - 1] : p0)));
  const peak = Math.max(...speeds, 0);
  const summary = summariseMove(pos, p0, p1, fps, 1);
  const rows = [];
  for (let f = f0; f <= f1; f++) {
    rows.push({ f, x: r1(A.x[f]), y: r1(A.y[f]), w: r1(A.w[f]), h: r1(A.h[f]), vx: r1(A.x[f] - A.x[f - 1]), vy: r1(A.y[f] - A.y[f - 1]),
      o: r3(A.o[f]), s: r3(A.s[f]), blur: r1(A.b[f]) });
  }
  const blurred = rows.filter((r) => r.blur >= 0.5);
  const isText = E.t.text.length > 0;
  return { id: `${shot}.${j}`, domId: E.id, label: label(E.t), role: isText ? 'text' : 'box', text: E.t.text.slice(0, 80),
    f0, f1, axis: ch.axis, frames: f1 - f0 + 1, movingFrames: speeds.filter((v) => v >= 0.05 * peak).length,
    from: [r1(A.x[f0 - 1]), r1(A.y[f0 - 1])], to: [r1(A.x[f1]), r1(A.y[f1])], size: [r1(median(rows.map((r) => r.w))), r1(median(rows.map((r) => r.h)))],
    peakSpeed: r1(peak * (ch.mul === 1 ? 1 : 0.01)), ...summary,
    opacity: [r3(A.o[f0 - 1]), r3(A.o[f1])], scale: [r3(A.s[f0 - 1]), r3(A.s[f1])],
    color: (A.bg[f1] && A.bg[f1].alpha >= 0.5 ? A.bg[f1].hex : null), textColor: isText && A.c[f1] ? A.c[f1].hex : null, fontPx: isText ? r1(A.fs[f1]) : null,
    blur: blurred.length ? { f0: blurred[0].f, f1: blurred[blurred.length - 1].f, frames: blurred.length, px: r1(Math.max(...blurred.map((r) => r.blur))) } : null,
    confidence: 'high', rows };
}

function shotPalette(S, m, f0, f1) {
  const mid = Math.floor((f0 + f1) / 2);
  const total = new Map();
  const canvas = S[0].A.bg[mid] && S[0].A.bg[mid].alpha >= 0.5 ? S[0].A.bg[mid] : (S[1].A.bg[mid] && S[1].A.bg[mid].alpha >= 0.5 ? S[1].A.bg[mid] : null);
  const frameArea = m.frame.width * m.frame.height;
  if (canvas) total.set(canvas.hex, frameArea);
  for (const E of S.slice(2)) {
    const bg = E.A.bg[mid];
    if (!E.A.vis[mid] || !bg || bg.alpha < 0.5 || E.A.o[mid] < 0.5) continue;
    total.set(bg.hex, (total.get(bg.hex) || 0) + Math.min(E.A.w[mid] * E.A.h[mid], frameArea));
  }
  const sum = [...total.values()].reduce((a, b) => a + b, 0) || 1;
  return [...total.entries()].map(([hex, a]) => ({ hex, share: r3(a / sum) })).sort((a, b) => b.share - a.share).slice(0, 5);
}

function textEntries(S, m, s0, s1) {
  const out = [];
  for (const E of S) {
    if (!E.t.text || !E.seen) continue;
    const vis = (f) => E.A.vis[f] && E.A.o[f] >= MIN_OPACITY && E.A.x[f] > -E.A.w[f] / 2 && E.A.x[f] < m.frame.width + E.A.w[f] / 2;
    let a = -1, b = -1;
    for (let f = s0; f < s1; f++) if (vis(f)) { if (a < 0) a = f; b = f; }
    if (a < 0) continue;
    const segs = segmentsOf(S, E, s0, s1);
    const arrival = segs.find((g) => g.f0 <= a + m.fps * 0.8);
    const settle = Math.max(a, arrival ? arrival.f1 : a);
    const later = segs.filter((g) => g.f0 > settle);
    const leaves = later.length && (E.A.o[later[later.length - 1].f1] < 0.5);
    const exitF = leaves ? later[later.length - 1].f0 : b + 1;
    const mid = Math.min(b, settle);
    out.push({ text: E.t.text.slice(0, 80), label: label(E.t), domId: E.id, f0: a, f1: b + 1, settleF: settle, exitF,
      boxHeightPx: r1(E.A.h[mid]), fontPx: r1(E.A.fs[mid]), fontPxApprox: r1(E.A.fs[mid]), cxPx: r1(E.A.x[mid]), cyPx: r1(E.A.y[mid]),
      color: E.A.c[mid] ? E.A.c[mid].hex : null, words: E.t.text.split(/\s+/).filter(Boolean).length });
  }
  return out.slice(0, MAX_TEXT);
}

export function buildRenderSpec(m, file) {
  const S = series(m);
  const cuts = findCuts(S, m);
  const bounds = [0, ...cuts.map((c) => c.frame), m.n];
  const hits = m.cues.filter((c) => !c.loop && c.at != null && Number.isFinite(Number(c.at)))
    .map((c) => ({ t: r3(Number(c.at)), frame: Math.round(Number(c.at) * m.fps), name: c.synth || c.src || '', strength: null }));
  const shots = [];
  for (let i = 0; i < bounds.length - 1; i++) {
    const f0 = bounds[i], f1 = bounds[i + 1];
    if (f1 - f0 < 2) continue;
    const perEl = [];
    for (const E of S.slice(2)) {
      if (!E.seen) continue;
      const segs = segmentsOf(S, E, f0, f1).filter((g) => g.f1 - g.f0 >= 1 && E.A.w[g.f1] * E.A.h[g.f1] >= 4);
      if (segs.length) perEl.push({ E, segs, area: median(segs.map((g) => E.A.w[g.f1] * E.A.h[g.f1])) });
    }
    const keep = [...perEl.filter((p) => !p.E.t.text).sort((a, b) => b.area - a.area).slice(0, MAX_MOVERS), ...perEl.filter((p) => p.E.t.text).slice(0, MAX_TEXT)];
    const elements = keep.flatMap((p) => p.segs.slice(0, 3).map((g, j) => moveOf(p.E, g, i + 1, j + 1, m.fps)));
    elements.sort((a, b) => a.f0 - b.f0 || b.size[0] * b.size[1] - a.size[0] * a.size[1]);
    elements.forEach((e, k) => { e.id = `${i + 1}.${k + 1}`; });
    shots.push({ index: i + 1, f0, f1, frames: f1 - f0, t0: r3(f0 / m.fps), t1: r3(f1 / m.fps), palette: shotPalette(S, m, f0, f1),
      camera: { zoomTotal: 1, panTotalPx: [0, 0], peakZoomPerFrame: 0, peakPanPxPerFrame: 0, big: false, rows: [] },
      elements, text: textEntries(S, m, f0, f1), hits: hits.filter((h) => h.frame >= f0 && h.frame < f1) });
  }
  const rootPalette = m.root.map((r) => ({ name: r.name, hex: (cssColor(r.color) || {}).hex })).filter((r) => r.hex);
  return { source: 'dom', media: { file, width: m.frame.width, height: m.frame.height, nativeFps: m.fps }, fps: m.fps, frames: m.n, duration: m.dur,
    cuts, audio: { hits, source: 'dom' }, spectacle: m.spectacle, rootPalette, shots };
}

// ── names: the DOM says WHICH element a pixel-measured box is, never how it moves ───────────────────
const NAME_MIN_IOU = 0.3;

function sourceLine(lines, t) {
  const find = (re) => { const i = lines.findIndex((l) => re.test(l)); return i >= 0 ? i + 1 : null; };
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (t.id) return find(new RegExp(`id=["']${esc(t.id)}["']`));
  if (t.cls) return find(new RegExp(`class=["'][^"']*\\b${esc(t.cls.split('.')[0])}\\b`));
  return t.text ? find(new RegExp(esc(t.text.slice(0, 20)))) : null;
}

/** m from measurePage -> { at(t, { cx, cy, w, h }) } with a box as fractions of the frame; -> { label, line } or null. */
export function domNamer(m, pagePath) {
  const lines = fs.readFileSync(pagePath, 'utf8').split('\n');
  const W = m.frame.width, H = m.frame.height;
  return { at(t, box) {
    const f = Math.max(0, Math.min(m.n - 1, Math.round(t * m.fps)));
    let best = null;
    m.table.forEach((el, id) => {
      const r = m.frames[f][id];
      if (!r || el.tag === 'html' || el.tag === 'body' || r[5] < MIN_OPACITY) return;
      const [, cx, cy, w, h] = r;
      const ix = Math.min(cx + w / 2, (box.cx + box.w / 2) * W) - Math.max(cx - w / 2, (box.cx - box.w / 2) * W);
      const iy = Math.min(cy + h / 2, (box.cy + box.h / 2) * H) - Math.max(cy - h / 2, (box.cy - box.h / 2) * H);
      if (ix <= 0 || iy <= 0) return;
      const iou = (ix * iy) / (w * h + box.w * W * box.h * H - ix * iy);
      if (!best || iou > best.iou) best = { iou, el };
    });
    if (!best || best.iou < NAME_MIN_IOU) return null;
    return { label: label(best.el), line: sourceLine(lines, best.el), text: best.el.text.slice(0, 24) };
  } };
}

/** Puts `name` on every tracked element and layout box of a pixel spec of the page's render. */
export function attachNames(spec, namer) {
  const W = spec.media.width, H = spec.media.height;
  for (const s of spec.shots) {
    for (const e of s.elements) e.name = namer.at((e.land ? e.land.t : e.f1 / spec.fps), { cx: e.to[0] / W, cy: e.to[1] / H, w: e.size[0] / W, h: e.size[1] / H });
    if (s.layout) for (const b of s.layout.boxes) b.name = namer.at(s.layout.frame / spec.fps, { cx: b.x + b.w / 2, cy: b.y + b.h / 2, w: b.w, h: b.h });
  }
}

export async function renderSpec({ page, outDir, aspect, withNames = false }) {
  const m = await measurePage(page, { aspect });
  const spec = buildRenderSpec(m, page);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'render-spec.json'), `${JSON.stringify(spec, null, 1)}\n`);
  return withNames ? { spec, namer: domNamer(m, page) } : spec;
}

async function main() {
  const argv = process.argv.slice(2);
  const flag = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
  const page = argv.find((a, i) => !a.startsWith('--') && !(argv[i - 1] || '').startsWith('--'));
  if (!page || !fs.existsSync(page)) die('usage: node harness/media/render-spec.mjs <page.html> [--out dir] [--aspect 16:9]');
  const outDir = path.resolve(flag('--out', scratch('render-spec', path.basename(path.dirname(path.resolve(page))))));
  let spec;
  try { spec = await renderSpec({ page: path.resolve(page), outDir, aspect: flag('--aspect', undefined) }); } catch (e) {
    if (e instanceof MeasureTimeout) die(`measure ${e.message}: raise the limit with VAWE_MEASURE_TIMEOUT=<seconds>`);
    throw e;
  }
  console.log(`✓ render-spec: ${spec.shots.length} shot(s), ${spec.cuts.length} cut(s) -> ${path.join(outDir, 'render-spec.json')}`);
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((e) => { console.error(e.stack || String(e)); process.exit(2); });
