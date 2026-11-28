import test from 'node:test';
import assert from 'node:assert/strict';
import { easeFn, GSAP_EASE_VARS, PAGE_EASE_VARS } from '../../core/motion/presets.js';
import { GSAP_EASE_NAMES } from '../../core/motion/gsap-eases.js';

const US = [0, 0.25, 0.5, 0.75, 1];
const bounceOut = (p) => (p < 1 / 2.75 ? 7.5625 * p * p : p < 2 / 2.75 ? 7.5625 * Math.pow(p - 1.5 / 2.75, 2) + 0.75 : p < 2.5 / 2.75 ? 7.5625 * Math.pow(p - 2.25 / 2.75, 2) + 0.9375 : 7.5625 * Math.pow(p - 2.625 / 2.75, 2) + 0.984375);
const back = (s) => (p) => (p ? (p - 1) * (p - 1) * ((s + 1) * (p - 1) + s) + 1 : 0);

// Closed forms from the GSAP docs and gsap.js, written independently of core/motion/gsap-eases.js.
const FORMULAS = {
  'none': (p) => p,
  'linear': (p) => p,
  'power1.in': (p) => p ** 2, 'power1.out': (p) => 1 - (1 - p) ** 2, 'power1.inOut': (p) => (p < 0.5 ? (2 * p) ** 2 / 2 : 1 - (2 * (1 - p)) ** 2 / 2),
  'power2.in': (p) => p ** 3, 'power2.out': (p) => 1 - (1 - p) ** 3, 'power2.inOut': (p) => (p < 0.5 ? (2 * p) ** 3 / 2 : 1 - (2 * (1 - p)) ** 3 / 2),
  'power3.in': (p) => p ** 4, 'power3.out': (p) => 1 - (1 - p) ** 4, 'power3.inOut': (p) => (p < 0.5 ? (2 * p) ** 4 / 2 : 1 - (2 * (1 - p)) ** 4 / 2),
  'power4.in': (p) => p ** 5, 'power4.out': (p) => 1 - (1 - p) ** 5, 'power4.inOut': (p) => (p < 0.5 ? (2 * p) ** 5 / 2 : 1 - (2 * (1 - p)) ** 5 / 2),
  'sine.in': (p) => 1 - Math.cos(p * Math.PI / 2), 'sine.out': (p) => Math.sin(p * Math.PI / 2), 'sine.inOut': (p) => -(Math.cos(Math.PI * p) - 1) / 2,
  'expo.in': (p) => (p ? 2 ** (10 * (p - 1)) : 0), 'expo.out': (p) => 1 - (1 - p ? 2 ** (-10 * p) : 0),
  'expo.inOut': (p) => (p < 0.5 ? (2 * p ? 2 ** (10 * (2 * p - 1)) : 0) / 2 : 1 - (2 * (1 - p) ? 2 ** (10 * (1 - 2 * p)) : 0) / 2),
  'circ.in': (p) => 1 - Math.sqrt(1 - p * p), 'circ.out': (p) => Math.sqrt(1 - (p - 1) ** 2), 'circ.inOut': (p) => (p < 0.5 ? (1 - Math.sqrt(1 - 4 * p * p)) / 2 : (Math.sqrt(1 - (2 - 2 * p) ** 2) + 1) / 2),
  'back.out': back(1.70158), 'back.in': (p) => 1 - back(1.70158)(1 - p),
  'bounce.out': bounceOut, 'bounce.in': (p) => 1 - bounceOut(1 - p),
};

test('the GSAP eases match their published formulas at 0, 0.25, 0.5, 0.75 and 1', () => {
  for (const [name, formula] of Object.entries(FORMULAS)) {
    for (const u of US) assert.ok(Math.abs(easeFn(name)(u) - formula(u)) < 1e-9, `${name} at ${u}`);
  }
});

test('every GSAP ease starts at 0 and ends at 1 and has a CSS var', () => {
  for (const name of GSAP_EASE_NAMES) {
    assert.ok(Math.abs(easeFn(name)(0)) < 1e-9 && Math.abs(easeFn(name)(1) - 1) < 1e-9, name);
  }
  assert.equal(Object.keys(GSAP_EASE_VARS).length, GSAP_EASE_NAMES.length - 1);
});

test('a bare family is its .out and back.out(1.5) takes its overshoot', () => {
  assert.equal(easeFn('power2')(0.3), easeFn('power2.out')(0.3));
  assert.notEqual(easeFn('back.out(1.5)')(0.5), easeFn('back.out')(0.5));
  assert.ok(Math.abs(easeFn('back.out(1.5)')(0.5) - back(1.5)(0.5)) < 1e-9);
  assert.ok(easeFn('back.out')(0.7) > 1);
});

test('each GSAP ease is a CSS custom property holding linear()', () => {
  for (const name of ['power1-in', 'power2-out', 'power4-in-out', 'sine-in-out', 'expo-out', 'circ-in', 'back-out', 'elastic-out', 'bounce-out', 'linear']) {
    assert.ok(PAGE_EASE_VARS[name]?.startsWith('linear('), name);
  }
  assert.ok(PAGE_EASE_VARS.land.startsWith('linear('));
});

test('the linear() string follows the exact curve within 0.002', () => {
  const stops = GSAP_EASE_VARS['power2-in-out'].slice(7, -1).split(',').map(Number);
  const f = easeFn('power2.inOut');
  stops.forEach((v, i) => assert.ok(Math.abs(v - f(i / (stops.length - 1))) < 1e-4));
});

test('an unknown name still lists the valid ones, GSAP names too', () => {
  assert.throws(() => easeFn('power9.out'), /unknown ease "power9.out".*land.*power2\.out/s);
  assert.throws(() => easeFn('back.out(x)'), /unknown ease/);
});
