// Build the /easing pages' data from the motion library: one JSON file the site imports at build time.
// Every number on an easing page is computed here from core/motion (the curve, its velocity, the
// linear() string, the bezier fit, the After Effects handles, the speed bands, the stagger and exit
// limits, the product UI numbers) and from the real handle data in scripts/site/data/ae-handles.json.
// The words are in easing-text.mjs (vaweWords takes the numbers this file computes) and in the JOBS
// table below, which picks which core number goes where.
//
//   node scripts/site/easing.mjs     writes site/lib/easing.json (pure node, runs in prebuild)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { EASE, EASE_HANDLES, easeFn, UI, BANDS } from '../../core/motion/presets.js';
import { resolveHandle, HANDLE_REGISTRY } from '../../core/motion/motion.js';
import { curveToLinear, spring, springDuration, springLinear } from '../../core/motion/springs.js';
import * as curves from '../../core/motion/curves.js';
import { FPS, sec, span, firstFrame, lateStart, EXIT, EXIT_EXAMPLE, EXIT_FALLBACK, popPeakAt, popSettleFrames, JOBS } from '../../core/motion/ease-jobs.js';
import { VAWE_TEXT, vaweWords, FAMILY, DIRECTION, SPECIAL, CSS_TEXT } from './easing-text.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(root, 'site', 'lib', 'easing.json');
const AE = JSON.parse(fs.readFileSync(path.join(root, 'scripts/site/data/ae-handles.json'), 'utf8'));
const MOVES_DIR = path.join(root, 'prompts', 'moves');

if (!fs.existsSync(MOVES_DIR)) {
  console.log('~ prompts/moves is not here; using the committed site/lib/easing.json');
  process.exit(0);
}
const MOVES_JSON = JSON.parse(fs.readFileSync(path.join(root, 'site/lib/moves.json'), 'utf8'));

const SAMPLES = 100;
const DENSE = 4000;
const LINEAR_TOLERANCE = 0.002;
const r4 = (x) => Math.round(x * 1e4) / 1e4;
const r2 = (x) => Math.round(x * 1e2) / 1e2;
const kebab = (s) => s.replace(/([A-Z])/g, '-$1').toLowerCase();
const cap = (s) => s[0].toUpperCase() + s.slice(1);

// ---- curve measurements ------------------------------------------------------------------------------------------
function measure(fn) {
  const v = [];
  for (let i = 0; i <= DENSE; i++) v.push(fn(i / DENSE));
  const crossing = (level) => {
    for (let i = 1; i <= DENSE; i++) {
      if (v[i - 1] < level && v[i] >= level) return (i - 1 + (level - v[i - 1]) / (v[i] - v[i - 1])) / DENSE;
    }
    return 1;
  };
  let peak = 0;
  for (let i = 1; i <= DENSE; i++) peak = Math.max(peak, Math.abs(v[i] - v[i - 1]) * DENSE);
  return {
    t50: r4(crossing(0.5)),
    t90: r4(crossing(0.9)),
    peakSpeed: r2(peak),
    overshoot: r2(Math.max(0, Math.max(...v) - 1) * 100),
    undershoot: r2(Math.max(0, -Math.min(...v)) * 100),
    at10: r2(fn(0.1) * 100),
  };
}

function sampled(fn) {
  const y = [], vel = [];
  for (let i = 0; i <= SAMPLES; i++) y.push(r4(fn(i / SAMPLES)));
  const h = 1 / 400;
  for (let i = 0; i <= SAMPLES; i++) {
    const u = i / SAMPLES;
    const a = Math.max(0, u - h), b = Math.min(1, u + h);
    vel.push(r2((fn(b) - fn(a)) / (b - a)));
  }
  return { y, vel };
}

// ---- cubic-bezier fit: Nelder-Mead on the RMS gap, then the worst gap ---------------------------------------------
function bezierFit(fn) {
  const pts = Array.from({ length: 201 }, (_, i) => i / 200);
  const target = pts.map(fn);
  const inside = Math.min(...target) >= 0 && Math.max(...target) <= 1;
  const clampY = (y) => (inside ? Math.min(1, Math.max(0, y)) : y);
  const gap = (p) => {
    const b = curves.cubicBezier(Math.min(1, Math.max(0, p[0])), clampY(p[1]), Math.min(1, Math.max(0, p[2])), clampY(p[3]));
    let s = 0, worst = 0;
    for (let i = 0; i < pts.length; i++) {
      const d = Math.abs(b(pts[i]) - target[i]);
      s += d * d;
      worst = Math.max(worst, d);
    }
    return { rms: Math.sqrt(s / pts.length), worst };
  };
  const starts = [[0.25, 0.1, 0.25, 1], [0.42, 0, 1, 1], [0, 0, 0.58, 1], [0.42, 0, 0.58, 1], [0.7, 0, 0.9, 0.2], [0.1, 0.9, 0.3, 1], [0.34, 1.56, 0.64, 1], [0.36, 0, 0.66, -0.56]];
  let best = null;
  for (const s of starts) {
    const found = nelderMead((p) => gap(p).rms, s);
    if (!best || found.f < best.f) best = found;
  }
  const p = best.x.map((n, i) => (i === 0 || i === 2 ? Math.min(1, Math.max(0, n)) : clampY(n))).map((n) => Math.round(n * 100) / 100);
  return { params: p, worst: r4(gap(p).worst) };
}

function nelderMead(f, x0) {
  const n = x0.length;
  let simplex = [x0, ...x0.map((_, i) => x0.map((v, j) => (i === j ? v + 0.15 : v)))].map((x) => ({ x, f: f(x) }));
  for (let iter = 0; iter < 600; iter++) {
    simplex.sort((a, b) => a.f - b.f);
    const centroid = Array.from({ length: n }, (_, j) => simplex.slice(0, n).reduce((s, v) => s + v.x[j], 0) / n);
    const along = (k) => centroid.map((c, j) => c + k * (simplex[n].x[j] - c));
    const reflected = along(-1), fr = f(reflected);
    if (fr < simplex[0].f) {
      const expanded = along(-2), fe = f(expanded);
      simplex[n] = fe < fr ? { x: expanded, f: fe } : { x: reflected, f: fr };
    } else if (fr < simplex[n - 1].f) simplex[n] = { x: reflected, f: fr };
    else {
      const contracted = along(fr < simplex[n].f ? -0.5 : 0.5), fc = f(contracted);
      if (fc < Math.min(fr, simplex[n].f)) simplex[n] = { x: contracted, f: fc };
      else simplex = simplex.map((v, i) => (i === 0 ? v : { x: v.x.map((c, j) => simplex[0].x[j] + 0.5 * (c - simplex[0].x[j])), f: null })).map((v) => (v.f === null ? { x: v.x, f: f(v.x) } : v));
    }
  }
  simplex.sort((a, b) => a.f - b.f);
  return simplex[0];
}

// ---- After Effects handle data ------------------------------------------------------------------------------------
const LOTTIE = AE.rows.filter((r) => r[0] === 'lottie').map(([, role, oi, os, ii, is]) => ({ role, oi, os, ii, is }));
const HF = AE.rows.filter((r) => r[0] === 'hf').map(([, role, oi, os, ii, is]) => ({ role, oi, os, ii, is }));
const near = (inf, spd, ref) => Math.abs(inf - ref.influence) <= 10 && Math.abs(spd - ref.speed) <= (Math.abs(ref.speed) <= 1 ? 0.3 : 0.25 * Math.abs(ref.speed));
const pct = (n, d) => r2((n / d) * 100);
const isDefaultHandle = (inf, spd) => (Math.abs(inf - 17) <= 1 && Math.abs(spd - 1) <= 0.05) || (Math.abs(inf - 33) <= 1 && Math.abs(spd) <= 0.05);

function handleShares(out, into) {
  const handles = LOTTIE.flatMap((s) => [[s.oi, s.os], [s.ii, s.is]]);
  const pair = LOTTIE.filter((s) => near(s.oi, s.os, out) && near(s.ii, s.is, into));
  const entrances = LOTTIE.filter((s) => s.role === 'entrance');
  const exits = LOTTIE.filter((s) => s.role === 'exit');
  return {
    outShare: pct(handles.filter(([i, s]) => near(i, s, out)).length, handles.length),
    inShare: pct(handles.filter(([i, s]) => near(i, s, into)).length, handles.length),
    pairShare: pct(pair.length, LOTTIE.length),
    pairCount: pair.length,
    entranceShare: pct(pair.filter((s) => s.role === 'entrance').length, entrances.length),
    exitShare: pct(pair.filter((s) => s.role === 'exit').length, exits.length),
    hfCount: HF.filter((s) => near(s.oi, s.os, out) && near(s.ii, s.is, into)).length,
  };
}

const defaults = LOTTIE.filter((s) => isDefaultHandle(s.oi, s.os) && isDefaultHandle(s.ii, s.is)).length;
const STATS = {
  lottieSegments: LOTTIE.length,
  hfSegments: HF.length,
  lottieHandles: LOTTIE.length * 2,
  defaultShare: pct(defaults, LOTTIE.length),
  tunedSegments: LOTTIE.length - defaults,
  entranceSegments: LOTTIE.filter((s) => s.role === 'entrance').length,
  exitSegments: LOTTIE.filter((s) => s.role === 'exit').length,
  entranceStopShare: pct(LOTTIE.filter((s) => s.role === 'entrance' && s.ii >= 55 && s.is <= 0.1).length, LOTTIE.filter((s) => s.role === 'entrance').length),
  exitsFasterThan15: LOTTIE.filter((s) => s.role === 'exit' && s.is >= 1.5).length,
};

// ---- the ease list ------------------------------------------------------------------------------------------------
const FAMILIES = ['sine', 'quad', 'cubic', 'quart', 'quint', 'expo', 'circ', 'back', 'elastic', 'bounce'];
const DIRS = ['in', 'out', 'inOut'];
const CSS_BEZIER = { ease: [0.25, 0.1, 0.25, 1], 'ease-in': [0.42, 0, 1, 1], 'ease-out': [0, 0, 0.58, 1], 'ease-in-out': [0.42, 0, 0.58, 1] };

const entries = [];
for (const name of Object.keys(EASE_HANDLES)) entries.push({ slug: kebab(name), name, kind: 'vawe', family: 'vawe', fn: easeFn(name), linear: EASE[name] });
for (const family of FAMILIES) {
  for (const dir of DIRS) {
    const name = `ease${cap(dir)}${cap(family)}`;
    entries.push({ slug: kebab(name), name, kind: 'classic', family, dir, fn: curves[name], linear: curveToLinear(curves[name], { tolerance: LINEAR_TOLERANCE }) });
  }
}
for (const name of ['ease', 'ease-in', 'ease-out', 'ease-in-out']) entries.push({ slug: name, name, kind: 'css', family: 'css', fn: curves.cubicBezier(...CSS_BEZIER[name]), linear: curveToLinear(curves.cubicBezier(...CSS_BEZIER[name]), { tolerance: LINEAR_TOLERANCE }) });
entries.push({ slug: 'linear', name: 'linear', kind: 'css', family: 'css', fn: (t) => t, linear: 'linear(0, 1)' });

// ---- moves that use each vawe ease ---------------------------------------------------------------------------------
const moveTitle = new Map(MOVES_JSON.moves.map((m) => [m.name, m.title]));
const moveFiles = fs.readdirSync(MOVES_DIR).filter((f) => f.endsWith('.md') && moveTitle.has(f.slice(0, -3)));
function movesUsing(camel) {
  const re = new RegExp(`(?:EASE\\.${camel}|EASE\\[['"]${camel}['"]\\]|easeFn\\(['"]${camel}['"]\\))(?![A-Za-z])`, 'g');
  return moveFiles
    .map((f) => ({ name: f.slice(0, -3), uses: (fs.readFileSync(path.join(MOVES_DIR, f), 'utf8').match(re) || []).length }))
    .filter((m) => m.uses)
    .sort((a, b) => b.uses - a.uses || a.name.localeCompare(b.name))
    .map((m) => ({ name: m.name, title: moveTitle.get(m.name), uses: m.uses }));
}

// ---- assemble ------------------------------------------------------------------------------------------------------
const rmsGap = (a, b) => {
  let s = 0;
  for (let i = 0; i <= 100; i++) s += (a.y[i] - b.y[i]) ** 2;
  return Math.sqrt(s / 101);
};

// ---- jobs: core/motion/ease-jobs.js ---------------------------------------------------------------------------------
for (const j of JOBS) {
  for (const slug of [j.ease, ...(j.also ?? [])]) {
    if (!entries.some((e) => e.slug === slug)) throw new Error(`easing: job "${j.id}" names the unknown ease "${slug}"`);
  }
}

// ---- product UI: the numbers of core/motion/ui.js, plus the curves they imply ---------------------------------------
const tauOf = (k) => -1 / (FPS * Math.log(1 - k));
const APPROACH_WINDOW = 0.3;
const approachFn = (tau) => (u) => (1 - Math.exp((-u * APPROACH_WINDOW) / tau)) / (1 - Math.exp(-APPROACH_WINDOW / tau));
const SEND = (() => {
  let over = 0;
  for (let t = 0; t < 1; t += 0.001) over = Math.max(over, spring(t, UI.send.k, UI.send.d) - 1);
  return { k: UI.send.k, d: UI.send.d, overshoot: Math.round(over * 100), settleS: r2(springDuration(UI.send.k, UI.send.d, 0.01)) };
})();
const mid = ([lo, hi]) => Math.round(((lo + hi) / 2) * 1000);
// The demo length of each /easing/for page: a number from the job's own range, in ms.
const DEMO_MS = {
  title: mid(BANDS.gravity),
  panel: UI.panel.fadeMs,
  value: UI.roll.inMs,
  stagger: UI.row.fadeMs,
  pop: mid(BANDS.gravity),
  exit: EXIT_EXAMPLE.exitMs,
  'camera-short': mid([BANDS.gravity[0], BANDS.cinematic[1]]),
  'camera-long': Math.round(BANDS.cinematic[1] * 1000),
  scan: mid([BANDS.gravity[0], 1]),
  hold: Math.round(BANDS.cinematic[1] * 1000),
  send: Math.round(springDuration(UI.send.k, UI.send.d) * 1000),
};
const SEND_DEMO = { ms: DEMO_MS.send, linear: springLinear(UI.send.k, UI.send.d), settleS: SEND.settleS, overshoot: SEND.overshoot };
const FIRST_FRAME_AT = [0.2, 0.3, 0.4, 0.5, 0.8];
const FAST_OUT_K = [0.27, 0.39];
const REAL_FIRST_FRAME = FAST_OUT_K.map((k) => Math.round(k * 100));

function productUi(list) {
  const approach = FAST_OUT_K.map((k) => {
    const tau = tauOf(k);
    const mine = sampled(approachFn(tau));
    const nearest = list.map((o) => ({ o, gap: rmsGap(mine, o) })).sort((a, b) => a.gap - b.gap)[0];
    return { k, tau: r2(tau), settle99: r2(tau * Math.log(100)), nearest: { slug: nearest.o.slug, name: nearest.o.name, gap: r4(nearest.gap) } };
  });
  return {
    window: APPROACH_WINDOW,
    realFirstFrame: REAL_FIRST_FRAME,
    rows: [
      { name: 'Move length', value: '0.15 to 0.4 s', rule: 'A state change takes 0.2 to 0.4 s, a row or line 0.15 to 0.3 s. Holds are long: 1.5 to 2.5 s.' },
      { name: 'Panel in', value: `fade ${UI.panel.fadeMs} ms, rise ${UI.panel.rise}`, rule: 'A panel fades only. No scale, no overshoot.' },
      { name: 'Row in, stagger', value: `fade ${UI.row.fadeMs} ms, rise ${UI.row.rise}, ${UI.row.staggerMs} ms apart`, rule: 'Real rows arrive 70 to 100 ms apart. The vawe limit is 30 to 80 ms.' },
      { name: 'Send, small arrival', value: `spring k ${SEND.k}, d ${SEND.d}`, rule: `Overshoot ${SEND.overshoot}%, settled in ${SEND.settleS} s. Small items only: a bubble, a chip, a tip (3 to 20 px of travel). Real overshoot is ${UI.snap.overshoot.map((n) => Math.round(n * 100)).join(' to ')}%.` },
      { name: 'Typing', value: `${UI.typing.charMs} ms a character, +${UI.typing.spaceMs} ms after a space, ${UI.typing.jitter * 100}% jitter`, rule: '20 to 27 characters a second with pauses at word gaps. Seed the jitter with rng.' },
      { name: 'Stream', value: `${UI.stream.gapMs[0]} to ${UI.stream.gapMs[1]} ms a chunk, fade ${UI.stream.fadeMs} ms`, rule: '15 to 25 words a second. A word fades in, the text never moves, the layout is reserved.' },
      { name: 'Digit roll', value: `${UI.roll.outMs} ms out, ${UI.roll.inMs} ms in, rise ${UI.roll.rise}`, rule: 'Each digit rolls in its own clipped slot. A counter never overshoots.' },
      { name: 'Exit', value: `fade ${UI.exit.ms} ms, drift ${UI.exit.drift}`, rule: 'The whole window fades to the empty ground in 0.3 to 0.4 s, shorter than the entrance.' },
    ],
    approach,
    firstFrame: {
      at: FIRST_FRAME_AT,
      rows: ['land', 'landSoft'].map((name) => ({ slug: kebab(name), name, shares: FIRST_FRAME_AT.map((d) => firstFrame(name, d)) })),
    },
    realSurface: [
      'A copied product surface moves as the real one does: its timing, its curve and its steps.',
      'A terminal steps and never eases its text: characters and whole lines appear on a frame, with no slide or fade.',
      'No overshoot where the real UI has none: a panel fades, a counter never springs.',
    ],
  };
}

const FIX = vaweWords({ firstFrame, REAL_FIRST_FRAME, lateStart, STATS, EXIT, sec, EXIT_EXAMPLE, EXIT_FALLBACK, span, BANDS, popPeakAt, popSettleFrames, FPS, SEND });

const out = entries.map((e) => {
  const { y, vel } = sampled(e.fn);
  const m = measure(e.fn);
  const fit = e.kind === 'css' && e.slug !== 'linear' ? { params: CSS_BEZIER[e.slug], worst: 0 } : e.kind === 'vawe' ? null : bezierFit(e.fn);
  const entry = { slug: e.slug, name: e.name, kind: e.kind, family: e.family, dir: e.dir ?? null, y, vel, ...m, linear: e.linear, points: e.linear.split(',').length };
  if (e.kind === 'vawe') {
    const [outH, inH] = EASE_HANDLES[e.name];
    const o = resolveHandle(outH, 'easeOut'), i = resolveHandle(inH, 'easeIn');
    const hname = (h) => (typeof h === 'string' ? h : null);
    const shown = (h, name) => ({ ...h, influence: r2(h.influence), name });
    entry.handles = { out: shown(o, hname(outH)), in: shown(i, hname(inH)), shares: handleShares(o, i) };
    entry.bezier = { params: [r4(o.influence / 100), r4(o.speed * (o.influence / 100)), r4(1 - i.influence / 100), r4(1 - i.speed * (i.influence / 100))], exact: true };
    entry.moves = movesUsing(e.name);
    Object.assign(entry, VAWE_TEXT[e.slug], FIX[e.slug]);
    entry.jobs = JOBS.filter((j) => j.ease === e.slug || j.also?.includes(e.slug)).map(({ id, job, time }) => ({ id, job, time }));
  } else {
    const bad = (e.family === 'elastic' || e.family === 'bounce');
    const worst = e.slug === 'linear' ? 0 : fit.worst;
    if (e.slug === 'linear') fit.params = [0, 0, 1, 1];
    entry.bezier = { params: fit.params, worst: r4(worst), exact: e.kind === 'css' || worst <= 0.005, usable: !bad && worst <= 0.05, express: bad ? 'no' : worst <= 0.005 ? 'exact' : worst <= 0.05 ? 'close' : 'no' };
    if (e.kind === 'css') Object.assign(entry, CSS_TEXT[e.slug]);
    else if (SPECIAL[e.slug]) Object.assign(entry, { blurb: `${DIRECTION[e.dir].role} ${SPECIAL[e.slug].feel}`, use: SPECIAL[e.slug].use, avoid: SPECIAL[e.slug].avoid });
    else {
      const f = FAMILY[e.family], d = DIRECTION[e.dir];
      Object.assign(entry, { blurb: `${d.role} ${f.feel}`, use: [`${cap(d.use)}.`, ...(e.dir === 'in' ? [] : [`${cap(f.use)}.`])], avoid: [`${cap(d.avoid)}.`, `${cap(f.avoid)}.`] });
    }
  }
  return entry;
});

// related: the nearest curves by RMS gap, plus the same family
for (const e of out) {
  const others = out.filter((o) => o.slug !== e.slug);
  const byGap = others.map((o) => ({ o, gap: rmsGap(e, o) })).sort((a, b) => a.gap - b.gap);
  const nearestVawe = byGap.find((g) => g.o.kind === 'vawe' && e.kind !== 'vawe');
  const picks = [];
  const add = (g) => { if (g && !picks.some((p) => p.slug === g.o.slug)) picks.push({ slug: g.o.slug, name: g.o.name, gap: r4(g.gap) }); };
  if (e.kind === 'classic') others.filter((o) => o.family === e.family).forEach((o) => add({ o, gap: rmsGap(e, o) }));
  add(nearestVawe);
  byGap.filter((g) => g.o.kind !== 'classic' || g.o.family !== e.family || e.kind !== 'classic').forEach((g) => picks.length < 6 && add(g));
  e.related = picks.slice(0, 6);
  if (e.kind !== 'vawe') {
    const g = nearestVawe ? { slug: nearestVawe.o.slug, name: nearestVawe.o.name, gap: r4(nearestVawe.gap) } : null;
    e.nearestVawe = g;
  }
}

const jobsOut = JOBS.map(({ also, ...j }) => ({ ...j, also: (also ?? []).map((slug) => ({ slug, name: out.find((e) => e.slug === slug).name })), easeName: out.find((e) => e.slug === j.ease).name }));
fs.writeFileSync(OUT, JSON.stringify({ stats: STATS, jobs: jobsOut, exitExample: EXIT_EXAMPLE, ui: productUi(out), popPeakAt: r4(popPeakAt), uiRaw: UI, demoMs: DEMO_MS, sendDemo: SEND_DEMO, families: FAMILIES, handleNames: HANDLE_REGISTRY.names, eases: out }));
console.log(`easing: ${out.length} eases, ${(fs.statSync(OUT).size / 1024).toFixed(0)} KB -> ${path.relative(root, OUT)}`);
