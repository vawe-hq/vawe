import { EASE, UI, easeFn } from '../../../core/motion/presets.js';
import { springLinear, springDuration, rng } from '../../../core/motion/springs.js';

// The stage light travels the points once and returns to the first, over the clip's whole length: the last frame matches the first.
export function driftLight(ms, points = [[50, 44], [60, 38], [42, 50]]) {
  const loop = [...points, points[0]];
  document.documentElement.animate(
    loop.map(([x, y], i) => ({ '--pool-x': `${x}%`, '--pool-y': `${y}%`, offset: i / (loop.length - 1), easing: EASE.glide })),
    { duration: ms, fill: 'both' },
  );
}

// The subject leaves in 0.3 s and the clip ends 0.1 s later, on the empty ground that frame 0 also shows.
export function leave(el, clipMs, drift = UI.exit.drift) {
  const { ms, endGapMs } = UI.exit;
  el.animate([{ opacity: 0, translate: `0 ${drift}` }], { duration: ms, delay: clipMs - endGapMs - ms, easing: EASE.launch, fill: 'forwards' });
}

// A UI arrival: fades in and rises on EASE.land. The reference clips (everestchris ai-component-library) fade a panel in 0.12 to 0.3 s and a row in 0.15 to 0.3 s.
export function arrive(el, atMs, { ms = UI.row.fadeMs, from = UI.row.rise, ease = EASE.land, blur = 0 } = {}) {
  const soft = blur ? (px) => ({ filter: `blur(${px}px)` }) : () => ({});
  return el.animate(
    [{ opacity: 0, translate: `0 ${from}`, ...soft(blur) }, { opacity: 1, translate: '0 0', ...soft(0) }],
    { duration: ms, delay: atMs, easing: ease, fill: 'both' },
  );
}

// A sent message travels from where it was typed (a viewport y) to its place and overshoots by about 11 percent of its travel: the reference bubble measures x1.11 in 0.1 s.
export function flipFrom(el, fromTop, atMs) {
  const dy = fromTop - el.getBoundingClientRect().top;
  const { k, d } = UI.send;
  return el.animate(
    [{ opacity: 0, translate: `0 ${dy}px`, scale: 0.96 }, { opacity: 1, translate: '0 0', scale: 1 }],
    { duration: springDuration(k, d) * 1000, delay: atMs, easing: springLinear(k, d), fill: 'both' },
  );
}

// Per-character times (ms) of a typed line: 30 ms a character, 70 ms more after a space, each jittered 25 percent from a seeded rng.
// The reference prompts type at 20 to 27 characters a second (38 characters in 1.5 s, 61 in 3 s).
export function typeTimes(text, startMs, seed = 5) {
  const { charMs, spaceMs, jitter } = UI.typing;
  const r = rng(seed);
  let t = startMs;
  return [...text].map((c) => { const at = t; t += (charMs + (c === ' ' ? spaceMs : 0)) * (1 - jitter + r() * 2 * jitter); return at; });
}

export const typedCount = (times, ms) => times.filter((at) => at <= ms).length;

// The second a move on `ease` over durMs, starting at atMs, reaches `fraction` of its distance (0 to 1): when a scan line crosses a slot.
export function crossAt(ease, atMs, durMs, fraction) {
  const f = easeFn(ease);
  let lo = 0, hi = 1;
  for (let i = 0; i < 24; i++) { const mid = (lo + hi) / 2; if (f(mid) < fraction) lo = mid; else hi = mid; }
  return atMs + hi * durMs;
}

// One text slot changes from one reading to another: the old one rolls up and out, the new one rolls in from below as it ends, so no two glyphs share a spot.
export function rollSwap(outEl, inEl, atMs, rise = UI.roll.rise, ease = EASE.land) {
  outEl.animate([{ opacity: 1, translate: '0 0' }, { opacity: 0, translate: `0 -${rise}` }], { duration: UI.roll.outMs, delay: atMs, easing: EASE.launch, fill: 'both' });
  inEl.animate([{ opacity: 0, translate: `0 ${rise}` }, { opacity: 1, translate: '0 0' }], { duration: UI.roll.inMs, delay: atMs + UI.roll.outMs, easing: ease, fill: 'both' });
}

// An element shows only from fromMs to toMs of a clip totalMs long, with 60 ms soft edges; a missing bound means the clip's start or end.
export function between(el, fromMs, toMs, totalMs) {
  const EDGE = 60;
  const keys = [];
  if (fromMs == null) keys.push({ opacity: 1, offset: 0 });
  else keys.push({ opacity: 0, offset: Math.max(0, (fromMs - EDGE) / totalMs) }, { opacity: 1, offset: (fromMs + EDGE) / totalMs });
  if (toMs == null) keys.push({ opacity: 1, offset: 1 });
  else keys.push({ opacity: 1, offset: (toMs - EDGE) / totalMs }, { opacity: 0, offset: Math.min(1, (toMs + EDGE) / totalMs) });
  if (fromMs != null) keys.unshift({ opacity: 0, offset: 0 });
  if (toMs != null) keys.push({ opacity: 0, offset: 1 });
  return el.animate(keys, { duration: totalMs, fill: 'both' });
}

// A terminal row shows in one frame at atMs (null: from the start) and goes at untilMs when given: a real terminal reprints text, it never fades or slides it.
export function show(el, atMs, untilMs) {
  if (atMs != null) el.animate([{ visibility: 'hidden' }, { visibility: 'visible' }], { duration: 1, delay: atMs, fill: 'both' });
  if (untilMs != null) el.animate([{ visibility: 'visible' }, { visibility: 'hidden' }], { duration: 1, delay: untilMs, fill: 'forwards' });
}

// A tool call's dot blinks grey while it runs (one dip every blinkMs) and is green after toMs: a terminal toggles it, it never fades.
export function runDot(dot, fromMs, toMs, blinkMs = 360) {
  const keys = [{ opacity: 1, offset: 0 }, { opacity: 1, offset: 0.5 }, { opacity: 0.25, offset: 0.5 }, { opacity: 0.25, offset: 1 }];
  dot.animate(keys, { duration: blinkMs, delay: fromMs, iterations: Math.max(1, Math.floor((toMs - fromMs) / blinkMs)) });
  dot.animate([{ backgroundColor: 'var(--muted)' }], { duration: toMs - fromMs, delay: fromMs });
}
