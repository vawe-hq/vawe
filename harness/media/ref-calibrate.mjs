#!/usr/bin/env node
// harness/media/ref-calibrate.mjs: how wrong is ref-spec? Renders the pages in tests/fixtures/ref-measure/
// (their truth is known: a delay, an easing, a box, a word's reveal time), runs refSpec on each mp4 and
// writes the error per measure to quality/baselines/ref-spec-error.json. refSpec loads that file, so every
// SPEC.md and every delta knows how far to trust each number, and marks "check by eye" where the p90 error
// is larger than the difference the measure has to detect.
//
//   node harness/media/ref-calibrate.mjs [--only move-linear,text-stagger] [--dry]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scratch } from '../lib/scratch.mjs';
import { deltaE } from '../lib/color-delta.mjs';
import { norm } from '../lib/ref-measure/words.mjs';
import { ERROR_BASELINE } from '../lib/ref-measure/error-table.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const FIXTURES = path.join(ROOT, 'tests/fixtures/ref-measure');
const RENDER = { fps: 60, w: 960, h: 540 };
const REST_PX = 0.5;

// What each measure must be able to tell apart, in its own unit. A measure whose p90 error exceeds this is "check by eye".
export const MUST_DETECT = { startMs: 1000 / 30, landMs: 1000 / 30, landMsTail: 1000 / 30, overshoot: 0.02, sizeFrac: 0.1, posFrac: 0.03, cutMs: 1000 / 30,
  layoutFrac: 0.02, wordT0Ms: 1000 / 30, textSizeFrac: 0.12, textPosFrac: 0.03, attackMs: 40, paletteDE: 6 };

// ── truth: closed forms of what each fixture's own script does ──────────────────────────────────
const clamp01 = (u) => Math.min(1, Math.max(0, u));

function bezier(x1, y1, x2, y2) {
  const at = (s, a, b) => 3 * (1 - s) ** 2 * s * a + 3 * (1 - s) * s * s * b + s ** 3;
  return (u) => {
    if (u <= 0) return 0;
    if (u >= 1) return 1;
    let lo = 0, hi = 1;
    for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (at(m, x1, x2) < u) lo = m; else hi = m; }
    return at((lo + hi) / 2, y1, y2);
  };
}

function cssLinear(file) {
  const src = fs.readFileSync(path.join(FIXTURES, file), 'utf8');
  const stops = /linear\(([^)]*)\)/.exec(src)[1].split(',').map(Number);
  return (u) => {
    const x = clamp01(u) * (stops.length - 1), i = Math.min(stops.length - 2, Math.floor(x));
    return stops[i] + (stops[i + 1] - stops[i]) * (x - i);
  };
}

const BOX = { left: 0.1, top: 0.38, w: 0.14, h: 0.24 };
const CARD = { left: 0.35, top: 0.08, w: 0.3, h: 0.26 };
const linearMove = (start, dur, ease) => ({ start, prog: (t) => ease(clamp01((t - start) / dur)) });

const MOVES = {
  'move-linear': { ...linearMove(0.5, 0.7, (u) => u), box: BOX, axis: 'x', classes: ['linear'] },
  'move-bezier': { ...linearMove(0.5, 0.7, bezier(0.2, 0.8, 0.2, 1)), box: BOX, axis: 'x', classes: ['bezier', 'approach', 'spring'] },
  'move-blur': { ...linearMove(0.5, 0.7, bezier(0.2, 0.8, 0.2, 1)), box: BOX, axis: 'x', classes: ['bezier', 'approach', 'spring'] },
  'move-overshoot': { ...linearMove(0.5, 0.8, bezier(0.34, 1.56, 0.64, 1)), box: BOX, axis: 'x', classes: ['bezier', 'spring'] },
  'move-spring': { ...linearMove(0.5, 0.89, cssLinear('move-spring.html')), box: BOX, axis: 'x', classes: ['spring', 'bezier'] },
  'move-inout-card': { ...linearMove(0.6, 0.9, bezier(0.65, 0, 0.35, 1)), box: CARD, axis: 'y', classes: ['bezier'] },
  'move-approach': { start: 0.5, prog: (t) => (t < 0.5 ? 0 : 1 - 0.85 ** ((t - 0.5) * 30)), box: BOX, axis: 'x', classes: ['approach', 'bezier'] },
};

// Last time the box is more than 0.5 px from where it rests, and the highest it overshoots.
function moveTruth(m, travelPx) {
  let land = m.start, peak = 0;
  for (let t = m.start; t < m.start + 3; t += 0.001) {
    const p = m.prog(t);
    if (Math.abs(p - 1) * travelPx > REST_PX) land = t;
    peak = Math.max(peak, p);
  }
  return { start: m.start, land, overshoot: Math.max(1, peak) };
}

const TEXT_ROWS = {
  'text-stagger': { font: 0.09, rows: [{ words: ['Good', 'motion', 'design', 'travels'], at: (i) => 0.5 + 0.15 * i, order: 'left-to-right' },
    { words: ['Simple', 'systems', 'always', 'scale'], at: (i) => 1.5 + 0.2 * (3 - i), order: 'right-to-left' },
    { words: ['Good', 'ideas', 'Good', 'ideas'], at: () => 3.0, order: 'all-at-once' }] },
  'text-blur': { font: 0.12, rows: [{ words: ['Motion', 'follows', 'meaning'], at: (i) => 0.4 + 0.1 * i, order: 'left-to-right' },
    { words: ['Good', 'timing', 'reads'], at: (i) => 1.6 + 0.3 * i, order: 'left-to-right' }] },
};

const LAYOUT_TRUTH = [{ x: 0.1, y: 0.08, w: 0.4, h: 0.06 }, ...[0.1, 0.4, 0.7].map((x) => ({ x, y: 0.2, w: 0.2, h: 0.5 })), ...[0.1, 0.4, 0.7].map((x) => ({ x, y: 0.74, w: 0.2, h: 0.04 }))];
const PALETTE_TRUTH = { 'layout-grid': ['#101820', '#ffd400', '#e63946', '#f1faee'], 'move-bezier': ['#101820', '#ffd400'], 'move-linear': ['#101820', '#ffd400'] };
const TRANSITION_TRUTH = [{ start: 1.0, end: 1.0, type: 'cut' }, { start: 2.0, end: 2.2, type: 'crossfade' }, { start: 3.0, end: 3.3, type: 'wipe' },
  { start: 4.0, end: 4.3, type: 'push' }, { start: 5.0, end: 5.0, type: 'match' }];
const AUDIO_TRUTH = [1.0, 1.2, 2.0];

// ── collection: every sample is { measure, value (signed), unit } ──────────────────────────────
function moveSamples(name, spec) {
  const m = MOVES[name], W = spec.media.width, H = spec.media.height, span = m.axis === 'x' ? W : H;
  const t = moveTruth(m, 0.5 * span);
  const rest = { cx: (m.box.left + m.box.w / 2) * W + (m.axis === 'x' ? 0.5 * W : 0), cy: (m.box.top + m.box.h / 2) * H + (m.axis === 'y' ? 0.5 * H : 0) };
  const els = spec.shots.flatMap((s) => s.elements);
  const dist = (e) => Math.hypot(e.to[0] - rest.cx, e.to[1] - rest.cy);
  const e = els.sort((a, b) => dist(a) - dist(b))[0];
  if (!e || dist(e) > 0.1 * W) return { samples: [], hits: [{ measure: 'elementFound', ok: false }] };
  const out = [{ measure: 'posFrac', value: dist(e) / W }, { measure: 'sizeFrac', value: Math.sqrt((e.size[0] * e.size[1]) / (m.box.w * W * m.box.h * H)) - 1, blur: name === 'move-blur' }];
  const hits = [{ measure: 'elementFound', ok: true }];
  if (e.easing) {
    const tail = e.fit && e.fit.kind === 'approach';
    out.push({ measure: 'startMs', value: (e.start.t - t.start) * 1000 }, { measure: tail ? 'landMsTail' : 'landMs', value: (e.land.t - t.land) * 1000 }, { measure: 'overshoot', value: (e.overshoot ?? 1) - t.overshoot });
    hits.push({ measure: 'easingClass', ok: m.classes.includes(e.easing.class) });
  } else hits.push({ measure: 'easingClass', ok: false });
  return { samples: out, hits };
}

function layoutSamples(spec) {
  const boxes = spec.shots[0].layout.boxes;
  return LAYOUT_TRUTH.map((t) => {
    const near = boxes.reduce((b, x) => (!b || Math.hypot(x.x - t.x, x.y - t.y) < Math.hypot(b.x - t.x, b.y - t.y) ? x : b), null);
    return { measure: 'layoutFrac', value: near ? Math.max(Math.abs(near.x - t.x), Math.abs(near.y - t.y), Math.abs(near.w - t.w), Math.abs(near.h - t.h)) : 1 };
  });
}

function paletteSamples(name, spec) {
  const have = spec.shots[0].palette.map((p) => p.hex);
  return (PALETTE_TRUTH[name] || []).map((hex) => ({ measure: 'paletteDE', value: Math.min(...have.map((h) => deltaE(hex, h))) }));
}

function transitionSamples(spec) {
  const samples = [], hits = [];
  TRANSITION_TRUTH.forEach((t, i) => {
    const c = spec.cuts[i];
    if (!c) { hits.push({ measure: 'transitionType', ok: false }); return; }
    samples.push({ measure: 'cutMs', value: (c.t - t.end) * 1000 }, { measure: 'cutMs', value: (c.transition.startT - t.start) * 1000 });
    hits.push({ measure: 'transitionType', ok: c.transition.type === t.type });
  });
  if (spec.cuts.length !== TRANSITION_TRUTH.length) hits.push({ measure: 'transitionCount', ok: false });
  return { samples, hits };
}

function audioSamples(spec) {
  const hits = spec.audio ? spec.audio.hits : [];
  return AUDIO_TRUTH.map((t) => {
    const near = hits.reduce((b, h) => (!b || Math.abs(h.attack - t) < Math.abs(b.attack - t) ? h : b), null);
    return near && Math.abs(near.attack - t) < 0.15 ? { measure: 'attackMs', value: (near.attack - t) * 1000 } : { measure: 'attackMs', value: 150 };
  });
}

// The DOM knows where each word's box is; the truth for a reveal time comes from the fixture's own delay table.
function textSamples(name, spec, dom) {
  const cfg = TEXT_ROWS[name], W = spec.media.width, H = spec.media.height, k = W / dom.frame.width;
  const spans = dom.table.map((t, id) => ({ t, id })).filter((s) => s.t.tag === 'span');
  const truth = cfg.rows.flatMap((r) => r.words.map((w, i) => ({ word: w, t0: r.at(i) })));
  const measured = spec.textLines.flatMap((l) => l.words);
  const samples = [];
  spans.forEach((s, i) => {
    const r = dom.frames[dom.n - 1][s.id];
    const same = measured.filter((w) => norm(w.word) === norm(truth[i].word));
    const w = same.reduce((b, x) => (!b || Math.hypot(x.x - r[1] * k, x.y - r[2] * k) < Math.hypot(b.x - r[1] * k, b.y - r[2] * k) ? x : b), null);
    if (!w || Math.hypot(w.x - r[1] * k, w.y - r[2] * k) > 0.1 * W) { samples.push({ measure: 'wordT0Ms', value: 1000 }); return; }
    samples.push({ measure: 'wordT0Ms', value: (w.t0 - truth[i].t0) * 1000 }, { measure: 'textSizeFrac', value: w.fontPx / (cfg.font * H) - 1 },
      { measure: 'textPosFrac', value: Math.hypot((w.x - r[1] * k) / W, (w.y - r[2] * k) / H) });
  });
  const hits = cfg.rows.map((row) => ({ measure: 'stagger', ok: spec.textLines.some((l) => l.stagger === row.order && row.words.filter((w) => l.text.toLowerCase().includes(w.toLowerCase())).length >= row.words.length - 1) }));
  return { samples, hits };
}

// ── run ───────────────────────────────────────────────────────────────────────────────────────
async function measure(name, mp4, page) {
  const { refSpec } = await import('./ref-spec.mjs');
  const text = name in TEXT_ROWS;
  const spec = await refSpec({ video: mp4, outDir: path.join(path.dirname(mp4), name), fps: RENDER.fps, ocr: text, audio: name === 'audio-click', calibrating: true });
  if (name in MOVES) return moveSamples(name, spec);
  if (name === 'layout-grid') return { samples: [...layoutSamples(spec), ...paletteSamples(name, spec)], hits: [] };
  if (name === 'transitions') return transitionSamples(spec);
  if (name === 'audio-click') return { samples: audioSamples(spec), hits: [] };
  const { measurePage, MeasureTimeout } = await import('./render-spec.mjs');
  try { return textSamples(name, spec, await measurePage(page)); } catch (e) {
    if (!(e instanceof MeasureTimeout)) throw e;
    console.error(`✗ measure ${e.message}: raise the limit with VAWE_MEASURE_TIMEOUT=<seconds>`);
    process.exit(2);
  }
}

const quantile = (a, q) => [...a].sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(q * a.length))];

export function summarise(samples, hits) {
  const by = {};
  for (const s of samples) (by[s.measure] ||= []).push(s);
  const measures = {};
  for (const [name, list] of Object.entries(by)) {
    const abs = list.map((s) => Math.abs(s.value));
    const round = (v) => Math.round(v * 1000) / 1000;
    measures[name] = { n: list.length, p50: round(quantile(abs, 0.5)), p90: round(quantile(abs, 0.9)), bias: round(quantile(list.map((s) => s.value), 0.5)),
      mustDetect: round(MUST_DETECT[name]), ok: quantile(abs, 0.9) <= MUST_DETECT[name] };
  }
  const blur = samples.filter((s) => s.blur).map((s) => s.value);
  if (blur.length) measures.sizeFracBlur = { n: blur.length, p50: Math.round(quantile(blur.map(Math.abs), 0.5) * 1000) / 1000, p90: Math.round(Math.max(...blur.map(Math.abs)) * 1000) / 1000, bias: Math.round(blur[0] * 1000) / 1000, mustDetect: MUST_DETECT.sizeFrac, ok: true };
  const accuracy = {};
  for (const h of hits) { const a = (accuracy[h.measure] ||= { hit: 0, n: 0 }); a.n++; if (h.ok) a.hit++; }
  return { measures, accuracy };
}

async function main() {
  const argv = process.argv.slice(2);
  const only = argv.includes('--only') ? argv[argv.indexOf('--only') + 1].split(',') : null;
  const names = fs.readdirSync(FIXTURES).filter((f) => f.endsWith('.html')).map((f) => f.slice(0, -5)).filter((n) => !only || only.includes(n));
  const { renderPage } = await import('./render-page.mjs');
  const dir = scratch('ref-calibrate');
  const samples = [], hits = [];
  for (const name of names) {
    const page = path.join(FIXTURES, `${name}.html`), mp4 = path.join(dir, `${name}.mp4`);
    console.error(`calibrate: ${name}`);
    await renderPage(page, mp4, { fps: RENDER.fps, w: RENDER.w, h: RENDER.h, audio: name === 'audio-click' ? true : undefined });
    const got = await measure(name, mp4, page);
    got.samples.forEach((s) => { s.fixture = name; });
    samples.push(...got.samples); hits.push(...got.hits);
  }
  if (argv.includes('--samples')) for (const s of samples) console.log(`${s.fixture.padEnd(16)} ${s.measure.padEnd(13)} ${Math.round(s.value * 1000) / 1000}`);
  const table = { generated: new Date().toISOString().slice(0, 10), render: RENDER, fixtures: names, ...summarise(samples, hits) };
  if (!argv.includes('--dry')) fs.writeFileSync(ERROR_BASELINE, `${JSON.stringify(table, null, 1)}\n`);
  for (const [k, v] of Object.entries(table.measures)) console.log(`${k.padEnd(14)} n ${String(v.n).padStart(3)}  p50 ${String(v.p50).padStart(8)}  p90 ${String(v.p90).padStart(8)}  bias ${String(v.bias).padStart(8)}  ${v.ok ? 'ok' : 'CHECK BY EYE'}`);
  for (const [k, v] of Object.entries(table.accuracy)) console.log(`${k.padEnd(14)} ${v.hit}/${v.n}`);
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((e) => { console.error(e.stack || String(e)); process.exit(2); });
