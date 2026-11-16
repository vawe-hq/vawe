import test from 'node:test';
import assert from 'node:assert/strict';
import { easeFn, BANDS, bandSeconds, bandOf, pickBand, enterSpecs, enter, leaveSpecs, leave, staggerTimes, stagger, layerTiming, layer, EASE, EASE_HANDLES, keysSpec, keys, cameraSpecs, parallax, focusSpecs, ramp, rampSpecs, rampSpeeds } from '../../core/motion/presets.js';
import { peakValue, overshoots } from '../../harness/lib/ease-curve.mjs';
import { handleCurve, HANDLE_REGISTRY } from '../../core/motion/motion.js';

function fakeEl() {
  const anims = [];
  return {
    anims,
    animate(keyframes, timing) {
      const a = { id: timing.id, keyframes, timing, effect: { getTiming: () => timing } };
      anims.push(a);
      return a;
    },
    getAnimations: () => anims,
  };
}

test('bands name the speed-bands doc ranges and pick by duration and distance', () => {
  assert.deepEqual(Object.keys(BANDS), ['energy', 'professional', 'gravity', 'cinematic']);
  assert.equal(bandSeconds('gravity'), 0.65);
  assert.equal(bandOf(0.1), 'energy');
  assert.equal(bandOf(0.45), 'professional');
  assert.equal(bandOf(3), 'cinematic');
  assert.equal(pickBand(900), 'cinematic');
  assert.equal(pickBand(150), 'energy');
  assert.throws(() => bandSeconds('slow'), /valid: energy professional gravity cinematic/);
});

test('enter lands on the land ease, fades in the first 40% and holds both ends', () => {
  const [move, fade] = enterSpecs({ at: 1.2, band: 'gravity' });
  assert.equal(move.timing.easing, EASE.land);
  assert.match(EASE.land, /^linear\(0, /);
  assert.equal(move.timing.delay, 1200);
  assert.equal(move.timing.duration, 650);
  assert.equal(fade.timing.duration, 260);
  assert.equal(move.timing.fill, 'both');
  assert.deepEqual(move.keyframes[1], { translate: '0 0', scale: '1' });
  assert.deepEqual(fade.keyframes.map((k) => k.opacity), [0, 1]);
});

test('enter with blur clears the blur as the move settles', () => {
  const [move] = enterSpecs({ blur: 8 });
  assert.equal(move.keyframes[0].filter, 'blur(8px)');
  assert.equal(move.keyframes[1].filter, 'blur(0px)');
});

test('leave runs 0.6 of the entrance it finds, accelerates, and fills forwards only', () => {
  const el = fakeEl();
  enter(el, { band: 'gravity' });
  const [a] = leave(el, { end: 3 });
  assert.equal(a.timing.duration, 390);
  assert.equal(a.timing.delay, 2610);
  assert.equal(a.timing.easing, EASE.launch);
  assert.equal(a.timing.fill, 'forwards');
});

test('leave with no entrance takes 0.6 of the band it is given', () => {
  const [spec] = leaveSpecs({ at: 1, band: 'professional' });
  assert.equal(spec.timing.duration, 240);
  assert.equal(spec.timing.delay, 1000);
});

test('stagger gaps stay in 30 to 80 ms, fit 0.5 s, and repeat for one seed', () => {
  for (const n of [3, 6, 20]) {
    const t = staggerTimes(n, { at: 2 });
    assert.equal(t[0], 2);
    const gaps = t.slice(1).map((x, i) => x - t[i]);
    for (const g of gaps) assert.ok(g >= 0.0299 && g <= 0.0801, `gap ${g}`);
    assert.deepEqual(staggerTimes(n, { at: 2 }), t);
    if (n <= 11) assert.ok(t[n - 1] - t[0] <= 0.5 * 1.26);
  }
  assert.notDeepEqual(staggerTimes(5, { seed: 2 }), staggerTimes(5, { seed: 3 }));
});

test('stagger never lands two items on one 60 fps frame', () => {
  const els = [fakeEl(), fakeEl(), fakeEl(), fakeEl()];
  stagger(els, { at: 0, band: 'energy' });
  const lands = els.map((e) => Math.round((e.anims[0].timing.delay + e.anims[0].timing.duration) * 60 / 1000));
  assert.equal(new Set(lands).size, els.length);
});

test('layer starts the secondary before the lead lands, one band slower', () => {
  assert.deepEqual(layerTiming({ at: 1, band: 'gravity' }), { at: 1.455, band: 'cinematic' });
  const main = fakeEl(), second = fakeEl();
  layer(main, second, { at: 1, band: 'professional', overlap: 0.5 });
  assert.equal(second.anims[0].timing.delay, 1200);
  assert.equal(second.anims[0].timing.duration, 650);
  const land = main.anims[0].timing.delay + main.anims[0].timing.duration;
  assert.ok(second.anims[0].timing.delay < land);
});

test('layer staggers a list of secondaries', () => {
  const main = fakeEl(), parts = [fakeEl(), fakeEl(), fakeEl()];
  layer(main, parts, { band: 'energy' });
  const starts = parts.map((p) => p.anims[0].timing.delay);
  assert.ok(starts[0] < starts[1] && starts[1] < starts[2]);
});

test('leave accepts ease: leave, enter accepts any EASE name, an unknown name throws', () => {
  const [a] = leaveSpecs({ at: 0, band: 'gravity', ease: 'leave' });
  assert.equal(a.timing.easing, EASE.leave);
  assert.equal(enterSpecs({ ease: 'settle' })[0].timing.easing, EASE.settle);
  assert.throws(() => enterSpecs({ ease: 'zoom' }), /valid: land landSoft settle swap glide carry leave launch/);
});

test('the handle numbers follow the Lottie and HyperFrames data', () => {
  const at = (n) => HANDLE_REGISTRY.pick(n);
  assert.deepEqual(at('fling'), { influence: 12, speed: 4.8 });
  assert.deepEqual(at('overshoot'), { influence: 35, speed: -0.4 });
  assert.deepEqual(at('long'), { influence: 60, speed: 0 });
  assert.deepEqual(at('hang'), { influence: 75, speed: 0 });
  assert.equal(at('easyEase').speed, 0);
});

function parseLinear(str) {
  return str.slice('linear('.length, -1).split(',').map(Number);
}

test('every EASE is a linear() from its handle pair, starts at 0 and ends at 1', () => {
  assert.deepEqual(Object.keys(EASE), Object.keys(EASE_HANDLES));
  for (const [name, [out, into]] of Object.entries(EASE_HANDLES)) {
    const pts = parseLinear(EASE[name]), f = handleCurve(out, into);
    assert.equal(pts[0], 0);
    assert.equal(pts.at(-1), 1);
    pts.forEach((v, i) => assert.ok(Math.abs(v - f(i / (pts.length - 1))) < 1e-3, `${name} sample ${i}`));
  }
  assert.ok(parseLinear(EASE.land)[2] > 0.15, 'land leaves fast');
});

test('keys: a two-key table is the handleCurve of its two handles', () => {
  const { keyframes, timing } = keysSpec('translate', [[1, '0 0', 'fling'], [2.5, '0 40px', 'hang']]);
  assert.equal(keyframes.length, 2);
  assert.deepEqual(keyframes.map((k) => k.offset), [0, 1]);
  assert.equal(timing.delay, 1000);
  assert.equal(timing.duration, 1500);
  const pts = parseLinear(keyframes[0].easing), f = handleCurve('fling', 'hang');
  pts.forEach((v, i) => assert.ok(Math.abs(v - f(i / (pts.length - 1))) < 1e-3));
  assert.equal(keyframes[1].easing, undefined);
});

test('keys: a three-key table has two segment easings and offsets from times', () => {
  const el = fakeEl();
  keys(el, 'scale', [[0, 1, { out: 'fling' }], [1, 1.2, 'easyEase'], [4, 1, { in: 'long' }]]);
  const { keyframes } = el.anims[0];
  assert.deepEqual(keyframes.map((k) => k.offset), [0, 0.25, 1]);
  assert.match(keyframes[0].easing, /^linear\(0, /);
  assert.match(keyframes[1].easing, /^linear\(0, /);
  assert.notEqual(keyframes[0].easing, keyframes[1].easing);
  assert.equal(keyframes[2].easing, undefined);
});

test('keys: no handles is a straight segment; bad tables throw', () => {
  assert.equal(keysSpec('x', [[0, 0], [1, 1]]).keyframes[0].easing, 'linear');
  assert.throws(() => keysSpec('x', [[0, 0]]), /two keys/);
  assert.throws(() => keysSpec('x', [[1, 0], [1, 1]]), /increase/);
});

test('easeFn samples a named ease, and pop passes its mark', () => {
  assert.equal(easeFn('land')(0), 0);
  assert.equal(easeFn('land')(1), 1);
  assert.ok(Math.max(...Array.from({ length: 101 }, (_, i) => easeFn('pop')(i / 100))) > 1.1);
  assert.throws(() => easeFn('nope'), /unknown ease/);
});

test('nudge overshoots by a few per cent, which the dev check counts', () => {
  const peak = peakValue(EASE.nudge);
  assert.ok(peak > 1.03 && peak < 1.1, `peak ${peak}`);
  assert.equal(overshoots(EASE.nudge, 0.01), true);
  assert.equal(overshoots(EASE.land, 0.01), false);
});

test('stagger nudgeEvery lands every nth element on nudge', () => {
  const els = [fakeEl(), fakeEl(), fakeEl(), fakeEl(), fakeEl(), fakeEl()];
  stagger(els, { nudgeEvery: 3 });
  assert.deepEqual(els.map((e) => e.anims[0].timing.easing === EASE.nudge), [false, false, true, false, false, true]);
});

test('camera: push, pull, drift and whips are transforms on one wrapper', () => {
  const [push] = cameraSpecs({ kind: 'push', at: 1, duration: 2, origin: '30% 40%' });
  assert.equal(push.timing.easing, EASE.glide);
  assert.equal(push.timing.duration, 2000);
  assert.deepEqual(push.keyframes.map((k) => k.scale), ['1', '1.12']);
  assert.equal(push.keyframes[0].transformOrigin, '30% 40%');
  assert.deepEqual(cameraSpecs({ kind: 'pull' })[0].keyframes.map((k) => k.scale), ['1.15', '1']);
  const [drift] = cameraSpecs({ kind: 'drift', duration: 4, from: 1.12, to: 1.15 });
  assert.deepEqual(drift.keyframes.map((k) => k.translate), ['0% 0%', '-1.5% -0.8%']);
  const [out] = cameraSpecs({ kind: 'whipOut' }), [into] = cameraSpecs({ kind: 'whipIn' });
  assert.deepEqual(out.keyframes.map((k) => k.translate), ['0% 0%', '-100% 0%']);
  assert.deepEqual(into.keyframes.map((k) => k.translate), ['100% 0%', '0% 0%']);
  assert.equal(out.timing.easing, EASE.launch);
  assert.equal(into.timing.easing, EASE.land);
  assert.throws(() => cameraSpecs({ kind: 'spin' }), /unknown camera/);
});

test('parallax moves a layer by its depth', () => {
  const [ground, front] = [fakeEl(), fakeEl()];
  parallax([[ground, 0.5], [front, 2]], { kind: 'push', duration: 1 });
  assert.deepEqual(ground.anims[0].keyframes.map((k) => k.scale), ['1', '1.06']);
  assert.deepEqual(front.anims[0].keyframes.map((k) => k.scale), ['1', '1.24']);
});

test('focus clears a blur from small and faint to sharp', () => {
  const [spec] = focusSpecs({ at: 1, blur: 8, scale: 0.85, opacity: 0.6 });
  assert.deepEqual(spec.keyframes[0], { filter: 'blur(8px)', scale: '0.85', opacity: '0.6' });
  assert.deepEqual(spec.keyframes[1], { filter: 'blur(0px)', scale: '1', opacity: '1' });
  assert.equal(spec.timing.delay, 1000);
});

function linearPoints(easing) {
  return easing.slice('linear('.length, -1).split(', ').map(Number);
}
function atU(points, u) {
  const x = u * (points.length - 1), i = Math.min(points.length - 2, Math.floor(x));
  return points[i] + (points[i + 1] - points[i]) * (x - i);
}
const slope = (points, from, to) => (atU(points, to) - atU(points, from)) / (to - from);

for (const kind of ['scaleOut', 'scaleIn', 'x', 'y']) {
  test(`ramp ${kind}: same velocity either side of the cut, monotonic, ends on its targets`, () => {
    const [out, into] = rampSpecs({ at: 5, kind });
    const s = rampSpeeds({ kind });
    assert.ok(Math.abs(s.velocity.out - s.velocity.in) / s.velocity.out < 0.02);
    const outP = linearPoints(out.timing.easing), inP = linearPoints(into.timing.easing);
    for (const p of [outP, inP]) for (let i = 1; i < p.length; i++) assert.ok(p[i] >= p[i - 1], 'monotonic');
    const h = 1 / 256;
    const vOut = (s.amount / s.dOut) * slope(outP, 1 - h, 1), vIn = (s.inAmount / s.dIn) * slope(inP, 0, h);
    assert.ok(Math.abs(vOut - vIn) / vOut < 0.02, `sampled velocities ${vOut} vs ${vIn}`);
    assert.ok(outP[0] === 0 && outP.at(-1) === 1 && inP[0] === 0 && inP.at(-1) === 1);
    const prop = kind.startsWith('scale') ? 'scale' : 'translate';
    assert.equal(into.keyframes.at(-1)[prop], kind.startsWith('scale') ? '1' : '0% 0%');
    assert.equal(out.timing.delay + out.timing.duration, 5000);
    assert.equal(into.timing.delay, 5000);
    assert.equal(out.timing.duration + into.timing.duration, 450);
    assert.ok(out.timing.duration < into.timing.duration);
  });
}

test('ramp: the outgoing accelerates and the incoming decelerates, in the same direction', () => {
  const [out, into] = rampSpecs({ at: 2, kind: 'scaleOut' });
  const [o, i] = [linearPoints(out.timing.easing), linearPoints(into.timing.easing)];
  assert.ok(slope(o, 0, 0.1) < slope(o, 0.9, 1));
  assert.ok(slope(i, 0, 0.1) > slope(i, 0.9, 1));
  assert.ok(Number(out.keyframes.at(-1).scale) < 1 && Number(into.keyframes[0].scale) > 1);
  const [slideOut, slideIn] = rampSpecs({ at: 2, kind: 'x', dir: 1 });
  assert.equal(slideOut.keyframes.at(-1).translate, '-40% 0%');
  assert.equal(slideIn.keyframes[0].translate, '60% 0%');
});

test('ramp hides the outgoing from the cut and the incoming before it; unknown kind throws', () => {
  const [, , gone, wait] = rampSpecs({ at: 3 });
  assert.equal(gone.timing.delay, 3000);
  assert.equal(gone.timing.fill, 'forwards');
  assert.equal(wait.timing.duration, 3000);
  assert.throws(() => rampSpecs({ kind: 'spin' }), /unknown ramp/);
  const [a, b] = [fakeEl(), fakeEl()];
  ramp(a, b, { at: 1 });
  assert.equal(a.anims.length, 2);
  assert.equal(b.anims.length, 2);
});

test('snap moves 80% of the way by a fifth of the move and lands without overshoot', () => {
  const f = easeFn('snap');
  assert.ok(f(0.2) >= 0.78, `snap at 0.2: ${f(0.2).toFixed(3)}`);
  assert.ok(easeFn('land')(0.2) < 0.7, 'land stays slower than snap');
  assert.ok(Array.from({ length: 101 }, (_, i) => f(i / 100)).every((v) => v <= 1.0001), 'no overshoot');
  assert.match(EASE.snap, /^linear\(/);
});

test('enter overshoot passes the rest pose by that share of the travel at 40% of the move, then settles', () => {
  const [move] = enterSpecs({ from: '0 100px', scale: 0, overshoot: 0.2, ease: 'snap', duration: 0.3 });
  const [start, peak, end] = move.keyframes;
  assert.equal(peak.offset, 0.4);
  assert.equal(peak.scale, '1.2');
  assert.equal(peak.translate, '0 calc((100px) * -0.2)');
  assert.equal(start.easing, EASE.snap);
  assert.equal(peak.easing, EASE.settle);
  assert.deepEqual([end.translate, end.scale], ['0 0', '1']);
  assert.equal(move.timing.easing, 'linear');
  assert.throws(() => enterSpecs({ overshoot: 0.5 }), /overshoot is a share/);
  assert.throws(() => enterSpecs({ overshoot: 0.2, anticipate: 0.1 }), /not both/);
});
