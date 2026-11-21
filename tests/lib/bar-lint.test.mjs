import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { boxMotion, deadStop, staging, anticipation, spectacleWeak, speedCeiling, overshootShare, textBreathing, textLingers, lingerCeiling, barLint } from '../../harness/lib/bar-lint.mjs';
import { unwaived } from '../../harness/lib/motion-lint.mjs';
import { firedRules, firedLines } from '../../harness/lib/taste-steps.mjs';
import { probeTracks, readHoldProblems, lineNeed } from '../../harness/lib/read-hold.mjs';
import { worldLimit, readNeed, READ_MARGIN_S } from '../../harness/lib/worlds.mjs';
import { EASE } from '../../core/motion/presets.js';
import LIMITS from '../../taste/build/limits.json' with { type: 'json' };

const W = 1920, H = 1080, DT = 0.04;
const frame = (tracks, parent = tracks.map(() => -1)) => ({
  times: tracks[0].map((_, k) => +(k * DT).toFixed(3)), tracks, labels: tracks.map((_, i) => `el${i}`), parent, area: W * H, width: W, height: H,
});
const at = (xs, { y = 300, w = 100, h = 100, alpha = 1 } = {}) => xs.map((x, k) => [x, y, w, h, typeof alpha === 'function' ? alpha(k) : alpha, 1]);
const line = (n, step) => Array.from({ length: n }, (_, k) => k * step);

test('boxMotion: the peak speed is the longest step in frame heights per second, and when it came', () => {
  const { peaks } = boxMotion(frame([at([0, 10, 30, 60, 100, 140, 180, 190, 195, 196, 196])]));
  assert.equal(peaks.length, 1);
  assert.ok(Math.abs(peaks[0].speed - 40 / H / DT) < 1e-9);
  assert.equal(peaks[0].at, 0.2);
});

test('boxMotion: a step much longer than its neighbours is a cut, a camera or ground over 60% of the frame is no element, a hidden element does not count', () => {
  const smooth = line(8, 20);
  const jumped = [...smooth, 160 + 700, 860, 860, 860];
  const camera = at(line(11, 20), { w: 1600, h: 900 });
  const hidden = at(line(11, 20), { alpha: 0 });
  const { peaks } = boxMotion(frame([at(jumped), camera, hidden]));
  assert.equal(peaks.length, 1);
  assert.ok(Math.abs(peaks[0].speed - 20 / H / DT) < 1e-9);
});

test('boxMotion: the motion a parent carries is not the child\'s own speed', () => {
  const parent = at(line(11, 30), { w: 600, h: 400 });
  const child = at(line(11, 30).map((x) => x + 50), { w: 100, h: 50 });
  assert.deepEqual(boxMotion(frame([parent, child], [-1, 0])).peaks.filter((p) => p.label === 'el1'), []);
});

test('speedCeiling: the p90 of the moving elements decides, and names the fastest and the second', () => {
  const peaks = [0.5, 1, 2, 3, 4, 5, 6, 14, 15].map((speed, i) => ({ label: `el${i}`, speed, at: i }));
  const found = speedCeiling(peaks);
  assert.deepEqual(found.map((f) => [f.code, f.rule, f.at]), [['speed-ceiling', 'speed-bands', 8]]);
  assert.match(found[0].what, /9 moving elements peaks at 15\.0 frame heights/);
  assert.match(found[0].what, /Fastest: el8 15\.0 at 8\.00 s, then el7 14\.0 at 7\.00 s/);
  assert.equal(speedCeiling(peaks.slice(0, 7)).length, 0);
  assert.equal(speedCeiling(peaks.slice(5, 9)).length, 0, 'fewer than moving_min elements');
  assert.equal(speedCeiling(null).length, 0);
});

test('speedCeiling: one fast element among many does not move the p90, and drifts under the floor are not elements', () => {
  const calm = Array.from({ length: 20 }, (_, i) => ({ label: `a${i}`, speed: 3 + i * 0.1, at: i }));
  assert.equal(speedCeiling([...calm, { label: 'fast', speed: 19, at: 1 }]).length, 0);
  const drifts = Array.from({ length: 30 }, (_, i) => ({ label: `d${i}`, speed: 0.05, at: i }));
  const fast = Array.from({ length: 5 }, (_, i) => ({ label: `f${i}`, speed: 20, at: i }));
  assert.equal(speedCeiling([...drifts, ...fast]).length, 1);
});

const rec = (over) => ({ target: 0, label: 'card', id: 'enter', props: ['translate'], delay: 0, duration: 0.5, easing: EASE.land, kfEasings: [], opacity: [0, 1], from: 'translate(0px, 24px)', fullFrame: false, decorative: false, ...over });
const arrivals = (eases) => eases.map((easing, i) => rec({ target: i, delay: i * 0.6, easing }));

test('spectacleWeak: a spectacle second whose move is slower than another moment fires with both numbers; the strongest or an unsampled second does not', () => {
  const peaks = [{ label: 'chip', speed: 0.29, at: 12.1 }, { label: 'strip', speed: 3.1, at: 12.0 }, { label: 'badge', speed: 5.0, at: 4.8 }, { label: 'mail', speed: 1.2, at: 2.0 }];
  const [f] = spectacleWeak(peaks, 12, [0, 20]);
  assert.equal(f.rule, 'spectacle-weak');
  assert.equal(f.at, 12);
  assert.match(f.what, /spectacle at 12 s is weaker than 4\.8 s: strip peaks at 3\.1 frame heights per second there, badge peaks at 5 at 4\.8 s/);
  assert.deepEqual(spectacleWeak(peaks, 4.8, [0, 20]), []);
  assert.deepEqual(spectacleWeak(peaks, 12, [0, 10]), []);
  assert.deepEqual(spectacleWeak(peaks, null, [0, 20]), []);
  assert.deepEqual(spectacleWeak([{ label: 'strip', speed: 3.1, at: 12 }, { label: 'badge', speed: 3.5, at: 4.8 }], 12, [0, 20]), []);
  assert.match(spectacleWeak([{ label: 'badge', speed: 5, at: 4.8 }], 12, [0, 20])[0].what, /no element moves there/);
});

test('barLint reads the spectacle second beside the speed and arrival checks', () => {
  const boxes = { peaks: [{ label: 'badge', speed: 5, at: 4.8 }], arrivals: [], span: [0, 20] };
  assert.equal(barLint({ records: [], boxes, text: null, spectacle: 12 })[0].rule, 'spectacle-weak');
  assert.equal(barLint({ records: [], boxes, text: null })[0], undefined);
});

test('overshootShare: no spring at all is fine, a third on a spring is fine', () => {
  assert.deepEqual(overshootShare(arrivals(Array(6).fill(EASE.land))), []);
  assert.deepEqual(overshootShare(arrivals([EASE.pop, EASE.pop, EASE.land, EASE.land, EASE.land, EASE.land])), []);
});

test('overshootShare: far over the range fires, the limit being 1.5 times the reference p90', () => {
  const found = overshootShare(arrivals(Array(6).fill(EASE.pop)));
  assert.match(found[0].what, /6 of 6 arrivals overshoot \(100%\)/);
  assert.ok(LIMITS.overshoot.share_max_pct > 41);
  assert.equal(overshootShare(arrivals([EASE.pop, EASE.pop, EASE.pop, EASE.pop, EASE.land, EASE.land, EASE.land, EASE.land, EASE.land, EASE.land])).length, 0);
});

test('overshootShare: css curves count, a fade alone and a curve it cannot read do not; an aria-hidden layer is measured', () => {
  const bezier = arrivals(['cubic-bezier(0.34, 1.56, 0.64, 1)', 'ease', 'ease-out', 'linear', 'ease-in-out', 'ease-out']);
  assert.equal(overshootShare(bezier).length, 0, '1 of 6 is inside the limit');
  assert.equal(overshootShare(arrivals(Array(6).fill(EASE.pop)).map((r) => ({ ...r, props: ['opacity'] }))).length, 0);
  assert.equal(overshootShare(arrivals(Array(6).fill(EASE.pop)).map((r) => ({ ...r, decorative: true }))).length, 1);
  assert.equal(overshootShare(arrivals(Array(6).fill('inferred')).map((r) => ({ ...r, easing: 'inferred', kfEasings: ['inferred'] }))).length, 0);
  assert.equal(overshootShare(arrivals(Array(5).fill(EASE.land))).length, 0, 'fewer than arrivals_min');
});

test('overshootShare: a page with no animation records reads its arrivals from the boxes', () => {
  const boxArrivals = [0, 1, 2, 3, 4, 5, 6].map((i) => ({ at: 1 + i, over: i === 0 }));
  assert.equal(overshootShare([], boxArrivals).length, 0);
  assert.match(overshootShare([], boxArrivals.map((a) => ({ ...a, over: true })))[0].what, /7 of 7 arrivals overshoot \(100%\)/);
  assert.equal(overshootShare([], boxArrivals.map((a, i) => ({ ...a, over: i < 2 }))).length, 0);
  assert.equal(overshootShare(arrivals([EASE.pop, EASE.pop, EASE.land, EASE.land, EASE.land, EASE.land]), boxArrivals).length, 0, 'the records win when they are enough');
});

test('boxMotion: an arrival is a move that starts faded out and ends faded in; it overshoots when it goes past its end and returns', () => {
  const fade = (k) => Math.min(1, 0.2 + k * 0.3);
  const settle = [0, 50, 85, 105, 112, 108, 103, 100, 100, 100, 100, 100];
  const tight = [0, 50, 80, 95, 100, 100, 100, 100, 100, 100, 100, 100];
  const { arrivals: found } = boxMotion(frame([at(settle, { alpha: fade }), at(tight, { alpha: fade }), at(settle, { alpha: 1 })]));
  assert.deepEqual(found.map((a) => a.over), [true, false]);
});

test('boxMotion: a pop that grows in place overshoots by its size, though its centre never moves', () => {
  const fade = (k) => Math.min(1, 0.2 + k * 0.3);
  const grow = (sizes) => sizes.map((w, k) => [900 - w / 2, 500 - w / 2, w, w, fade(k), 1]);
  const pop = grow([60, 120, 190, 240, 262, 252, 244, 240, 240, 240, 240, 240]);
  const land = grow([60, 120, 190, 225, 238, 240, 240, 240, 240, 240, 240, 240]);
  assert.deepEqual(boxMotion(frame([pop, land])).arrivals.map((a) => a.over), [true, false]);
});

const at5 = (t, ...texts) => ({ t, lines: texts.map((text, block) => ({ text, box: [0, 0, 400, 60], block })) });
const CTX = { step: 0.5, frameH: 600 };
const times = (n) => Array.from({ length: n }, (_, k) => 0.25 + k * 0.5);
const filmOf = (n, shows) => times(n).map((t, k) => (shows(k) ? at5(t, 'Ship it now') : at5(t)));

test('textBreathing: text in more than 84% of a film fires and names the longest run', () => {
  const samples = filmOf(40, (k) => k >= 4);
  const found = textBreathing(samples, CTX);
  assert.deepEqual(found.map((f) => [f.code, f.rule, f.at]), [['text-breathing', 'text-breathing', 2]]);
  assert.match(found[0].what, /90% of the film \(18\.0 s in one run from 2\.0 s\)/);
});

test('textBreathing: rests inside the range, a short film, chrome text and tiny text give no advice', () => {
  assert.equal(textBreathing(filmOf(40, (k) => k % 4 !== 3), CTX).length, 0);
  assert.equal(textBreathing(filmOf(8, () => true), CTX).length, 0);
  const chrome = times(40).map((t) => ({ t, lines: [{ text: 'Inbox', box: [0, 0, 100, 60], chrome: true }] }));
  assert.equal(textBreathing(chrome, CTX).length, 0);
  const tiny = times(40).map((t) => ({ t, lines: [{ text: 'credit', box: [0, 0, 100, 6] }] }));
  assert.equal(textBreathing(tiny, CTX).length, 0);
});

const shown = (n, from, count, text) => times(n).map((t, k) => (k >= from && k < from + count ? at5(t, text) : at5(t)));

test('textLingers: a one word line on screen 5 s fires with its read time and its ceiling', () => {
  const found = textLingers(shown(40, 2, 10, 'Launch'), CTX);
  assert.deepEqual(found.map((f) => [f.code, f.rule, f.at]), [['text-lingers', 'readable-hold', 1]]);
  assert.match(found[0].what, /"Launch" stays on screen 5\.0 s; it needs 1\.2 s to read, so it may stay 2\.8 s/);
});

test('textLingers: a line still on screen at the end is the end card and is not measured', () => {
  assert.equal(textLingers(shown(40, 30, 10, 'Download now'), CTX).length, 0);
});

test('textLingers: words of one element that arrive one after another are one line', () => {
  const words = 'one two three four five six seven eight nine ten'.split(' ');
  const samples = times(40).map((t, k) => ({ t, lines: words.filter((_, i) => k >= 2 + i && k < 16).map((text) => ({ text, box: [0, 0, 100, 60], block: 0 })) }));
  assert.equal(textLingers(samples, CTX).length, 0);
  const slow = times(40).map((t, k) => ({ t, lines: words.filter((_, i) => k >= 2 + i && k < 20).map((text) => ({ text, box: [0, 0, 100, 60], block: 0 })) }));
  assert.match(textLingers(slow, CTX)[0].what, /stays on screen 9\.\d s; it needs 6\.0 s to read, so it may stay 7\.5 s/);
});

test('text-lingers, readable-hold and the read-time hold of a world agree for lines of 1, 4 and 8 words (past 8 the rule says cut the line)', () => {
  for (const n of [1, 4, 8]) {
    const text = Array.from({ length: n }, (_, i) => `w${i}`).join(' ');
    const need = lineNeed(n);
    const cap = Math.min(worldLimit({ readNeed: readNeed([text]) }), readNeed([text]) + READ_MARGIN_S);
    const ceiling = lingerCeiling(need);
    assert.ok(0.9 * need < ceiling, `${n} words: the readable-hold minimum is under the ceiling`);
    assert.ok(0.9 * need <= cap, `${n} words: the readable-hold minimum fits in a world`);
    assert.ok(cap <= ceiling, `${n} words: a line held for its read time and the margin stays under the ceiling`);
    const steps = Math.round(cap / CTX.step);
    const samples = shown(steps + 40, 2, steps, text);
    const tracks = probeTracks(samples, CTX);
    assert.deepEqual(readHoldProblems(tracks), [], `${n} words: held for its read time and the margin passes readable-hold`);
    assert.deepEqual(textLingers(samples, CTX), [], `${n} words: held for its read time and the margin passes text-lingers`);
  }
});

test('barLint: the findings sit in time order, and a window draft has no text findings', () => {
  const samples = filmOf(40, (k) => k >= 4);
  const all = barLint({ records: arrivals(Array(6).fill(EASE.pop)), boxes: null, text: { samples, ctx: CTX } });
  assert.deepEqual(all.map((f) => f.code), ['overshoot-share', 'text-breathing']);
  assert.deepEqual(barLint({ records: [], boxes: null, text: null }), []);
});

test('a bar finding is waived by its code, and fires its rule id into rules_fired and the printed line', () => {
  const found = barLint({ records: arrivals(Array(6).fill(EASE.pop)), boxes: null, text: null });
  assert.deepEqual(unwaived(found, { allow: ['overshoot-share'], _why: { 'overshoot-share': 'the film is a toy shop: 6 arrivals in 2 s of world s1, all on EASE.pop' }, _worlds: ['s1'] }), []);
  assert.equal(unwaived(found, {}).length, 1);
  const fired = firedRules(found, []);
  assert.deepEqual(fired.map((f) => f.id), ['overshoot']);
  const [printed] = firedLines(fired);
  assert.match(printed, /\(rule overshoot, taste\/rules\/overshoot\.md\); instead: arrive fast, land soft/);
});

const tideRamp = JSON.parse(fs.readFileSync(new URL('../fixtures/spectacle-tide-v-ramp-boxes.json', import.meta.url), 'utf8'));

test('spectacleWeak: tide-v, a speed ramp at 3.0 s (the world scales out, the next scales in) is stronger than the underline at 4.2 s', () => {
  const { peaks, scales, span } = boxMotion(tideRamp);
  const ramp = scales.find((s) => s.label.startsWith('section.world') && Math.abs(s.at - 3) < 0.1);
  assert.ok(ramp.speed > 3.6);
  const underline = peaks.find((p) => p.label === 'u');
  assert.ok(underline.at > 4.1 && underline.speed > 3.6);
  assert.deepEqual(spectacleWeak(peaks, 3, span, scales), []);
  assert.match(spectacleWeak(peaks, 3, span)[0].what, /weaker than 4\.2 s/);
});

test('spectacleWeak: a scale move counts against the spectacle too, and a nearby ramp-in counts for it', () => {
  const scaling = (sizes) => sizes.map((s, k) => [500 - s / 2, 300, s, s, 1, 1]);
  const quick = boxMotion(frame([scaling([100, 100, 100, 160, 240, 340, 460, 600, 600, 600, 600, 600])]));
  assert.ok(quick.scales[0].speed > 3);
  assert.equal(spectacleWeak([], 0.1, quick.span, quick.scales).length, 0);
  assert.equal(spectacleWeak([{ label: 'badge', speed: 9, at: 6 }], 0.1, [0, 8], quick.scales).length, 1);
});

const stopsOf = (xs) => boxMotion(frame([at(xs)])).stops;

test('deadStop: a track that ends at speed fires; one that lands on an ease, on a cut or off screen does not', () => {
  const abrupt = [0, 30, 60, 90, 120, 150, 150, 150, 150, 150, 150];
  const eased = [0, 30, 55, 75, 90, 100, 105, 107, 108, 108, 108, 108];
  const cut = [0, 30, 60, 90, 120, 150, 900, 900, 900, 900];
  const [f] = deadStop(stopsOf(abrupt));
  assert.deepEqual([f.code, f.rule, f.at], ['dead-stop', 'live-hold', 0.2]);
  assert.match(f.what, /1 element stops from over 600 px\/s in one step: el0 at 0\.20 s from 750 px\/s/);
  assert.deepEqual(deadStop(stopsOf(eased)), []);
  assert.deepEqual(deadStop(stopsOf(cut)), []);
  assert.deepEqual(deadStop(boxMotion(frame([at(abrupt, { alpha: (k) => (k < 6 ? 1 : 0) })])).stops), []);
  assert.deepEqual(deadStop(null), []);
});

test('deadStop: a slow drift into a hold is under the jolt limit', () => {
  assert.deepEqual(deadStop(stopsOf([0, 10, 20, 30, 40, 50, 50, 50, 50])), []);
});

test('staging: five equal movers in one beat fire; one hero among small movers, a stagger and few movers do not', () => {
  const mover = (step, y, delay = 0) => at([...Array(delay).fill(0), ...line(11 - delay, step)], { y });
  const equal = boxMotion(frame([0, 1, 2, 3, 4].map((i) => mover(20, 100 + i * 150)))).runs;
  const [f] = staging(equal);
  assert.deepEqual([f.code, f.rule, f.at], ['staging', 'one-hero-motion', 0]);
  assert.match(f.what, /5 elements move together at 0\.00 s and none leads: the largest, el0, owns 20% of the motion/);
  const hero = boxMotion(frame([mover(100, 100), ...[1, 2, 3, 4].map((i) => mover(8, 100 + i * 150))])).runs;
  assert.deepEqual(staging(hero), []);
  const staggered = boxMotion(frame([0, 1, 2, 3, 4].map((i) => mover(20, 100 + i * 150, i)))).runs;
  assert.deepEqual(staging(staggered), []);
  assert.deepEqual(staging(equal.slice(0, 3)), []);
  assert.deepEqual(staging(undefined), []);
});

test('anticipation: the spectacle move needs a counter-move or a dip; a straight rise fires, other moves are not asked', () => {
  const straight = boxMotion(frame([at([100, 115, 135, 160, 185, 200, 200, 200, 200, 200, 200])]));
  const [f] = anticipation(straight.runs, 0.1, straight.span);
  assert.deepEqual([f.code, f.rule, f.at], ['anticipation', 'anticipation', 0.1]);
  assert.match(f.what, /spectacle move \(el0, 0\.00 s\) starts with no wind-up/);
  const counter = boxMotion(frame([at([100, 97, 95, 100, 120, 150, 180, 200, 200, 200, 200])]));
  assert.deepEqual(anticipation(counter.runs, 0.1, counter.span), []);
  const grow = (sizes) => sizes.map((w, k) => [100 + k * 20, 300, w, w, 1, 1]);
  const dipped = boxMotion(frame([grow([100, 97, 96, 100, 110, 125, 140, 150, 150, 150, 150])]));
  assert.deepEqual(anticipation(dipped.runs, 0.1, dipped.span), []);
  const bloom = boxMotion(frame([grow([10, 30, 60, 100, 140, 170, 190, 200, 200, 200, 200]), at([300, 300, 300, 305, 310, 315, 315, 315, 315, 315, 315])]));
  assert.deepEqual(anticipation(bloom.runs, 0.1, bloom.span), [], 'a bloom that grows from nothing is revealed, not wound up');
  const light = boxMotion(frame([at([100, 130, 160, 190, 220, 250, 250, 250, 250, 250, 250], { w: 1100, h: 1100 })]));
  assert.deepEqual(anticipation(light.runs, 0.1, light.span), [], 'a light that covers over 40 percent of the frame carries no weight');
  assert.deepEqual(anticipation(straight.runs, 9, straight.span), [], 'a spectacle outside the sampled seconds is not measured');
  assert.deepEqual(anticipation(straight.runs, null, straight.span), []);
  assert.match(anticipation(straight.runs, 5, [0, 10])[0].what, /no element moves within 0\.75 s of the spectacle second 5 s/, 'a spectacle second with no move is named, not passed');
});

test('anticipation: a dip that every mover shares winds up nothing; the hero alone dipping passes', () => {
  const grow = (sizes, y) => sizes.map((w, k) => [100 + k * 20, y, w, w, 1, 1]);
  const dip = [100, 97, 96, 100, 110, 125, 140, 150, 150, 150, 150];
  const hero = [100, 97, 96, 100, 120, 150, 190, 230, 250, 250, 250];
  const alone = boxMotion(frame([grow(hero, 100), at([300, 305, 310, 315, 320, 325, 325, 325, 325, 325, 325], { y: 500 })]));
  assert.deepEqual(anticipation(alone.runs, 0.1, alone.span), []);
  const everyone = boxMotion(frame([grow(hero, 100), grow(dip, 300), grow(dip, 500), grow(dip, 700)]));
  const [f] = anticipation(everyone.runs, 0.1, everyone.span);
  assert.match(f.what, /starts with no wind-up/);
  assert.match(f.fix, /other movers dip at the same time/);
});

test('spectacleWeak: the exaggeration floor wants the spectacle at 1.3 times the median mover', () => {
  const others = [1, 1, 1, 1, 1].map((speed, i) => ({ label: `el${i}`, speed, at: 2 + i }));
  const [f] = spectacleWeak([...others, { label: 'hero', speed: 1.2, at: 10 }], 10, [0, 20]);
  assert.equal(f.rule, 'spectacle-weak');
  assert.match(f.what, /spectacle at 10 s peaks at 1\.2 frame heights per second \(hero\), only 1\.2 times the median mover \(1\); the key moment should reach 1\.3 times/);
  assert.deepEqual(spectacleWeak([...others, { label: 'hero', speed: 2, at: 10 }], 10, [0, 20]), []);
  assert.deepEqual(spectacleWeak([...others.slice(0, 3), { label: 'hero', speed: 1.1, at: 10 }], 10, [0, 20]), [], 'fewer than moving_min movers: no median to judge');
});

test('barLint carries dead-stop, staging and anticipation beside the rest', () => {
  const boxes = boxMotion(frame([at([100, 130, 160, 190, 220, 250, 250, 250, 250, 250, 250])]));
  const rules = barLint({ records: [], boxes, text: null, spectacle: 0.1 }).map((x) => x.code);
  assert.deepEqual(rules.sort(), ['anticipation', 'dead-stop']);
});
