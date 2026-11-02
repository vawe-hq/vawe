import test from 'node:test';
import assert from 'node:assert/strict';
import { advise, clippedShare, edgeSamples, flashProfile, hueOf, lookProblem, lookTable, median, summarise } from '../../harness/media/see/look-math.mjs';
import { BLOCK, channelPhase, channelsSplit, describePattern, powerSpectrum, spectrumPeak } from '../../harness/media/see/texture-math.mjs';
import { autoBox, commonBox, parseBox, zoomProblem } from '../../harness/media/see/zoom-math.mjs';
import { VERBS } from '../../harness/cli/verbs.mjs';

const lumaOf = (rgb) => Uint8Array.from({ length: rgb.length / 3 }, (_, i) => (rgb[i * 3] * 77 + rgb[i * 3 + 1] * 150 + rgb[i * 3 + 2] * 29) >> 8);

function frameOf(w, h, pixel) {
  const rgb = new Uint8Array(w * h * 3);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) rgb.set(pixel(x, y).map((v) => Math.max(0, Math.min(255, Math.round(v)))), (y * w + x) * 3);
  return { w, h, rgb, L: lumaOf(rgb) };
}

const erf = (x) => {
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return x >= 0 ? y : -y;
};

test('flashProfile: a known flash of 3 frames to luma 205 over a 60 floor, with its rise and decay', () => {
  const means = Array(60).fill(60);
  means.splice(20, 5, 60, 198, 205, 150, 60);
  const [f, ...rest] = flashProfile(means, 30);
  assert.equal(rest.length, 0);
  assert.deepEqual({ frames: f.frames, peak: f.peak, base: f.base, rise: f.rise, decay: f.decay }, { frames: 3, peak: 205, base: 60, rise: 2, decay: 2 });
  assert.equal(f.at, 0.7);
});

test('flashProfile: a slow ramp or a cut that stays is not a flash', () => {
  const ramp = Array.from({ length: 80 }, (_, i) => 40 + i);
  assert.equal(flashProfile(ramp, 30).length, 0);
  const cut = [...Array(40).fill(50), ...Array(40).fill(180)];
  assert.equal(flashProfile(cut, 30).length, 0);
});

test('clippedShare: the share of pixels at or above 250', () => {
  const luma = Uint8Array.from([255, 250, 249, 0]);
  assert.equal(clippedShare(luma), 50);
});

test('bloom: a step blurred by sigma 3 measures about 2.56 sigma from 90% to 10%; a sharp step is under 2 px', () => {
  const blurred = frameOf(220, 24, (x) => { const v = 255 * 0.5 * (1 - erf((x - 110) / (3 * Math.SQRT2))); return [v, v, v]; });
  const sharp = frameOf(220, 24, (x) => (x < 110 ? [255, 255, 255] : [0, 0, 0]));
  const wide = median(edgeSamples(blurred).spreads);
  assert.ok(wide > 6.3 && wide < 9.1, `blurred ${wide}`);
  assert.ok(median(edgeSamples(sharp).spreads) < 2);
});

test('chromatic offset: blue shifted 2 px right of red reads +2 along x and +2 along y', () => {
  const box = (x, y, dx, dy) => x >= 60 + dx && x < 140 + dx && y >= 30 + dy && y < 90 + dy;
  const f = frameOf(200, 120, (x, y) => [box(x, y, 0, 0) ? 255 : 0, box(x, y, 0, 0) ? 255 : 0, box(x, y, 2, 2) ? 255 : 0]);
  const e = edgeSamples(f);
  assert.ok(Math.abs(median(e.dx) - 2) < 0.2, `dx ${median(e.dx)}`);
  assert.ok(Math.abs(median(e.dy) - 2) < 0.2, `dy ${median(e.dy)}`);
  const plain = frameOf(200, 120, (x, y) => (box(x, y, 0, 0) ? [255, 255, 255] : [0, 0, 0]));
  assert.ok(Math.abs(median(edgeSamples(plain).dx)) < 0.1);
});

test('glow colour: a red halo reads red, a neutral one neutral', () => {
  assert.equal(hueOf(30, 4, 4).name, 'red');
  assert.equal(hueOf(10, 11, 10).name, 'neutral white');
  const f = frameOf(220, 24, (x) => { const v = 255 * 0.5 * (1 - erf((x - 110) / (6 * Math.SQRT2))); return [v + (x >= 110 ? 40 * Math.exp(-(x - 110) / 10) : 0), v, v]; });
  const e = edgeSamples(f);
  assert.ok(e.halo.length > 5 && e.halo.every((h) => h[0] > h[1] && h[0] > h[2]));
});

function stripes(period, shifts) {
  const block = (c) => Float64Array.from({ length: BLOCK * BLOCK }, (_, i) => 30 + 20 * Math.cos((2 * Math.PI * ((i % BLOCK) - shifts[c])) / period));
  return [block(0), block(1), block(2)];
}

test('texture: period-3 stripes with the channels one pixel apart are RGB-striped, vertical, period 3', () => {
  const [r, g, b] = stripes(3, [0, 1, 2]);
  const luma = r.map((_, i) => 0.3 * r[i] + 0.59 * g[i] + 0.11 * b[i]);
  const peak = spectrumPeak(powerSpectrum(luma));
  const p = describePattern(peak);
  assert.equal(p.kind, 'vertical stripes');
  assert.ok(Math.abs(p.period - 3) < 0.1, `period ${p.period}`);
  const split = channelsSplit(channelPhase(r, peak.fx, peak.fy), channelPhase(g, peak.fx, peak.fy), channelPhase(b, peak.fx, peak.fy));
  assert.equal(split.striped, true);
});

test('texture: period-4 grey stripes are monochrome; horizontal lines and grids are named; noise is none', () => {
  const [r, g, b] = stripes(4, [0, 0, 0]);
  const peak = spectrumPeak(powerSpectrum(r));
  assert.ok(Math.abs(describePattern(peak).period - 4) < 0.1);
  assert.equal(channelsSplit(channelPhase(r, peak.fx, peak.fy), channelPhase(g, peak.fx, peak.fy), channelPhase(b, peak.fx, peak.fy)).striped, false);
  const lines = Float64Array.from({ length: BLOCK * BLOCK }, (_, i) => 30 + 20 * Math.cos((2 * Math.PI * Math.floor(i / BLOCK)) / 5));
  assert.equal(describePattern(spectrumPeak(powerSpectrum(lines))).kind, 'horizontal lines');
  const grid = Float64Array.from({ length: BLOCK * BLOCK }, (_, i) => 30 + 10 * Math.cos((2 * Math.PI * (i % BLOCK)) / 4) + 10 * Math.cos((2 * Math.PI * Math.floor(i / BLOCK)) / 4));
  assert.equal(describePattern(spectrumPeak(powerSpectrum(grid))).kind, 'grid');
  let seed = 7;
  const noise = Float64Array.from({ length: BLOCK * BLOCK }, () => { seed = (seed * 1664525 + 1013904223) >>> 0; return 30 + (seed / 2 ** 32) * 10; });
  assert.equal(describePattern(spectrumPeak(powerSpectrum(noise))).kind, 'none');
});

const film = (over) => summarise({ means: Array(60).fill(50), fps: 30, clips: [0, 0], edges: [{ spreads: [], halo: [], dx: [], dy: [] }], texture: null, ...over });

test('look table and advice: a long weak flash against a short bright one says shorter and brighter', () => {
  const dim = Array(90).fill(50); dim.splice(30, 9, 60, 90, 100, 100, 100, 100, 90, 70, 60);
  const sharp = Array(60).fill(60); sharp.splice(20, 4, 198, 205, 150, 60);
  const a = film({ means: dim, fps: 30 }), b = film({ means: sharp, fps: 30 });
  const table = lookTable(a, b, ['yours', 'ref']).join('\n');
  assert.match(table, /flashes\s+\| 1\s+\| 1/);
  const advice = advise(a, b).join('\n');
  assert.match(advice, /flashes: yours .* ref .* make the flash shorter and brighter/);
  assert.match(lookTable(a, null).join('\n'), /flashes/);
});

test('zoom arguments: box, scale, --vs and --auto are checked', () => {
  assert.deepEqual(parseBox('10,20,300,200'), { x: 10, y: 20, w: 300, h: 200 });
  assert.equal(parseBox('1900,0,100,100'), null);
  assert.equal(parseBox('a,b,c,d'), null);
  assert.equal(zoomProblem({ at: '1', box: '0,0,100,100', scale: 3 }), null);
  assert.match(zoomProblem({ box: '0,0,100,100', scale: 3 }), /--at/);
  assert.match(zoomProblem({ at: '1', scale: 3 }), /--box/);
  assert.match(zoomProblem({ at: '1', box: '0,0,100,100', auto: true, scale: 3 }), /not both/);
  assert.match(zoomProblem({ at: '1', box: '0,0,900,100', scale: 3, vs: 'x' }), /wider/);
  assert.match(zoomProblem({ at: '1', box: '0,0,100,100', scale: 3, atB: '2' }), /--vs/);
  assert.equal(zoomProblem({ at: '1', auto: true, scale: 3 }), null);
  assert.match(lookProblem({ from: '5', to: '2' }), /after/);
});

test('autoBox: centres on a bright text edge', () => {
  const luma = new Uint8Array(1920 * 1080).fill(10);
  for (let y = 600; y < 640; y++) for (let x = 1000; x < 1100; x++) luma[y * 1920 + x] = 255;
  const box = autoBox(luma);
  assert.ok(box.x <= 1050 && box.x + box.w >= 1050 && box.y <= 620 && box.y + box.h >= 620, JSON.stringify(box));
  assert.equal(autoBox(new Uint8Array(1920 * 1080).fill(10)), null);
});

test('commonBox: picks the region bright in both films, not the densest one of film a', () => {
  const plane = (...rects) => {
    const luma = new Uint8Array(1920 * 1080).fill(10);
    for (const [x0, y0, x1, y1] of rects) for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) luma[y * 1920 + x] = 255;
    return luma;
  };
  const stripes = Array.from({ length: 12 }, (_, i) => [200, 200 + i * 8, 280, 204 + i * 8]);
  const a = plane(...stripes, [1000, 600, 1100, 640]);
  const b = plane([1000, 600, 1100, 640]);
  assert.ok(autoBox(a).x < 700, 'film a alone picks its big block');
  const box = commonBox(a, b);
  assert.ok(box.x <= 1050 && box.x + box.w >= 1050 && box.y <= 620 && box.y + box.h >= 620, JSON.stringify(box));
  assert.equal(commonBox(plane(...stripes), plane([1000, 600, 1100, 640])), null);
});

test('verbs: zoom is a mode of frame, and look is part of see', () => {
  const frame = VERBS.find((v) => v.name === 'frame');
  const [zs] = frame.build({ at: '2', box: '0,0,240,135', scale: 3, vs: 'ref-a' }, ['a.mp4']);
  assert.deepEqual(zs.args.slice(0, 3), ['a.mp4', '--at', '2']);
  assert.ok(zs.args.includes('--vs'));
  assert.throws(() => frame.build({ box: '0,0,240,135', scale: 3 }, ['a.mp4']), /--at/);
  assert.equal(VERBS.some((v) => v.name === 'zoom'), false);
  assert.equal(VERBS.some((v) => v.name === 'look'), false);
});
