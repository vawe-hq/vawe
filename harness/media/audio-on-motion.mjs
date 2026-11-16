// data-on="start:<selector>", "land:<selector>" or "leave:<selector>" on an <audio>: the cue follows the element's own motion,
// so it stays on its action when the animation is retimed. data-at is added as an offset in seconds.
import { sampleBoxTracks } from '../lib/box-track.mjs';
import { FPS } from './motion-curve.mjs';

export const MOTION_ON = /^(start|land|leave):(.+)$/;
// A box counts as arrived when it has covered all but this share of the way from its first box to its rest box, or passed it:
// a fast overshoot jumps past the rest pose between two frames.
const ARRIVE_SHARE = 0.08;

/** [{ start, end }] in seconds of each animation on the first element that matches `selector` that moves it (not only visibility), or null when nothing matches. */
const readMotion = (page, selector) => page.evaluate((sel) => {
  const el = document.querySelector(sel);
  if (!el) return null;
  // Only these move or show the element; a font, colour or spacing swap is not the action a cue sounds for.
  const MOVE = new Set(['transform', 'translate', 'scale', 'rotate', 'opacity', 'clipPath', 'left', 'top', 'right', 'bottom', 'width', 'height', 'offsetDistance']);
  const props = (a) => a.effect.getKeyframes().flatMap(Object.keys);
  return el.getAnimations().flatMap((a) => {
    const t = a.effect.getComputedTiming();
    const moves = props(a).some((p) => MOVE.has(p));
    return moves && Number.isFinite(t.endTime) ? [{ start: t.delay / 1000, end: t.endTime / 1000 }] : [];
  });
}, selector);

const pose = ([x, y, w, h]) => [x + w / 2, y + h / 2, w, h];

/** The first time in `times` whose box [x, y, w, h] has covered all but ARRIVE_SHARE of the way from the first box to the last, or passed it. Pure. */
export function arrivalSecond(times, boxes) {
  const rest = pose(boxes[boxes.length - 1]);
  const away = (b) => pose(b).map((v, i) => v - rest[i]);
  const from = away(boxes[0]);
  const reach = from.reduce((s, v) => s + v * v, 0);
  if (reach === 0) return times[0];
  const left = (b) => away(b).reduce((s, v, i) => s + v * from[i], 0) / reach;
  return times[boxes.findIndex((b) => left(b) <= ARRIVE_SHARE)];
}

/** The first move: every animation that starts with the earliest one, from that start to the latest of their ends. Pure. */
export function firstMove(anims) {
  const start = Math.min(...anims.map((a) => a.start));
  return { start, end: Math.max(...anims.filter((a) => a.start === start).map((a) => a.end)) };
}

/** The second `what` (start | land | leave) of the element's motion. */
async function motionSecond(page, what, selector, anims) {
  if (what === 'leave') return Math.max(...anims.map((a) => a.start));
  const move = firstMove(anims);
  if (what === 'start') return move.start;
  const first = Math.ceil(move.start * FPS - 1e-6), last = Math.ceil(move.end * FPS - 1e-6);
  const times = Array.from({ length: last - first + 1 }, (_, k) => +((first + k) / FPS).toFixed(4));
  const { tracks, matched } = await sampleBoxTracks(page, times, { selectors: [selector] });
  return arrivalSecond(times, tracks[matched[0]]);
}

/** Moves each data-on="start|land|leave:<selector>" spec to that second of the element's motion, plus its data-at. Returns the problems. */
export async function startOnMotion(page, specs) {
  const problems = [];
  for (const s of specs.filter((x) => MOTION_ON.test(x.on ?? ''))) {
    const [, what, selector] = s.on.match(MOTION_ON);
    const anims = await readMotion(page, selector);
    if (anims === null) { problems.push(`<audio> data-on="${s.on}": no element matches ${selector}`); continue; }
    if (!anims.length) { problems.push(`<audio> data-on="${s.on}": ${selector} has no animation that moves it (only visibility, font or colour, or none)`); continue; }
    s.at += await motionSecond(page, what, selector, anims);
  }
  return problems;
}
