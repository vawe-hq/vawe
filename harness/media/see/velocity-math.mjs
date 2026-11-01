// Pure parts of `vawe frame --moment <s> --velocity`: the speed and scale of an element from its box samples, the start, peak, settle, overshoot and ease shape of a move.
// No I/O and no heavy imports: harness/cli/verbs.mjs loads this file to check the arguments.

export const VELOCITY_SPAN = 1;
export const VELOCITY_HZ = 120;
const SHOW = 4;
const START_SHARE = 0.05;
const ARRIVED = 0.98;
const POS_FLOOR = 0.03;
const SCALE_FLOOR = 0.02;
const MIN_ALPHA = 0.05;
const LINEAR_RATIO = 1.15;
const ROUND_PEAK_SHARE = 0.35;
const LATE_PEAK_SHARE = 0.65;

const round = (n, d = 3) => +n.toFixed(d);

/** The first problem in the arguments of velocity, or null. Pure. */
export function velocityProblem({ at, span, sel, ids }) {
  if (at === undefined) return 'missing --at <s> (the moment to look at)';
  if (!(Number.isFinite(Number(at)) && Number(at) >= 0)) return `--at is not a number of seconds: "${at}"`;
  if (!(span > 0)) return '--span must be more than 0 seconds';
  if (sel && ids) return 'give --sel <css> or --ids a,b, not both';
  return null;
}

/** The sample times of a window, VELOCITY_HZ a second, both ends included. Pure. */
export function sampleTimes(from, to) {
  const n = Math.round((to - from) * VELOCITY_HZ);
  return Array.from({ length: n + 1 }, (_, i) => round(from + i / VELOCITY_HZ, 4));
}

/** A box track [[x, y, w, h, alpha]] at `times` as points { t, x, y, s, alpha }: the centre, and the scale as the root of the box area. Missing boxes are dropped. Pure. */
export const trackPoints = (times, track) => track
  .map((b, i) => (b ? { t: times[i], x: b[0] + b[2] / 2, y: b[1] + b[3] / 2, s: Math.sqrt(Math.max(0, b[2] * b[3])), alpha: b[4] ?? 1 } : null))
  .filter(Boolean);

/**
 * The points of the longest stretch in which the box is drawn (a size above zero and an alpha above zero): an element that toggles display sits at 0, 0 with no size while hidden,
 * and reading that jump as a move gave speeds of 100 frame heights a second. { points, from, to } with the times of the stretch; no points when it is never drawn. Pure.
 */
export function visiblePoints(times, track) {
  let best = { start: 0, end: 0 }, start = null;
  const drawn = (b) => b && b[2] * b[3] > 0 && (b[4] ?? 1) > 0;
  for (let i = 0; i <= track.length; i++) {
    if (i < track.length && drawn(track[i])) { start ??= i; continue; }
    if (start !== null && i - start > best.end - best.start) best = { start, end: i };
    start = null;
  }
  const points = trackPoints(times.slice(best.start, best.end), track.slice(best.start, best.end));
  return { points, from: points.length ? points[0].t : null, to: points.length ? points.at(-1).t : null };
}

/** The central difference of `value(point)` per second at each point, one-sided at the two ends. Pure. */
function slope(pts, value) {
  return pts.map((_, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    return (value(b) - value(a)) / (b.t - a.t);
  });
}

/** The speed of the centre in frame heights per second at each point. Pure. */
export function speedSeries(pts, frameH) {
  const dx = slope(pts, (p) => p.x), dy = slope(pts, (p) => p.y);
  return pts.map((p, i) => ({ t: p.t, v: Math.hypot(dx[i], dy[i]) / frameH }));
}

/** The scale at each point as a share of its last value (1 is rest), and the size of its change per second. Pure. */
export function scaleSeries(pts) {
  const rest = pts.at(-1).s || 1;
  const rel = pts.map((p) => ({ t: p.t, v: p.s / rest }));
  const rate = slope(rel, (p) => p.v).map(Math.abs);
  return { rel, rate: rel.map((r, i) => ({ t: r.t, v: rate[i] })) };
}

/** How far along its own path the centre is at each point, in frame heights: the distance from the first point along the line to the farthest one. Pure. */
export function pathProgress(pts, frameH) {
  const far = pts.reduce((m, p) => (Math.hypot(p.x - pts[0].x, p.y - pts[0].y) > Math.hypot(m.x - pts[0].x, m.y - pts[0].y) ? p : m), pts[0]);
  const len = Math.hypot(far.x - pts[0].x, far.y - pts[0].y) || 1;
  const ux = (far.x - pts[0].x) / len, uy = (far.y - pts[0].y) / len;
  return pts.map((p) => ({ t: p.t, v: ((p.x - pts[0].x) * ux + (p.y - pts[0].y) * uy) / frameH }));
}

/** How much a track moves: the path of the centre in frame heights plus the size of its change as a share. Zero for an element that never shows. Pure. */
export function moveScore(pts, frameH) {
  if (pts.length < 2 || Math.max(...pts.map((p) => p.alpha)) < MIN_ALPHA) return 0;
  let path = 0;
  for (let i = 1; i < pts.length; i++) path += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  const grow = pts[0].s > 0 && pts.at(-1).s > 0 ? Math.abs(Math.log(pts.at(-1).s / pts[0].s)) : 0;
  return path / frameH + grow;
}

/** The indexes of the `count` tracks that move most, most first; a track that moves under 1 per cent of a frame height is left out. Pure. */
export const topMovers = (scores, count = SHOW) => scores
  .map((score, index) => ({ score, index }))
  .filter((s) => s.score > 0.01)
  .sort((a, b) => b.score - a.score)
  .slice(0, count)
  .map((s) => s.index);

/** The ease shape of a move from its speed profile between `start` and the first time it is `ARRIVED` of the way: linear, ease-out (fast first), ease-in (fast last) or in-out. Pure. */
export function easeShape(speed, start, arrive) {
  const seg = speed.filter((p) => p.t >= start && p.t <= arrive);
  const span = arrive - start;
  if (seg.length < 3 || !(span > 0)) return null;
  const peak = seg.reduce((m, p) => (p.v > m.v ? p : m), seg[0]);
  let area = 0;
  for (let i = 1; i < seg.length; i++) area += ((seg[i].v + seg[i - 1].v) / 2) * (seg[i].t - seg[i - 1].t);
  if (peak.v / (area / span) < LINEAR_RATIO) return 'linear';
  const at = (peak.t - start) / span;
  if (at < ROUND_PEAK_SHARE) return 'ease-out';
  if (at > LATE_PEAK_SHARE) return 'ease-in';
  return 'in-out';
}

/**
 * What one channel does in the window. `progress` is [{ t, v }] along the move (the path distance, or the scale), `speed` is [{ t, v }] of its change per second,
 * `floor` the speed under which the channel is still. The move runs from the first to the last time the speed passes 5 per cent of its peak; the rest value is the
 * last sample, so a move still going at the window end has no overshoot to judge. Overshoot is how far the progress passes rest, as a share of the move. Pure.
 */
export function analyseMove(progress, speed, floor) {
  const peak = speed.reduce((m, p) => (p.v > m.v ? p : m), speed[0]);
  if (peak.v < floor) return { moves: false };
  const limit = Math.max(floor, START_SHARE * peak.v);
  const going = speed.filter((p) => p.v > limit);
  const start = going[0].t, last = going.at(-1).t;
  const settled = last < speed.at(-1).t - 1e-9;
  const from = progress[0].v, rest = progress.at(-1).v, total = rest - from;
  const sign = Math.sign(total) || 1;
  const arrive = (progress.find((p) => p.t >= start && sign * (p.v - from) >= ARRIVED * Math.abs(total)) ?? progress.at(-1)).t;
  const beyond = Math.max(0, ...progress.map((p) => sign * (p.v - rest)));
  const judged = settled && Math.abs(total) > 1e-6;
  return {
    moves: true, start: round(start), peakAt: round(peak.t), peakSpeed: round(peak.v), settle: round(last), settled,
    overshootPct: judged ? round((100 * beyond) / Math.abs(total), 1) : null,
    shape: easeShape(speed, start, arrive),
  };
}

const sec = (t) => `${t.toFixed(2)} s`;

/** The summary lines of one element: its position channel and its scale channel, each as one line. Pure. */
export function summaryLines(label, pos, scale, frameH) {
  const lines = [label];
  const say = (name, m, unit) => {
    if (!m.moves) return `  ${name}: still`;
    const over = m.overshootPct === null ? 'overshoot not judged (still moving at the window end)' : m.overshootPct >= 1 ? `overshoots its rest by ${m.overshootPct}%` : 'no overshoot';
    return `  ${name}: starts ${sec(m.start)}, peak ${unit(m.peakSpeed)} at ${sec(m.peakAt)}, ${m.settled ? `settles ${sec(m.settle)}` : 'still moving at the window end'}, ${over}, ${m.shape ?? 'too short to classify'}`;
  };
  lines.push(say('position', pos, (v) => `${round(v, 2)} frame heights/s (${Math.round(v * frameH)} px/s)`));
  lines.push(say('scale', scale, (v) => `${round(v * 100, 1)}%/s`));
  return lines;
}

/** One element's analysis from its box track: { pos, scale, speed, rel } where `speed` and `rel` are the lines of the graph. Pure. */
export function analyseTrack(pts, frameH) {
  const speed = speedSeries(pts, frameH);
  const { rel, rate } = scaleSeries(pts);
  return { pos: analyseMove(pathProgress(pts, frameH), speed, POS_FLOOR), scale: analyseMove(rel, rate, SCALE_FLOOR), speed, rel };
}
