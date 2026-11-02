// Pure parts of `vawe new --from-url --tour`: the steps file, the frame times and the tweens. No I/O and no heavy imports.
// A tour is a JSON list of steps, or { "dur": s, "cursor": [x, y], "steps": [...] }. Every step has a time `t` in seconds and one action:
//   { "t": 1.2, "move": "#job-exit", "dur": 0.6 }   the cursor travels to the middle of the element (or to [x, y] in CSS px); "hover" is the same step
//   { "t": 2.4, "click": "#job-exit" }              press and release (0.12 s) at the cursor; the cursor must already be over the element
//   { "t": 3, "scrollTo": "#product-ui", "dur": 1.2, "offset": 40 }   the page scrolls until the element's top is `offset` px (default 0) below the top of the view
//   { "t": 0, "scroll": 0 }                         the page scrolls to y px; with "dur" it travels, without it jumps

export const CLICK_S = 0.12;
export const MOVE_DUR_S = 0.6;
export const SCROLL_DUR_S = 1;
export const TAIL_S = 0.5;
const ACTIONS = ['move', 'hover', 'click', 'scroll', 'scrollTo'];
const USAGE = 'a tour is a JSON list of { "t": s, "move" | "click" | "scrollTo": selector, "scroll": y, "dur": s } steps';

const fail = (message) => { throw new Error(`tour: ${message}; ${USAGE}`); };
const isTarget = (v) => (typeof v === 'string' && v.length > 0) || (Array.isArray(v) && v.length === 2 && v.every(Number.isFinite));

function checkTarget(at, key, target) {
  if (key === 'scroll' ? !Number.isFinite(target) : !isTarget(target)) fail(`${at}: "${key}" has no usable value`);
  if ((key === 'click' || key === 'scrollTo') && typeof target !== 'string') fail(`${at}: "${key}" takes a selector`);
}

function parseStep(raw, index) {
  const at = `step ${index + 1}`;
  if (!raw || typeof raw !== 'object') fail(`${at} is not an object`);
  if (!Number.isFinite(raw.t) || raw.t < 0) fail(`${at} needs "t", a number of seconds from 0`);
  const keys = ACTIONS.filter((k) => raw[k] !== undefined);
  if (keys.length !== 1) fail(`${at} needs exactly one of ${ACTIONS.join(', ')}, has ${keys.length ? keys.join(' and ') : 'none'}`);
  const key = keys[0];
  const kind = key === 'hover' ? 'move' : key;
  const target = raw[key];
  checkTarget(at, key, target);
  if (raw.dur !== undefined && !(Number.isFinite(raw.dur) && raw.dur >= 0)) fail(`${at}: "dur" is not a number of seconds`);
  const fallback = kind === 'move' ? MOVE_DUR_S : kind === 'scrollTo' ? SCROLL_DUR_S : 0;
  if (raw.offset !== undefined && !(kind === 'scrollTo' && Number.isFinite(raw.offset))) fail(`${at}: "offset" is a number of px and only goes with "scrollTo"`);
  return { t: raw.t, kind, target, dur: kind === 'click' ? CLICK_S : (raw.dur ?? fallback), offset: raw.offset ?? 0 };
}

/** The tour of a steps file: { steps sorted by t, dur, cursor }. `dur` is the file's own, else the last step's end plus TAIL_S. Throws one line naming the fix. Pure. */
export function parseTour(text) {
  let raw;
  try { raw = JSON.parse(text); } catch (e) { fail(`not JSON (${e.message})`); }
  const [list, head] = Array.isArray(raw) ? [raw, {}] : [raw?.steps, raw ?? {}];
  if (!Array.isArray(list) || !list.length) fail('no steps');
  const steps = list.map(parseStep);
  steps.forEach((s, i) => { if (i && s.t < steps[i - 1].t) fail(`step ${i + 1} starts at ${s.t} s, before step ${i} at ${steps[i - 1].t} s`); });
  const end = Math.max(...steps.map((s) => s.t + s.dur));
  if (head.dur !== undefined && !(Number.isFinite(head.dur) && head.dur >= end)) fail(`"dur" ${head.dur} ends before the last step at ${end} s`);
  if (head.cursor !== undefined && !(Array.isArray(head.cursor) && head.cursor.length === 2 && head.cursor.every(Number.isFinite))) fail('"cursor" is not [x, y]');
  return { steps, dur: head.dur ?? end + TAIL_S, cursor: head.cursor ?? null };
}

/** How many frames a tour of `dur` seconds has at `fps`, and the second of frame i: both exact, so a frame is a pure function of its index. Pure. */
export const frameCount = (dur, fps) => Math.round(dur * fps);
export const frameTime = (i, fps) => i / fps;

/** The steps that start after `prev` and at or before `t`: the ones a frame at `t` must set going. Pure. */
export const stepsDue = (steps, prev, t) => steps.filter((s) => s.t > prev && s.t <= t + 1e-9);

/** A segment { t0, dur, from, to } at second t: `from` before it, `to` after it, `ease(u)` between. Pure. */
export function tween(seg, t, ease) {
  if (t < seg.t0) return seg.from;
  if (t >= seg.t0 + seg.dur) return seg.to;
  return seg.from + (seg.to - seg.from) * ease((t - seg.t0) / seg.dur);
}

/** The value at t of a list of segments that follow each other (each `from` is the value its predecessor had when it began). Pure. */
export function valueAt(segs, t, initial, ease) {
  let value = initial;
  for (const seg of segs) if (seg.t0 <= t) value = tween(seg, t, ease);
  return value;
}

/** Whether the button is down at t: 1 from a click's second until CLICK_S later. Pure. */
export const pressedAt = (clicks, t) => clicks.some((c) => t >= c.t0 && t < c.t0 + CLICK_S);

/** Whether a point lies inside a rect { left, top, width, height }. Pure. */
export const inside = (p, r) => p.x >= r.left - 0.5 && p.x <= r.left + r.width + 0.5 && p.y >= r.top - 0.5 && p.y <= r.top + r.height + 0.5;

/** The viewport of a tour: 16:9, so the mp4 fits the film frame. Pure. */
export const tourSize = (width) => ({ width, height: Math.round((width * 9) / 16 / 2) * 2 });
