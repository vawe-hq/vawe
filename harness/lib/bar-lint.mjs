// Five advice findings from the measured bar of the reference films (harness/dev/bar-from-refs.mjs), in the shape of the motion
// lint's: { code, rule, at, what, fix }. The code is the rule id. Each number is read from taste/build/limits.json. Pure.
//   speed-ceiling    the fastest tenth of the moving elements, from element boxes over time
//   spectacle-weak   the page's spectacle second moves slower than another moment, or less than exaggeration_min times the median mover, from the same boxes
//   overshoot-share  too large a share of the arrivals goes past rest, from the animation records
//   text-breathing   the share of the film with readable text on screen, from the text samples
//   text-lingers     a line on screen well past its read time, from the text tracks
//   dead-stop        an element that stops from a speed over the jolt limit within one step, from element boxes (rule live-hold)
//   staging          a beat of several movers where none owns the motion, from the move runs (rule one-hero-motion)
//   anticipation     the spectacle move arrives with no wind-up, from the move run of the hero (rule anticipation)
//   constant-camera  the camera moves for most of the film or for several worlds in a row, from the animation records (rule constant-camera)
import LIMITS from '../../taste/build/limits.json' with { type: 'json' };
import { overshoots } from './ease-curve.mjs';
import { CUT, moves, entering, measured, byTarget } from './motion-records.mjs';
import { ownTrack, inFrame } from './motion-lint.mjs';
import { probeTracks, screenLines, MIN_TEXT_H } from './read-hold.mjs';
import { moveScore, trackPoints } from '../media/see/velocity-math.mjs';
import { cameraLoad } from './camera-moves.mjs';

const SPEED = LIMITS['speed-bands'];
const SHOOT = LIMITS.overshoot;
const BREATH = LIMITS['text-breathing'];
const LINGER = LIMITS['readable-hold'];
const JOLT = LIMITS['live-hold'];
const STAGE = LIMITS['one-hero-motion'];
const WIND = LIMITS.anticipation;
const CAM = LIMITS['constant-camera'];

const STILL_PX = 0.25;
const FULL_FRAME = 0.6;
const s1 = (x) => x.toFixed(1);
const pct = (x) => Math.round(x);
const finding = (code, at, what, fix, rule = code) => ({ code, rule, at, what, fix });

const cornerTravel = (a, b) => {
  const corners = ([x, y, w, h]) => [[x, y], [x + w, y], [x, y + h], [x + w, y + h]];
  const [ca, cb] = [corners(a), corners(b)];
  return Math.max(...cb.map(([x, y], i) => Math.hypot(x - ca[i][0], y - ca[i][1])));
};

const coversFrame = (b, { area }) => b[2] * b[3] >= FULL_FRAME * area;

/** The travel in px of each step of one element in its parent's frame, null where the element is not visible at both ends of the step or covers most of the frame. */
function stepTravels(boxes, i) {
  const track = boxes.tracks[i];
  const own = ownTrack(track, boxes.tracks[boxes.parent[i]]);
  return track.slice(1).map((b, j) => {
    const a = track[j];
    return inFrame(a, boxes) && inFrame(b, boxes) && !coversFrame(a, boxes) && !coversFrame(b, boxes) ? cornerTravel(own[j], own[j + 1]) : null;
  });
}

/** A step much longer than both its neighbours is a jump: the element is replaced, not moved. */
const isJump = (travels, k) => travels[k] > SPEED.isolated_ratio * Math.max(travels[k - 1] ?? 0, travels[k + 1] ?? 0);

/** One element's peak speed in frame heights per second and when it came, or null when it never moves by itself. */
function peakSpeed(boxes, i) {
  const travels = stepTravels(boxes, i);
  let peak = null;
  let moving = 0;
  travels.forEach((px, k) => {
    if (px === null || px <= STILL_PX) return;
    moving += 1;
    if (isJump(travels, k)) return;
    const speed = px / boxes.height / (boxes.times[k + 1] - boxes.times[k]);
    if (!peak || speed > peak.speed) peak = { speed, at: boxes.times[k] };
  });
  return moving >= SPEED.moving_steps_min && peak ? { label: boxes.labels[i], ...peak } : null;
}

/**
 * One element's fastest change of size in frame heights per second and when it came, or null when it never changes size. Read from the box in the
 * frame, not in its parent's: a world that scales out moves every word in it, and a world that covers the frame is still a scale ramp.
 */
function peakScale(boxes, i) {
  const track = boxes.tracks[i];
  const sizes = track.slice(1).map((b, j) => {
    const a = track[j];
    return inFrame(a, boxes) && inFrame(b, boxes) ? Math.max(Math.abs(b[2] - a[2]), Math.abs(b[3] - a[3])) : null;
  });
  let peak = null;
  let moving = 0;
  sizes.forEach((px, k) => {
    if (px === null || px <= STILL_PX) return;
    moving += 1;
    if (isJump(sizes, k)) return;
    const speed = px / boxes.height / (boxes.times[k + 1] - boxes.times[k]);
    if (!peak || speed > peak.speed) peak = { speed, at: boxes.times[k] };
  });
  return moving >= SPEED.moving_steps_min && peak ? { label: boxes.labels[i], ...peak } : null;
}

const n3 = (x) => +x.toFixed(3);
const nearestRank =(sorted, q) => sorted[Math.max(0, Math.ceil(q * sorted.length) - 1)];

const centre = ([x, y, w, h]) => [x + w / 2, y + h / 2];
const ALPHA_IN = 0.5;
const QUIET_STEPS = 3;

/** The runs of one element's moving steps as [first step, last step]; a run ends after QUIET_STEPS steps without motion. */
function moveRuns(travels) {
  const runs = [];
  travels.forEach((px, k) => {
    if (px === null || px <= STILL_PX) return;
    const last = runs.at(-1);
    if (last && k - last[1] <= QUIET_STEPS) last[1] = k; else runs.push([k, k]);
  });
  return runs;
}

/** Does any corner of the box go past its end along the way it came, by more than the tolerance of its travel? A move and a size change both carry the corners. Null when no corner travels far enough to measure. */
function runOvershoots(boxes) {
  const corners = ([x, y, w, h]) => [[x, y], [x + w, y], [x, y + h], [x + w, y + h]];
  const [from, to] = [corners(boxes[0]), corners(boxes.at(-1))];
  const paths = boxes.map(corners);
  const verdicts = to.map((end, c) => {
    const length = Math.hypot(end[0] - from[c][0], end[1] - from[c][1]);
    if (length < SHOOT.min_travel_px) return null;
    const past = Math.max(...paths.map((p) => ((p[c][0] - end[0]) * (end[0] - from[c][0]) + (p[c][1] - end[1]) * (end[1] - from[c][1])) / length));
    return past > Math.max(SHOOT.past_px_min, SHOOT.past_share * length);
  }).filter((v) => v !== null);
  return verdicts.length ? verdicts.some(Boolean) : null;
}

/** The arrivals of one element read from its boxes: a run of motion that starts while the element is faded out and ends faded in. */
function boxArrivals(boxes, i) {
  const track = boxes.tracks[i];
  const own = ownTrack(track, boxes.tracks[boxes.parent[i]]);
  const travels = stepTravels(boxes, i);
  return moveRuns(travels).filter(([a, b]) => track[a][4] < ALPHA_IN && track[b + 1][4] >= ALPHA_IN).map(([a, b]) => ({
    at: boxes.times[a],
    over: runOvershoots(own.slice(a, b + 2)),
  })).filter((r) => r.over !== null);
}

/**
 * What one pass of element boxes (sampleBoxTracks 'visible') says: { peaks: [{ label, speed, at }] slowest first, arrivals: [{ at, over }], stops, runs }.
 * A camera or ground that covers most of the frame, and a step much longer than both its neighbours (an element replaced, a cut), are not speed.
 * An arrival is a run of motion that starts faded out and ends faded in.
 */
export function boxMotion(boxes) {
  const elements = boxes.tracks.map((_, i) => i);
  return {
    peaks: elements.map((i) => peakSpeed(boxes, i)).filter(Boolean).sort((a, b) => a.speed - b.speed),
    scales: elements.map((i) => peakScale(boxes, i)).filter(Boolean).sort((a, b) => a.speed - b.speed),
    arrivals: elements.flatMap((i) => boxArrivals(boxes, i)),
    stops: elements.flatMap((i) => stopsOf(boxes, i)),
    runs: elements.flatMap((i) => runsOf(boxes, i)).sort((a, b) => a.from - b.from),
    span: [boxes.times[0], boxes.times.at(-1)],
  };
}

const REF_HEIGHT = 1080;

/** The stops of one element: a step that holds still right after a step faster than the limit, in px per second of a 1080 high frame. A step much longer than its neighbours is a cut and is not a speed. */
function stopsOf(boxes, i) {
  const travels = stepTravels(boxes, i);
  const k = REF_HEIGHT / boxes.height;
  const out = [];
  for (let s = 1; s < travels.length; s++) {
    const [before, after] = [travels[s - 1], travels[s]];
    if (before === null || after === null || before <= STILL_PX || after > STILL_PX || isJump(travels, s - 1)) continue;
    out.push({ label: boxes.labels[i], at: boxes.times[s], speed: Math.round((before * k) / (boxes.times[s] - boxes.times[s - 1])) });
  }
  return out;
}

/** The part of a run's path against its direction, as a share of its length, and the dip of its size below the start, as a share of the start. Null when the run has no length to measure, or grows from under reveal_from_share of its size (a bloom or a ripple is revealed, not wound up), or covers atmosphere_share of the frame (a light, a ground or a camera carries no weight). */
function windUp(points, sizes) {
  const [from, to] = [points[0], points.at(-1)];
  const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
  if (length < SHOOT.min_travel_px || sizes[0] < WIND.reveal_from_share * sizes.at(-1)) return null;
  const back = Math.max(0, ...points.map((p) => -((p[0] - from[0]) * (to[0] - from[0]) + (p[1] - from[1]) * (to[1] - from[1])) / length));
  const grows = sizes.at(-1) > sizes[0];
  return { counter: back / length, dip: grows ? Math.max(0, 1 - Math.min(...sizes) / sizes[0]) : 0 };
}

/** The runs of motion of one element in its parent's frame: { label, from, to, score (frame heights moved plus size change), counter, dip }. */
function runsOf(boxes, i) {
  const track = boxes.tracks[i];
  const own = ownTrack(track, boxes.tracks[boxes.parent[i]]);
  return moveRuns(stepTravels(boxes, i)).flatMap(([a, b]) => {
    const part = own.slice(a, b + 2);
    const score = moveScore(trackPoints(boxes.times.slice(a, b + 2), part), boxes.height);
    const atmosphere = Math.max(...part.map((p) => p[2] * p[3])) >= WIND.atmosphere_share * boxes.area;
    const wind = atmosphere ? null : windUp(part.map(centre), part.map((p) => Math.sqrt(Math.max(0, p[2] * p[3]))));
    return score > STAGE.mover_floor ? [{ label: boxes.labels[i], from: boxes.times[a], to: boxes.times[b + 1], score: n3(score), counter: wind ? n3(wind.counter) : null, dip: wind ? n3(wind.dip) : null }] : [];
  });
}

const SPECTACLE = LIMITS['spectacle-weak'];
const n1 = (x) => +x.toFixed(1);

/**
 * The page's spectacle second (`<meta name="spectacle">`) against every other moment: the fastest element peak within a window of it, and the
 * fastest peak outside it. Fires when another moment is stronger (rule spectacle-weak). `peaks` is boxMotion's, `span` the seconds the boxes were
 * sampled over: a spectacle second outside them is not measured. `scales` is boxMotion's too: a speed ramp is a scale change, and it counts as a
 * move beside the translations.
 */
export function spectacleWeak(peaks, spectacle, span, scales = []) {
  const moves = [...(peaks ?? []), ...scales];
  if (spectacle == null || !moves.length || (span && (spectacle < span[0] || spectacle > span[1]))) return [];
  const fastest = (list) => list.reduce((best, p) => (!best || p.speed > best.speed ? p : best), null);
  const near = (p) => Math.abs(p.at - spectacle) <= SPECTACLE.window_s;
  const [mine, other] = [fastest(moves.filter(near)), fastest(moves.filter((p) => !near(p)))];
  if (other && (!mine || other.speed >= mine.speed * SPECTACLE.stronger_margin)) return [finding('spectacle-weak', spectacle,
    `spectacle at ${n1(spectacle)} s is weaker than ${n1(other.at)} s: ${mine ? `${mine.label} peaks at ${n1(mine.speed)} frame heights per second there` : 'no element moves there'}, ${other.label} peaks at ${n1(other.speed)} at ${n1(other.at)} s`,
    'give the second named in <meta name="spectacle"> and in the Board the fastest or longest move of the film, with quiet before it')];
  const moving = moves.filter((p) => p.speed >= SPEED.moving_floor_fh_s).map((p) => p.speed).sort((a, b) => a - b);
  if (!mine || moving.length < SPEED.moving_min) return [];
  const median = moving[Math.floor((moving.length - 1) / 2)];
  if (mine.speed >= SPECTACLE.exaggeration_min * median) return [];
  return [finding('spectacle-weak', spectacle,
    `spectacle at ${n1(spectacle)} s peaks at ${n1(mine.speed)} frame heights per second (${mine.label}), only ${(mine.speed / median).toFixed(1)} times the median mover (${n1(median)}); the key moment should reach ${SPECTACLE.exaggeration_min} times`,
    'push the spectacle: a longer travel, a larger scale change or a shorter duration than every other move, with quiet before it')];
}

/** Elements that stop dead: a step faster than the jolt limit (rule live-hold) followed by a step that holds still. `stops` is boxMotion's; a cut is no stop. */
export function deadStop(stops) {
  const jolts = (stops ?? []).filter((s) => s.speed > JOLT.jolt_px_per_s).sort((a, b) => a.at - b.at);
  if (!jolts.length) return [];
  const [first, worst] = [jolts[0], jolts.reduce((m, s) => (s.speed > m.speed ? s : m), jolts[0])];
  const n = new Set(jolts.map((s) => s.label)).size;
  return [finding('dead-stop', first.at,
    `${n} element${n === 1 ? ' stops' : 's stop'} from over ${JOLT.jolt_px_per_s} px/s in one step: ${first.label} at ${first.at.toFixed(2)} s from ${first.speed} px/s${worst === first ? '' : `, worst ${worst.label} ${worst.speed} px/s at ${worst.at.toFixed(2)} s`}`,
    'end the move on EASE.land or a spring so the speed falls to zero; a linear or slow-start curve straight into a hold is the cause', 'live-hold')];
}

/** The runs grouped into beats: runs that start within simultaneous_s of the one before compete at once. A stagger starts its items further apart. */
function beatsOf(runs) {
  const beats = [];
  for (const r of runs) {
    const last = beats.at(-1);
    if (last && r.from - last.at(-1).from <= STAGE.simultaneous_s + 1e-9) last.push(r); else beats.push([r]);
  }
  return beats;
}

/** A beat of movers_min or more movers where the top one owns less than top_share_min of the motion (rule one-hero-motion). `runs` is boxMotion's. */
export function staging(runs) {
  return beatsOf(runs ?? []).filter((b) => b.length >= STAGE.movers_min).flatMap((beat) => {
    const total = beat.reduce((sum, r) => sum + r.score, 0);
    const top = beat.reduce((m, r) => (r.score > m.score ? r : m), beat[0]);
    if (top.score / total >= STAGE.top_share_min) return [];
    return [finding('staging', beat[0].from,
      `${beat.length} elements move together at ${beat[0].from.toFixed(2)} s and none leads: the largest, ${top.label}, owns ${pct((100 * top.score) / total)}% of the motion`,
      'pick one hero for the beat: give it the largest travel, start the others later and move them less', 'one-hero-motion')];
  });
}

/** The spectacle move with no wind-up: the strongest run near the spectacle second has no counter-move or size dip in the ranges of rule anticipation. `runs` is boxMotion's. */
export function anticipation(runs, spectacle, span) {
  if (spectacle == null || !runs?.length || (span && (spectacle < span[0] || spectacle > span[1]))) return [];
  const near = runs.filter((r) => r.from <= spectacle + SPECTACLE.window_s && r.to >= spectacle - SPECTACLE.window_s);
  if (!near.length) return [finding('anticipation', spectacle, `no element moves within ${SPECTACLE.window_s} s of the spectacle second ${n1(spectacle)} s`, 'put the one big move on that second, with its wind-up')];
  const hero = near.reduce((m, r) => (r.score > m.score ? r : m), near[0]);
  if (hero.counter === null) return [];
  const counter = hero.counter >= WIND.counter_floor_pct / 100 && hero.counter <= WIND.counter_travel_pct_max / 100;
  const dips = (r) => r.dip !== null && r.dip >= WIND.dip_pct_min / 100;
  const sharedDip = near.filter((r) => r !== hero && dips(r)).length >= SPECTACLE.shared_dip_min;
  if (counter || (dips(hero) && !sharedDip)) return [];
  return [finding('anticipation', spectacle,
    `the spectacle move (${hero.label}, ${hero.from.toFixed(2)} s) starts with no wind-up: it first moves ${pct(hero.counter * 100)}% of its travel back and dips ${pct(hero.dip * 100)}% in size`,
    `${sharedDip ? 'other movers dip at the same time, so the dip winds up nothing: ' : ''}enter(el, { anticipate: 0.12 }) from core/motion/presets.js adds a counter-move; or dip the hero's own scale 2 to 4% for 4 frames before the move`)];
}

/** The fastest tenth of the moving elements over the speed ceiling (rule speed-bands). `all` is the peaks of boxMotion, or null when the speed was not sampled. An element slower than moving_floor_fh_s is a drift the eye does not follow (the reference films' slowest tracked elements peak near 0.2). */
export function speedCeiling(all, { ceiling = SPEED.ceiling_fh_s } = {}) {
  const peaks = (all ?? []).filter((p) => p.speed >= SPEED.moving_floor_fh_s);
  if (peaks.length < SPEED.moving_min) return [];
  const p90 = nearestRank(peaks, 0.9).speed;
  if (p90 <= ceiling) return [];
  const [first, second] = [peaks.at(-1), peaks.at(-2)];
  return [finding('speed-ceiling', first.at,
    `the fastest tenth of ${peaks.length} moving elements peaks at ${s1(p90)} frame heights per second; the reference films stay under ${ceiling}. Fastest: ${first.label} ${s1(first.speed)} at ${first.at.toFixed(2)} s, then ${second.label} ${s1(second.speed)} at ${second.at.toFixed(2)} s`,
    'give the fastest moves a longer duration (the next speed band) or a shorter distance', 'speed-bands')];
}

const curvesOf = (r) => [r.easing, ...r.kfEasings];

/** Does one arrival (the entering records of one element) overshoot? Null when it has no move or no curve that can be read. */
function arrivalOvershoots(records) {
  const readable = records.filter((r) => moves(r) && measured(r) && curvesOf(r).some((c) => overshoots(c) !== null));
  if (!readable.length) return null;
  return readable.some((r) => curvesOf(r).some((c) => overshoots(c, SHOOT.tolerance)));
}

/** The arrivals of the animation records, one per element: { at, over }. Full-frame elements are not arrivals; aria-hidden elements are. */
function recordArrivals(records) {
  return byTarget(records.filter((r) => !r.fullFrame))
    .map((rs) => rs.filter((r) => entering(r) && r.duration > CUT))
    .filter((rs) => rs.length)
    .map((rs) => ({ at: Math.min(...rs.map((r) => r.delay)), over: arrivalOvershoots(rs) }))
    .filter((a) => a.over !== null);
}

/** The timed arrivals of a page, [{ at, over }]: the animation records when they have any, else the sampled boxes'. No minimum count. */
export const timedArrivals = (records, boxArrivals = []) => {
  const fromRecords = recordArrivals(records);
  return fromRecords.length ? fromRecords : boxArrivals;
};

const countedArrivals = (records, boxArrivals) => {
  const fromRecords = recordArrivals(records);
  const arrivals = fromRecords.length >= SHOOT.arrivals_min ? fromRecords : boxArrivals;
  return arrivals.length < SHOOT.arrivals_min ? [] : arrivals;
};

/** The percent of arrivals that overshoot, counted as overshootShare counts them; null under arrivals_min arrivals. */
export function overshootPct(records, boxArrivals = []) {
  const arrivals = countedArrivals(records, boxArrivals);
  return arrivals.length ? (100 * arrivals.filter((a) => a.over).length) / arrivals.length : null;
}

/**
 * Too many arrivals that overshoot (none is fine: UI, type and devices land without a spring) (rule overshoot). The easing of the animation records decides; a page that paints
 * in window.seek has none, so its arrivals come from the boxes (`boxArrivals`, from boxMotion) when the records give fewer than arrivals_min.
 */
export function overshootShare(records, boxArrivals = []) {
  const arrivals = countedArrivals(records, boxArrivals);
  if (!arrivals.length) return [];
  const over = arrivals.filter((a) => a.over).length;
  const share = (100 * over) / arrivals.length;
  const at = Math.min(...arrivals.map((a) => a.at));
  const counted = `${over} of ${arrivals.length} arrivals overshoot (${pct(share)}%)`;
  if (share > SHOOT.share_max_pct) return [finding('overshoot-share', at, `${counted}; the reference films overshoot 41% at most`,
    'land most arrivals on EASE.land and keep the spring for the one that matters', 'overshoot')];
  return [];
}

const hasText = (s, frameH) => s.lines.some((l) => !l.chrome && l.box && l.box[3] / frameH >= MIN_TEXT_H);

/** The longest run of consecutive samples that satisfy `on`, as { first, count } (first is an index). */
function longestRun(samples, on) {
  let best = { first: 0, count: 0 };
  let run = { first: 0, count: 0 };
  samples.forEach((s, i) => {
    run = on(s) ? { first: run.count ? run.first : i, count: run.count + 1 } : { first: i, count: 0 };
    if (run.count > best.count) best = run;
  });
  return best;
}

/** Readable text on screen for more of the film than the reference films allow (rule text-breathing). A film under film_min_s (the shortest reference film is 19 s) is one beat and has no rest to give. `ctx` is { step, frameH }. */
export function textBreathing(samples, { step, frameH }) {
  if (samples.length * step < BREATH.film_min_s) return [];
  const share = (100 * samples.filter((s) => hasText(s, frameH)).length) / samples.length;
  if (share <= BREATH.text_share_max_pct) return [];
  const run = longestRun(samples, (s) => hasText(s, frameH));
  const from = Math.max(0, samples[run.first].t - step / 2);
  return [finding('text-breathing', from, `readable text is on screen for ${pct(share)}% of the film (${s1(run.count * step)} s in one run from ${s1(from)} s); the reference films stay at ${BREATH.text_share_max_pct}% or less`,
    'leave a beat with no words: let the product or the ground carry it')];
}

/** The most seconds a line may stay on screen: the reference hold, or its read time plus the margin when that is longer. Pure. */
export const lingerCeiling = (need) => Math.max(LINGER.hold_ref_p90_s, need + LINGER.read_margin_s);

/** The line that stays on screen longest past its ceiling (rule readable-hold). A line still on screen at the last sample is the end card (rule cta-last-short) and is not measured. */
export function textLingers(samples, ctx) {
  if (!samples.length) return [];
  const end = samples.at(-1).t + ctx.step / 2;
  const over = screenLines(probeTracks(samples, ctx))
    .filter((l) => l.tOut < end - 1e-6)
    .map((l) => ({ ...l, onScreen: l.tOut - l.tIn, ceiling: lingerCeiling(l.need) }))
    .filter((l) => l.onScreen > l.ceiling)
    .sort((a, b) => b.onScreen - b.ceiling - (a.onScreen - a.ceiling));
  if (!over.length) return [];
  const w = over[0];
  return [finding('text-lingers', w.tIn, `"${w.text.slice(0, 30)}" stays on screen ${s1(w.onScreen)} s; it needs ${s1(w.need)} s to read, so it may stay ${s1(w.ceiling)} s${over.length > 1 ? ` (${over.length} lines)` : ''}`,
    'take the line off at its read time plus 1.5 s, or give the held seconds a second thing to look at', 'readable-hold')];
}

/**
 * A camera that never rests, checked only for a film whose DESIGN.md says `camera: still` (rule constant-camera): whole-frame moves over share_max_pct of the film, or over worlds_max worlds in a row. The move
 * that holds the spectacle second is the one deliberate move and is not counted. `film` is { dur, worlds }; null when the length is not known.
 */
export function constantCamera(records, film, spectacle = null) {
  if (!film?.dur) return [];
  const load = cameraLoad(records, { ...film, spectacle });
  const share = 100 * load.share;
  const over = [];
  if (share > CAM.share_max_pct) over.push(`the camera moves for ${pct(share)}% of the film (limit ${CAM.share_max_pct}%)`);
  if (load.worlds > CAM.worlds_max) over.push(`the camera moves in ${load.worlds} worlds in a row (limit ${CAM.worlds_max})`);
  if (!over.length) return [];
  return [finding('constant-camera', load.first ?? 0, over.join('; '),
    'hold the camera still and give each hold an element motion (a line typing, a counter, a glint, a secondary action); keep one deliberate camera move for the spectacle or a reveal')];
}

/** Every bar finding in time order. `camera` is the camera: line of DESIGN.md (still turns the constant-camera finding on; a camera that eases once per shot is the default and is never flagged). `boxes` is boxMotion of the sampled element boxes, or null when they were not sampled; `text` is { samples, ctx } or null for a window draft. */
export function barLint({ records, boxes, text, spectacle = null, film = null, camera = null }) {
  return [...(camera === 'still' ? constantCamera(records, film, spectacle) : []), ...speedCeiling(boxes?.peaks), ...spectacleWeak(boxes?.peaks, spectacle, boxes?.span, boxes?.scales), ...deadStop(boxes?.stops), ...staging(boxes?.runs), ...anticipation(boxes?.runs, spectacle, boxes?.span), ...overshootShare(records, boxes?.arrivals), ...(text ? [...textBreathing(text.samples, text.ctx), ...textLingers(text.samples, text.ctx)] : [])]
    .sort((a, b) => a.at - b.at);
}
