// The motion lint: advice lines on how a page moves, each with its taste rule id, the second and
// one fix. collectMotion runs in the page and reads Web Animations; recordsFromBoxes infers the same
// records from element boxes over time (harness/lib/box-track.mjs) for a page that paints in window.seek
// or vawe.onFrame. Everything else is pure over the records.
import LIMITS from '../../taste/build/limits.json' with { type: 'json' };
import { isWaived } from './waivers.mjs';
import { CLIP_SKIP_RULES } from './clip-demo.mjs';
import { DECORATIVE } from './draft-check.mjs';
import { BANDS, bandOf } from '../../core/motion/presets.js';
import { CUT, moves, moveProps, moveParts, entering, exiting, measured, byTarget, easeName, moveDirection } from './motion-records.mjs';
import { motionVariety } from './motion-variety.mjs';
import { NO_RECORDS_NOTE } from './slideshow.mjs';
import { easeRef, jobLine, jobOf } from '../../core/motion/ease-jobs.js';
import { isCameraMove } from './camera-moves.mjs';

export { moveDirection };

// motionRecord and collectMotion run inside the page (runMotionCollector bundles their source with DECORATIVE),
// so each is self-contained: no other outer bindings.
export function motionRecord(a, k, area) {
  const skip = ['offset', 'computedOffset', 'easing', 'composite'];
  const e = a.effect, el = e.target, t = e.getComputedTiming(), kfs = e.getKeyframes();
  const withOpacity = kfs.filter((f) => f.opacity != null);
  const box = el.getBoundingClientRect();
  const text = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 18);
  const kf = {};
  const props = ['scale', 'translate', 'rotate', 'transform', 'filter', 'clipPath', 'maskImage', 'maskPosition'];
  for (const p of props) {
    const vs = kfs.map((f) => f[p]).filter((v) => v != null && v !== '');
    if (vs.length) kf[p] = [String(vs[0]), String(vs[vs.length - 1])];
  }
  const stops = kfs.map((f) => Object.fromEntries([['offset', f.computedOffset], ...props.filter((p) => f[p] != null && f[p] !== '').map((p) => [p, String(f[p])])]));
  const cls = typeof el.className === 'string' && el.className ? `.${el.className.trim().split(/\s+/)[0]}` : '';
  return {
    target: k, label: `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : cls}${text ? ` "${text}"` : ''}`,
    id: a.id || a.animationName || '', props: [...new Set(kfs.flatMap((f) => Object.keys(f).filter((p) => !skip.includes(p))))],
    delay: (t.delay || 0) / 1000, duration: (t.duration || 0) / 1000,
    easing: t.easing || 'linear', kfEasings: kfs.map((f) => f.easing || 'linear'),
    opacity: withOpacity.length ? [Number(withOpacity[0].opacity), Number(withOpacity[withOpacity.length - 1].opacity)] : null,
    from: String((kfs[0] && (kfs[0].translate || kfs[0].transform || kfs[0].clipPath)) || ''), kf, stops,
    fullFrame: box.width * box.height >= 0.6 * area, area: Math.round(box.width * box.height),
    decorative: Boolean(el.closest(DECORATIVE)),
    ...likeness(el),
  };
}

// kind groups like elements (a data-role, else the tag and class list); uniform marks a copied product surface. Bundled into the page with motionRecord.
export function likeness(el) {
  const role = el.getAttribute('data-role');
  const classes = [...el.classList].sort().join('.');
  return {
    kind: role ? `role ${role}` : `${el.tagName.toLowerCase()}${classes ? `.${classes}` : ''}`,
    uniform: Boolean(el.closest('[data-chrome]')) || document.documentElement.getAttribute('data-look') === 'product',
  };
}

export function collectMotion() {
  const targets = [];
  const records = [];
  for (const a of document.getAnimations()) {
    if (!a.effect || !a.effect.target || !a.effect.getKeyframes) continue;
    let k = targets.indexOf(a.effect.target);
    if (k < 0) k = targets.push(a.effect.target) - 1;
    records.push(motionRecord(a, k, innerWidth * innerHeight));
  }
  return { records, scripted: typeof window.seek === 'function' || (window.__vaweFrameHooks || []).length > 0 };
}

const COLLECTOR = `const DECORATIVE = ${JSON.stringify(DECORATIVE)};\n${[likeness, motionRecord, collectMotion].map((fn) => fn.toString()).join('\n')}`;

/** { records, scripted } from a loaded page. Call it before any seek past the start: a finished fill-none animation drops out of getAnimations. */
export function runMotionCollector(page) {
  return page.evaluate((src) => new Function(`${src}\nreturn collectMotion();`)(), COLLECTOR);
}

const LINEAR_LIMIT = LIMITS['named-eases'].linear_move_limit_s;
const FINAL_FPS = 60;
const MIN_GAP_S = 0.002;
const KEYWORDS = new Set(['linear', 'ease', 'ease-in', 'ease-out', 'ease-in-out']);
const onKeywords = (r) => [r.easing, ...r.kfEasings].every((e) => KEYWORDS.has(e));
const isLinear = (r) => [r.easing, ...r.kfEasings].every((e) => e === 'linear');
const s2 = (x) => x.toFixed(2);

/** An exit that runs as long as or longer than its entrance, per element (rule exits-shorter). Decorative elements and sampled runs under two samples are not measured. */
export function exitLength(records) {
  const out = [];
  for (const rs of byTarget(records.filter((r) => !r.decorative))) {
    const ins = rs.filter((r) => entering(r) && r.duration > CUT && measured(r)), outs = rs.filter((r) => exiting(r) && r.duration > CUT && measured(r));
    if (!ins.length || !outs.length) continue;
    const came = Math.max(...ins.map((r) => r.duration)), exit = outs.reduce((a, r) => (r.duration > a.duration ? r : a));
    if (exit.duration >= came) out.push({ code: 'exit-length', rule: 'exits-shorter', at: exit.delay,
      what: `${exit.label} leaves in ${s2(exit.duration)} s, its entrance took ${s2(came)} s`,
      fix: 'leave(el) from core/motion/presets.js: 0.6 of the entrance, accelerating' });
  }
  return out;
}

/** Three or more elements whose entrances land on one frame at 60 fps (rule stagger). */
export function groupLanding(records) {
  const frames = new Map();
  for (const rs of byTarget(records)) {
    const ins = rs.filter((r) => entering(r) && r.duration > CUT);
    if (!ins.length) continue;
    const land = Math.max(...ins.map((r) => r.delay + r.duration));
    const f = Math.round(land * FINAL_FPS);
    (frames.get(f) || frames.set(f, []).get(f)).push(ins[0].label);
  }
  return [...frames].filter(([, labels]) => labels.length >= LIMITS.stagger.same_frame_group).map(([f, labels]) => ({
    code: 'group-landing', rule: 'stagger', at: f / FINAL_FPS,
    what: `${labels.length} elements land on one frame (${labels.slice(0, 3).join(', ')})`,
    fix: 'stagger(els) from core/motion/presets.js: 30 to 80 ms apart',
  }));
}

const gapsText = (gaps) => {
  const [lo, hi] = [Math.min(...gaps), Math.max(...gaps)].map((g) => Math.round(g * 1000));
  return lo === hi ? `${lo} ms` : `${lo} to ${hi} ms`;
};

/** Entrances that start closer than the stagger floor (rule stagger): one finding per run of siblings, from its first start. Sampled runs are not measured: their step is wider than the gap. */
export function tightStagger(records) {
  const floor = LIMITS.stagger.gap_min_s;
  const starts = byTarget(records.filter((r) => !r.step))
    .map((rs) => rs.filter((r) => entering(r) && r.duration > CUT).map((r) => r.delay))
    .filter((ds) => ds.length).map((ds) => Math.min(...ds)).sort((a, b) => a - b);
  const runs = [];
  starts.slice(1).forEach((t, i) => {
    const gap = t - starts[i];
    if (gap < MIN_GAP_S || gap >= floor) return;
    const run = runs.at(-1);
    if (run && run.last === starts[i]) Object.assign(run, { last: t, n: run.n + 1, gaps: [...run.gaps, gap] });
    else runs.push({ at: starts[i], last: t, n: 2, gaps: [gap] });
  });
  return runs.map((r) => ({
    code: 'stagger-gap', rule: 'stagger', at: r.at,
    what: `${r.n} elements start ${gapsText(r.gaps)} apart, under the ${Math.round(floor * 1000)} ms floor`,
    fix: 'stagger(els) from core/motion/presets.js: 30 to 80 ms apart',
  }));
}

const EASE_ADVICE = 'easing: EASE.land to arrive, EASE.leave or EASE.launch to exit, EASE.glide for a drift (core/motion/presets.js), or enter(el)';
const CAMERA_LONG_S = 2;
const JOBS_DOC = 'the ease for each job: taste/craft/motion-craft.md';

const entranceLine = () => `Entrance: ${easeRef(jobOf('title').ease)}, ${jobOf('title').time} for a title, ${jobOf('panel').time} for a panel`;

export function easeFix(r) {
  if (exiting(r)) return `${jobLine('exit')} (${JOBS_DOC})`;
  if (entering(r)) return `${entranceLine()} (${JOBS_DOC})`;
  if (isCameraMove(r)) return `${jobLine(r.duration < CAMERA_LONG_S ? 'camera-short' : 'camera-long')} (${JOBS_DOC})`;
  return `${EASE_ADVICE}; ${JOBS_DOC}`;
}

/** A move longer than 0.3 s on linear easing, or on a default CSS keyword (ease, ease-in-out) with no curve of its own (rule named-eases). */
export function linearMove(records) {
  return records.filter((r) => moves(r) && r.duration > LINEAR_LIMIT && onKeywords(r)).map((r) => {
    const linear = isLinear(r);
    return { code: linear ? 'linear-move' : 'default-ease', rule: 'named-eases', at: r.delay,
      what: `${r.label} moves ${moveProps(r).join(',')} for ${s2(r.duration)} s on ${linear ? 'linear' : `the CSS keyword ${[r.easing, ...r.kfEasings].find((e) => e !== 'linear')}`} easing`,
      fix: easeFix(r) };
  });
}

/** The full-frame moves of a film as seams: records that start within one cut length of each other are one seam, with the moves they make. Texture is no seam. */
function seamsOf(records) {
  const timed = records.filter((r) => r.fullFrame && !r.decorative && r.duration > CUT).sort((a, b) => a.delay - b.delay);
  const seams = [];
  for (const r of timed) {
    const parts = moveParts(r);
    if (!parts.length) continue;
    const last = seams.at(-1);
    if (last && r.delay - last.at <= CUT) last.parts.push(...parts); else seams.push({ at: r.delay, parts });
  }
  return seams.map(({ at, parts }) => {
    const unique = [...new Map(parts.map((p) => [p.key, p])).values()];
    return { at, key: unique.map((p) => p.key).sort().join(' + '), text: unique.map((p) => p.text).join(', ') };
  });
}

/** The same full-frame transition move twice in a row, read from the animation's own keyframes; hard cuts are not moves (rule seam-variety). */
export function seamRepeat(records) {
  const seams = seamsOf(records);
  const out = [];
  for (let i = 1; i < seams.length; i++) {
    const [a, b] = [seams[i - 1], seams[i]];
    if (a.key === b.key) out.push({ code: 'seam-repeat', rule: 'seam-variety', at: b.at,
      what: `the seam at ${s2(b.at)} s repeats the one at ${s2(a.at)} s (${b.text})`,
      fix: 'change the axis or direction, or cut: a wipe on x after a push on y' });
  }
  return out;
}

/** Every timed move in one speed band. A page that paints in onFrame or seek is not measured here (rule speed-bands). */
export function oneBand(records, { scripted = false } = {}) {
  const timed = records.filter((r) => r.duration > CUT && (moves(r) || r.opacity));
  if (scripted || timed.length < 2) return [];
  const bands = new Set(timed.map((r) => bandOf(r.duration)));
  if (bands.size > 1) return [];
  const [band] = bands;
  return [{ code: 'one-band', rule: 'speed-bands', at: Math.min(...timed.map((r) => r.delay)),
    what: `all ${timed.length} timed moves sit in the ${band} band (${BANDS[band].join(' to ')} s)`,
    fix: 'give the hero gravity or cinematic and a payoff energy: the slowest beat at least 3x the fastest' }];
}

const SIZE = LIMITS['speed-bands'];

/** A small element on a longer move than a large one (rule speed-bands): the large is area_ratio times the area of the small and moves in under 1/duration_ratio of its time. The worst pair, one finding. */
export function durationSize(records) {
  const timed = records.filter((r) => !r.decorative && !r.fullFrame && r.area > 0 && r.duration > CUT && moves(r) && entering(r) && (!r.step || r.duration >= 2 * r.step));
  let worst = null;
  for (const big of timed) for (const small of timed) {
    if (big.target === small.target || big.area < SIZE.area_ratio * small.area || small.duration < SIZE.duration_ratio * big.duration) continue;
    const gap = small.duration / big.duration;
    if (!worst || gap > worst.gap) worst = { big, small, gap };
  }
  if (!worst) return [];
  const { big, small } = worst;
  return [{ code: 'duration-size', rule: 'speed-bands', at: small.delay,
    what: `${small.label} (${Math.round(small.area / 1000)}k px2) moves for ${s2(small.duration)} s, ${big.label} (${Math.round(big.area / 1000)}k px2, ${Math.round(big.area / small.area)} times larger) for ${s2(big.duration)} s`,
    fix: 'a large element needs the longer move: give the small one the faster band, or the large one gravity' }];
}

// Box noise under these is no motion: sub-pixel layout jitter and colour-rounding of opacity.
const STILL_PX = 0.25;
const STILL_ALPHA = 0.005;
const SEEN = 0.05;
const LINEAR_CV = 0.15;

const boxMoved = (a, b, px = STILL_PX) => Math.abs(a[0] - b[0]) > px || Math.abs(a[1] - b[1]) > px || Math.abs(a[2] - b[2]) > px || Math.abs(a[3] - b[3]) > px;

/** The element's own motion: its box in its parent's frame (the parent's move and scale undone) and its own opacity. */
export function ownTrack(track, parentTrack) {
  if (!parentTrack) return track.map((b) => b.slice(0, 5));
  const [w0, h0] = [parentTrack[0][2], parentTrack[0][3]];
  return track.map((b, k) => {
    const [px, py, pw, ph] = parentTrack[k];
    const sx = w0 > 0 && pw > 0 ? w0 / pw : 1, sy = h0 > 0 && ph > 0 ? h0 / ph : 1;
    return [(b[0] - px) * sx, (b[1] - py) * sy, b[2] * sx, b[3] * sy, b[5]];
  });
}

/** Runs of changing samples as [first step, last step], one quiet step allowed inside a run. */
function activeRuns(track) {
  const runs = [];
  for (let k = 1; k < track.length; k++) {
    const moving = boxMoved(track[k], track[k - 1]) || Math.abs(track[k][4] - track[k - 1][4]) > STILL_ALPHA;
    if (!moving) continue;
    const last = runs.at(-1);
    if (last && k - last[1] <= 2) last[1] = k; else runs.push([k, k]);
  }
  return runs;
}

function stepSpeeds(track, a, b) {
  const out = [];
  for (let k = a; k <= b; k++) {
    const [p, q] = [track[k - 1], track[k]];
    const px = Math.max(Math.hypot(q[0] - p[0], q[1] - p[1]), Math.abs(q[2] - p[2]), Math.abs(q[3] - p[3]));
    out.push(px > STILL_PX ? px : Math.abs(q[4] - p[4]) * 100);
  }
  return out;
}

/** Constant speed through the run's middle: the coefficient of variation of its inner steps is small. */
function looksLinear(speeds) {
  const inner = speeds.slice(1, -1);
  if (inner.length < 4) return false;
  const mean = inner.reduce((x, y) => x + y, 0) / inner.length;
  const sd = Math.sqrt(inner.reduce((x, y) => x + (y - mean) ** 2, 0) / inner.length);
  return mean > 0 && sd / mean < LINEAR_CV;
}

export function inFrame(b, { width, height }) {
  return b[2] > 0 && b[3] > 0 && b[0] < width && b[1] < height && b[0] + b[2] > 0 && b[1] + b[3] > 0 && b[4] > SEEN;
}

function runRecord(boxes, i, own, [a, b]) {
  const track = boxes.tracks[i];
  const [s, e] = [own[a - 1], own[b]];
  const moved = boxMoved(s, e, 1);
  const fade = Math.abs(e[4] - s[4]) > SEEN;
  const [before, after] = [inFrame(track[a - 1], boxes), inFrame(track[b], boxes)];
  const linear = looksLinear(stepSpeeds(own, a, b));
  return {
    target: i, label: boxes.labels[i], id: !before && after ? 'enter' : before && !after ? 'leave' : '',
    props: [...(moved ? ['transform'] : []), ...(fade ? ['opacity'] : [])],
    delay: boxes.times[a - 1], duration: boxes.times[b] - boxes.times[a - 1],
    easing: linear ? 'linear' : 'inferred', kfEasings: [linear ? 'linear' : 'inferred'],
    opacity: fade ? [s[4], e[4]] : null,
    from: moved ? `translate(${(s[0] - e[0]).toFixed(1)}px, ${(s[1] - e[1]).toFixed(1)}px)` : '',
    kf: moved ? { translate: [`${s[0].toFixed(1)}px ${s[1].toFixed(1)}px`, `${e[0].toFixed(1)}px ${e[1].toFixed(1)}px`], ...(Math.abs(e[2] - s[2]) > 1 && s[2] > 0 ? { scale: [String(+(s[2] / e[2]).toFixed(3)), '1'] } : {}) } : {},
    fullFrame: Math.max(track[a - 1][2] * track[a - 1][3], track[b][2] * track[b][3]) >= 0.6 * boxes.area,
    area: Math.round(Math.max(track[a - 1][2] * track[a - 1][3], track[b][2] * track[b][3])),
    step: boxes.times[1] - boxes.times[0],
  };
}

/** Motion records inferred from box tracks: one per run of an element's own change; riding its parent is not its own. */
export function recordsFromBoxes(boxes) {
  const out = [];
  boxes.tracks.forEach((track, i) => {
    if (track.length < 2 || !track.some((b) => inFrame(b, boxes))) return;
    const own = ownTrack(track, boxes.tracks[boxes.parent[i]]);
    for (const run of activeRuns(own)) out.push(runRecord(boxes, i, own, run));
  });
  return out.filter((r) => r.props.length);
}

/** Animation records and box-inferred records in one list: the two sources number their targets from 0, so the second set moves up. */
export function mergeRecords(animated, sampled) {
  const base = Math.max(-1, ...animated.map((r) => r.target)) + 1;
  return [...animated, ...sampled.map((r) => ({ ...r, target: r.target + base }))];
}

/** The records of a probed page, or null when it paints in seek(t) and no boxes were sampled: nothing then sees its motion. */
export const sightedRecords = (motion) => {
  if (motion.scripted && !motion.boxes) return null;
  return motion.boxes ? mergeRecords(motion.records, recordsFromBoxes(motion.boxes)) : motion.records;
};

/** One line naming the checks that cannot run on a page that paints in seek(t) or vawe.onFrame with no boxes sampled; [] otherwise. */
export const unseenMotionLines = (motion) => (sightedRecords(motion) === null ? [NO_RECORDS_NOTE] : []);

const median = (xs) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.floor((xs.length - 1) / 2)] : null);
const mostCommon = (xs) => [...new Set(xs)].sort((a, b) => xs.filter((x) => x === b).length - xs.filter((x) => x === a).length)[0] ?? null;
const SIBLING_MAX_S = 0.2;

/**
 * What the page's moves measure for the signature dials: { band, ease, stagger }, each null when nothing measures it.
 * band is the band of the median move duration; ease the most common EASE name on entering moves (null on an inferred
 * or unnamed curve); stagger the median ms between the starts of entering moves that follow each other within 0.2 s.
 */
export function measureMotion(records) {
  const own = records.filter((r) => !r.decorative && r.duration > CUT && moves(r));
  const secs = median(own.map((r) => r.duration));
  const starts = own.filter(entering).map((r) => r.delay).sort((a, b) => a - b);
  const gaps = starts.slice(1).map((t, i) => t - starts[i]).filter((g) => g > 0.005 && g <= SIBLING_MAX_S);
  const names = own.filter(entering).map(easeName).filter(Boolean);
  const gap = median(gaps);
  return { band: secs == null ? null : bandOf(secs), ease: mostCommon(names), stagger: gap == null ? null : Math.round(gap * 1000), medianS: secs == null ? null : +secs.toFixed(2) };
}

/** Every lint finding, in time order. */
export function motionLint({ records, scripted }) {
  return [...exitLength(records), ...groupLanding(records), ...tightStagger(records), ...linearMove(records), ...seamRepeat(records), ...oneBand(records, { scripted }), ...durationSize(records), ...motionVariety(records)]
    .sort((a, b) => a.at - b.at);
}

/** Drops a finding the page waives: authoring.allow holds its code or its rule id, bare or as code@<second or range>, with a _why. */
export function unwaived(findings, authoring = {}) {
  const waived = (f) => isWaived(authoring, f.code, s2(f.at)) || isWaived(authoring, f.rule, s2(f.at));
  return findings.filter((f) => !(authoring._clip && CLIP_SKIP_RULES.has(f.rule)) && !waived(f));
}

/** One printed line per finding. */
export function lintLines(findings) {
  return findings.map((f) => `rule ${f.rule} @${s2(f.at)}s ${f.code}: ${f.what}; fix: ${f.fix}`);
}
