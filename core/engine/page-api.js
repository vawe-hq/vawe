// core/engine/page-api.js: wires `window.vawe` for a hand-authored BARE HTML page, the render target
// harness/media/render-page.mjs and preview-server.mjs serve. Importing this ONE module gives a page:
//
//   vawe.onFrame((t) => { ... })   registers a per-frame hook; core/engine/page-seek.js defines it before any script and runs it,
//                                  so it works without this import.
//   vawe.layoutSeek                true while a probe that reads boxes and text seeks (no pixels read): skip canvas painting in window.seek / onFrame then.
//   vawe.value(row, t)             samples a timing-sheet row ({at,dur,from,to,ease}) as a plain
//                                  NUMBER; `ease` is a CSS keyword or a name in core/motion/easings.js.
//   vawe.three.studio/extrude/material   the three.js helpers in core/three/index.js.
import { studio, extrude, material } from '../three/index.js';
import { cubicBezier, clamp01, lerp, easeOutCubic } from '../motion/curves.js';
import { EASINGS } from '../motion/easings.js';

// The four CSS easing keywords: the standard cubic-beziers, https://drafts.csswg.org/css-easing-1/#easing-functions.
const CSS_EASE = { ease: [0.25, 0.1, 0.25, 1], 'ease-in': [0.42, 0, 1, 1], 'ease-out': [0, 0, 0.58, 1], 'ease-in-out': [0.42, 0, 0.58, 1] };
function easingFor(e) {
  if (typeof e === 'function') return e;
  if (e == null || e === '') return easeOutCubic;
  if (CSS_EASE[e]) return cubicBezier(...CSS_EASE[e]);
  if (EASINGS[e]) return EASINGS[e];
  throw new Error(unknownEase(e));
}

const GSAP_DIRECTION = { in: 'ease-in', out: 'ease-out', inOut: 'ease-in-out' };
const GSAP_CURVE = { 'expo.out': 'CURVES.expoOut', 'back.out': 'CURVES.overshoot', 'power2.out': 'CURVES.expoOut', 'power3.out': 'CURVES.expoOut', 'power4.out': 'CURVES.expoOut' };

function gsapAlternative(name) {
  const m = /^(power[1-4]|expo|sine|circ|back)\.(in|out|inOut)$/.exec(name);
  if (!m) return null;
  const keyword = m[1] === 'expo' || m[1] === 'back' ? null : `"${GSAP_DIRECTION[m[2]]}"`;
  return [keyword, GSAP_CURVE[name]].filter(Boolean).join(' or ') || null;
}

function editDistance(a, b) {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cur = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
  }
  return row[b.length];
}

function unknownEase(name) {
  const valid = [...Object.keys(CSS_EASE), ...Object.keys(EASINGS)];
  const key = String(name).toLowerCase();
  const nearest = valid.reduce((best, v) => (editDistance(key, v.toLowerCase()) < editDistance(key, best.toLowerCase()) ? v : best));
  const mapped = gsapAlternative(String(name));
  return `unknown ease ${JSON.stringify(name)}: ${mapped ? `use ${mapped}` : `closest is "${nearest}"`}. Valid: ${valid.join(', ')}.`;
}

/** vawe.value(row, t) → a NUMBER, `row.from` eased toward `row.to` between `row.at` and `row.at+row.dur`. */
export function value(row, t) {
  const { at = 0, dur = 0.5, from = 0, to = 1, ease } = row;
  return lerp(from, to, easingFor(ease)(clamp01(dur === 0 ? (t > at ? 1 : 0) : (t - at) / dur)));
}

// Guarded the same way core/motion/timeline.js's own bottom line already is: importable in Node
// (so tooling that walks every core/ module, e.g. `make check GATE=word-action`, does not choke on it)
// even though the assignment itself only means anything in a browser page.
/**
 * vawe.assert(t, fn, message): a check the renderer runs after seeking to `t` seconds, at `vawe dev` and
 * `vawe ship`. A falsy or throwing fn fails the render (exit 2) with the time and `message`.
 */
export function assert(t, fn, message) {
  (window.__vaweAsserts ||= []).push({ t, fn, message });
}

if (typeof window !== 'undefined') Object.assign(window.vawe || (window.vawe = {}), { value, assert, clock: window.__pageClock, three: { studio, extrude, material } });
