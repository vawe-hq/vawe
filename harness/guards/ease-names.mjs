// Finds a hand-written ease in page source and names the closest house ease (core/motion/presets.js EASE_HANDLES). Advice only.
import { EASE_HANDLES, easeFn } from '../../core/motion/presets.js';
import { easeSamples } from '../lib/ease-curve.mjs';

const SAMPLES = 32;

// Declarations that hold a CSS timing function, and the WAAPI option. `linear` is left out: a constant-speed spin or loop is deliberate.
const KEYWORD = /(?<![\w-])(ease-in-out|ease-in|ease-out|ease)(?![\w(-])/;
const BEZIER = /cubic-bezier\(\s*[-\d.]+\s*,\s*[-\d.]+\s*,\s*[-\d.]+\s*,\s*[-\d.]+\s*\)/g;
const KEYWORD_DECL = /(?:\banimation(?:-timing-function)?|\btransition(?:-timing-function)?)\s*:[^;}]*|\beasing\s*:\s*["'`][^"'`]*["'`]/g;

/** The house ease whose curve is closest to `easing` (a CSS keyword or cubic-bezier()), by root mean square over 32 samples; null when unreadable. */
export function closestEase(easing) {
  const mine = easeSamples(easing, SAMPLES);
  if (!mine) return null;
  let best = null;
  for (const name of Object.keys(EASE_HANDLES)) {
    const f = easeFn(name);
    const sum = mine.reduce((s, [u, y]) => s + (f(u) - y) ** 2, 0);
    const rms = Math.sqrt(sum / mine.length);
    if (!best || rms < best.rms) best = { name, rms };
  }
  return best.name;
}

const kebab = (name) => name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

/** { easing, index } for each hand-written ease in `code` (comments blanked), first occurrence of each distinct string. */
export function handEases(code) {
  const found = new Map();
  const keep = (easing, index) => { if (!found.has(easing)) found.set(easing, index); };
  for (const m of code.matchAll(BEZIER)) keep(m[0].replace(/\s+/g, ''), m.index);
  for (const d of code.matchAll(KEYWORD_DECL)) {
    const k = KEYWORD.exec(d[0].replace(BEZIER, ' '));
    if (k) keep(k[1], d.index);
  }
  return [...found].map(([easing, index]) => ({ easing, index }));
}

/** Findings (code 'hand-ease', severity advise) naming the house ease to use in place of each hand-written one. */
export function easeFindings(code) {
  return handEases(code).flatMap(({ easing, index }) => {
    const name = closestEase(easing);
    if (!name) return [];
    return [{
      code: 'hand-ease', severity: 'advise', line: code.slice(0, index).split('\n').length,
      message: `${easing} is a hand-written ease, not a named one`,
      fix: `use var(--ease-${kebab(name)}) in CSS or EASE.${name} in script (the closest house ease); the job table is core/motion/README.md`,
    }];
  });
}
