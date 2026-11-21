// Advice when one hue family holds the ground of the whole film. `perShot` is the ground block of ref-measure/ground.mjs
// ({ t0, L, chroma, hue } per shot, hue in Lab degrees); the reference side reads the same block from its spec.json. Pure.
import LIMITS from '../../taste/build/limits.json' with { type: 'json' };

const { hue_span_deg_max: SPAN_MAX, chroma_min: CHROMA_MIN, shots_min: SHOTS_MIN } = LIMITS['ground-hue'];
const REF_TURNS_MAX = 3;
export const GROUND_HUE = 'ground-hue';

/** [lo, hi] of the smallest arc of the hue circle that holds every hue, in degrees; hi may pass 360. */
export function hueArc(hues) {
  const sorted = [...hues].sort((a, b) => a - b);
  const gaps = sorted.map((h, i) => (sorted[i + 1] ?? sorted[0] + 360) - h);
  const widest = gaps.indexOf(Math.max(...gaps));
  const lo = sorted[(widest + 1) % sorted.length];
  const hi = sorted[widest];
  return [lo, hi < lo ? hi + 360 : hi];
}

const wrap = (deg) => Math.round(deg % 360);

/** { shots, from, to, hue: [lo, hi], light: [lo, hi] } when three or more shots keep a tinted ground inside one hue family, else null. Neutral grounds break the family. */
export function hueFamily(perShot, endSec) {
  const shots = perShot.filter((p) => p.start !== null && p.start !== undefined);
  if (shots.length < SHOTS_MIN || shots.some((p) => p.chroma < CHROMA_MIN)) return null;
  const [lo, hi] = hueArc(shots.map((p) => p.hue));
  if (hi - lo > SPAN_MAX) return null;
  const light = shots.map((p) => p.L);
  return { shots: shots.length, from: shots[0].t0, to: endSec, hue: [wrap(lo), wrap(hi)], light: [Math.round(Math.min(...light)), Math.round(Math.max(...light))] };
}

/** The biggest ground changes of a reference as "2.1 s (hue 20 to 210)", at most three, in time order; [] when the reference has no ground block. */
export function refTurns(ground) {
  const shots = ground?.perShot ?? [];
  const found = (ground?.cuts ?? []).filter((c) => c.dE >= ground.changeDE).sort((a, b) => b.dE - a.dE).slice(0, REF_TURNS_MAX).sort((a, b) => a.at - b.at);
  return found.flatMap((c) => {
    const i = shots.findIndex((s) => s.t0 === c.at);
    const [before, after] = [shots[i - 1], shots[i]];
    return i > 0 && before?.start && after?.start ? [`${c.at} s (hue ${before.hue} to ${after.hue}, L ${Math.round(before.L)} to ${Math.round(after.L)})`] : [];
  });
}

/** The advice lines for a draft of `endSec` seconds: [] when the ground turns. One hue family is the house default, so the line comes only when the brief names a reference (`ref` is { id, ground }) to compare with; null gives []. */
export function groundHueLines(perShot, endSec, ref = null) {
  const family = ref && hueFamily(perShot, endSec);
  if (!family) return [];
  const where = `from ${family.from} s to ${family.to.toFixed(1)} s`;
  const turns = refTurns(ref.ground);
  const pointer = turns.length ? `reference ${ref.id} turns its ground at ${turns.join(', ')}` : `reference ${ref.id} has no ground change that its spec records`;
  return [`ground-hue: the ground of ${family.shots} worlds stays in one hue family (hue ${family.hue[0]} to ${family.hue[1]} degrees, L ${family.light[0]} to ${family.light[1]}), ${where}; the judge scores this as one colour scale. ${pointer}`];
}
