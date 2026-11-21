// The slideshow tells of taste/craft/transitions.md "Banned (slideshow tells)", measured. Pure: world rows (timeline.mjs worldRows),
// motion records (motion-records.mjs), detected transitions (ref-measure/transition.mjs findTransitions, or null with no video) and static runs
// (scene-stats staticRuns, or null) in; { score, of, tells } out, each tell { code, at: [seconds], what, fix }. Advice only.
// Thresholds are conservative on purpose: a tell needs a repeated pattern (3 or more cuts, 5 or more elements, a 75 percent share), so
// films/examples/colour-sting and tracking-hud stay clean (tests/lib/slideshow.test.mjs reads their pages' shape through the same rules).
import { CUT, entering, exiting, moveParts, movesBetween } from './motion-records.mjs';
import { scenesOf } from './motion-variety.mjs';

export const MIN_REPEATS = 3;
export const SHARE = 0.75;
export const SAME_KIND_SHARE = 0.85;
export const SAME_KIND_MIN = 5;
export const EQUAL_SPREAD = 0.15;
export const STATIC_SHARE = 0.25;
export const CARRY_MARGIN_S = 0.1;
export const CARRY_WINDOW_S = 0.3;
export const DRIFT_SHARE = 0.8;
export const AT_ONCE_S = 0.04;
export const SPARSE_MAX = 2;

const r2 = (x) => Math.round(x * 100) / 100;
const own = (records) => records.filter((r) => !r.decorative && r.duration > CUT);
// An entrance is every entering record of one element that starts with its first: enter() runs the move and its fade as two animations,
// so the fade alone is the kind only when nothing moves with it.
const kindOf = (r) => {
  const keys = [...new Set((r.together ?? [r]).flatMap((x) => moveParts(x).map((p) => p.key)))];
  const moved = keys.filter((k) => !k.startsWith('fade '));
  return (moved.length ? moved : keys).sort().join(' + ') || 'none';
};
const mostCommon = (xs) => {
  const n = new Map();
  for (const x of xs) n.set(x, (n.get(x) ?? 0) + 1);
  return [...n].sort((a, b) => b[1] - a[1])[0] ?? [null, 0];
};
function firstPerTarget(rs) {
  const first = new Map();
  for (const r of [...rs].sort((a, b) => a.delay - b.delay)) {
    const had = first.get(r.target);
    if (!had) first.set(r.target, { ...r, together: [r] });
    else if (r.delay - had.delay <= AT_ONCE_S) had.together.push(r);
  }
  return [...first.values()];
}
const worldIndex = (worlds, t) => worlds.reduce((k, w, i) => (w.start <= t + 1e-9 ? i : k), 0);
const boundaries = (worlds) => worlds.slice(1).map((w, i) => ({ at: w.start, a: worlds[i], b: w }));
const mostly = (flags) => flags.length >= MIN_REPEATS && flags.filter(Boolean).length / flags.length >= SHARE;

function sameEntrance(records) {
  const enters = firstPerTarget(own(records).filter(entering));
  const [kind, n] = mostCommon(enters.map(kindOf));
  if (enters.length < SAME_KIND_MIN || n / enters.length < SAME_KIND_SHARE) return null;
  return { code: 'same-entrance', at: [r2(enters[0].delay)], what: `${n} of ${enters.length} elements enter with one move (${kind})`,
    fix: 'vary the moves of the hero, the support and the detail; stagger them' };
}

function sameInOut(worlds, records) {
  if (worlds.length < MIN_REPEATS) return null;
  const rs = own(records);
  const pairs = worlds.map((w, i) => {
    const inside = (r) => worldIndex(worlds, r.delay) === i;
    return [mostCommon(firstPerTarget(rs.filter(entering).filter(inside)).map(kindOf))[0], mostCommon(rs.filter(exiting).filter(inside).map(kindOf))[0]];
  });
  const both = pairs.filter(([, o]) => o);
  if (pairs.some(([i]) => !i) || both.length < MIN_REPEATS || new Set(both.map((p) => p.join('|'))).size !== 1) return null;
  return { code: 'same-in-out', at: worlds.map((w) => r2(w.start)), what: `every scene enters with ${pairs[0][0]} and exits with ${pairs[0][1]}`,
    fix: 'change the way in or out per scene; exits shorter and faster than entrances' };
}

const share = (transitions, type) => transitions.filter((t) => t.type === type);

function crossfadeEvery(transitions, fps) {
  const fades = share(transitions, 'crossfade');
  if (!mostly(transitions.map((t) => t.type === 'crossfade'))) return null;
  return { code: 'crossfade-every-cut', at: fades.map((t) => r2(t.startFrame / fps)), what: `${fades.length} of ${transitions.length} cuts are crossfades`,
    fix: 'carry one handoff object across the cut (skills/vawe-transitions/SKILL.md), or cut on a beat' };
}

function cutAndFadeIn(worlds, records, transitions, fps) {
  const rs = own(records).filter(entering);
  const fadeFirst = worlds.map((w, i) => { const first = firstPerTarget(rs.filter((r) => worldIndex(worlds, r.delay) === i))[0]; return Boolean(first) && kindOf(first) === 'fade in'; });
  if (!mostly(transitions.map((t) => t.type === 'cut')) || !mostly(fadeFirst)) return null;
  return { code: 'cut-and-fade-in', at: worlds.filter((w, i) => fadeFirst[i]).map((w) => r2(w.start)), what: `hard cuts, and ${fadeFirst.filter(Boolean).length} of ${worlds.length} scenes open on a fade in`,
    fix: 'open the scene on the carried object landing, not on a fade' };
}

// A handoff is visible on both sides of the cut and moves in the window around it. One animation over most of the film is a drift, never a handoff.
function swapNoCarry(worlds, records) {
  const film = worlds.at(-1).end - worlds[0].start;
  const rs = own(records).filter((r) => !r.fullFrame && !(r.duration >= DRIFT_SHARE * film && (r.stops ?? []).length <= 2));
  const bs = boundaries(worlds);
  const carried = bs.map((b) => rs.some((r) => r.delay < b.at - CARRY_MARGIN_S && r.delay + r.duration > b.at + CARRY_MARGIN_S
    && movesBetween(r, b.at - CARRY_WINDOW_S, b.at + CARRY_WINDOW_S).length > 0));
  if (!mostly(carried.map((c) => !c))) return null;
  return { code: 'swap-no-carry', at: bs.filter((b, i) => !carried[i]).map((b) => r2(b.at)), what: `${carried.filter((c) => !c).length} of ${bs.length} cuts swap the whole frame with no element carried across`,
    fix: 'name a handoff object that leaves A and starts B (taste/craft/transitions.md families)' };
}

function deadGap(worlds, records) {
  const rs = own(records);
  const bs = boundaries(worlds);
  const dead = bs.map((b, i) => {
    const out = rs.filter(exiting).filter((r) => worldIndex(worlds, r.delay) === i);
    const next = firstPerTarget(rs.filter(entering).filter((r) => worldIndex(worlds, r.delay) === i + 1))[0];
    return out.length > 0 && Boolean(next) && next.delay >= Math.max(...out.map((r) => r.delay + r.duration));
  });
  if (!mostly(dead)) return null;
  return { code: 'dead-gap', at: bs.filter((b, i) => dead[i]).map((b) => r2(b.at)), what: `${dead.filter(Boolean).length} of ${bs.length} cuts start the next scene only after the last one fully left`,
    fix: 'overlap 0.2 to 0.4 s: the next scene starts while the last one exits' };
}

function allAtOnce(records) {
  const scenes = scenesOf(records).map((s) => {
    const enters = firstPerTarget(s.records.filter(entering));
    return { at: s.at, hit: enters.length >= MIN_REPEATS && enters.every((r) => Math.abs(r.delay - enters[0].delay) <= AT_ONCE_S) && new Set(enters.map(kindOf)).size === 1 };
  });
  if (!mostly(scenes.map((s) => s.hit))) return null;
  return { code: 'all-at-once', at: scenes.filter((s) => s.hit).map((s) => r2(s.at)), what: `${scenes.filter((s) => s.hit).length} of ${scenes.length} scenes bring every element in on one frame with one move`,
    fix: 'stagger the entrances by 30 to 80 ms and give the hero a different move from the support' };
}

function oneThingScenes(worlds, records) {
  const rs = own(records);
  const sparse = worlds.map((w, i) => new Set(rs.filter((r) => worldIndex(worlds, r.delay) === i).map((r) => r.target)).size <= SPARSE_MAX);
  if (!mostly(sparse)) return null;
  return { code: 'one-thing-scenes', at: worlds.filter((w, i) => sparse[i]).map((w) => r2(w.start)), what: `${sparse.filter(Boolean).length} of ${worlds.length} scenes animate ${SPARSE_MAX} elements or fewer`,
    fix: 'give each scene a supporting part that moves while the line is read' };
}

function equalShots(worlds) {
  if (worlds.length < MIN_REPEATS) return null;
  const cuts = worlds.slice(0, -1).map((w) => w.cut);
  if (cuts.length < MIN_REPEATS - 1) return null;
  const mean = cuts.reduce((s, x) => s + x, 0) / cuts.length;
  if ((Math.max(...cuts) - Math.min(...cuts)) / mean > EQUAL_SPREAD) return null;
  return { code: 'equal-shots', at: worlds.map((w) => r2(w.start)), what: `all ${cuts.length} shots last ${r2(Math.min(...cuts))} to ${r2(Math.max(...cuts))} s`,
    fix: 'vary the lengths: let one cut breathe about 0.5 s longer than the rest' };
}

function staticHolds(staticRuns, duration) {
  if (!staticRuns || !(duration > 0)) return null;
  const total = staticRuns.reduce((s, r) => s + r.len, 0);
  if (total / duration < STATIC_SHARE) return null;
  return { code: 'static-holds', at: staticRuns.map((r) => r.a), what: `${r2(total)} s of ${r2(duration)} s hold with nothing moving`,
    fix: 'keep a part moving inside every hold (a counter, a caret, a light)' };
}

export const NO_RECORDS_NOTE = 'checks skipped: slideshow entrance and exit tells, arrival and exit lint (the page paints in seek(t) or vawe.onFrame and no element boxes were sampled, so no motion is seen)';

/**
 * { score, of, tells, skipped } of a film. `transitions` and `staticRuns` may be null (no video): the tells that need them are skipped.
 * `records` null means no source could see the motion: the tells that read entrances and exits are skipped, never fired on nothing.
 */
export function slideshowTells({ worlds, records, transitions = null, staticRuns = null, duration = 0, fps = 30 }) {
  const many = worlds.length >= MIN_REPEATS + 1;
  const video = transitions && transitions.length >= MIN_REPEATS;
  const seen = records !== null;
  const tells = [
    seen && sameEntrance(records),
    seen && many && sameInOut(worlds, records),
    video && crossfadeEvery(transitions, fps),
    seen && video && cutAndFadeIn(worlds, records, transitions, fps),
    seen && many && swapNoCarry(worlds, records),
    seen && many && deadGap(worlds, records),
    seen && allAtOnce(records),
    seen && many && oneThingScenes(worlds, records),
    equalShots(worlds),
    staticHolds(staticRuns, duration),
  ].filter(Boolean);
  return { score: tells.length, of: 10, tells, skipped: !seen };
}

/** The advice lines of a result: a score line, then each tell with its seconds and fix. [] when none fired. */
export function slideshowLines({ score, of, tells }) {
  if (!score) return [];
  return [`slideshow: score ${score}/${of}`, ...tells.map((t) => `slideshow: ${t.code} at ${t.at.slice(0, 6).join(', ')} s: ${t.what}. Fix: ${t.fix}`)];
}
