// Views, camera movements, backdrop and depth cue for filming a screen as a product shot: data and pure helpers next to lens.js, which owns the camera.
// No second way to tilt. A view is a pose of the plane (rotateX, rotateY, rotateZ, zoom); a movement is a start and an end drawn from seeded ranges.
// Angles are degrees as CSS reads them: rotateX above 0 tips the top edge away, rotateY above 0 turns the right edge away. lensPose() turns a pose into lens options.
//
// Source of the numbers: a measured study of a product-shot tool's presets (read-only, 2026-10-19). Its four perspective presets are VIEWS below (x/y/z of 15/-45/0, 30/45/0,
// 65/0/-45, -20/45/0, zoom 125 percent). Its screen movements are MOVES: each rotation is a seeded range, a direction sign drawn once per move, and every
// rotateX and rotateY it applies is clamped to +-25 degrees; CLAMP_DEG is 50 here, so a tilted device (the isometric views) keeps its angle. The ranges of its screen generator are copied as they are; where its end
// state adds a random -[0,14] degrees of pitch and -[0,24] of yaw on top of the named end, that noise is dropped so a move settles. Zoom is its percent change
// divided by 100.
import { rng } from '../motion/springs.js';

export const CLAMP_DEG = 50;

// The lens zoom of a view is by sight on a 16:9 screen in a 16:9 frame.
export const VIEWS = {
  flat: { x: 0, y: 0, z: 0, zoom: 0.82 },
  'side-angle': { x: 15, y: -45, z: 0, zoom: 0.78 },
  isometric: { x: 30, y: 45, z: 0, zoom: 0.6 },
  'top-diagonal': { x: 65, y: 0, z: -45, zoom: 0.55 },
  'reverse-isometric': { x: -20, y: 45, z: 0, zoom: 0.58 },
};

// An axis is [direction, low, high]: the value is the seeded direction ('P' for pitch, 'U' for yaw, 'UP' for both) times a draw from low to high, so a negative
// range turns the other way. zoom is [low, high] as a share of the view's zoom. An axis left out is 0.
export const MOVES = {
  'focus-push': { from: { x: ['P', 0, 30], y: ['U', 0, 40], z: ['UP', 0, 6], zoom: [-0.38, -0.1] }, to: {} },
  'focus-pull': { from: { x: ['P', 0, 30], y: ['U', 18, 52], z: ['UP', 0, 6], zoom: [0.1, 0.42] }, to: { zoom: [-0.18, -0.02] } },
  'side-drift': { from: { x: ['P', 4, 24], y: ['U', 12, 42] }, to: { y: ['U', 2, 7] } },
  'angle-settle': { from: { x: ['P', 12, 42], y: ['U', 22, 58], zoom: [-0.24, -0.02] }, to: { x: ['U', 1, 5], y: ['U', 2, 7], zoom: [0.03, 0.16] } },
  'soft-orbit': { from: { x: ['P', 6, 30], y: ['U', 20, 52] }, to: { x: ['P', 3, 10], y: ['U', -15, -7] } },
  'diagonal-rise': { from: { x: ['P', -46, -18], y: ['U', 14, 50], z: ['U', 4, 10], zoom: [-0.32, -0.08] }, to: { z: ['U', -6, -2], zoom: [0.04, 0.2] } },
  'close-orbit': { from: { x: ['P', 8, 28], y: ['U', -62, -30], z: ['UP', 3, 9], zoom: [0.22, 0.54] }, to: { y: ['U', 6, 14], zoom: [-0.22, -0.06] } },
  'wide-sweep': { from: { x: ['P', -22, -4], y: ['U', 36, 68], zoom: [-0.5, -0.24] }, to: { x: ['P', 5, 14], y: ['U', -18, -8], zoom: [0.08, 0.28] } },
  'isometric-glide': { from: { x: ['', 46, 56], y: ['U', 12, 30], z: ['U', 40, 48], zoom: [-0.26, -0.08] }, to: { x: ['', 36, 48], y: ['U', -26, -8], z: ['U', 30, 42], zoom: [0.05, 0.22] } },
  'isometric-reveal': { from: { x: ['', 24, 40], y: ['U', -24, -10], z: ['U', 18, 32], zoom: [-0.34, -0.16] }, to: { x: ['', 47, 54], y: ['U', 10, 30], z: ['U', 42, 48], zoom: [0.04, 0.18] } },
};

const rad = (degrees) => (degrees * Math.PI) / 180;
const clamp = (v, limit) => Math.max(-limit, Math.min(limit, v));

/** The lens options of a pose { x, y, z, zoom } in degrees: { tiltX, tiltY, roll, zoom }. Pure. */
export const lensPose = ({ x = 0, y = 0, z = 0, zoom = 1 }) => ({ tiltX: -rad(x), tiltY: -rad(y), roll: rad(z), zoom });

/** A named view as a pose, or a pose passed through. Throws on an unknown name. Pure. */
export function view(name) {
  if (typeof name !== 'string') return name;
  if (!(name in VIEWS)) throw new Error(`lens-views: unknown view "${name}"; valid: ${Object.keys(VIEWS).join(', ')}`);
  return VIEWS[name];
}

/** A view with its angles scaled (0.5 turns reverse-isometric into 10 and 22.5 degrees); the zoom is kept. Pure. */
export const viewScaled = (name, k) => { const v = view(name); return { x: v.x * k, y: v.y * k, z: v.z * k, zoom: v.zoom }; };

/**
 * A movement drawn with `seed`, as two poses around `base` (a view name or a pose): { from, to }. Rotation about x and y is clamped to CLAMP_DEG after `scale`
 * (the measured clamp), and `scale` shrinks every angle (0.6 keeps a start within 15 degrees). Same name and seed, same move. Throws on an unknown name.
 */
export function moveBetween(name, seed, { base = 'flat', scale = 1 } = {}) {
  if (!(name in MOVES)) throw new Error(`lens-views: unknown move "${name}"; valid: ${Object.keys(MOVES).join(', ')}`);
  const at = view(base);
  const draw = rng(seed);
  const flip = { P: draw() < 0.5 ? -1 : 1, U: draw() < 0.5 ? -1 : 1, '': 1 };
  flip.UP = flip.P * flip.U;
  const span = (lo, hi) => lo + (hi - lo) * draw();
  const axis = (a) => (a ? flip[a[0]] * span(a[1], a[2]) * scale : 0);
  const end = ({ x, y, z, zoom }) => ({
    x: clamp(at.x + axis(x), CLAMP_DEG),
    y: clamp(at.y + axis(y), CLAMP_DEG),
    z: at.z + axis(z),
    zoom: at.zoom * (1 + (zoom ? span(zoom[0], zoom[1]) * scale : 0)),
  });
  const from = end(MOVES[name].from);
  return { from, to: end(MOVES[name].to) };
}

const channel = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

/** Relative luminance 0..1 of an sRGB colour [r, g, b] in 0..1. Pure. */
export const luminance = ([r, g, b]) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);

const DARK_BELOW = 0.18;
const DARK_LIFT = 0.1;
const LIGHT_DROP = 0.06;

/** The backdrop for a page whose edge colour is `page` [r, g, b] in 0..1: close to the page, a little lighter on a dark page and a little darker on a light one, so the page edge still reads. Pure. */
export function backdropFor(page) {
  const dark = luminance(page) < DARK_BELOW;
  return page.map((c) => (dark ? c + DARK_LIFT * (1 - c) : c * (1 - LIGHT_DROP)));
}

/**
 * The depth cue that reads on `backdrop` for a plane of edge colour `page`: soft shadow layers (offsets and blur in shares of the plane's width and px of
 * a 1920 frame), a rim light on the plane's edge and a faint reflection of the page's light below it. A light backdrop gets the plain soft shadow. A dark
 * backdrop swallows a faint shadow, so its layers are denser and tighter, and a rim and a reflection carry the rest. `tint` [r, g, b] colours the rim (a brand cobalt on a cobalt-ink backdrop). Pure.
 */
export function shadowFor(backdrop, page, { tint = null } = {}) {
  if (luminance(backdrop) >= DARK_BELOW) {
    return { mode: 'light', layers: [{ dx: 0.014, dy: 0.042, blur: 34, alpha: 0.3 }, { dx: 0.003, dy: 0.008, blur: 7, alpha: 0.34 }], rim: { alpha: 0, width: 0 }, reflection: { alpha: 0, blur: 0, dy: 0 } };
  }
  const lifted = page.map((c) => c + 0.55 * (1 - c));
  const rim = tint ? lifted.map((c, k) => 0.5 * c + 0.5 * tint[k]) : lifted;
  return { mode: 'dark', layers: [{ dx: 0.01, dy: 0.036, blur: 26, alpha: 0.7 }, { dx: 0.002, dy: 0.008, blur: 6, alpha: 0.85 }], rim: { alpha: 0.3, width: 1.5, color: rim }, reflection: { alpha: 0.07, blur: 44, dy: 0.05 } };
}

export const READ_DEG = 30;

const deg = (radians) => (radians * 180) / Math.PI;

/** The pose in degrees { x, y, z } of lens options { tiltX, tiltY, roll }: the inverse of lensPose. Pure. */
export const poseOf = ({ tiltX = 0, tiltY = 0, roll = 0 }) => ({ x: -deg(tiltX) || 0, y: -deg(tiltY) || 0, z: deg(roll) });

const contrastOf = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
const SHADOW_MIN = 1.2;

/**
 * What the depth cue earns on `backdrop` for a page edge `page` (both [r, g, b] 0..1): the contrast of the page edge against the backdrop, the contrast of the
 * densest shadow against the backdrop, and whether the shadow itself reads (the rim light of a dark backdrop is returned apart). The layers come from shadowFor. Pure.
 */
export function cueRead(backdrop, page, options = {}) {
  const cue = shadowFor(backdrop, page, options);
  const covered = 1 - cue.layers.reduce((keep, l) => keep * (1 - l.alpha), 1);
  const lb = luminance(backdrop);
  const shadow = contrastOf(lb, lb * (1 - covered));
  const rim = cue.rim.alpha > 0 ? contrastOf(lb, luminance(backdrop.map((c, k) => c + (cue.rim.color[k] - c) * cue.rim.alpha))) : 1;
  return { mode: cue.mode, edge: contrastOf(lb, luminance(page)), shadow, rim, visible: shadow >= SHADOW_MIN };
}
