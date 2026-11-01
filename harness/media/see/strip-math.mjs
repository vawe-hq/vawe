// Pure parts of `vawe frame`: the window around a moment, the cuts of a film, and when the motion in a window starts and settles.
// No I/O and no heavy imports: harness/cli/verbs.mjs loads this file to check the arguments.
import { atProblem } from './at-problem.mjs';

export const STRIP_SPAN = 1;
export const STRIP_FPS = 8;
const BURST_GAP_S = 0.2;
const MOTION_SHARE = 0.1;
const SAMPLE_S = 0.1;

const round = (n) => +n.toFixed(3);

/** The first problem in the arguments of strip, or null. Pure. */
export function stripProblem({ at, cuts, span, fps }) {
  if (cuts && at !== undefined) return 'give --at <s> or --cuts, not both';
  if (!cuts && at === undefined) return 'missing --at <s> (the moment to look at) or --cuts (one strip per world change or shot cut)';
  if (!cuts && atProblem(at)) return atProblem(at);
  if (!(span > 0)) return '--span must be more than 0 seconds';
  if (!(fps > 0)) return '--fps must be more than 0 (0.5 is one frame every 2 s)';
  return null;
}

/** The problem with asking for `fps` frames per second from a source that has `sourceFps`, or null. Pure. */
export function stripFpsProblem(fps, sourceFps) {
  if (fps <= sourceFps * 1.005) return null;
  return `--fps ${fps} is more than the ${+sourceFps.toFixed(2)} fps this video has: ask for at most ${+sourceFps.toFixed(2)} (a draft is 30 fps, a final 60: strip the final mp4 to measure 60)`;
}

/** The window { from, to } of `span` seconds centred on `at`, moved to stay inside [0, dur] (shorter than `span` only when the film is). Pure. */
export function stripWindow(at, span, dur) {
  const len = Math.min(span, dur);
  const from = Math.max(0, Math.min(at - len / 2, dur - len));
  return { from: round(from), to: round(from + len) };
}

/** The world changes of measured spans [{ id, start, end }]: [{ at, from, to }], `at` the middle between the end of the world before and the start of the next. Worlds never shown are skipped. Pure. */
export function worldCuts(spans) {
  const shown = spans.filter((s) => s.start != null).sort((a, b) => a.start - b.start);
  const cuts = [];
  let last = shown[0];
  for (const s of shown.slice(1)) {
    cuts.push({ at: round((last.end + s.start) / 2), from: last.id, to: s.id });
    if (s.end > last.end) last = s;
  }
  return cuts;
}

/** The cuts of a reference from its measured shots [{ start }]: one at the start of each shot after the first. Pure. */
export const shotCuts = (shots) => shots.slice(1).map((s, i) => ({ at: round(s.start), from: `shot ${i + 1}`, to: `shot ${i + 2}` }));

const REACH_S = 0.5;

/**
 * Each cut with the shot change it sits in: { ...cut, start, end, kind }. `transitions` are [{ startT, endT, type }] (harness/media/see/transitions.mjs
 * for a video, the measured cuts of spec.json for a reference). The change nearest to the cut within REACH_S wins; a cut with none starts and ends at `at`. Pure.
 */
export function withTransitions(cuts, transitions) {
  const gap = (t, at) => Math.max(t.startT - at, at - t.endT, 0);
  const nearestCut = (t) => cuts.reduce((best, c, i) => (gap(t, c.at) < gap(t, cuts[best].at) ? i : best), 0);
  const own = cuts.map(() => []);
  for (const t of cuts.length ? transitions : []) {
    const i = nearestCut(t);
    if (gap(t, cuts[i].at) <= REACH_S) own[i].push(t);
  }
  return cuts.map((c, i) => {
    const near = own[i].sort((a, b) => gap(a, c.at) - gap(b, c.at))[0];
    return near ? { ...c, start: near.startT, end: near.endT, kind: near.type } : { ...c, start: c.at, end: c.at, kind: null };
  });
}

/**
 * What the energy series (one { t, v } per 0.1 s) says about the motion inside [from, to): where it starts, peaks and settles, and how many
 * separate bursts it has. Motion is energy above `floor` and above a tenth of the window's peak. A dip of under 0.2 s does not split a burst,
 * so a spring turning at its far end stays one burst: energy cannot tell an overshoot from a second move, and this does not claim to. Pure.
 */
export function motionRead(energy, from, to, floor) {
  const inside = energy.filter((p) => p.t >= from - 1e-9 && p.t < to - 1e-9);
  if (!inside.length) return null;
  const peak = inside.reduce((m, p) => (p.v > m.v ? p : m), inside[0]);
  if (peak.v < floor) return { moving: false, peak: round(peak.v) };
  const threshold = Math.max(floor, MOTION_SHARE * peak.v);
  const bursts = [];
  for (const p of inside.filter((x) => x.v > threshold)) {
    const open = bursts.at(-1);
    if (open && p.t - open.t1 < BURST_GAP_S - 1e-9) open.t1 = p.t + SAMPLE_S;
    else bursts.push({ t0: p.t, t1: p.t + SAMPLE_S });
  }
  const end = inside.at(-1).t + SAMPLE_S;
  return {
    moving: true,
    peak: +peak.v.toFixed(2),
    peakAt: round(peak.t),
    start: round(bursts[0].t0),
    startedBefore: bursts[0].t0 <= inside[0].t + 1e-9,
    settle: round(bursts.at(-1).t1),
    settled: bursts.at(-1).t1 < end - 1e-9,
    bursts: bursts.map((b) => ({ t0: round(b.t0), t1: round(b.t1) })),
  };
}

/** The lines that say a motionRead in words: the numbers an agent can act on. Pure. */
export function motionLines(read, floor) {
  if (!read) return ['motion: no energy samples in this window'];
  if (!read.moving) return [`motion: nothing moves in this strip (peak energy ${read.peak}, under ${floor})`];
  const start = read.startedBefore ? `already moving at the strip start (${read.start.toFixed(2)} s)` : `starts ${read.start.toFixed(2)} s`;
  const settle = read.settled ? `settles ${read.settle.toFixed(2)} s` : 'still moving at the strip end';
  const lines = [`motion: ${start}, peaks ${read.peak} at ${read.peakAt.toFixed(2)} s, ${settle}; ${read.bursts.length} burst${read.bursts.length === 1 ? '' : 's'}`];
  if (read.bursts.length > 1) lines.push(`bursts: ${read.bursts.map((b) => `${b.t0.toFixed(2)}-${b.t1.toFixed(2)} s`).join(', ')} (a second move, or a spring coming back: read the frames)`);
  return lines;
}

/** The energy rows of a window, one line per 0.1 s with a bar, or one line of numbers when `compact`. Pure. */
export function energyLines(energy, from, to, { compact = false } = {}) {
  const rows = energy.filter((p) => p.t >= from - 1e-9 && p.t < to - 1e-9);
  if (compact) return [`energy per 0.1 s from ${(rows[0]?.t ?? from).toFixed(1)} s: ${rows.map((p) => p.v.toFixed(1)).join(' ')}`];
  const top = Math.max(1, ...rows.map((p) => p.v));
  return ['energy per 0.1 s:', ...rows.map((p) => `  ${p.t.toFixed(2)} s  ${p.v.toFixed(2).padStart(6)}  ${'#'.repeat(Math.round((20 * p.v) / top))}`)];
}

/** The film name a mp4 of out/ belongs to: `out/<name>.mp4`, `<name>-draft.mp4` or `<name>.web.mp4` give <name>. Pure. */
export const filmNameOf = (file) => file.split('/').pop().replace(/\.(web\.)?mp4$/, '').replace(/-draft$/, '');

const bucketOf = (t) => Math.floor(t / SAMPLE_S + 1e-9) * SAMPLE_S;

/**
 * Seconds the picture holds still before the cut at `at`, or null when the shot since the cut before (`since`) has no whole sample to read.
 * A sample covers [t, t + SAMPLE_S); the samples that hold this cut and the cut before are left out. `whole` when no sample of the shot
 * is over `floor`. Pure.
 */
export function holdBefore(energy, at, floor, since = 0) {
  const start = since > 0 ? bucketOf(since) + SAMPLE_S : 0;
  const end = bucketOf(at);
  const shot = energy.filter((p) => p.t >= start - 1e-9 && p.t < end - 1e-9);
  if (!shot.length) return null;
  const moving = shot.filter((p) => p.v > floor).at(-1);
  return { holdS: round(end - (moving ? moving.t + SAMPLE_S : start)), whole: !moving };
}

/** holdBefore for each cut of withTransitions: measured to the first changing frame of the cut, from the end of the cut before. Pure. */
export const cutHolds = (energy, cuts, floor) => cuts.map((c, i) => holdBefore(energy, c.start, floor, i ? cuts[i - 1].end : 0));

const DISSOLVES = new Set(['crossfade', 'dip']);

/** The line on how the picture changes at one cut (from withTransitions), or null for a hard cut or a cut with no shot change found. Pure. */
export function transitionLine(c) {
  const span = round(c.end - c.start);
  if (!c.kind || c.kind === 'cut' || c.kind === 'match') return null;
  if (DISSOLVES.has(c.kind)) return `a dissolve of ${span.toFixed(2)} s, from ${c.start.toFixed(2)} s (${c.kind}); the hold is measured up to its start`;
  return `a transition of ${span.toFixed(2)} s, from ${c.start.toFixed(2)} s (${c.kind}); the hold is measured up to its start`;
}

export const PAUSE_S = 0.3;
// cutHolds over the shot cuts of the 22 reference films in ~/.vawe/refs, measured to the start of each shot change (harness/dev/pause-bar.mjs prints it again).
const REF_PAUSES = 'the shot cuts of 22 reference films: 3 films never pause, the median film pauses before 3 cuts in 10';

/** One line on the hold before one cut (`h` from holdBefore). Pure. */
export function holdLine(h) {
  if (!h) return 'hold before the cut: not measured, the shot is under 0.2 s';
  if (h.whole) return `hold before the cut: ${h.holdS.toFixed(2)} s, the whole shot is under the motion floor`;
  return h.holdS < SAMPLE_S ? 'hold before the cut: none, the cut lands on motion' : `hold before the cut: ${h.holdS.toFixed(2)} s`;
}

/** Two lines: how many measured cuts pause PAUSE_S or more, then the reference range. Pure. */
export function holdsSummary(holds) {
  const measured = holds.filter(Boolean);
  const paused = measured.filter((h) => h.holdS >= PAUSE_S).length;
  return [`pauses: ${paused} of ${measured.length} measured cuts hold ${PAUSE_S} s or more under the motion floor before the first changing frame of the cut (a dissolve is not a hold)`,
    `for comparison, ${REF_PAUSES}`];
}
