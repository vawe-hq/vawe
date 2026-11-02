// Frozen runs, jerky steps and jumps of a draft, read from its frame differences: item i of `diffs` is the mean
// absolute grey change (0 to 255) of frame i+1 against frame i at 240x136, as frameMotion in motion-curve.mjs
// gives it. The still threshold is that file's STILL (0.05), through frozenInside.
import { frozenInside } from '../media/motion-curve.mjs';

export const JUMP = 25;
export const MOVING = 1;
export const JERK_RATIO = 2.2;
export const FROZEN_FRAMES = 3;
const TURN_TOLERANCE_S = 0.15;
// A cut changes the picture on its frame, and the frame after it compares against that change: both are the cut, not a move.
const CUT_FRAMES = 2;

const inSpan = (t, [a, b]) => t >= a - 1e-9 && t <= b + 1e-9;

/** The jump ({ t, mag }) inside the [a, b] span with the largest picture change (the earliest on a tie), or undefined. Pure. */
export const biggestJump = (jumps, span) => jumps.filter((j) => inSpan(j.t, span)).reduce((best, j) => (!best || j.mag > best.mag ? j : best), undefined);
const near = (t, list, tol) => list.some((c) => Math.abs(t - c) <= tol + 1e-9);

/**
 * { frozen, jerky, jumps } with a time in seconds on each entry. `cuts` are the declared cut times, `turns`
 * the hard cuts scene-stats found (10 samples a second, so they get a wider tolerance). A jump within one
 * frame of either is a cut, not a jump, and so is the one largest jump inside each `cutSpans` [start, end] (a wipe or fade the Shots overlap declares); any other jump in the span still counts. `worldCuts` are the seconds where a world starts or ends: a speed change
 * within two frames of one is the cut, not a jerky step. A speed change is jerky only inside a run already moving for two frames:
 * the first frames of a move from rest are not. Pure.
 */
export function smoothness(diffs, { fps = 30, cuts = [], cutSpans = [], turns = [], worldCuts = [] } = {}) {
  const frozen = frozenInside(diffs).filter((f) => f.frames >= FROZEN_FRAMES).map((f) => ({ t: (f.frame - 1) / fps, frames: f.frames }));
  const jumps = [];
  const jerky = [];
  const all = hardJumps(diffs, fps);
  const wipes = new Set(cutSpans.map((span) => biggestJump(all, span)).filter(Boolean));
  diffs.forEach((d, i) => {
    const t = (i + 1) / fps;
    if (d > JUMP && !near(t, cuts, 1 / fps) && !wipes.has(all.find((j) => j.t === t)) && !near(t, turns, TURN_TOLERANCE_S)) jumps.push({ t, mag: d });
    const [prev, before] = [diffs[i - 1], diffs[i - 2]];
    if (i < 2 || d > JUMP || prev > JUMP || d <= MOVING || prev <= MOVING || before <= MOVING || near(t, worldCuts, CUT_FRAMES / fps)) return;
    if (Math.max(d, prev) / Math.min(d, prev) > JERK_RATIO) jerky.push({ t, ratio: Math.max(d, prev) / Math.min(d, prev) });
  });
  return { frozen, jerky, jumps };
}

/** Where the picture jumps hard, for the cut check: every diff over JUMP, as { t (seconds), mag }. Pure. */
export function hardJumps(diffs, fps = 30) {
  return diffs.flatMap((d, i) => (d > JUMP ? [{ t: (i + 1) / fps, mag: d }] : []));
}
