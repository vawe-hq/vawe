// The lens (core/surfaces/lens.js) one effect at a time, measured on pixels.
//   node --test --test-concurrency=1 tests/media/lens.test.mjs
// tests/fixtures/pages/lens.html films an HTML screen; `?cfg=` turns ONE effect on over an all-off lens and
// `?only=` shows one feature of the screen. The page is read back with gl.readPixels at a 1920x1080 viewport,
// so one canvas pixel is one CSS pixel. Launches Chrome: not part of the fast unit run.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { REPO_ROOT, serveRepo, RENDER_ARGS } from '../../harness/lib/render-harness.mjs';
import { projectWith, resolveOptions, lookOverride, LOOKS } from '../../core/surfaces/lens.js';
import { installPageFrame } from '../../core/engine/page-seek.js';

const W = 1920, H = 1080;
let server, browser;

before(async () => {
  const { default: puppeteer } = await import('puppeteer');
  server = await serveRepo({ root: REPO_ROOT });
  browser = await puppeteer.launch({ headless: true, args: RENDER_ARGS });
});
after(async () => { await browser?.close(); server?.close(); });

async function newPage() {
  const page = await browser.newPage();
  await page.evaluateOnNewDocument(installPageFrame, { aspect: '16:9', width: W, height: H });
  return page;
}

async function shoot(cfg, { only, src, t = 0.3, scale = 1, draws = 1, probe = [], plain = false, override = null } = {}) {
  const page = await newPage();
  try {
    if (override) await page.evaluateOnNewDocument((o) => { window.__vaweLensOverride = o; }, override);
    await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
    const q = new URLSearchParams({ cfg: JSON.stringify(cfg), scale: String(scale) });
    if (only) q.set('only', only);
    if (src) q.set('src', src);
    if (plain) q.set('raw', '1');
    await page.goto(`http://127.0.0.1:${server.port}/tests/fixtures/pages/lens.html?${q}`, { waitUntil: 'load' });
    const b64 = await page.evaluate(async (tt, n) => {
      for (let i = 0; i < n; i++) for (const fn of window.__vaweFrameHooks) await fn(tt);
      const gl = window.__lens.gl;
      const buf = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
      gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, buf);
      let s = '';
      for (let i = 0; i < buf.length; i += 32768) s += String.fromCharCode(...buf.subarray(i, i + 32768));
      return btoa(s);
    }, t, draws);
    const probes = await page.evaluate((pts, tt) => pts.map(([x, y]) => window.__lens.project(x, y, tt)), probe, t);
    const raw = Buffer.from(b64, 'base64');
    const at = (x, y) => (Math.floor(y) * W + Math.floor(x)) * 4;
    const px = (x, y) => { const i = (H - 1 - Math.floor(y)) * W * 4 + Math.floor(x) * 4; return [raw[i], raw[i + 1], raw[i + 2]]; };
    return { raw, px, at, probes };
  } finally { await page.close(); }
}

const srgb = (v) => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lin = ([r, g, b]) => 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b);
const luma = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const window2 = (img, x0, y0, w, h) => { const out = []; for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) out.push(img.px(x, y)); return out; };
const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
const std = (a) => { const m = mean(a); return Math.sqrt(mean(a.map((v) => (v - m) ** 2))); };
const hash = (img) => createHash('md5').update(img.raw).digest('hex');

test('perspective: project() lands on the pixel where the marker is drawn', async () => {
  const cfg = { tiltY: 0.4, tiltX: 0.2, roll: 0.1, zoom: 1.8, aim: [1300, 700] };
  const img = await shoot(cfg, { only: 'marker', probe: [[1512, 812]] });
  let sx = 0, sy = 0, n = 0;
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) { if (luma(img.px(x, y)) > 128) { sx += x; sy += y; n++; } }
  assert.ok(n > 200, `marker pixels found: ${n}`);
  const [p] = img.probes;
  assert.ok(Math.hypot(sx / n - p.x, sy / n - p.y) < 2, `centroid ${(sx / n).toFixed(1)},${(sy / n).toFixed(1)} vs project ${p.x.toFixed(1)},${p.y.toFixed(1)}`);
  assert.ok(p.visible && p.depth > 0);
});

test('project(): the aim point maps to the middle of the view, a tilted far edge is smaller', () => {
  const base = { tiltX: 0, tiltY: 0, roll: 0, zoom: 1, focal: 1.7, aim: null };
  const mid = projectWith(base, [1920, 1080], { w: W, h: H }, 960, 540);
  assert.ok(Math.abs(mid.x - 960) < 1e-6 && Math.abs(mid.y - 540) < 1e-6 && Math.abs(mid.scale - 1) < 1e-6);
  const tilted = { ...base, tiltY: 0.5 };
  const right = projectWith(tilted, [1920, 1080], { w: W, h: H }, 1800, 540);
  const left = projectWith(tilted, [1920, 1080], { w: W, h: H }, 120, 540);
  assert.ok(right.scale > left.scale, 'tiltY > 0 brings the right edge closer');
});

test('depth of field: sharp at the focus point, blurred at the far edge, flat plane stays sharp', async (t) => {
  const tilt = { tiltY: 0.5, aim: [1100, 650], dof: { focus: [1100, 650], soft: 0, blur: 0 } };
  const sharpness = async (blur, cfg) => {
    const img = await shoot({ ...cfg, dof: { ...cfg.dof, blur } }, { only: 'stripes', probe: [[1100, 650], [560, 650]] });
    const [focusAt, farAt] = img.probes;
    const grad = (x0, y0) => mean(Array.from({ length: 40 * 30 }, (_, i) => { const x = Math.round(x0) - 20 + (i % 40), y = Math.round(y0) - 15 + Math.floor(i / 40); return Math.abs(luma(img.px(x + 1, y)) - luma(img.px(x, y))); }));
    return { focus: grad(focusAt.x, focusAt.y), far: grad(farAt.x, farAt.y) };
  };
  const sharp = await sharpness(0, tilt);
  const soft = await sharpness(0.9, tilt);
  t.diagnostic(`sharpness kept at focus ${(soft.focus / sharp.focus).toFixed(2)}, at far edge ${(soft.far / sharp.far).toFixed(2)}`);
  assert.ok(soft.focus / sharp.focus > 0.85, `at the focus point ${soft.focus.toFixed(1)} vs ${sharp.focus.toFixed(1)}`);
  assert.ok(soft.far / sharp.far < 0.5, `at the far edge ${soft.far.toFixed(1)} vs ${sharp.far.toFixed(1)}`);
  const flat = await sharpness(0.9, { aim: [1100, 650], dof: { focus: [1100, 650], soft: 0 } });
  assert.ok(flat.far / sharp.far > 0.5 || flat.far > 5, 'a plane facing the camera has no depth to defocus');
});

test('depth of field band: inside the band the focus is exactly as sharp as with no blur, outside it still softens', async (t) => {
  const tilt = { tiltY: 0.5, aim: [1100, 650], dof: { focus: [1100, 650], soft: 0, blur: 0 } };
  const grads = async (dof) => {
    const img = await shoot({ ...tilt, dof: { ...tilt.dof, ...dof } }, { only: 'stripes', probe: [[1100, 650], [560, 650], [1160, 650]] });
    const grad = ({ x: x0, y: y0 }) => mean(Array.from({ length: 40 * 30 }, (_, i) => { const x = Math.round(x0) - 20 + (i % 40), y = Math.round(y0) - 15 + Math.floor(i / 40); return Math.abs(luma(img.px(x + 1, y)) - luma(img.px(x, y))); }));
    return { focus: grad(img.probes[0]), far: grad(img.probes[1]), near: grad(img.probes[2]) };
  };
  const sharp = await grads({ blur: 0 });
  const unbanded = await grads({ blur: 0.9 });
  const banded = await grads({ blur: 0.9, band: 4 });
  t.diagnostic(`focus kept ${(banded.focus / sharp.focus).toFixed(3)}, far edge kept ${(banded.far / sharp.far).toFixed(2)}`);
  assert.ok(unbanded.near / sharp.near < 0.97, `without a band the area near the focus softens ${unbanded.near.toFixed(1)} vs ${sharp.near.toFixed(1)}`);
  assert.ok(banded.near / sharp.near > 0.99, `near the focus, inside the band ${banded.near.toFixed(1)} vs ${sharp.near.toFixed(1)}`);
  assert.ok(banded.focus / sharp.focus > 0.99, `inside the band ${banded.focus.toFixed(2)} vs ${sharp.focus.toFixed(2)}`);
  assert.ok(banded.far / sharp.far < 0.6, `the far edge still softens ${banded.far.toFixed(1)} vs ${sharp.far.toFixed(1)}`);
});

test('palette: a 50% grey maps to the stop mix at its brightness', async () => {
  const stops = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [1, 1, 1]];
  const img = await shoot({ palette: { stops } }, { only: 'patch' });
  const [r, g, b] = img.px(1400, 500);
  const expectG = 255 * (128 / 255 * 3 - 1);
  assert.ok(r > 250 && b < 6 && Math.abs(g - expectG) < 8, `got ${r},${g},${b} want 255,${expectG.toFixed(0)},0`);
});

const RISO_BLACK = { amount: 1, inks: [[0, 0, 0]], cell: 10, soft: 0.5, mottle: 0, fibre: 0 };

test('riso: a 50% grey prints as dots of solid ink at its tone, a dark ground prints solid', async () => {
  const img = await shoot({ riso: RISO_BLACK }, { only: 'patch' });
  const lum = window2(img, 1200, 400, 400, 200).map(luma);
  const mid = lum.filter((v) => v > 60 && v < 180).length / lum.length;
  assert.ok(Math.abs(mean(lum) - 128) < 16, `the patch keeps its tone: mean ${mean(lum).toFixed(0)}`);
  assert.ok(mid < 0.3, `the patch is dots, not a flat grey: ${(mid * 100).toFixed(0)}% of pixels are mid-tone`);
  assert.ok(luma(img.px(600, 900)) < 20, `the dark ground is solid ink: ${luma(img.px(600, 900)).toFixed(0)}`);
});

test('riso: a register offset moves the plate by that many CSS px', async () => {
  const still = await shoot({ riso: RISO_BLACK }, { only: 'glyph' });
  const moved = await shoot({ riso: { ...RISO_BLACK, offset: [[20, 0]] } }, { only: 'glyph' });
  assert.ok(luma(still.px(305, 530)) > 200 && luma(moved.px(305, 530)) < 40, 'the white glyph left its old left edge');
  assert.ok(luma(still.px(372, 530)) < 40 && luma(moved.px(372, 530)) > 200, 'and prints 20 px to the right');
});

test('riso: two inks over each other multiply, as an overprint does', async () => {
  const pink = [1, 0.282, 0.69], blue = [0, 0.471, 0.749], paper = [1, 1, 1];
  const img = await shoot({ riso: { amount: 1, inks: [pink, blue], paper, cell: 10, soft: 0.5, mottle: 0, fibre: 0 } }, { only: 'patch' });
  const [r, g, b] = img.px(600, 900);
  const want = pink.map((v, i) => 255 * v * blue[i]);
  assert.ok([r, g, b].every((v, i) => Math.abs(v - want[i]) < 12), `the dark ground is pink times blue: got ${r},${g},${b} want ${want.map(Math.round)}`);
});

test('bloom: a bright glyph lifts the pixels around it, not the far ground', async (t) => {
  const off = await shoot({}, { only: 'glyph' });
  const on = await shoot({ bloom: { strength: 1.5, radius: 30, threshold: 0.2 } }, { only: 'glyph' });
  const near = (img) => mean(window2(img, 310, 470, 40, 12).map(luma));
  const far = (img) => mean(window2(img, 310, 150, 40, 12).map(luma));
  t.diagnostic(`bloom lift ${(near(on) - near(off)).toFixed(1)} levels 20 px above the glyph`);
  assert.ok(near(on) - near(off) > 12, `lift above the glyph ${(near(on) - near(off)).toFixed(1)}`);
  assert.ok(far(on) - far(off) < 2, 'far ground unchanged');
});

test('halation: a bar tints the dark pixels beside it warm, only when on, and OFF is the identity', async (t) => {
  const off = await shoot({}, { only: 'bar' });
  const on = await shoot({ halation: { strength: 1, radius: 60, threshold: 0.5 } }, { only: 'bar' });
  const cold = await shoot({ halation: { strength: 1, radius: 60, threshold: 0.5, tint: [0.1, 0.4, 1] } }, { only: 'bar' });
  const beside = (img) => [0, 1, 2].map((c) => mean(window2(img, 150, 500, 12, 40).map((p) => p[c])));
  const [r0, g0, b0] = beside(off), [r1, g1, b1] = beside(on), [r2, , b2] = beside(cold);
  t.diagnostic(`beside the bar: off ${[r0, g0, b0].map((v) => v.toFixed(1))}, on ${[r1, g1, b1].map((v) => v.toFixed(1))}`);
  assert.ok(r0 < 30, `dark beside the bar with halation off, red ${r0.toFixed(1)}`);
  assert.ok(r1 - r0 > 25 && r1 > g1 && g1 > b1, `warm halo beside the bar, ${r1.toFixed(1)},${g1.toFixed(1)},${b1.toFixed(1)}`);
  assert.ok(b2 > r2, 'a cold tint gives a blue halo');
  const bar = on.px(120, 540);
  assert.deepEqual(bar, off.px(120, 540), 'the bright bar itself is not changed');
  assert.equal(hash(await shoot({ halation: { strength: 0 } }, { only: 'bar' })), hash(off), 'strength 0 is the identity');
});

test('grid: equal-area RGB stripes, one cell per period, no overall tint', async (t) => {
  const img = await shoot({ grid: { amount: 1, cell: 6 }, zoom: 2, aim: [1400, 500] }, { only: 'patch' });
  const cell = 12;
  const rows = Array.from({ length: 24 }, (_, i) => 440 + i);
  const chan = (c) => Array.from({ length: cell * 8 }, (_, i) => mean(rows.map((y) => img.px(700 + i, y)[c])));
  const ch = [0, 1, 2].map(chan);
  const means = ch.map((a) => mean(a.map(srgb)) * 255);
  assert.ok(Math.max(...means) / Math.min(...means) < 1.08, `channel means ${means.map((m) => m.toFixed(1))}`);
  const phase = (a) => { const f = Array(cell).fill(0); a.forEach((v, i) => { f[i % cell] += v; }); return f.indexOf(Math.max(...f)); };
  const [pr, pg, pb] = ch.map(phase);
  t.diagnostic(`grid channel means ${means.map((m) => m.toFixed(1))}, peaks ${pr},${pg},${pb} of ${cell} px`);
  const gap = (a, b) => { const d = Math.abs(a - b) % cell; return Math.min(d, cell - d); };
  assert.ok(Math.abs(gap(pr, pg) - 4) <= 1.5 && Math.abs(gap(pg, pb) - 4) <= 1.5, `channel peaks at ${pr},${pg},${pb} of ${cell} px`);
  const swing = (a) => Math.max(...a) - Math.min(...a);
  assert.ok(swing(ch[1]) > 40, 'the cells are visible');
  const plain = await shoot({ zoom: 2, aim: [1400, 500] }, { only: 'patch' });
  const ratio = mean(window2(img, 700, 440, 96, 24).map(lin)) / mean(window2(plain, 700, 440, 96, 24).map(lin));
  assert.ok(ratio > 0.75 && ratio < 1.05, `the grid keeps ${ratio.toFixed(2)} of the linear light`);
});

test('chromatic aberration: red and blue split by the radial amount in px', async (t) => {
  const img = await shoot({ aberration: { amount: 5 } }, { only: 'bar' });
  const centroid = (c) => { let s = 0, w = 0; for (let x = 40; x < 240; x++) { const v = Math.max(0, img.px(x, 540)[c] - 14); s += x * v; w += v; } return s / w; };
  const sep = centroid(0) - centroid(2);
  const want = 2 * (5 * (960 - 120)) / (0.5 * H);
  t.diagnostic(`R minus B ${sep.toFixed(1)} px, expected ${want.toFixed(1)}`);
  assert.ok(Math.abs(sep - want) < 2, `R minus B ${sep.toFixed(1)} px, expected ${want.toFixed(1)}`);
});

test('tear: rows slide sideways, the same time gives the same rows', async () => {
  const flat = await shoot({}, { only: 'bar' });
  const cfg = { tear: { amount: 40, prob: 1, band: 16 } };
  const a = await shoot(cfg, { only: 'bar' });
  const b = await shoot(cfg, { only: 'bar', draws: 2 });
  const centres = (img) => Array.from({ length: 20 }, (_, k) => { let s = 0, w = 0; for (let x = 0; x < 400; x++) { const v = Math.max(0, luma(img.px(x, 120 + k * 16 + 8)) - 14); s += x * v; w += v; } return s / w; });
  assert.ok(std(centres(flat)) < 0.5, 'a flat lens keeps the bar straight');
  assert.ok(std(centres(a)) > 5, `torn rows spread ${std(centres(a)).toFixed(1)} px`);
  assert.equal(hash(a), hash(b), 'draw(t) is a pure function of t');
});

test('exposure, vignette and grain', async () => {
  const fill = { aim: [1400, 500], zoom: 3.4 };
  const plain = await shoot(fill, { only: 'patch' });
  const dim = await shoot({ ...fill, exposure: 0.5 }, { only: 'patch' });
  const vig = await shoot({ ...fill, vignette: 0.4 }, { only: 'patch' });
  const grain = await shoot({ ...fill, grain: 0.1 }, { only: 'patch' });
  assert.ok(Math.abs(lin(dim.px(960, 540)) / lin(plain.px(960, 540)) - 0.5) < 0.03, 'exposure scales linear light');
  const corner = lin(vig.px(4, 4)) / lin(vig.px(960, 540));
  assert.ok(Math.abs(corner - 0.64) < 0.05, `vignette corner ${corner.toFixed(2)} of the centre in linear light, expected 0.64`);
  const sd = std(window2(grain, 900, 500, 60, 60).map((p) => p[1]));
  assert.ok(sd > 5 && sd < 10, `grain std ${sd.toFixed(1)} of 255, expected about 7.4`);
});

test('bloom: a linear-light tail reaches far past one pass, energy stays sane', async (t) => {
  const edge = 360 + 1;
  const tail = async (radius) => {
    const img = await shoot({ bloom: { strength: 1, radius, threshold: 0.3 } }, { only: 'glyph' });
    const base = mean(Array.from({ length: 20 }, (_, i) => lin(img.px(1200 + i, 530))));
    return (d) => mean(Array.from({ length: 5 }, (_, i) => lin(img.px(edge + d, 528 + i)))) - base;
  };
  const wide = await tail(120), narrow = await tail(8);
  const half = [4, 8, 16, 32, 64, 100].map((d) => [d, wide(d)]);
  const e = wide(4) / Math.E;
  const reach = [4, 8, 16, 32, 64, 100, 140].find((d) => wide(d) < e);
  t.diagnostic(`linear excess at 4/16/64/100 px: ${[4, 16, 64, 100].map((d) => wide(d).toFixed(4))}, tail falls to 1/e at ${reach} px; narrow bloom at 64 px ${narrow(64).toFixed(5)}`);
  assert.ok(wide(64) > 0.004, `a wide halo on the glyph, ${wide(64).toFixed(4)} linear at 64 px`);
  assert.ok(narrow(64) < wide(64) / 4, 'a short radius gives no tail that far out');
  assert.ok(half.every(([, v], i) => i === 0 || v <= half[i - 1][1] + 1e-4), 'the tail falls with distance');
  assert.ok(wide(4) < 0.6, 'bloom adds light without blowing the surround out');
});

test('aperture: an out-of-focus point lights a pentagon of the lens radius', async (t) => {
  const cfg = { dof: { soft: 24, blades: 5, rotation: 0, roundness: 0, bokeh: 0, taps: 64, catEye: 0 } };
  const img = await shoot(cfg, { only: 'point' });
  const cx = 1006, cy = 806;
  const peak = Math.max(...window2(img, cx - 40, cy - 40, 80, 80).map(lin));
  const radii = Array.from({ length: 120 }, (_, k) => {
    const a = (k / 120) * 2 * Math.PI;
    let far = 0;
    for (let r = 4; r < 45; r += 0.5) if (lin(img.px(cx + Math.cos(a) * r, cy + Math.sin(a) * r)) > peak * 0.4) far = r;
    return far;
  });
  const at = (i) => (i + 120) % 120;
  const smooth = radii.map((_, i) => mean(Array.from({ length: 9 }, (_, o) => radii[at(i + o - 4)])));
  const peaks = smooth.filter((v, i) => Array.from({ length: 17 }, (_, o) => smooth[at(i + o - 8)]).every((w, o) => o === 8 || v > w || (v === w && o > 8)) && v > mean(smooth)).length;
  const ratio = Math.max(...smooth) / Math.min(...smooth);
  t.diagnostic(`pentagon: ${peaks} corners, max radius ${Math.max(...smooth).toFixed(1)} px, corner/edge ratio ${ratio.toFixed(2)} (1.24 expected)`);
  assert.ok(peaks === 5, `${peaks} corners`);
  assert.ok(Math.max(...smooth) > 20 && Math.max(...smooth) < 34, `corner radius ${Math.max(...smooth)}`);
  assert.ok(ratio > 1.12 && ratio < 1.4, `corner/edge ratio ${ratio.toFixed(2)}`);
});

const magenta = (img) => { let n = 0; for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) { const [r, g, b] = img.px(x, y); if (r > 200 && g < 60 && b > 200) n++; } return n; };

test('fit: a strong tilt keeps the target in the frame and, with cover, shows no border', async (t) => {
  const tilt = { tiltY: 0.9, tiltX: 0.15, zoom: 2.5, aim: [250, 540], edge: 'black', outside: [1, 0, 1], dof: { blur: 0 } };
  const target = [1850, 540];
  const lost = await shoot(tilt, { only: 'stripes', probe: [target] });
  assert.equal(lost.probes[0].visible, false, 'without a fit the camera looks away from the target');
  assert.ok(magenta(lost) > 1000, 'and the border shows');
  const kept = await shoot({ ...tilt, fit: { keep: target, margin: 80 } }, { only: 'stripes', probe: [target] });
  const p = kept.probes[0];
  assert.ok(p.visible && p.x >= 80 - 1 && p.x <= W - 80 + 1 && p.y >= 80 - 1 && p.y <= H - 80 + 1, `target at ${p.x.toFixed(0)},${p.y.toFixed(0)}`);
  const covered = await shoot({ ...tilt, fit: { keep: target, margin: 80, cover: true } }, { only: 'stripes', probe: [target] });
  t.diagnostic(`border pixels (sampled): lost ${magenta(lost)}, kept ${magenta(kept)}, cover ${magenta(covered)}`);
  assert.equal(magenta(covered), 0, 'cover leaves no border in the frame');
  const extended = await shoot({ ...tilt, edge: 'extend' }, { only: 'stripes' });
  assert.equal(magenta(extended), 0, 'an extended edge never shows the border');
});

test('a canvas source films the same plane as an HTML source', async () => {
  const page = await newPage();
  try {
    await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
    const q = new URLSearchParams({ cfg: JSON.stringify({ palette: { stops: [[0, 0, 0], [1, 1, 1]] } }), src: 'canvas' });
    await page.goto(`http://127.0.0.1:${server.port}/tests/fixtures/pages/lens.html?${q}`, { waitUntil: 'load' });
    await page.evaluate(async () => { for (const fn of window.__vaweFrameHooks) await fn(0.3); });
    const g = await page.evaluate(() => { const gl = window.__lens.gl; const b = new Uint8Array(4); gl.readPixels(1400, 1080 - 500, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, b); return [...b]; });
    assert.ok(Math.abs(g[1] - 128) < 4, `canvas source grey ${g}`);
  } finally { await page.close(); }
});

test('render-page: the lens fixture renders identically twice, in a draft and a final', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lens-determinism-'));
  const script = path.join(REPO_ROOT, 'harness/media/render-page.mjs');
  const page = path.join(REPO_ROOT, 'tests/fixtures/pages/lens.html');
  const frames = (mp4) => execFileSync('ffmpeg', ['-v', 'error', '-i', mp4, '-f', 'framemd5', '-'], { encoding: 'utf8' }).split('\n').filter((l) => l && !l.startsWith('#')).map((l) => l.split(',').pop().trim());
  try {
    for (const mode of [[], ['--final', '--blur', '1']]) {
      const [a, b] = ['a', 'b'].map((n) => {
        const out = path.join(tmp, `${mode.length ? 'final' : 'draft'}-${n}.mp4`);
        execFileSync('node', [script, page, out, '--fps', '10', ...(mode.length ? mode : ['--w', '320', '--h', '180'])], { encoding: 'utf8', stdio: 'pipe' });
        return frames(out);
      });
      assert.ok(a.length >= 10 && new Set(a).size > 1, 'the lens moves with the seek');
      assert.deepEqual(a, b, `${mode.length ? 'final' : 'draft'}: two renders differ`);
    }
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

const stripeEnergy = (img, x0) => mean(Array.from({ length: 400 * 200 }, (_, i) => { const x = x0 + (i % 400), y = 440 + Math.floor(i / 400); return Math.abs(luma(img.px(x + 1, y)) - luma(img.px(x, y))); }));

test('depth of field from a depth canvas: only the half away from the focus depth blurs, and the reverse', async (t) => {
  const kept = async (focus) => {
    const sharp = await shoot({ dof: { blur: 0, soft: 0, focus } }, { src: 'depth' });
    const soft = await shoot({ dof: { blur: 0.9, soft: 0, focus } }, { src: 'depth' });
    return { near: stripeEnergy(soft, 300) / stripeEnergy(sharp, 300), far: stripeEnergy(soft, 1300) / stripeEnergy(sharp, 1300) };
  };
  const nearFocus = await kept(0.2);
  const farFocus = await kept(0.8);
  t.diagnostic(`stripe contrast kept, focus near: near ${nearFocus.near.toFixed(2)} far ${nearFocus.far.toFixed(2)}; focus far: near ${farFocus.near.toFixed(2)} far ${farFocus.far.toFixed(2)}`);
  assert.ok(nearFocus.near > 0.85 && nearFocus.far < 0.3, `focus near: ${JSON.stringify(nearFocus)}`);
  assert.ok(farFocus.far > 0.85 && farFocus.near < 0.3, `focus far: ${JSON.stringify(farFocus)}`);
});

test('depth of field from a depth canvas: a focus point reads its depth', async () => {
  const sharp = await shoot({ dof: { blur: 0, soft: 0 } }, { src: 'depth' });
  const soft = await shoot({ dof: { blur: 0.9, soft: 0, focus: [300, 540] } }, { src: 'depth' });
  assert.ok(stripeEnergy(soft, 300) / stripeEnergy(sharp, 300) > 0.85, 'the near half holds the focus point');
  assert.ok(stripeEnergy(soft, 1300) / stripeEnergy(sharp, 1300) < 0.3, 'the far half blurs');
});

test('depth of field without a depth input is the plane path: the source has no depth upload', async () => {
  const page = await newPage();
  try {
    await page.goto(`http://127.0.0.1:${server.port}/tests/fixtures/pages/lens.html?src=canvas`, { waitUntil: 'load' });
    assert.equal(await page.evaluate(() => typeof window.__lens.source.uploadDepth), 'undefined');
  } finally { await page.close(); }
});

const sum = (img, x0, y0, w, h) => window2(img, x0, y0, w, h).reduce((s, p) => s + lin(p), 0);
const barCentroid = (img, y = 540) => { let s = 0, w = 0; for (let x = 0; x < 260; x++) { const v = Math.max(0, luma(img.px(x, y)) - 14); s += x * v; w += v; } return s / w; };

test('new effects at strength 0 leave the OFF image byte for byte', async () => {
  const zeros = {
    streaks: { strength: 0, length: 900 }, diffusion: { strength: 0, radius: 200 }, softFocus: { amount: 0, radius: 60 },
    tiltShift: { blur: 0, center: 0.2, width: 0.1 }, distortion: { amount: 0 }, weave: { amount: 0 },
  };
  for (const only of ['glyph', 'stripes']) assert.equal(hash(await shoot(zeros, { only })), hash(await shoot({}, { only })), only);
});

test('anamorphic streaks: a bright point spreads light along the row, far more than along the column', async (t) => {
  const off = await shoot({}, { only: 'point' });
  const on = await shoot({ streaks: { strength: 1, length: 600, threshold: 0.5 } }, { only: 'point' });
  const cx = 1006, cy = 806;
  const across = sum(on, cx + 100, cy - 2, 300, 4) - sum(off, cx + 100, cy - 2, 300, 4);
  const along = sum(on, cx - 2, cy - 400, 4, 300) - sum(off, cx - 2, cy - 400, 4, 300);
  t.diagnostic(`streak light 100 to 400 px away: along the row ${across.toFixed(3)}, along the column ${along.toFixed(3)}`);
  assert.ok(across > 0.5, `light along the row ${across.toFixed(3)}`);
  assert.ok(across > 20 * Math.max(along, 1e-4), `row ${across.toFixed(3)} vs column ${along.toFixed(3)}`);
  const cold = await shoot({ streaks: { strength: 1, length: 600, threshold: 0.5, tint: [0, 0, 1] } }, { only: 'point' });
  const [r, , b] = cold.px(cx + 150, cy);
  assert.ok(b > r + 10, `the tint colours the streak, ${r},${b}`);
});

test('diffusion: the blacks beside a bright area lift, the far ground barely does', async (t) => {
  const off = await shoot({}, { only: 'glyph' });
  const on = await shoot({ diffusion: { strength: 0.5, radius: 60 } }, { only: 'glyph' });
  const near = (img) => mean(window2(img, 310, 470, 40, 12).map(luma));
  const far = (img) => mean(window2(img, 1500, 150, 40, 12).map(luma));
  t.diagnostic(`diffusion lift near ${(near(on) - near(off)).toFixed(1)}, far ${(far(on) - far(off)).toFixed(1)} levels`);
  assert.ok(near(on) - near(off) > 10, `lift beside the glyph ${(near(on) - near(off)).toFixed(1)}`);
  assert.ok(far(on) - far(off) < (near(on) - near(off)) / 3, 'the far ground lifts much less');
});

test('soft focus: the image mixes with a blurred copy, so edges lose contrast and the mean light stays', async () => {
  const sharp = await shoot({}, { only: 'stripes' });
  const soft = await shoot({ softFocus: { amount: 0.8, radius: 20 } }, { only: 'stripes' });
  assert.ok(stripeEnergy(soft, 600) < stripeEnergy(sharp, 600) * 0.5, `stripe contrast ${stripeEnergy(soft, 600).toFixed(1)} vs ${stripeEnergy(sharp, 600).toFixed(1)}`);
  assert.ok(Math.abs(mean(window2(soft, 600, 440, 200, 40).map(lin)) / mean(window2(sharp, 600, 440, 200, 40).map(lin)) - 1) < 0.1, 'the mean light holds');
});

test('tilt-shift: the band stays sharp, the stripes above and below blur', async (t) => {
  const cfg = { tiltShift: { center: 0.6, width: 0.2, blur: 30 } };
  const sharp = await shoot({}, { only: 'stripes' });
  const shifted = await shoot(cfg, { only: 'stripes' });
  const energy = (img, y0) => mean(Array.from({ length: 400 * 20 }, (_, i) => { const x = 500 + (i % 400), y = y0 + Math.floor(i / 400); return Math.abs(luma(img.px(x + 1, y)) - luma(img.px(x, y))); }));
  const kept = (y0) => energy(shifted, y0) / energy(sharp, y0);
  t.diagnostic(`stripe contrast kept: top ${kept(310).toFixed(2)}, middle ${kept(640).toFixed(2)}, bottom ${kept(950).toFixed(2)}`);
  assert.ok(kept(310) < 0.5 && kept(950) < 0.5, 'the top and bottom stripes blur');
  assert.ok(kept(640) > 0.9, 'the middle stays sharp');
});

test('distortion: barrel pulls an edge feature inward, pincushion pushes it outward, project() follows', async (t) => {
  const at = async (amount) => shoot({ distortion: { amount } }, { only: 'bar', probe: [[120, 540]] });
  const flat = await at(0), barrel = await at(0.12), pin = await at(-0.12);
  const [c0, cb, cp] = [flat, barrel, pin].map((i) => barCentroid(i));
  t.diagnostic(`bar centre: flat ${c0.toFixed(1)}, barrel ${cb.toFixed(1)} (project ${barrel.probes[0].x.toFixed(1)}), pincushion ${cp.toFixed(1)} (project ${pin.probes[0].x.toFixed(1)})`);
  assert.ok(Math.abs(c0 - 120) < 0.6, `flat ${c0}`);
  assert.ok(cb > c0 + 10, `barrel moves the bar inward, ${cb.toFixed(1)}`);
  assert.ok(cp < c0 - 10, `pincushion moves the bar outward, ${cp.toFixed(1)}`);
  assert.ok(Math.abs(cb - barrel.probes[0].x) < 1.5 && Math.abs(cp - pin.probes[0].x) < 1.5, 'project() lands on the warped bar');
});

test('gate weave: the image moves with the frame and the seed, project() follows, and off is still', async (t) => {
  const at = async (cfg, time) => shoot(cfg, { only: 'bar', t: time, probe: [[120, 540]] });
  const cfg = { weave: { amount: 14 } };
  const [a, b, still, other] = [await at(cfg, 0.3), await at(cfg, 0.6), await at({}, 0.3), await at({ ...cfg, seed: 9 }, 0.3)];
  const [ca, cb, cs, co] = [a, b, still, other].map((i) => barCentroid(i));
  t.diagnostic(`bar centre: off ${cs.toFixed(2)}, frame 9 ${ca.toFixed(2)}, frame 18 ${cb.toFixed(2)}, seed 9 ${co.toFixed(2)}`);
  assert.ok(Math.abs(cs - 120) < 0.6, 'off: no weave');
  assert.ok(Math.abs(ca - cb) > 1 && Math.abs(ca - co) > 1, 'a new frame and a new seed move the image');
  assert.ok(Math.abs(ca - cs) <= 14 * 0.6 + 1 && Math.abs(cb - cs) <= 14 * 0.6 + 1, 'the shift stays inside the amount');
  assert.ok(Math.abs(ca - a.probes[0].x) < 1 && Math.abs(cb - b.probes[0].x) < 1, 'project() follows the weave');
  assert.equal(hash(await at(cfg, 0.3)), hash(a), 'the same frame is the same pixels');
});

test('looks: the page wins over the look, the override wins over the page, no look is the old default', () => {
  assert.equal(resolveOptions({}, null).grid.amount, 0.9, 'no look: the filmed-screen defaults');
  const look = resolveOptions({ look: 'film-halation' }, null);
  assert.equal(look.halation.strength, LOOKS['film-halation'].halation.strength, 'the look sets its effects');
  assert.equal(look.grid.amount, 0, 'a named look starts from a flat lens, not the defaults');
  assert.equal(resolveOptions({ look: 'film-halation', grain: 0.2, halation: { radius: 10 } }, null).grain, 0.2, 'a page option beats the look');
  assert.deepEqual([resolveOptions({ look: 'film-halation', halation: { radius: 10 } }, null).halation.radius, resolveOptions({ look: 'film-halation', halation: { radius: 10 } }, null).halation.strength], [10, 1], 'a nested page option beats one key only');
  assert.equal(resolveOptions({ look: 'film-halation', grain: 0.2 }, { grain: 0.7 }).grain, 0.7, 'the override beats the page');
  assert.equal(resolveOptions({ look: 'film-halation' }, { look: 'cyanotype' }).palette.stops.length, 6, 'the override look replaces the page look');
  assert.throws(() => resolveOptions({ look: 'nope' }, null), /unknown look "nope"; valid: clean, dream-bloom/);
});

test('looks: an override look turns the page effects off and keeps its camera and focus', () => {
  const page = { zoom: 2, tiltY: 0.3, dof: { blur: 0.7 }, bloom: { strength: 1.2 }, palette: { stops: [[0, 0, 0], [1, 1, 1]] } };
  const p = resolveOptions(page, lookOverride('clean'));
  assert.deepEqual([p.zoom, p.tiltY, p.dof.blur], [2, 0.3, 0.7], 'camera and focus stay');
  assert.deepEqual([p.bloom.strength, p.palette, p.grid.amount, p.grain], [0, null, 0, 0], 'every effect is off');
  assert.equal(resolveOptions(page, lookOverride('crt')).grid.amount, 0.9, 'the look turns its own on');
  assert.throws(() => lookOverride('nope'), /unknown look/);
});

test('looks: lens({ look }) films the look, and the preview override swaps it', async () => {
  const beside = (img) => mean(window2(img, 150, 500, 12, 40).map((p) => p[0]));
  const clean = await shoot({ look: 'clean' }, { only: 'bar', plain: true });
  const halation = await shoot({ look: 'film-halation', vignette: 0, grain: 0 }, { only: 'bar', plain: true });
  assert.ok(beside(halation) - beside(clean) > 15, `the look lights the dark beside the bar, ${beside(clean).toFixed(1)} to ${beside(halation).toFixed(1)}`);
  const swapped = await shoot({ look: 'film-halation', vignette: 0, grain: 0 }, { only: 'bar', plain: true, override: lookOverride('clean') });
  assert.equal(hash(swapped), hash(clean), 'the override look beats the page look');
});
