// The film against the brief's SPEC tables. Every check is { label, spec, got, dev, unit }: `dev` is how far
// the film is from the spec (Infinity when the thing was not found), in `unit`. A time is measured on the frame
// grid by runStart, which looks around the spec time and widens until the run's edge, so the measure does not
// depend on the spec value. The samples are the draft's text probe (harness/media/draft-check.mjs sampleSpec).
import { RULES } from './draft-check.mjs';
import { FPS } from '../media/motion-curve.mjs';
import { biggestJump } from './smoothness.mjs';

const COARSE_FRAMES = 8;
const REST_SHARE = 0.005;
const REST_LOOK_S = 0.25;
const MIN_WORD_CHARS = 2;
export const APPEAR_TOL_S = 0.05;
export const LAYOUT_TOL_PCT = 1;

const round = (t) => +t.toFixed(3);
const norm = (s) => String(s).replace(/\s+/g, ' ').trim().toLowerCase();
const squash = (s) => norm(s).replace(/\s+/g, '');
const has = (v) => typeof v === 'number';

/** False for a Words text too short to find: under 2 letters or digits, or only punctuation. */
export const findable = (text) => String(text).replace(/[^\p{L}\p{N}]/gu, '').length >= MIN_WORD_CHARS;

/** The Words texts that spec checks skip, for the note. Pure. */
export const skippedWords = (words) => words.filter((w) => !findable(w.text)).map((w) => w.text);

/** The seconds to sample: { text: the settle times, boxes: every frame of the film when objects are named }. Pure. */
export function specTimes({ words = [], objects = [] }, dur, fps = FPS) {
  const settles = [...new Set(words.filter((w) => findable(w.text) && has(w.settle)).map((w) => round(w.settle)))].sort((a, b) => a - b);
  return { text: settles, boxes: objects.length ? Array.from({ length: Math.floor(dur * fps + 1e-9) + 1 }, (_, k) => round(k / fps)) : [] };
}

/**
 * The first frame time of the run where `on(t)` holds that is nearest `hint`: the run's start when `on` holds at
 * `hint`, the start of the next run when it does not. Null when no run starts before `dur`. `on` may be async. The
 * search steps back or forward by COARSE_FRAMES, then scans the last gap frame by frame.
 */
export async function runStart(on, hint, { dur, fps = FPS }) {
  const last = Math.floor(dur * fps + 1e-9);
  const k = Math.min(last, Math.max(0, Math.round(hint * fps)));
  const firstOn = async (from, to) => { for (let j = from; j < to; j++) if (await on(j / fps)) return round(j / fps); return round(to / fps); };
  if (await on(k / fps)) {
    let hi = k;
    while (hi > 0) {
      const p = Math.max(0, hi - COARSE_FRAMES);
      if (!(await on(p / fps))) return firstOn(p + 1, hi);
      hi = p;
    }
    return 0;
  }
  let lo = k;
  while (lo < last) {
    const p = Math.min(last, lo + COARSE_FRAMES);
    if (await on(p / fps)) return firstOn(lo + 1, p);
    lo = p;
  }
  return null;
}

/** The line a spec word is on: an exact line, else the shortest line or block (a whole element's text) that holds the word, spaces ignored. */
export function lineFor(sample, text) {
  const lines = sample?.lines ?? [];
  const exact = lines.find((l) => norm(l.text) === norm(text));
  if (exact) return exact;
  const key = squash(text);
  return [...(sample?.blocks ?? []), ...lines].filter((l) => squash(l.text).includes(key)).sort((a, b) => a.text.length - b.text.length)[0] ?? null;
}

const sampleAt = (samples, t) => samples.find((s) => Math.abs(s.t - t) < 1e-6);

const boxAtRest = (a, b, { frameW, frameH }) => Math.abs(a[0] - b[0]) <= REST_SHARE * frameW && Math.abs(a[1] - b[1]) <= REST_SHARE * frameH
  && Math.abs(a[2] - b[2]) <= REST_SHARE * frameW && Math.abs(a[3] - b[3]) <= REST_SHARE * frameH;

const check = (label, spec, got, unit, of = null) => ({ label, spec, got, dev: got === null ? Infinity : Math.abs(got - spec), unit, ...(of ? { of } : {}) });

/**
 * Per spec word, when its text first shows (appear) and when its box stops moving (settle), measured around the
 * spec times. `linesAt(t)` is the async text probe { lines, blocks } of one seek. { appear, settle }, null where
 * the word was not found or has no spec time.
 */
export async function wordTimes(word, linesAt, { dur, frame }) {
  if (!findable(word.text)) return { appear: null, settle: null };
  const seen = async (t) => lineFor(await linesAt(t), word.text);
  const span = { dur };
  const appear = has(word.appear) ? await runStart(async (t) => Boolean(await seen(t)), word.appear, span) : null;
  if (!has(word.settle)) return { appear, settle: null };
  const restAt = await firstRest(seen, appear ?? 0, { dur, frame });
  if (restAt === null) return { appear, settle: null };
  const ref = await seen(Math.min(dur, restAt + REST_LOOK_S));
  const settle = await runStart(async (t) => { const l = await seen(t); return Boolean(l) && boxAtRest(l.box, ref.box, frame); }, restAt, span);
  return { appear, settle };
}

/** The first coarse frame time from `from` where the word's box holds still for REST_LOOK_S, so settle never depends on the brief's value. */
async function firstRest(seen, from, { dur, frame, fps = FPS }) {
  for (let k = Math.round(from * fps); k / fps + REST_LOOK_S <= dur; k += COARSE_FRAMES) {
    const [a, b] = [await seen(k / fps), await seen(k / fps + REST_LOOK_S)];
    if (a && b && boxAtRest(a.box, b.box, frame)) return round(k / fps);
  }
  return null;
}

/** Per spec word: the first time its text shows vs `appear s` (from `times`, wordTimes per word), then cap height, x and y at `settle s`. Pure. */
export function wordChecks(words, samples, { frameW, frameH }, times = []) {
  const out = [];
  words.forEach((w, i) => {
    if (!findable(w.text)) return;
    if (has(w.appear)) out.push(check(`"${w.text}" appears`, w.appear, times[i]?.appear ?? null, 's'));
    if (!has(w.settle)) return;
    const line = lineFor(sampleAt(samples, round(w.settle)), w.text);
    const got = line && { cap: (RULES.capOfFont * line.fontPx * 100) / frameH, x: (line.box[0] * 100) / frameW, y: (line.box[1] * 100) / frameH };
    for (const [key, name] of [['cap', 'cap height'], ['x', 'x'], ['y', 'y']]) {
      if (has(w[key])) out.push(check(`"${w.text}" ${name} at ${w.settle} s`, w[key], got ? got[key] : null, '%'));
    }
  });
  return out;
}

const alphaOf = (box) => box[4];

/**
 * Per spec object: when it is half visible (`in`), when it stops moving (`settle`), when it drops under half
 * visible (`out`). `boxes` is sampleBoxTracks with { selectors } at every frame of the film (specTimes): tracks of
 * [x, y, w, h, alpha, own], and `matched`, the track index of each selector or -1.
 */
export async function objectChecks(objects, boxes, frame, fps = FPS) {
  const out = [];
  const span = { dur: boxes.times.at(-1) ?? 0, fps };
  for (const [i, o] of objects.entries()) {
    const track = boxes.tracks[boxes.matched[i]];
    if (!track) { out.push(check(`${o.id} (${o.selector}) found`, 0, null, 's')); continue; }
    const box = (t) => track[Math.min(track.length - 1, Math.round(t * fps))];
    const visible = (t) => alphaOf(box(t)) >= 0.5;
    const of = (field) => ({ list: 'objects', key: o.id, field });
    if (has(o.in)) out.push(check(`${o.id} in`, o.in, await runStart(visible, o.in, span), 's', of('in')));
    if (has(o.settle)) {
      const rest = box(Math.min(span.dur, o.settle + REST_LOOK_S));
      out.push(check(`${o.id} settle`, o.settle, await runStart((t) => boxAtRest(box(t), rest, frame), o.settle, span), 's', of('settle')));
    }
    if (has(o.out)) out.push(check(`${o.id} out`, o.out, await runStart((t) => !visible(t), o.out, span), 's', of('out')));
  }
  return out;
}

/** The times the film measured for the SPEC rows, for spec-sync: { words: [{ text, appear, settle }], objects: [{ id, in, settle, out }], worlds: [{ id, start, end, ground }] }. Pure. */
export function measuredSpec(words, times, objects, worlds = []) {
  const byId = new Map();
  for (const c of objects.filter((x) => x.of)) byId.set(c.of.key, { ...(byId.get(c.of.key) ?? { id: c.of.key }), [c.of.field]: c.got });
  return { words: words.map((w, i) => ({ text: w.text, appear: times[i]?.appear ?? null, settle: times[i]?.settle ?? null })), objects: [...byId.values()], worlds };
}

export const WIPE_MAX_S = 1;

/**
 * [start, end] seconds of each transition into a shot after the first, by time: a shot that starts before the previous one ends
 * (the Shots table overlap) is a wipe or fade that long, at most WIPE_MAX_S, and its picture may jump inside it. Pure.
 */
export const cutSpans = (shots) => shots.slice(1).flatMap((s, i) => (has(s.start) ? [[s.start, Math.min(s.start + WIPE_MAX_S, Math.max(s.start, has(shots[i].end) ? shots[i].end : s.start))]] : []))
  .sort((a, b) => a[0] - b[0]);

/**
 * Each shot start after the first is a cut in the spec. `jumps` is hardJumps' { t, mag }. Where the film has a hard jump within half a second,
 * the cut must land within one frame, or be the largest picture change inside the transition the table overlap declares; with no jump nearby
 * the shot change is a soft transition and is left alone. Pure.
 */
export function cutChecks(shots, jumps, fps = 30) {
  const out = [];
  shots.slice(1).forEach((s, i) => {
    if (!has(s.start)) return;
    const inside = biggestJump(jumps, cutSpans([shots[i], s])[0]);
    const nearest = inside ?? jumps.filter((j) => Math.abs(j.t - s.start) <= 0.5).sort((x, y) => Math.abs(x.t - s.start) - Math.abs(y.t - s.start))[0];
    if (nearest !== undefined) out.push({ label: `${s.id} cut`, spec: s.start, got: nearest.t, dev: inside === undefined ? Math.abs(nearest.t - s.start) * fps : 0, unit: 's', frames: true });
  });
  return out;
}

const fmt = (x, unit) => (unit === '%' ? `${x.toFixed(1)}%` : `${x.toFixed(2)} s`);

/** The advice line for one check. Pure. */
export function checkLine(c) {
  return c.got === null
    ? `${c.label}: not found within the sampled window (spec ${fmt(c.spec, c.unit)})`
    : `${c.label}: spec ${fmt(c.spec, c.unit)}, film ${fmt(c.got, c.unit)}${c.frames ? ` (${c.dev.toFixed(1)} frames off)` : ''}`;
}

/** One advice line per check outside `tol`. Pure. */
export const checkLines = (checks, tol) => checks.filter((c) => c.dev > tol + 1e-9).map(checkLine);
