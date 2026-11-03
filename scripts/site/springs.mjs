// Build the /springs pages' data from the motion library: one JSON file the site imports at build time.
// Every number on a spring page is computed here with core/motion/springs.js (spring, springDuration,
// springLinear) from a stiffness and a damping with unit mass. The stiffness and damping of a library
// preset are read from that library's own source or official docs; each preset records where and at
// which version. A preset whose units need a conversion records the formula next to it.
//
//   node scripts/site/springs.mjs     writes site/lib/springs.json (pure node, runs in prebuild)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(root, 'site', 'lib', 'springs.json');

if (!fs.existsSync(path.join(root, 'core', 'motion', 'springs.js'))) {
  console.log('~ core/motion is not here; using the committed site/lib/springs.json');
  process.exit(0);
}
const { SPRINGS, spring, springDuration, springLinear } = await import('../../core/motion/springs.js');

const SAMPLES = 100;
const LINEAR_STEPS = [40, 60, 80, 120, 160, 240];
const LINEAR_TOLERANCE = 0.002;
const STEP = 0.001;

const round = (v, n) => Math.round(v * 10 ** n) / 10 ** n;
const clean = (v) => round(v, 2);

const REACT_SPRING = { version: '@react-spring/core 10.1.2', file: 'packages/core/src/constants.ts, const config', url: 'https://github.com/pmndrs/react-spring/blob/main/packages/core/src/constants.ts' };
const REACT_SPRING_UNITS = 'Stiffness is tension and damping is friction, with mass 1 (the default). The physics loop in the same package, acceleration = (-tension x displacement - friction x velocity) / mass, is the spring that spring() in springs.js solves.';
const MOTION = { version: 'motion-dom 14.9.0 (motion and framer-motion 14.9.0)', url: 'https://github.com/motiondivision/motion/blob/main/packages/motion-dom/src/animation/generators/spring.ts' };
const MOTION_UNITS = 'Stiffness and damping are used as they are, with mass 1.';
const SWIFTUI = { version: 'SwiftUI documentation read on 2026-11-03', url: 'https://developer.apple.com/documentation/swiftui/animation/spring(response:dampingfraction:blendduration:)' };
const SWIFTUI_UNITS = 'stiffness = (2 pi / response)^2, damping = 4 pi x dampingFraction / response, with mass 1. The duration-and-bounce forms map to response = duration and dampingFraction = 1 - bounce, the same bounce mapping Motion documents "as SwiftUI does". Apple states bounce 0 is critically damped and bounce 1 is undamped.';
const COMPOSE = { version: 'androidx main at 9adbcd8 (compose animation-core 1.14.0-alpha01)', url: 'https://github.com/androidx/androidx/blob/androidx-main/compose/animation/animation-core/src/commonMain/kotlin/androidx/compose/animation/core/VectorizedAnimationSpec.kt' };
const COMPOSE_UNITS = 'Stiffness is used as it is with mass 1 (SpringSimulation takes the natural frequency as sqrt(stiffness)). damping = 2 x dampingRatio x sqrt(stiffness), the same c = 2 x naturalFreq x dampingRatio that SpringSimulation.getAcceleration uses.';
const M3 = { version: 'androidx main at 9adbcd8 (compose material3 1.6.0-alpha01)', url: 'https://github.com/androidx/androidx/blob/androidx-main/compose/material3/material3/src/commonMain/kotlin/androidx/compose/material3/tokens/ExpressiveMotionTokens.kt' };
const M3_STANDARD = { ...M3, url: 'https://github.com/androidx/androidx/blob/androidx-main/compose/material3/material3/src/commonMain/kotlin/androidx/compose/material3/tokens/StandardMotionTokens.kt' };

export const LIBRARIES = [
  { id: 'vawe', label: 'vawe house springs', intro: 'The four springs in SPRINGS, from core/motion/springs.js. Page code reads them with spring(t, k, d).' },
  { id: 'react-spring', label: 'react-spring', intro: 'The six presets of the config object in react-spring.' },
  { id: 'motion', label: 'Motion (Framer Motion)', intro: 'The spring numbers Motion uses when you do not set them.' },
  { id: 'swiftui', label: 'SwiftUI', intro: 'Apple spring animations, converted from response and damping fraction to stiffness and damping.' },
  { id: 'compose', label: 'Jetpack Compose', intro: 'spring() in Compose, from the constants of the Spring object.' },
  { id: 'material', label: 'Material 3', intro: 'The spatial springs of the Material 3 motion schemes in Compose.' },
];

const swiftui = (response, fraction) => ({ k: (2 * Math.PI / response) ** 2, d: 4 * Math.PI * fraction / response });
const compose = (ratio, stiffness) => ({ k: stiffness, d: 2 * ratio * Math.sqrt(stiffness) });

// Each preset: where the numbers come from, the original units, and a note that holds one fact the numbers alone do not show.
const PRESETS = [
  { slug: 'vawe-snappy', lib: 'vawe', name: 'vawe snappy', short: 'snappy', ...SPRINGS.snappy, source: { version: 'core/motion/springs.js', file: 'SPRINGS.snappy', url: null }, original: 'SPRINGS.snappy = { k: 400, d: 32 }', note: () => 'indicator() gives this spring to the edge of a moving indicator that leads the move.' },
  { slug: 'vawe-default', lib: 'vawe', name: 'vawe default', short: 'default', ...SPRINGS.default, source: { version: 'core/motion/springs.js', file: 'SPRINGS.default', url: null }, original: 'SPRINGS.default = { k: 170, d: 26 }', note: () => 'It is the default of spring(), track() and springLinear(), and the trailing edge in indicator(). The numbers equal react-spring default.' },
  { slug: 'vawe-heavy', lib: 'vawe', name: 'vawe heavy', short: 'heavy', ...SPRINGS.heavy, source: { version: 'core/motion/springs.js', file: 'SPRINGS.heavy', url: null }, original: 'SPRINGS.heavy = { k: 90, d: 22 }', note: () => 'It is the only overdamped house spring, so it never passes the end value.' },
  { slug: 'vawe-playful', lib: 'vawe', name: 'vawe playful', short: 'playful', ...SPRINGS.playful, source: { version: 'core/motion/springs.js', file: 'SPRINGS.playful', url: null }, original: 'SPRINGS.playful = { k: 220, d: 12 }', note: () => 'It is the house spring that overshoots most.' },

  { slug: 'react-spring-default', lib: 'react-spring', name: 'react-spring default', short: 'default', k: 170, d: 26, source: REACT_SPRING, original: 'config.default = { tension: 170, friction: 26 }', conversion: REACT_SPRING_UNITS, note: () => 'It is the config a spring gets when you pass none. The numbers equal vawe default.' },
  { slug: 'react-spring-gentle', lib: 'react-spring', name: 'react-spring gentle', short: 'gentle', k: 120, d: 14, source: REACT_SPRING, original: 'config.gentle = { tension: 120, friction: 14 }', conversion: REACT_SPRING_UNITS, note: () => 'Its stiffness is lower than default (120 against 170) and its damping is about half (14 against 26).' },
  { slug: 'react-spring-wobbly', lib: 'react-spring', name: 'react-spring wobbly', short: 'wobbly', k: 180, d: 12, source: REACT_SPRING, original: 'config.wobbly = { tension: 180, friction: 12 }', conversion: REACT_SPRING_UNITS, note: () => 'Of the six react-spring presets it overshoots the most.' },
  { slug: 'react-spring-stiff', lib: 'react-spring', name: 'react-spring stiff', short: 'stiff', k: 210, d: 20, source: REACT_SPRING, original: 'config.stiff = { tension: 210, friction: 20 }', conversion: REACT_SPRING_UNITS, note: (n) => `Its settle time is about the same as default (${n.settle} s against ${n.defaultSettle} s), but default does not overshoot.` },
  { slug: 'react-spring-slow', lib: 'react-spring', name: 'react-spring slow', short: 'slow', k: 280, d: 60, source: REACT_SPRING, original: 'config.slow = { tension: 280, friction: 60 }', conversion: REACT_SPRING_UNITS, note: () => 'Its tension (280) is the same as molasses; only the friction differs (60 against 120).' },
  { slug: 'react-spring-molasses', lib: 'react-spring', name: 'react-spring molasses', short: 'molasses', k: 280, d: 120, source: REACT_SPRING, original: 'config.molasses = { tension: 280, friction: 120 }', conversion: REACT_SPRING_UNITS, note: (n) => `It is the slowest preset in this set, ${n.settle} s. Its damping ratio is ${n.zeta}, so the extra friction holds the spring back.` },

  { slug: 'motion-default', lib: 'motion', name: 'Motion default spring', short: 'default spring', k: 100, d: 10, source: { ...MOTION, file: 'defaultStiffness, defaultDamping, defaultMass in animation/generators/spring.ts' }, original: 'transition: { type: "spring" } with no other option: stiffness 100, damping 10, mass 1', conversion: MOTION_UNITS, note: () => 'Motion uses it for a spring you declare with type "spring" and no other numbers.' },
  { slug: 'motion-transform', lib: 'motion', name: 'Motion x, y and rotate default', short: 'transform default', k: 500, d: 25, source: { ...MOTION, file: 'underDampedSpring in animation/utils/default-transitions.ts', url: 'https://github.com/motiondivision/motion/blob/main/packages/motion-dom/src/animation/utils/default-transitions.ts' }, original: 'underDampedSpring = { type: "spring", stiffness: 500, damping: 25, restSpeed: 10 }', conversion: MOTION_UNITS, note: () => 'Motion uses it for a transform value (x, y, rotate) with two keyframes, when you set no transition. A scale value gets the next preset.' },
  { slug: 'motion-scale', lib: 'motion', name: 'Motion scale default', short: 'scale default', k: 550, d: 30, source: { ...MOTION, file: 'criticallyDampedSpring in animation/utils/default-transitions.ts', url: 'https://github.com/motiondivision/motion/blob/main/packages/motion-dom/src/animation/utils/default-transitions.ts' }, original: 'criticallyDampedSpring(target) = { type: "spring", stiffness: 550, damping: target === 0 ? 2 * Math.sqrt(550) : 30, restSpeed: 10 }', conversion: MOTION_UNITS, note: () => 'The source calls it criticallyDampedSpring, but damping 30 is below critical for stiffness 550, which is 2 x sqrt(550), about 46.9. Motion uses that value only when a scale animates to 0.' },

  { slug: 'swiftui-spring', lib: 'swiftui', name: 'SwiftUI spring()', short: 'spring()', ...swiftui(0.5, 0.825), source: { ...SWIFTUI, file: 'Animation.spring(response:dampingFraction:blendDuration:)' }, original: 'spring(response: 0.5, dampingFraction: 0.825): the documented defaults', conversion: SWIFTUI_UNITS, note: () => 'A damping fraction of 0.825 is the documented default of spring(response:dampingFraction:blendDuration:).' },
  { slug: 'swiftui-smooth', lib: 'swiftui', name: 'SwiftUI .smooth', short: '.smooth', ...swiftui(0.5, 1), source: { ...SWIFTUI, url: 'https://developer.apple.com/documentation/swiftui/animation/smooth', file: 'Animation.smooth' }, original: '.smooth: duration 0.5, bounce 0 (Apple: "no bounce")', conversion: SWIFTUI_UNITS, note: () => 'Bounce 0 means a critically damped spring: the fastest settle with no overshoot.' },
  { slug: 'swiftui-snappy', lib: 'swiftui', name: 'SwiftUI .snappy', short: '.snappy', ...swiftui(0.5, 0.85), source: { ...SWIFTUI, url: 'https://developer.apple.com/documentation/swiftui/animation/snappy(duration:extrabounce:)', file: 'Animation.snappy(duration:extraBounce:)' }, original: '.snappy: duration 0.5, base bounce 0.15 (Apple: "small amount of bounce")', conversion: SWIFTUI_UNITS, note: () => 'Its base bounce of 0.15 gives a damping fraction of 0.85.' },
  { slug: 'swiftui-bouncy', lib: 'swiftui', name: 'SwiftUI .bouncy', short: '.bouncy', ...swiftui(0.5, 0.7), source: { ...SWIFTUI, url: 'https://developer.apple.com/documentation/swiftui/animation/bouncy(duration:extrabounce:)', file: 'Animation.bouncy(duration:extraBounce:)' }, original: '.bouncy: duration 0.5, base bounce 0.3 (Apple: "higher amount of bounce")', conversion: SWIFTUI_UNITS, note: () => 'Its base bounce of 0.3 gives a damping fraction of 0.7.' },

  { slug: 'compose-no-bouncy-medium', lib: 'compose', name: 'Compose spring() default', short: 'spring() default', ...compose(1, 1500), source: { ...COMPOSE, file: 'spring() in AnimationSpec.kt: dampingRatio = DampingRatioNoBouncy (1), stiffness = StiffnessMedium (1500)', url: 'https://github.com/androidx/androidx/blob/androidx-main/compose/animation/animation-core/src/commonMain/kotlin/androidx/compose/animation/core/AnimationSpec.kt' }, original: 'spring(): dampingRatio 1f, stiffness 1500f', conversion: COMPOSE_UNITS, note: (n) => `Stiffness 1500 with critical damping gives the shortest settle in this set, ${n.settle} s.` },
  { slug: 'compose-no-bouncy-medium-low', lib: 'compose', name: 'Compose NoBouncy with StiffnessMediumLow', short: 'NoBouncy, MediumLow', ...compose(1, 400), source: { ...COMPOSE, file: 'Spring.DampingRatioNoBouncy, Spring.StiffnessMediumLow' }, original: 'spring(dampingRatio = Spring.DampingRatioNoBouncy (1), stiffness = Spring.StiffnessMediumLow (400))', conversion: COMPOSE_UNITS, note: () => 'The source comments that StiffnessMediumLow is the default stiffness of the springs in enter and exit transitions.' },
  { slug: 'compose-medium-bouncy-low', lib: 'compose', name: 'Compose MediumBouncy with StiffnessLow', short: 'MediumBouncy, Low', ...compose(0.5, 200), source: { ...COMPOSE, file: 'Spring.DampingRatioMediumBouncy, Spring.StiffnessLow' }, original: 'spring(dampingRatio = Spring.DampingRatioMediumBouncy (0.5), stiffness = Spring.StiffnessLow (200))', conversion: COMPOSE_UNITS, note: () => 'Both constants come from the Spring object: a damping ratio of 0.5 and the low stiffness, 200.' },
  { slug: 'compose-high-bouncy-medium-low', lib: 'compose', name: 'Compose HighBouncy with StiffnessMediumLow', short: 'HighBouncy, MediumLow', ...compose(0.2, 400), source: { ...COMPOSE, file: 'Spring.DampingRatioHighBouncy, Spring.StiffnessMediumLow' }, original: 'spring(dampingRatio = Spring.DampingRatioHighBouncy (0.2), stiffness = Spring.StiffnessMediumLow (400))', conversion: COMPOSE_UNITS, note: () => 'DampingRatioHighBouncy, 0.2, is the lowest damping ratio constant in the Spring object.' },

  { slug: 'material-expressive-fast-spatial', lib: 'material', name: 'Material 3 Expressive fast spatial', short: 'Expressive fast spatial', ...compose(0.6, 800), source: { ...M3, file: 'ExpressiveMotionTokens.SpringFastSpatialDamping (0.6) and SpringFastSpatialStiffness (800)' }, original: 'damping ratio 0.6, stiffness 800 (MotionScheme.expressive().fastSpatialSpec())', conversion: COMPOSE_UNITS, note: () => 'It is the bounciest of the four Material 3 spatial springs here.' },
  { slug: 'material-expressive-default-spatial', lib: 'material', name: 'Material 3 Expressive default spatial', short: 'Expressive default spatial', ...compose(0.8, 380), source: { ...M3, file: 'ExpressiveMotionTokens.SpringDefaultSpatialDamping (0.8) and SpringDefaultSpatialStiffness (380)' }, original: 'damping ratio 0.8, stiffness 380 (MotionScheme.expressive().defaultSpatialSpec())', conversion: COMPOSE_UNITS, note: () => 'Material 3 documents the default spatial spec for animations that may change the shape or bounds of a component.' },
  { slug: 'material-expressive-slow-spatial', lib: 'material', name: 'Material 3 Expressive slow spatial', short: 'Expressive slow spatial', ...compose(0.8, 200), source: { ...M3, file: 'ExpressiveMotionTokens.SpringSlowSpatialDamping (0.8) and SpringSlowSpatialStiffness (200)' }, original: 'damping ratio 0.8, stiffness 200 (MotionScheme.expressive().slowSpatialSpec())', conversion: COMPOSE_UNITS, note: () => 'It has the same damping ratio as the default spatial spring (0.8). Only the stiffness is lower, 200 against 380.' },
  { slug: 'material-standard-default-spatial', lib: 'material', name: 'Material 3 Standard default spatial', short: 'Standard default spatial', ...compose(0.9, 700), source: { ...M3_STANDARD, file: 'StandardMotionTokens.SpringDefaultSpatialDamping (0.9) and SpringDefaultSpatialStiffness (700)' }, original: 'damping ratio 0.9, stiffness 700 (MotionScheme.standard().defaultSpatialSpec())', conversion: COMPOSE_UNITS, note: () => 'Its damping ratio is 0.9, against 0.8 and 0.6 in the Expressive scheme.' },
];

function curve(k, d) {
  const settle = springDuration(k, d);
  let peak = 0, peakAt = 0, crossings = 0, below = true;
  let t50 = null, t90 = null;
  for (let t = 0; t <= settle + STEP / 2; t += STEP) {
    const v = spring(t, k, d);
    if (v - 1 > peak) { peak = v - 1; peakAt = t; }
    if (t50 === null && v >= 0.5) t50 = t;
    if (t90 === null && v >= 0.9) t90 = t;
    const nowBelow = v < 1;
    if (t > 0 && nowBelow !== below) crossings++;
    below = nowBelow;
  }
  return { settle, overshoot: peak * 100, peakAt, crossings, t50, t90 };
}

// The smallest sample count whose linear() string stays within LINEAR_TOLERANCE of the spring everywhere.
function linearFit(k, d, settle) {
  let worst = Infinity, best = null;
  for (const n of LINEAR_STEPS) {
    const css = springLinear(k, d, n);
    const pts = css.slice(7, -1).split(', ').map(Number);
    worst = 0;
    for (let t = 0; t <= settle; t += STEP) {
      const x = (t / settle) * n, i = Math.min(Math.floor(x), n - 1), f = x - i;
      worst = Math.max(worst, Math.abs(pts[i] + (pts[i + 1] - pts[i]) * f - spring(t, k, d)));
    }
    best = { css, points: n + 1, worst };
    if (worst <= LINEAR_TOLERANCE) break;
  }
  return best;
}

function build(p) {
  const k = clean(p.k), d = clean(p.d);
  const c = curve(k, d);
  const settle = round(c.settle, 3);
  const zeta = d / (2 * Math.sqrt(k));
  const lin = linearFit(k, d, c.settle);
  const y = Array.from({ length: SAMPLES + 1 }, (_, i) => round(spring((i / SAMPLES) * c.settle, k, d), 4));
  const vel = y.map((v, i) => (i === 0 ? (y[1] - y[0]) * SAMPLES : (v - y[i - 1]) * SAMPLES));
  const peakSpeed = round(Math.max(...vel), 2);
  const numbers = { defaultSettle: round(springDuration(170, 26), 3), settle, overshoot: round(c.overshoot, 1), crossings: c.crossings, zeta: round(zeta, 2) };
  const omega = Math.sqrt(k);
  return {
    slug: p.slug,
    lib: p.lib,
    name: p.name,
    short: p.short,
    k,
    d,
    mass: 1,
    zeta: round(zeta, 3),
    omega: round(omega, 2),
    period: zeta < 1 ? round((2 * Math.PI) / (omega * Math.sqrt(1 - zeta * zeta)), 3) : null,
    settle,
    ms: Math.round(c.settle * 1000),
    overshoot: numbers.overshoot,
    overshootAt: round(c.peakAt, 3),
    crossings: c.crossings,
    t50: round(c.t50, 3),
    t90: round(c.t90, 3),
    peakSpeed,
    y,
    vel: vel.map((v) => round(v, 3)),
    linear: lin.css,
    points: lin.points,
    linearWorst: round(lin.worst, 4),
    source: p.source,
    original: p.original,
    conversion: p.conversion ?? null,
    note: p.note(numbers),
  };
}

const gap = (a, b) => {
  const T = Math.max(a.settle, b.settle);
  let sum = 0, n = 0;
  for (let t = 0; t <= T; t += 0.005, n++) sum += (spring(t, a.k, a.d) - spring(t, b.k, b.d)) ** 2;
  return round(Math.sqrt(sum / n), 3);
};

const springs = PRESETS.map(build);
for (const s of springs) {
  s.related = springs
    .filter((o) => o.slug !== s.slug)
    .map((o) => ({ slug: o.slug, name: o.name, gap: gap(s, o) }))
    .sort((a, b) => a.gap - b.gap || a.slug.localeCompare(b.slug))
    .slice(0, 4);
}

fs.writeFileSync(OUT, `${JSON.stringify({ libraries: LIBRARIES, springs, threshold: 0.001 })}\n`);
console.log(`springs: ${springs.length} presets -> ${path.relative(root, OUT)} (${(fs.statSync(OUT).size / 1024).toFixed(0)} KB)`);
