#!/usr/bin/env node
// Score the measuring tools against fixtures whose properties are known by construction.
//   node harness/dev/see-truth.mjs [--only <fixture>] [--reuse] [--json] [--tool old|see]
// Each fixture is tests/fixtures/truth/<name>/page.html plus truth.json (the known values and the tolerances). It renders as `vawe dev` does
// (960x540, 30 fps, silent; the sound fixture adds --audio; the look fixture is a final render) without the page checks, then the tools run
// and a table of measure | truth | measured | error | tolerance | pass/fail | tool is printed. --reuse keeps an mp4 newer than its page.
// A measure with no tool is "no tool"; a verb that is missing is "not available". --tool old or --tool see prints one side only.
// mp4s, spec folders and PNGs go to out/see-truth/.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const FIXTURES = path.join(ROOT, 'tests/fixtures/truth');
const OUT = path.join(ROOT, 'out/see-truth');
export const ORDER = ['cuts', 'flash', 'motion', 'camera', 'eye', 'ground', 'look', 'type', 'sound', 'events', 'beat'];
const EPS = 1e-9;

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const r = (v, d = 3) => (v == null ? null : Math.round(v * 10 ** d) / 10 ** d);

/** One scored measure. Numbers pass inside the tolerance; strings pass when equal; a missing value fails. */
export function scoreRow({ fixture, measure, tool, truth, measured, tolerance }) {
  const base = { fixture, measure, tool, truth, tolerance: tolerance ?? null };
  const m = typeof truth === 'number' ? num(measured) : measured ?? null;
  if (m === null) return { ...base, measured: null, error: null, status: 'fail' };
  if (typeof truth !== 'number') return { ...base, measured: m, error: null, status: m === truth ? 'pass' : 'fail' };
  const error = m - truth;
  return { ...base, measured: m, error, status: Math.abs(error) <= (tolerance ?? 0) + EPS ? 'pass' : 'fail' };
}

export const noTool = (fixture, measure, truth, tolerance) => ({ fixture, measure, tool: 'no tool', truth, tolerance: tolerance ?? null, measured: null, error: null, status: 'no tool' });

export const notAvailable = (fixture, measure, truth, tool, tolerance) => ({ fixture, measure, tool, truth, tolerance: tolerance ?? null, measured: null, error: null, status: 'not available' });

const cell = (v) => (v == null ? '-' : typeof v === 'number' ? String(r(v, 3)) : String(v));
const pad = (s, n) => s + ' '.repeat(Math.max(0, n - s.length));

export function formatTable(rows) {
  const head = ['measure', 'truth', 'measured', 'error', 'tolerance', 'result', 'tool'];
  const body = rows.map((x) => [`${x.fixture}: ${x.measure}`, cell(x.truth), cell(x.measured), x.error == null ? '-' : `${x.error >= 0 ? '+' : ''}${r(x.error, 3)}`,
    x.tolerance == null ? '-' : `+-${cell(x.tolerance)}`, x.status, x.tool]);
  const widths = head.map((h, i) => Math.max(h.length, ...body.map((b) => b[i].length)));
  const line = (cols) => cols.map((c, i) => pad(c, widths[i])).join(' | ').trimEnd();
  return [line(head), widths.map((w) => '-'.repeat(w)).join('-|-'), ...body.map(line)].join('\n');
}

/** Counts per fixture and in total: pass, fail, no tool, not available. */
export function summarise(rows) {
  const count = (list) => ({ pass: 0, fail: 0, 'no tool': 0, 'not available': 0, ...Object.fromEntries(Object.entries(Object.groupBy(list, (x) => x.status)).map(([k, v]) => [k, v.length])) });
  const byFixture = {};
  for (const f of new Set(rows.map((x) => x.fixture))) byFixture[f] = count(rows.filter((x) => x.fixture === f));
  return { total: count(rows), byFixture };
}

/** Per-fixture and total lines, then the three fixtures with the lowest pass share among measured rows. */
export function formatSummary(rows) {
  const { total, byFixture } = summarise(rows);
  const show = (c) => `pass ${c.pass}, fail ${c.fail}, no tool ${c['no tool']}, not available ${c['not available']}`;
  const lines = Object.entries(byFixture).map(([f, c]) => `${f}: ${show(c)}`);
  lines.push(`total: ${show(total)}`);
  const scored = Object.entries(byFixture).filter(([, c]) => c.pass + c.fail > 0).map(([f, c]) => [f, c.pass / (c.pass + c.fail)]);
  const weakest = scored.sort((a, b) => a[1] - b[1]).slice(0, 3).map(([f, s]) => `${f} ${Math.round(s * 100)}%`);
  lines.push(`weakest: ${weakest.join(', ')}`);
  return lines.join('\n');
}

/** `vawe frame --moment <s> --velocity` summary: one entry per element with its position move. */
export function parseVelocity(text) {
  const out = [];
  let cur = null;
  for (const line of String(text).split('\n')) {
    const head = /^\d+\.\s+(.*)$/.exec(line);
    if (head) { cur = { label: head[1], position: { moves: false } }; out.push(cur); continue; }
    const pos = /^\s+position:\s+(.*)$/.exec(line);
    if (!pos || !cur) continue;
    const body = pos[1];
    if (/^still/.test(body)) continue;
    const g = (re) => { const m = re.exec(body); return m ? m[1] : null; };
    const over = g(/overshoots its rest by (\d+(?:\.\d+)?)%/);
    cur.position = { moves: true, start: num(Number(g(/starts (\d+(?:\.\d+)?) s/))), peakPxPerS: num(Number(g(/\((\d+) px\/s\)/))),
      settle: g(/settles (\d+(?:\.\d+)?) s/) == null ? null : Number(g(/settles (\d+(?:\.\d+)?) s/)),
      overshootPct: over !== null ? Number(over) : /no overshoot/.test(body) ? 0 : null,
      shape: g(/(?:overshoot[^,]*|overshoot not judged[^,]*),\s*([a-z -]+)$/) ?? g(/,\s*([a-z-]+(?: [a-z-]+)?)$/) };
  }
  return out;
}

/** `vawe frame --at` motion line: start, peak, settle and the burst count. */
export function parseStrip(text) {
  const m = /motion: starts (\d+(?:\.\d+)?) s, peaks (\d+(?:\.\d+)?) at (\d+(?:\.\d+)?) s, settles (\d+(?:\.\d+)?) s; (\d+) burst/.exec(String(text));
  return m ? { start: Number(m[1]), settle: Number(m[4]), bursts: Number(m[5]) } : null;
}

/** `vawe sound --at a,b` : for each probed second, the cues sounding with the seconds into each. */
export function parseAudioAt(text) {
  const out = [];
  let cur = null;
  for (const line of String(text).split('\n')) {
    const at = /^(\d+(?:\.\d+)?) s\s+(?:world|no cue)/.exec(line);
    if (at) { cur = { at: Number(at[1]), cues: [] }; out.push(cur); continue; }
    const cue = /^\s+([a-z0-9-]+): (\d+(?:\.\d+)?) s into/.exec(line);
    if (cue && cur) cur.cues.push({ voice: cue[1], into: Number(cue[2]) });
  }
  return out;
}

/** The integrated loudness of `vawe sound --waveform`: "mix as written: -20.6 LUFS". */
export function parseLufs(text) {
  const m = /(-?\d+(?:\.\d+)?) LUFS/.exec(String(text));
  return m ? Number(m[1]) : null;
}

/** Display luma 0..255 of a grey whose CIE L* is given. */
export function lumaOfL(L) {
  const f = (L + 16) / 116;
  const y = f > 6 / 29 ? f ** 3 : (f - 16 / 116) / 7.787;
  const enc = y <= 0.0031308 ? 12.92 * y : 1.055 * y ** (1 / 2.4) - 0.055;
  return 255 * enc;
}

const deltaE76 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** Distance in frame heights between two 0..1 frame positions. */
export const heights = (a, b, aspect) => Math.hypot((a.x - b.x) * aspect, a.y - b.y);

const nearest = (list, value, key = (x) => x) => list.reduce((best, x) => (best === undefined || Math.abs(key(x) - value) < Math.abs(key(best) - value) ? x : best), undefined);

// Each takes truth.json and the parsed tool results (null when a tool failed) and returns rows.

export function cutsRows(t, { spec, timeline }) {
  const F = 'cuts', tol = t.tolerance;
  const rows = [];
  const cuts = spec?.cuts ?? null;
  t.truth.cuts.forEach((c, i) => rows.push(scoreRow({ fixture: F, measure: `cut ${i + 1} second`, tool: 'vawe see --spec (cuts)', truth: c, measured: cuts?.[i]?.t, tolerance: tol.cutSeconds })));
  rows.push(scoreRow({ fixture: F, measure: 'world count', tool: 'vawe see --spec (shots)', truth: t.truth.worlds.length, measured: spec?.shots?.length, tolerance: tol.worldCount }));
  rows.push(scoreRow({ fixture: F, measure: 'world count', tool: 'vawe see --plan', truth: t.truth.worlds.length, measured: timeline?.worlds?.length, tolerance: tol.worldCount }));
  for (const id of t.truth.durationWorlds) {
    const i = t.truth.worlds.findIndex((w) => w.id === id);
    const w = t.truth.worlds[i];
    const dur = w.end - w.start;
    const shot = spec?.shots?.find((s) => Math.abs(s.t0 - w.start) <= tol.worldSeconds);
    const tl = timeline?.worlds?.find((x) => x.id === id);
    rows.push(scoreRow({ fixture: F, measure: `world ${id} duration`, tool: 'vawe see --spec (shots)', truth: r(dur), measured: shot ? shot.t1 - shot.t0 : null, tolerance: tol.worldSeconds }));
    rows.push(scoreRow({ fixture: F, measure: `world ${id} duration`, tool: 'vawe see --plan', truth: r(dur), measured: tl ? tl.end - tl.start : null, tolerance: tol.worldSeconds }));
  }
  return rows;
}

export function flashRows(t, { spec }) {
  const F = 'flash', tol = t.tolerance, fps = t.fps;
  const rows = [];
  t.truth.flashes.forEach((fl, i) => {
    const tag = `flash ${i + 1}`;
    const cut = spec ? nearest(spec.cuts, fl.start, (c) => c.t) : undefined;
    const startOk = cut && Math.abs(cut.t - fl.start) <= tol.startSeconds * 2 ? cut : undefined;
    const next = startOk ? spec.cuts.find((c) => c.frame > startOk.frame) : undefined;
    const shot = startOk ? spec.shots.find((s) => s.f0 === startOk.frame) : undefined;
    const L = shot ? spec.colour?.perShot?.find((p) => p.shot === shot.index)?.dominant?.[0] : undefined;
    rows.push(scoreRow({ fixture: F, measure: `${tag} start second`, tool: 'vawe see --spec (cuts, derived)', truth: fl.start, measured: startOk?.t, tolerance: tol.startSeconds }));
    rows.push(scoreRow({ fixture: F, measure: `${tag} length in frames`, tool: 'vawe see --spec (cut pair, derived)', truth: fl.frames, measured: startOk && next ? next.frame - startOk.frame : null, tolerance: tol.lengthFrames }));
    rows.push(scoreRow({ fixture: F, measure: `${tag} peak mean luma`, tool: 'vawe see --spec (shot colour, derived)', truth: fl.peakLuma, measured: L == null ? null : lumaOfL(L), tolerance: tol.peakLuma }));
  });
  rows.push(noTool(F, 'flash event (one exposure flash, not two cuts)', 2));
  return rows;
}

export function motionRows(t, { velocity, spec, stripA, stripB }) {
  const F = 'motion', tol = t.tolerance, { a, b } = t.truth;
  const vel = (id) => velocity?.find((e) => e.label.endsWith(`#${id}`))?.position;
  const el = (axisStart) => spec?.shots?.flatMap((s) => s.elements).find((e) => e.axis === 'x' && Math.abs(e.start.t - axisStart) <= 0.1);
  const eA = el(a.start), eB = el(b.start);
  const rows = [
    scoreRow({ fixture: F, measure: 'A start second', tool: 'vawe frame --moment <s> --velocity (page)', truth: a.start, measured: vel('a')?.start, tolerance: tol.startSeconds }),
    scoreRow({ fixture: F, measure: 'A settle second', tool: 'vawe frame --moment <s> --velocity (page)', truth: a.settle, measured: vel('a')?.settle, tolerance: tol.settleSeconds }),
    scoreRow({ fixture: F, measure: 'A overshoot (points of travel)', tool: 'vawe frame --moment <s> --velocity (page)', truth: a.overshootPct, measured: vel('a')?.overshootPct, tolerance: tol.overshootPoints }),
    scoreRow({ fixture: F, measure: 'B start second', tool: 'vawe frame --moment <s> --velocity (page)', truth: b.start, measured: vel('b')?.start, tolerance: tol.startSeconds }),
    scoreRow({ fixture: F, measure: 'B settle second (end of move)', tool: 'vawe frame --moment <s> --velocity (page)', truth: b.settle, measured: vel('b')?.settle, tolerance: tol.settleSeconds }),
    scoreRow({ fixture: F, measure: 'B peak speed (css px/s)', tool: 'vawe frame --moment <s> --velocity (page)', truth: b.peakCssPxPerS, measured: vel('b')?.peakPxPerS, tolerance: b.peakCssPxPerS * tol.speedRatio }),
    scoreRow({ fixture: F, measure: 'B ease shape', tool: 'vawe frame --moment <s> --velocity (page)', truth: b.shape, measured: vel('b')?.shape }),
    scoreRow({ fixture: F, measure: 'A start second', tool: 'vawe see --spec (elements)', truth: a.start, measured: eA?.start?.t, tolerance: tol.startSeconds }),
    scoreRow({ fixture: F, measure: 'A settle second', tool: 'vawe see --spec (elements)', truth: a.settle, measured: eA?.land?.t, tolerance: tol.settleSeconds }),
    scoreRow({ fixture: F, measure: 'A overshoot (points of travel)', tool: 'vawe see --spec (elements)', truth: a.overshootPct, measured: eA?.overshoot == null ? null : (eA.overshoot - 1) * 100, tolerance: tol.overshootPoints }),
    scoreRow({ fixture: F, measure: 'A rest x (video px)', tool: 'vawe see --spec (elements)', truth: a.restVideoX, measured: eA?.to?.[0], tolerance: tol.restPx }),
    scoreRow({ fixture: F, measure: 'B start second', tool: 'vawe see --spec (elements)', truth: b.start, measured: eB?.start?.t, tolerance: tol.startSeconds }),
    scoreRow({ fixture: F, measure: 'B settle second (end of move)', tool: 'vawe see --spec (elements)', truth: b.settle, measured: eB?.land?.t, tolerance: tol.settleSeconds }),
    scoreRow({ fixture: F, measure: 'B ease shape', tool: 'vawe see --spec (elements)', truth: b.shape, measured: eB?.easing?.class }),
    scoreRow({ fixture: F, measure: 'A start second', tool: 'vawe frame --moment <s> (mp4)', truth: a.start, measured: stripA?.start, tolerance: tol.startSeconds }),
    scoreRow({ fixture: F, measure: 'A settle second', tool: 'vawe frame --moment <s> (mp4)', truth: a.settle, measured: stripA?.settle, tolerance: tol.settleSeconds }),
    scoreRow({ fixture: F, measure: 'A bursts', tool: 'vawe frame --moment <s> (mp4)', truth: a.bursts, measured: stripA?.bursts, tolerance: tol.bursts }),
    scoreRow({ fixture: F, measure: 'B start second', tool: 'vawe frame --moment <s> (mp4)', truth: b.start, measured: stripB?.start, tolerance: tol.startSeconds }),
    scoreRow({ fixture: F, measure: 'B settle second (end of move)', tool: 'vawe frame --moment <s> (mp4)', truth: b.settle, measured: stripB?.settle, tolerance: tol.settleSeconds }),
    noTool(F, 'A overshoot from vawe frame --moment <s> --onion (image only, prints no number)', a.overshootPct, tol.overshootPoints),
  ];
  return rows;
}

export function eyeRows(t, { spec }) {
  const F = 'eye', tol = t.tolerance, asp = t.aspect;
  const rows = [];
  const per = spec?.eye?.perShot ?? [];
  const shot = (t0) => per.find((p) => Math.abs(p.t0 - t0) <= 0.05);
  t.truth.shots.forEach((s, i) => {
    const m = shot(s.t0);
    for (const end of ['start', 'end']) {
      const got = m?.[end];
      rows.push(scoreRow({ fixture: F, measure: `shot ${i + 1} eye ${end} (frame heights from truth)`, tool: 'vawe see --spec (eye)', truth: 0, measured: got ? heights(got, s[end], asp) : null, tolerance: tol.eyeHeights }));
    }
  });
  t.truth.shots.forEach((s, i) => {
    rows.push(scoreRow({ fixture: F, measure: `shot ${i + 1} eye travel inside the shot (frame heights)`, tool: 'vawe see --spec (eye)', truth: r(heights(s.start, s.end, asp)), measured: shot(s.t0)?.travel, tolerance: tol.travelHeights }));
  });
  for (let i = 0; i + 1 < t.truth.shots.length; i++) {
    const b = t.truth.shots[i + 1];
    const jump = spec?.eye?.cuts?.find((c) => Math.abs(c.at - b.t0) <= 0.05);
    rows.push(scoreRow({ fixture: F, measure: `cut ${i + 1} eye jump (frame heights)`, tool: 'vawe see --spec (eye)', truth: r(heights(t.truth.shots[i].end, b.start, asp)), measured: jump?.jump, tolerance: tol.travelHeights }));
  }
  return rows;
}

export function groundRows(t, { spec }) {
  const F = 'ground', tol = t.tolerance;
  const rows = [];
  const per = spec?.ground?.perShot ?? [];
  const shot = (t0) => per.find((p) => Math.abs(p.t0 - t0) <= 0.05);
  t.truth.shots.forEach((s, i) => {
    const m = shot(s.t0);
    rows.push(scoreRow({ fixture: F, measure: `world ${i + 1} ground colour (deltaE from truth)`, tool: 'vawe see --spec (ground)', truth: 0, measured: m?.start ? deltaE76(m.start, s.lab) : null, tolerance: tol.deltaE }));
  });
  t.truth.cutDeltaE.forEach((de, i) => {
    const cut = spec?.ground?.cuts?.find((c) => Math.abs(c.at - t.truth.shots[i + 1].t0) <= 0.05);
    rows.push(scoreRow({ fixture: F, measure: `cut ${i + 1} deltaE`, tool: 'vawe see --spec (ground)', truth: de, measured: cut?.dE, tolerance: tol.deltaE }));
  });
  const drift = t.truth.shots.at(-1);
  const d = shot(drift.t0);
  rows.push(scoreRow({ fixture: F, measure: 'light drift of world 4 (L change)', tool: 'vawe see --spec (ground)', truth: drift.driftL, measured: d?.lightDrift == null ? null : Math.abs(d.lightDrift), tolerance: tol.driftL }));
  rows.push(scoreRow({ fixture: F, measure: 'still worlds report no drift (worlds 1 to 3)', tool: 'vawe see --spec (ground)', truth: 0, measured: [0, 1, 2].every((i) => shot(t.truth.shots[i].t0)) ? Math.max(...[0, 1, 2].map((i) => Math.abs(shot(t.truth.shots[i].t0).lightDrift ?? 0))) : null, tolerance: tol.driftL }));
  return rows;
}

export function typeRows(t, { spec }) {
  const F = 'type', tol = t.tolerance;
  const rows = [];
  const fps = spec?.fps ?? t.fps;
  const words = spec ? spec.shots.flatMap((s) => s.text ?? []) : null;
  const find = (text) => words?.find((w) => String(w.text).toUpperCase().replace(/[^A-Z]/g, '') === text);
  rows.push(scoreRow({ fixture: F, measure: 'word count', tool: 'vawe see --spec (words, OCR)', truth: t.truth.words.length, measured: words?.length, tolerance: tol.wordCount }));
  for (const w of t.truth.words) {
    const m = find(w.text);
    rows.push(scoreRow({ fixture: F, measure: `${w.text} in second`, tool: 'vawe see --spec (words, OCR)', truth: w.in, measured: m ? m.f0 / fps : null, tolerance: tol.wordSeconds }));
    rows.push(scoreRow({ fixture: F, measure: `${w.text} out second`, tool: 'vawe see --spec (words, OCR)', truth: w.out, measured: m ? m.f1 / fps : null, tolerance: tol.wordSeconds }));
    rows.push(scoreRow({ fixture: F, measure: `${w.text} cap height (fraction of frame)`, tool: 'vawe see --spec (words, OCR)', truth: t.truth.capHeightFraction, measured: m && spec?.media?.height ? m.boxHeightPx / spec.media.height : null, tolerance: tol.capHeightFraction }));
  }
  return rows;
}

export function soundRows(t, { audioAt, lufs, timeline, spec }) {
  const F = 'sound', tol = t.tolerance;
  const rows = [];
  t.truth.cues.forEach((c, i) => {
    const probe = audioAt?.find((p) => Math.abs(p.at - (c.at + PROBE_OFFSET)) < 1e-6);
    const cue = probe?.cues.find((x) => x.voice === c.voice);
    rows.push(scoreRow({ fixture: F, measure: `${c.voice} cue second`, tool: 'vawe sound --at (page)', truth: c.at, measured: cue ? probe.at - cue.into : null, tolerance: tol.cueSeconds }));
    rows.push(scoreRow({ fixture: F, measure: `${c.voice} cue second`, tool: 'vawe see --plan (page)', truth: c.at, measured: timeline?.cues?.[i]?.voice === c.voice ? timeline.cues[i].at : null, tolerance: tol.cueSeconds }));
    const hit = spec?.audio?.hits ? nearest(spec.audio.hits, c.at, (h) => h.t ?? h.frame / spec.fps) : undefined;
    rows.push(scoreRow({ fixture: F, measure: `${c.voice} cue second`, tool: 'vawe see --spec (audio hits of the mp4)', truth: c.at, measured: hit ? hit.t ?? hit.frame / spec.fps : null, tolerance: tol.cueSeconds }));
  });
  rows.push(scoreRow({ fixture: F, measure: 'integrated loudness (LUFS)', tool: 'vawe sound --waveform (page)', truth: t.truth.lufs, measured: lufs, tolerance: tol.lufs }));
  return rows;
}

/** Seconds after a cue start at which `vawe sound --at` probes it. */
export const PROBE_OFFSET = 0.1;

/** `vawe see` look table (harness/media/see/look.mjs): the glow sigma, the signed channel offsets and the stripe period of the screen texture. */
export function parseLook(text) {
  const t = String(text);
  const num1 = (re) => { const m = re.exec(t); return m ? Number(m[1]) : null; };
  const dx = num1(/median dx (-?\d+(?:\.\d+)?) px/), dy = num1(/median dx -?\d+(?:\.\d+)? px, dy (-?\d+(?:\.\d+)?) px/);
  return { bloomSigma: num1(/gaussian sigma about (\d+(?:\.\d+)?)/), offset: dx === null ? null : Math.hypot(dx, dy ?? 0), stripePeriod: /RGB-striped/.test(t) ? num1(/period (\d+(?:\.\d+)?) px, RGB-striped/) : null };
}

export function lookRows(t, { look }) {
  const F = 'look', tol = t.tolerance, v = t.truth, tool = 'vawe see (look)';
  return [
    scoreRow({ fixture: F, measure: 'bloom radius (css px, gaussian sigma)', tool, truth: v.bloomSigmaPx, measured: look?.bloomSigma, tolerance: tol.bloomPx }),
    scoreRow({ fixture: F, measure: 'red vs blue channel offset (css px)', tool, truth: v.channelOffsetPx, measured: look?.offset, tolerance: tol.channelOffsetPx }),
    scoreRow({ fixture: F, measure: 'RGB stripe period (css px)', tool, truth: v.stripePeriodPx, measured: look?.stripePeriod, tolerance: tol.stripePeriodPx }),
  ];
}

// Each takes truth.json and the see.json of the mp4 (`a`) and, where the page matters, of the page (`p`).

const SEE = 'vawe see';

export function cutsSeeRows(t, { a, p }) {
  const F = 'cuts', tol = t.tolerance;
  const rows = [];
  t.truth.cuts.forEach((c, i) => rows.push(scoreRow({ fixture: F, measure: `cut ${i + 1} second`, tool: `${SEE} (mp4)`, truth: c, measured: a?.structure.cuts[i]?.at, tolerance: tol.cutSeconds })));
  rows.push(scoreRow({ fixture: F, measure: 'world count', tool: `${SEE} (mp4)`, truth: t.truth.worlds.length, measured: a?.structure.shots.length, tolerance: tol.worldCount }));
  rows.push(scoreRow({ fixture: F, measure: 'world count', tool: `${SEE} (page)`, truth: t.truth.worlds.length, measured: p?.structure.worlds?.length, tolerance: tol.worldCount }));
  for (const id of t.truth.durationWorlds) {
    const w = t.truth.worlds.find((x) => x.id === id);
    const shot = a?.structure.shots.find((s) => Math.abs(s.start - w.start) <= tol.worldSeconds);
    const world = p?.structure.worlds?.find((x) => x.id === id);
    rows.push(scoreRow({ fixture: F, measure: `world ${id} duration`, tool: `${SEE} (mp4)`, truth: r(w.end - w.start), measured: shot?.length, tolerance: tol.worldSeconds }));
    rows.push(scoreRow({ fixture: F, measure: `world ${id} duration`, tool: `${SEE} (page)`, truth: r(w.end - w.start), measured: world ? world.end - world.start : null, tolerance: tol.worldSeconds }));
  }
  return rows;
}

export function flashSeeRows(t, { a }) {
  const F = 'flash', tol = t.tolerance;
  const rows = [];
  t.truth.flashes.forEach((fl, i) => {
    const m = a?.look.flashes.find((x) => Math.abs(x.at - fl.start) <= 2 * tol.startSeconds);
    rows.push(scoreRow({ fixture: F, measure: `flash ${i + 1} start second`, tool: SEE, truth: fl.start, measured: m?.at, tolerance: tol.startSeconds }));
    rows.push(scoreRow({ fixture: F, measure: `flash ${i + 1} length in frames`, tool: SEE, truth: fl.frames, measured: m?.frames, tolerance: tol.lengthFrames }));
    rows.push(scoreRow({ fixture: F, measure: `flash ${i + 1} peak mean luma`, tool: SEE, truth: fl.peakLuma, measured: m?.peakLuma, tolerance: tol.peakLuma }));
  });
  const alone = a && a.structure.cuts.length === 0 ? a.look.flashes.length : null;
  rows.push(scoreRow({ fixture: F, measure: 'flash event (one exposure flash, not two cuts)', tool: SEE, truth: 2, measured: alone, tolerance: 0 }));
  return rows;
}

function motionSeeRows(t, { a }) {
  const F = 'motion', tol = t.tolerance, { a: A, b: B } = t.truth;
  const moves = a?.shots.flatMap((s) => s.moves) ?? [];
  const mv = (start) => moves.find((m) => Math.abs(m.start - start) <= 0.1);
  const [mA, mB] = [mv(A.start), mv(B.start)];
  const window = (from, to) => a?.motion.perShot.flatMap((s) => s.energy?.bursts ?? []).filter((b) => b.t1 > from && b.t0 < to).length;
  return [
    scoreRow({ fixture: F, measure: 'A start second', tool: SEE, truth: A.start, measured: mA?.start, tolerance: tol.startSeconds }),
    scoreRow({ fixture: F, measure: 'A settle second', tool: SEE, truth: A.settle, measured: mA?.settle, tolerance: tol.settleSeconds }),
    scoreRow({ fixture: F, measure: 'A overshoot (points of travel)', tool: SEE, truth: A.overshootPct, measured: mA?.overshootPct, tolerance: tol.overshootPoints }),
    scoreRow({ fixture: F, measure: 'A rest x (video px)', tool: SEE, truth: A.restVideoX, measured: mA?.to ? mA.to[0] * (a.media.height / 1080) : null, tolerance: tol.restPx }),
    scoreRow({ fixture: F, measure: 'A bursts', tool: SEE, truth: A.bursts, measured: a ? window(A.start - 0.1, A.settle + 0.1) : null, tolerance: tol.bursts }),
    scoreRow({ fixture: F, measure: 'B start second', tool: SEE, truth: B.start, measured: mB?.start, tolerance: tol.startSeconds }),
    scoreRow({ fixture: F, measure: 'B settle second (end of move)', tool: SEE, truth: B.settle, measured: mB?.settle, tolerance: tol.settleSeconds }),
    scoreRow({ fixture: F, measure: 'B peak speed (css px/s)', tool: SEE, truth: B.peakCssPxPerS, measured: mB?.peakPxPerS, tolerance: B.peakCssPxPerS * tol.speedRatio }),
    scoreRow({ fixture: F, measure: 'B ease shape', tool: SEE, truth: B.shape, measured: mB?.ease }),
    scoreRow({ fixture: F, measure: 'A overshoot as a number (what onion shows as an image)', tool: SEE, truth: A.overshootPct, measured: mA?.overshootPct, tolerance: tol.overshootPoints }),
  ];
}

/** The camera rows of one tool: `shots` is [{ pan (video px), zoom, turn (deg) }] per world, null where the tool read nothing. */
function cameraGrade(t, shots, tool) {
  const F = 'camera', tol = t.tolerance, T = t.truth.shots;
  const g = (i, k) => shots?.[i]?.[k] ?? null;
  return [
    scoreRow({ fixture: F, measure: 'world 1 pan x (video px)', tool, truth: T[0].panVideoPx, measured: g(0, 'pan'), tolerance: tol.panPx }),
    scoreRow({ fixture: F, measure: 'world 1 zoom', tool, truth: T[0].zoom, measured: g(0, 'zoom'), tolerance: tol.zoom }),
    scoreRow({ fixture: F, measure: 'world 2 zoom', tool, truth: T[1].zoom, measured: g(1, 'zoom'), tolerance: tol.zoom }),
    scoreRow({ fixture: F, measure: 'world 2 pan x (video px)', tool, truth: T[1].panVideoPx, measured: g(1, 'pan'), tolerance: tol.stillPx }),
    scoreRow({ fixture: F, measure: 'world 3 turn (degrees clockwise)', tool, truth: T[2].turnDeg, measured: g(2, 'turn'), tolerance: tol.turnDeg }),
    scoreRow({ fixture: F, measure: 'world 3 zoom', tool, truth: T[2].zoom, measured: g(2, 'zoom'), tolerance: tol.zoom }),
    scoreRow({ fixture: F, measure: 'world 1 turn (degrees clockwise)', tool, truth: T[0].turnDeg, measured: g(0, 'turn'), tolerance: tol.turnDeg }),
  ];
}

export function cameraRows(t, { spec }) {
  const shots = spec?.shots.map((s) => ({ pan: s.camera.panTotalPx[0], zoom: s.camera.zoomTotal, turn: s.camera.rotation?.total ?? 0 }));
  return [...cameraGrade(t, shots, 'vawe see --spec (camera)'), noTool('camera', 'world 4 tilt of a still picture (degrees clockwise)', t.truth.shots[3].tiltDeg, t.tolerance.tiltDeg)];
}

function cameraSeeRows(t, { a }) {
  const per = a?.motion.perShot.map((s) => ({ pan: s.camera.panTotalPx[0], zoom: s.camera.zoomTotal, turn: s.camera.rotation?.total ?? 0 }));
  const tilt = a?.shots[3]?.camera.tilt?.deg ?? null;
  return [...cameraGrade(t, per, SEE), scoreRow({ fixture: 'camera', measure: 'world 4 tilt of a still picture (degrees clockwise)', tool: SEE, truth: t.truth.shots[3].tiltDeg, measured: tilt, tolerance: t.tolerance.tiltDeg })];
}

function eyeSeeRows(t, { a }) {
  const F = 'eye', tol = t.tolerance, asp = t.aspect;
  const rows = [];
  const shot = (t0) => a?.motion.perShot.find((s) => Math.abs((a.shots.find((x) => x.index === s.index)?.start ?? -1) - t0) <= 0.05);
  t.truth.shots.forEach((s, i) => {
    const m = shot(s.t0)?.eye;
    for (const end of ['start', 'end']) rows.push(scoreRow({ fixture: F, measure: `shot ${i + 1} eye ${end} (frame heights from truth)`, tool: SEE, truth: 0, measured: m ? heights(m[end], s[end], asp) : null, tolerance: tol.eyeHeights }));
    rows.push(scoreRow({ fixture: F, measure: `shot ${i + 1} eye travel inside the shot (frame heights)`, tool: SEE, truth: r(heights(s.start, s.end, asp)), measured: m?.travel, tolerance: tol.travelHeights }));
  });
  for (let i = 0; i + 1 < t.truth.shots.length; i++) {
    const b = t.truth.shots[i + 1];
    const jump = a?.motion.eyeCuts.find((c) => Math.abs(c.at - b.t0) <= 0.05);
    rows.push(scoreRow({ fixture: F, measure: `cut ${i + 1} eye jump (frame heights)`, tool: SEE, truth: r(heights(t.truth.shots[i].end, b.start, asp)), measured: jump?.jump, tolerance: tol.travelHeights }));
  }
  return rows;
}

function groundSeeRows(t, { a }) {
  const F = 'ground', tol = t.tolerance;
  const rows = [];
  const shot = (t0) => a?.shots.find((s) => Math.abs(s.start - t0) <= 0.05);
  t.truth.shots.forEach((s, i) => {
    const g = shot(s.t0)?.ground;
    rows.push(scoreRow({ fixture: F, measure: `world ${i + 1} ground colour (deltaE from truth)`, tool: SEE, truth: 0, measured: g?.startLab ? deltaE76(g.startLab, s.lab) : null, tolerance: tol.deltaE }));
  });
  t.truth.cutDeltaE.forEach((de, i) => {
    const cut = a?.groundCuts.find((c) => Math.abs(c.at - t.truth.shots[i + 1].t0) <= 0.05);
    rows.push(scoreRow({ fixture: F, measure: `cut ${i + 1} deltaE`, tool: SEE, truth: de, measured: cut?.dE, tolerance: tol.deltaE }));
  });
  const drift = t.truth.shots.at(-1), d = shot(drift.t0)?.ground;
  rows.push(scoreRow({ fixture: F, measure: 'light drift of world 4 (L change)', tool: SEE, truth: drift.driftL, measured: d?.lightDrift == null ? null : Math.abs(d.lightDrift), tolerance: tol.driftL }));
  const still = [0, 1, 2].map((i) => shot(t.truth.shots[i].t0)?.ground);
  rows.push(scoreRow({ fixture: F, measure: 'still worlds report no drift (worlds 1 to 3)', tool: SEE, truth: 0, measured: still.every(Boolean) ? Math.max(...still.map((g) => Math.abs(g.lightDrift ?? 0))) : null, tolerance: tol.driftL }));
  return rows;
}

function typeSeeRows(t, { a }) {
  const F = 'type', tol = t.tolerance;
  const rows = [];
  const words = a?.type.words ?? null;
  const find = (text) => words?.find((w) => String(w.text).toUpperCase().replace(/[^A-Z]/g, '') === text);
  rows.push(scoreRow({ fixture: F, measure: 'word count', tool: SEE, truth: t.truth.words.length, measured: words?.length, tolerance: tol.wordCount }));
  for (const w of t.truth.words) {
    const m = find(w.text);
    rows.push(scoreRow({ fixture: F, measure: `${w.text} in second`, tool: SEE, truth: w.in, measured: m?.in, tolerance: tol.wordSeconds }));
    rows.push(scoreRow({ fixture: F, measure: `${w.text} out second`, tool: SEE, truth: w.out, measured: m?.out, tolerance: tol.wordSeconds }));
    rows.push(scoreRow({ fixture: F, measure: `${w.text} cap height (fraction of frame)`, tool: SEE, truth: t.truth.capHeightFraction, measured: m ? m.capHeightPct / 100 : null, tolerance: tol.capHeightFraction }));
  }
  return rows;
}

function soundSeeRows(t, { a, p }) {
  const F = 'sound', tol = t.tolerance;
  const rows = [];
  t.truth.cues.forEach((c, i) => {
    const hit = a?.sound.hits.reduce((best, h) => (!best || Math.abs(h.onset - c.at) < Math.abs(best.onset - c.at) ? h : best), null);
    const cue = p?.sound.page?.cues[i];
    rows.push(scoreRow({ fixture: F, measure: `${c.voice} cue second`, tool: `${SEE} (mp4 onset)`, truth: c.at, measured: hit?.onset, tolerance: tol.cueSeconds }));
    rows.push(scoreRow({ fixture: F, measure: `${c.voice} cue second`, tool: `${SEE} (page)`, truth: c.at, measured: cue?.voice === c.voice ? cue.at : null, tolerance: tol.cueSeconds }));
  });
  rows.push(scoreRow({ fixture: F, measure: 'integrated loudness (LUFS)', tool: `${SEE} (page mix)`, truth: t.truth.lufs, measured: p?.sound.page?.mix?.lufs, tolerance: tol.lufs }));
  return rows;
}

/** `vawe see` on the events fixture: the second of each in-shot event, its sound offset in frames and verdict, and the sounds with no action. */
export function eventsSeeRows(t, { a }) {
  const F = 'events', tol = t.tolerance;
  const events = a?.shots.flatMap((s) => s.events ?? []) ?? [];
  const rows = [];
  t.truth.events.forEach((e) => {
    const found = nearest(events, e.t, (x) => x.t);
    const near = found && Math.abs(found.t - e.t) <= 0.2 ? found : null;
    rows.push(scoreRow({ fixture: F, measure: `${e.label}: event second`, tool: SEE, truth: e.t, measured: near?.t, tolerance: tol.eventSeconds }));
    rows.push(scoreRow({ fixture: F, measure: `${e.label}: sound offset (frames, + = sound after)`, tool: SEE, truth: e.frames, measured: near?.sound?.frames, tolerance: tol.soundFrames }));
    rows.push(scoreRow({ fixture: F, measure: `${e.label}: verdict`, tool: SEE, truth: e.verdict, measured: near?.verdict }));
  });
  const lone = a?.sound.events?.soundsWithoutAction ?? null;
  rows.push(scoreRow({ fixture: F, measure: 'sounds with no action (count)', tool: SEE, truth: t.truth.soundsWithoutAction.length, measured: lone?.length, tolerance: tol.count }));
  t.truth.soundsWithoutAction.forEach((at) => rows.push(scoreRow({ fixture: F, measure: `sound with no action at ${at} s`, tool: SEE, truth: at, measured: nearest(lone ?? [], at, (x) => x.t)?.t, tolerance: tol.eventSeconds })));
  return rows;
}

const BEAT = 'vawe sound';

/** `vawe sound` on the beat fixture: tempo, first beat, every strike, each cut's verdict and frames, the page cue. `sound` is its sound.json; null when the verb failed. */
export function beatRows(t, { sound }) {
  const F = 'beat', tol = t.tolerance, v = t.truth;
  const rows = [
    scoreRow({ fixture: F, measure: 'tempo (BPM)', tool: BEAT, truth: v.bpm, measured: sound?.tempo?.bpm, tolerance: tol.bpm }),
    scoreRow({ fixture: F, measure: 'first beat second', tool: BEAT, truth: v.firstBeat, measured: sound?.grid?.find((l) => l.kind === 'beat')?.t, tolerance: tol.beatSeconds }),
  ];
  for (const h of v.hits) rows.push(scoreRow({ fixture: F, measure: `strike at ${h} s: attack second`, tool: BEAT, truth: h, measured: nearest(sound?.onsets ?? [], h, (o) => o.attack)?.attack, tolerance: tol.onsetSeconds }));
  v.cuts.forEach((c, i) => {
    const row = sound?.cuts?.rows?.[i];
    rows.push(scoreRow({ fixture: F, measure: `cut ${i + 1} (${r(c.at, 2)} s) verdict`, tool: BEAT, truth: c.verdict, measured: row?.verdict, tolerance: null }));
    rows.push(scoreRow({ fixture: F, measure: `cut ${i + 1} (${r(c.at, 2)} s) offset in frames`, tool: BEAT, truth: c.frames, measured: row?.frames == null ? null : Math.abs(row.frames), tolerance: 0.1 }));
  });
  const cue = sound?.cues?.find((x) => x.voice === v.cue.voice);
  rows.push(scoreRow({ fixture: F, measure: `${v.cue.voice} cue second (its own row, apart from the bed)`, tool: BEAT, truth: v.cue.at, measured: cue?.at, tolerance: tol.cueSeconds }));
  return rows;
}

export function lookSeeRows(t, { a }) {
  const F = 'look', tol = t.tolerance, v = t.truth;
  const f = a?.look.film;
  return [
    scoreRow({ fixture: F, measure: 'bloom radius (css px, gaussian sigma)', tool: SEE, truth: v.bloomSigmaPx, measured: f?.bloom?.sigma, tolerance: tol.bloomPx }),
    scoreRow({ fixture: F, measure: 'red vs blue channel offset (css px)', tool: SEE, truth: v.channelOffsetPx, measured: f?.chroma ? Math.hypot(f.chroma.dx, f.chroma.dy) : null, tolerance: tol.channelOffsetPx }),
    scoreRow({ fixture: F, measure: 'RGB stripe period (css px)', tool: SEE, truth: v.stripePeriodPx, measured: f?.texture?.striped ? f.texture.period : null, tolerance: tol.stripePeriodPx }),
  ];
}

const sh = (cmd, args, opts = {}) => {
  const res = spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26, ...opts });
  return { ok: res.status === 0, text: `${res.stdout ?? ''}${res.stderr ?? ''}` };
};
const vawe = (...args) => sh('node', ['bin/vawe', ...args]);
const readJson = (file) => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; } };
const loadTruth = (name) => JSON.parse(fs.readFileSync(path.join(FIXTURES, name, 'truth.json'), 'utf8'));
const pageOf = (name) => path.join('tests/fixtures/truth', name, 'page.html');

function render(name, { reuse, audio, final }) {
  fs.mkdirSync(OUT, { recursive: true });
  const mp4 = path.join('out/see-truth', `${name}.mp4`);
  const fresh = fs.existsSync(path.join(ROOT, mp4)) && fs.statSync(path.join(ROOT, mp4)).mtimeMs > fs.statSync(path.join(ROOT, pageOf(name))).mtimeMs;
  if (reuse && fresh) return mp4;
  const res = sh('node', ['harness/media/render-page.mjs', pageOf(name), mp4, ...(audio ? ['--audio'] : ['--silent']), ...(final ? ['--final'] : [])]);
  if (!res.ok) { console.error(`render of ${name} failed:\n${res.text.split('\n').slice(-8).join('\n')}`); return null; }
  return mp4;
}

function specOf(name, mp4, ocr) {
  const dir = path.join('out/see-truth', `${name}-spec`);
  if (!mp4) return null;
  const res = vawe('see', mp4, '--spec', '--out', dir, '--no-cache', ...(ocr ? [] : ['--no-ocr']));
  if (!res.ok) console.error(`vawe see --spec on ${name} failed:\n${res.text.split('\n').slice(-6).join('\n')}`);
  return readJson(path.join(ROOT, dir, 'spec.json'));
}

const timelineOf = (name) => { const res = vawe('see', pageOf(name), '--plan', '--json'); try { return JSON.parse(res.text.slice(0, res.text.lastIndexOf('}') + 1)); } catch { return null; } };

/** The see.json of `vawe see` on the mp4 (or, with `page`, on the page read with that mp4 as its draft); null when it failed. */
function seeOf(name, mp4, { page = false, ocr = false } = {}) {
  if (!mp4) return null;
  const out = path.join('out/see-truth', `${name}-see${page ? '-page' : ''}`);
  const res = sh('node', ['harness/media/see/one.mjs', page ? pageOf(name) : mp4, '--out', out, ...(page ? ['--draft', mp4] : []), ...(ocr ? [] : ['--no-ocr'])]);
  if (!res.ok) console.error(`vawe see on ${name}${page ? ' (page)' : ''} failed:\n${res.text.split('\n').slice(-8).join('\n')}`);
  return readJson(path.join(ROOT, out, 'see.json'))?.a ?? null;
}

const FIXTURE_RUN = {
  cuts: (t, o) => { const mp4 = render('cuts', o); return [...cutsRows(t, { spec: specOf('cuts', mp4), timeline: timelineOf('cuts') }), ...cutsSeeRows(t, { a: seeOf('cuts', mp4), p: seeOf('cuts', mp4, { page: true }) })]; },
  flash: (t, o) => { const mp4 = render('flash', o); return [...flashRows(t, { spec: specOf('flash', mp4) }), ...flashSeeRows(t, { a: seeOf('flash', mp4) })]; },
  motion: (t, o) => {
    const mp4 = render('motion', o);
    const { a, b } = t.truth;
    const vel = vawe('frame', pageOf('motion'), '--velocity', '--moment', '1.5', '--span', '3', '--out', 'out/see-truth/velocity');
    const strip = (s) => (mp4 ? parseStrip(vawe('frame', mp4, '--moment', String(s.at), '--span', String(s.span), '--out', 'out/see-truth/strip').text) : null);
    return [...motionRows(t, { velocity: parseVelocity(vel.text), spec: specOf('motion', mp4), stripA: strip(a.strip), stripB: strip(b.strip) }), ...motionSeeRows(t, { a: seeOf('motion', mp4) })];
  },
  camera: (t, o) => { const mp4 = render('camera', o); return [...cameraRows(t, { spec: specOf('camera', mp4) }), ...cameraSeeRows(t, { a: seeOf('camera', mp4) })]; },
  eye: (t, o) => { const mp4 = render('eye', o); return [...eyeRows(t, { spec: specOf('eye', mp4) }), ...eyeSeeRows(t, { a: seeOf('eye', mp4) })]; },
  ground: (t, o) => { const mp4 = render('ground', o); return [...groundRows(t, { spec: specOf('ground', mp4) }), ...groundSeeRows(t, { a: seeOf('ground', mp4) })]; },
  type: (t, o) => { const mp4 = render('type', o); return [...typeRows(t, { spec: specOf('type', mp4, true) }), ...typeSeeRows(t, { a: seeOf('type', mp4, { ocr: true }) })]; },
  sound: (t, o) => {
    const mp4 = render('sound', { ...o, audio: true });
    const probes = t.truth.cues.map((c) => r(c.at + PROBE_OFFSET, 3)).join(',');
    const at = vawe('sound', pageOf('sound'), '--at', probes);
    const wave = vawe('sound', pageOf('sound'), '--waveform', '--out', 'out/see-truth/sound-wave.png');
    return [...soundRows(t, { audioAt: parseAudioAt(at.text), lufs: parseLufs(wave.text), timeline: timelineOf('sound'), spec: specOf('sound', mp4) }), ...soundSeeRows(t, { a: seeOf('sound', mp4), p: seeOf('sound', mp4, { page: true }) })];
  },
  events: (t, o) => eventsSeeRows(t, { a: seeOf('events', render('events', { ...o, audio: true })) }),
  beat: (t) => {
    const out = 'out/see-truth/beat-sound';
    const res = vawe('sound', pageOf('beat'), '--out', out, '--no-cache');
    if (!res.ok) console.error(`vawe sound on beat failed:\n${res.text.split('\n').slice(-8).join('\n')}`);
    return beatRows(t, { sound: readJson(path.join(ROOT, out, 'sound.json')) });
  },
  look: (t, o) => {
    const mp4 = render('look', { ...o, final: true });
    return [...lookRows(t, { look: mp4 ? parseLook(sh('node', ['harness/media/see/look.mjs', mp4]).text) : null }), ...lookSeeRows(t, { a: seeOf('look', mp4) })];
  },
};

export async function main(argv) {
  const only = argv.includes('--only') ? argv[argv.indexOf('--only') + 1] : null;
  if (only && !FIXTURE_RUN[only]) { console.error(`unknown fixture ${only}; known: ${ORDER.join(', ')}`); return 2; }
  const opts = { reuse: argv.includes('--reuse') };
  const started = Date.now();
  const rows = [];
  for (const name of ORDER) {
    if (only && only !== name) continue;
    console.error(`see-truth: ${name}`);
    rows.push(...FIXTURE_RUN[name](loadTruth(name), opts));
  }
  const tool = argv.includes('--tool') ? argv[argv.indexOf('--tool') + 1] : 'all';
  const shown = rows.filter((x) => tool === 'all' || (tool === 'see' ? x.tool.startsWith('vawe see') : !x.tool.startsWith('vawe see')));
  if (argv.includes('--json')) console.log(JSON.stringify(shown, null, 1));
  else console.log(`${formatTable(shown)}\n\n${formatSummary(shown)}\nrun time: ${Math.round((Date.now() - started) / 1000)} s`);
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(await main(process.argv.slice(2)));
