// GSAP's named eases as exact functions of u in 0..1, written from gsap@3.12.5 dist/gsap.js
// (https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.js, the _insertEase calls), so a page ported from a GSAP tool keeps its curves.
const TWO_PI = Math.PI * 2;
const HALF_PI = Math.PI / 2;
const BACK_OVERSHOOT = 1.70158;

const outOf = (easeIn) => (p) => 1 - easeIn(1 - p);
const inOutFromIn = (easeIn) => (p) => (p < 0.5 ? easeIn(p * 2) / 2 : 1 - easeIn((1 - p) * 2) / 2);
const inOutFromOut = (easeOut) => (p) => (p < 0.5 ? (1 - easeOut(1 - p * 2)) / 2 : 0.5 + easeOut((p - 0.5) * 2) / 2);

const fromIn = (easeIn) => ({ in: easeIn, out: outOf(easeIn), inOut: inOutFromIn(easeIn) });
const fromOut = (easeOut) => ({ in: outOf(easeOut), out: easeOut, inOut: inOutFromOut(easeOut) });
const power = (n) => fromIn((p) => Math.pow(p, n));

function backOut(overshoot) {
  return (p) => (p ? (p - 1) * (p - 1) * ((overshoot + 1) * (p - 1) + overshoot) + 1 : 0);
}

// GSAP's default period is 0.3 for .in and .out and 0.45 for .inOut.
function elasticOut(amplitude, period, defaultPeriod) {
  const p1 = amplitude >= 1 ? amplitude : 1;
  const p2 = (period || defaultPeriod) / (amplitude < 1 ? amplitude : 1);
  const p3 = (p2 / TWO_PI) * (Math.asin(1 / p1) || 0);
  return (p) => (p === 1 ? 1 : p1 * Math.pow(2, -10 * p) * Math.sin(((p - p3) * TWO_PI) / p2) + 1);
}

function bounceOut(p) {
  const n = 7.5625, c = 2.75;
  if (p < 1 / c) return n * p * p;
  if (p < 2 / c) return n * Math.pow(p - 1.5 / c, 2) + 0.75;
  if (p < 2.5 / c) return n * Math.pow(p - 2.25 / c, 2) + 0.9375;
  return n * Math.pow(p - 2.625 / c, 2) + 0.984375;
}

const FAMILIES = {
  power1: () => power(2),
  power2: () => power(3),
  power3: () => power(4),
  power4: () => power(5),
  sine: () => fromIn((p) => (p === 1 ? 1 : 1 - Math.cos(p * HALF_PI))),
  expo: () => fromIn((p) => (p ? Math.pow(2, 10 * (p - 1)) : 0)),
  circ: () => fromIn((p) => 1 - Math.sqrt(1 - p * p)),
  back: (overshoot = BACK_OVERSHOOT) => fromOut(backOut(overshoot)),
  elastic: (amplitude = 1, period) => ({
    ...fromOut(elasticOut(amplitude, period, 0.3)),
    inOut: inOutFromOut(elasticOut(amplitude, period, 0.45)),
  }),
  bounce: () => ({ ...fromOut(bounceOut), inOut: inOutFromIn(outOf(bounceOut)) }),
};

const WAYS = ['in', 'out', 'inOut'];

/** The GSAP ease names with a fixed curve: none, linear, and power1 to power4, sine, expo, circ, back, elastic, bounce, each with .in, .out and .inOut. */
export const GSAP_EASE_NAMES = ['none', 'linear', ...Object.keys(FAMILIES).flatMap((f) => WAYS.map((w) => `${f}.${w}`))];

/** A GSAP ease as a function of u in 0..1, or null when the name is not GSAP's. `back.out(1.5)` and `elastic.out(1, 0.3)` take parameters; a bare family is its .out, as in GSAP. */
export function gsapEase(name) {
  if (name === 'none' || name === 'linear') return (p) => p;
  const m = /^(\w+?)(?:\.(in|out|inOut))?(?:\(([^)]*)\))?$/.exec(String(name).trim());
  const make = m && Object.hasOwn(FAMILIES, m[1]) ? FAMILIES[m[1]] : null;
  if (!make) return null;
  const args = m[3] === undefined || m[3].trim() === '' ? [] : m[3].split(',').map(Number);
  if (args.some(Number.isNaN)) return null;
  return make(...args)[m[2] || 'out'];
}
