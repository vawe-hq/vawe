import test from 'node:test';
import assert from 'node:assert/strict';
import { typeSizes, fontFamilies, displayTracking, leftEdges, textMargin, accentFlood, pureBlackWhite, templateChrome, colouredWords, livingGround, coveredShare, namedText, layoutLint } from '../../harness/lib/layout-lint.mjs';
import { layoutTimes, heldPlaces, placeKey } from '../../harness/lib/draft-check.mjs';
import { CHECK_TIER, runsIn } from '../../harness/lib/draft-tiers.mjs';
import LIMITS from '../../taste/build/limits.json' with { type: 'json' };

const text = (over = {}) => ({ text: 'Hello', box: [300, 300, 400, 100], fontPx: 60, family: 'archivo', weight: 700, trackingEm: 0, caps: false, color: [20, 20, 30, 1], block: 0, chrome: false, ...over });
const sample = (over = {}) => ({ t: 1, w: 1920, h: 1080, accent: null, texts: [text()], blocks: [{ box: [300, 300, 400, 100] }], boxes: [], ...over });
const box = (over = {}) => ({ tag: 'div', p: -1, box: [0, 0, 400, 300], op: 1, bg: null, image: false, border: { l: [0, null], r: [0, null], t: [0, null], b: [0, null] }, radius: 0, shadow: false, decorative: false, ...over });
const card = (x, over = {}) => box({ box: [x, 300, 400, 400], bg: [40, 40, 50, 1], radius: 16, ...over });

test('type sizes name their rule and read their number from limits.json', () => {
  const sizes = [10, 12, 14, 18, 24, 32, 48].map((fontPx, i) => text({ fontPx, text: `t${i}`, block: i }));
  const [f] = typeSizes([sample({ texts: sizes })]);
  assert.deepEqual([f.code, f.rule], ['type-sizes', 'type-scale']);
  assert.match(f.what, new RegExp(`the rule allows ${LIMITS['type-scale'].sizes_max}`));
});

test('type sizes: six sizes pass, seven fire, text inside data-chrome is not counted', () => {
  const texts = (n, extra = {}) => Array.from({ length: n }, (_, i) => text({ fontPx: 20 + i * 8, text: `t${i}`, ...extra }));
  assert.equal(typeSizes([sample({ texts: texts(6) })]).length, 0);
  assert.equal(typeSizes([sample({ texts: texts(7) })]).length, 1);
  assert.equal(typeSizes([sample({ texts: texts(7, { chrome: true }) })]).length, 0);
  assert.equal(typeSizes([]).length, 0);
});

test('font families: more than the limit fire once, at the worst frame', () => {
  const faces = (names) => sample({ texts: names.map((family, i) => text({ family, text: `t${i}` })) });
  assert.equal(fontFamilies([faces(['a', 'b', 'c'])]).length, 0);
  const found = fontFamilies([faces(['a', 'b']), { ...faces(['a', 'b', 'c', 'd']), t: 3 }]);
  assert.deepEqual(found.map((f) => [f.code, f.rule, f.at]), [['font-families', 'typeface-system', 3]]);
});

test('display tracking: a headline-size line outside -0.05 to -0.02 em fires; capitals, small text and tight lines do not', () => {
  const at = (over) => displayTracking([sample({ texts: [text({ fontPx: 120, ...over })] })]).length;
  assert.equal(at({ trackingEm: -0.03 }), 0);
  assert.equal(at({ trackingEm: 0 }), 1);
  assert.equal(at({ trackingEm: -0.08 }), 1);
  assert.equal(at({ trackingEm: 0.1, caps: true }), 0);
  assert.equal(at({ trackingEm: 0, fontPx: 40 }), 0);
  assert.equal(displayTracking([{ ...sample({ texts: [text({ fontPx: 60, trackingEm: 0 })] }), w: 960, h: 540 }]).length, 1);
});

test('left edges: four left edges fire, a centred block is not an edge, edges within the tolerance are one', () => {
  const blocksAt = (xs) => ({ texts: xs.map((_, i) => text({ block: i, text: `t${i}` })), blocks: xs.map((x) => ({ box: [x, 300, 300, 80] })) });
  assert.equal(leftEdges([sample(blocksAt([200, 203, 600, 900]))]).length, 0);
  assert.equal(leftEdges([sample(blocksAt([200, 400, 600, 900]))]).length, 1);
  assert.equal(leftEdges([sample(blocksAt([200, 400, 600, 810]))]).length, 0);
});

test('text margin: text outside the inner 90 percent fires and names how far', () => {
  const at = (box) => textMargin([sample({ texts: [text({ box })] })]);
  assert.equal(at([200, 300, 400, 100]).length, 0);
  const [f] = at([30, 300, 400, 100]);
  assert.deepEqual([f.code, f.rule], ['text-margin', 'safe-margin']);
  assert.match(f.what, /66 px past/);
  assert.equal(at([200, 1000, 400, 100]).length, 1);
});

test('accent flood: the accent over the atmosphere limit fires; a small accent, no accent and overlap pass', () => {
  const accent = [37, 54, 255, 1];
  const ground = (b, bg) => box({ box: b, bg });
  const frame = (boxes, accentColour = accent) => sample({ accent: accentColour, texts: [], blocks: [], boxes });
  assert.equal(accentFlood([frame([ground([0, 0, 1920, 1080], accent)])]).length, 1);
  assert.equal(accentFlood([frame([ground([0, 0, 400, 300], accent)])]).length, 0);
  assert.equal(accentFlood([frame([ground([0, 0, 1920, 1080], accent)], null)]).length, 0);
  assert.equal(accentFlood([frame([ground([0, 0, 1920, 1080], [200, 200, 200, 1])])]).length, 0);
  assert.equal(coveredShare([[0, 0, 960, 1080], [0, 0, 960, 1080]], sample()), 0.5);
});

test('pure black and white: a pure ground fires and names pure ink on it; tinted, small, translucent and ink alone do not', () => {
  const ground = (bg, size = [1920, 1080]) => box({ box: [0, 0, ...size], bg });
  assert.equal(pureBlackWhite([sample({ boxes: [ground([0, 0, 0, 1])] })]).length, 1);
  assert.match(pureBlackWhite([sample({ texts: [text({ color: [255, 255, 255, 1] })], boxes: [ground([255, 255, 255, 1])] })])[0].what, /pure #fff as the ground and pure #fff ink on 1 text/);
  assert.equal(pureBlackWhite([sample({ boxes: [ground([0, 0, 0, 1], [400, 300])] })]).length, 0);
  assert.equal(pureBlackWhite([sample({ boxes: [ground([22, 21, 26, 1])] })]).length, 0);
  assert.equal(pureBlackWhite([sample({ boxes: [ground([255, 255, 255, 0.6])] })]).length, 0);
  assert.equal(pureBlackWhite([sample({ texts: [text({ color: [255, 255, 255, 1] })], boxes: [ground([22, 21, 26, 1])] })]).length, 0);
});

test('pure black and white the page declares as :root custom properties is its palette, not a default', () => {
  const ground = box({ box: [0, 0, 1920, 1080], bg: [0, 0, 0, 1] });
  const inked = { texts: [text({ color: [255, 255, 255, 1] })], boxes: [ground] };
  assert.equal(pureBlackWhite([sample({ ...inked, palette: [[0, 0, 0, 1]] })]).length, 0);
  assert.match(pureBlackWhite([sample({ ...inked, palette: [[255, 255, 255, 1]] })])[0].what, /pure #000 as the ground$/);
  assert.equal(pureBlackWhite([sample({ ...inked, palette: [[22, 21, 26, 1]] })]).length, 1);
});

test('template chrome: eyebrow, step markers, side stripe, nested cards and identical cards each fire; plain frames do not', () => {
  const title = text({ text: 'Ship the thing', fontPx: 120, box: [200, 400, 900, 130], block: 0 });
  const eyebrow = text({ text: 'FEATURES', fontPx: 28, caps: true, trackingEm: 0.12, box: [200, 340, 300, 34], block: 1 });
  const what = (s) => templateChrome([s]).map((f) => f.what).join('|');
  assert.match(what(sample({ texts: [title, eyebrow] })), /tracked-caps label above the title/);
  assert.equal(what(sample({ texts: [title, { ...eyebrow, trackingEm: 0 }] })), '');
  assert.equal(what(sample({ texts: [title, { ...eyebrow, box: [200, 700, 300, 34] }] })), '');
  const nums = ['01', '02'].map((n, i) => text({ text: n, block: i + 1 }));
  assert.match(what(sample({ texts: [title, ...nums] })), /step markers/);
  assert.equal(what(sample({ texts: [title, nums[0]] })), '');
  assert.match(what(sample({ texts: [text({ text: '01 / 04' })] })), /step markers/);
  assert.equal(what(sample({ texts: [text({ text: '08/28' })] })), '');
  const stripe = box({ box: [200, 200, 600, 200], border: { l: [4, [0, 120, 255, 1]], r: [0, null], t: [0, null], b: [0, null] } });
  assert.match(what(sample({ boxes: [stripe] })), /side-stripe/);
  assert.equal(what(sample({ boxes: [{ ...stripe, border: { ...stripe.border, t: [4, [0, 0, 0, 1]] } }] })), '');
  const kids = (at) => [box({ p: at, box: [0, 0, 50, 20] }), box({ p: at, box: [0, 30, 50, 20] })];
  const outer = card(100, { box: [100, 100, 1200, 800] });
  assert.match(what(sample({ boxes: [outer, ...kids(0), card(300, { p: 0 }), ...kids(3)] })), /card inside a card/);
  assert.equal(what(sample({ boxes: [outer, ...kids(0), card(300, { p: 0 })] })), '');
  assert.match(what(sample({ boxes: [card(100), ...kids(0), card(600), ...kids(3), card(1100), ...kids(6)] })), /identical sibling cards/);
  assert.equal(what(sample({ boxes: [card(100), ...kids(0), card(600, { box: [600, 300, 600, 300] }), ...kids(3)] })), '');
  assert.equal(what(sample()), '');
});

test('coloured word: a word in another colour that the message and beats do not name fires', () => {
  const ink = [20, 20, 30, 1], accent = [37, 54, 255, 1];
  const line = (word) => sample({ texts: [text({ text: 'Design that feels', block: 0 }), text({ text: word, color: accent, block: 0 })] });
  assert.equal(colouredWords([line('expensive')], namedText('design that feels expensive', '')).length, 0);
  const [f] = colouredWords([line('cheap')], namedText('design that feels expensive', '## Beats\n\n1. headline'));
  assert.deepEqual([f.code, f.rule], ['coloured-word', 'word-colour']);
  assert.equal(colouredWords([line('cheap')], namedText('x', '## Beats\n\ncheap shot')).length, 0);
  assert.equal(colouredWords([sample({ texts: [text({ color: ink }), text({ color: [30, 25, 35, 1] })] })], '').length, 0);
  const many = sample({ texts: [text({ text: 'a long line of words', block: 0 }), ...['one', 'two', 'three'].map((w) => text({ text: w, color: accent, block: 0 }))] });
  assert.match(colouredWords([many], 'one two three')[0].what, /3 coloured words in one line/);
});

test('layoutLint gathers the findings in time order, and layout runs in the settled tier at settled seconds', () => {
  const late = sample({ t: 4, texts: [text({ fontPx: 120, trackingEm: 0 })] });
  const early = sample({ t: 1, texts: [text({ box: [30, 300, 400, 100] })] });
  assert.deepEqual(layoutLint([late, early]).map((f) => f.code), ['text-margin', 'display-tracking']);
  assert.equal(CHECK_TIER.layout, 'settled');
  assert.equal(runsIn('layout', 'fast'), false);
  assert.equal(runsIn('layout', 'draft'), true);
  const held = (t) => ({ t, lines: [{ text: 'a', box: [0, 0, 10, 10], opacity: 1 }] });
  assert.deepEqual(layoutTimes([held(1), held(2), held(3)], { dur: 3 }), [3]);
  assert.deepEqual(layoutTimes([{ t: 1, lines: [] }], { dur: 4, from: 2 }), [3, 4, 5]);
});

test('held places: only a text that holds one place for half a second is read; moving text is left out', () => {
  const line = (text, x) => ({ text, box: [x, 100, 200, 50], opacity: 1 });
  const samples = [0, 1, 2, 3].map((i) => ({ t: i * 0.2, lines: [line('still', 100), line('moving', 100 + i * 40)] }));
  const held = heldPlaces(samples, { step: 0.2 });
  assert.equal(held.has(placeKey('still', [100, 100, 200, 50])), true);
  assert.equal(held.has(placeKey('moving', [100, 100, 200, 50])), false);
  const edge = text({ box: [30, 300, 400, 100], text: 'still' });
  const frame = sample({ texts: [edge, text({ box: [30, 600, 400, 100], text: 'moving' })] });
  assert.equal(layoutLint([frame], { held: new Set([placeKey('still', edge.box)]) }).filter((f) => f.code === 'text-margin').length, 1);
  assert.equal(layoutLint([frame], { held: new Set() }).length, 0);
});

test('left edges: text on a card or panel is product UI and is not counted; a full-frame ground is not a surface', () => {
  const xs = [200, 400, 600, 900];
  const frame = (boxes) => sample({ boxes, texts: xs.map((_, i) => text({ block: i, text: `t${i}`, box: [xs[i], 300, 200, 40] })), blocks: xs.map((x) => ({ box: [x, 300, 200, 40] })) });
  assert.equal(leftEdges([frame([])]).length, 1);
  assert.equal(leftEdges([frame([box({ box: [100, 200, 1100, 300], bg: [40, 40, 50, 1], radius: 12 })])]).length, 0);
  assert.equal(leftEdges([frame([box({ box: [0, 0, 1920, 1080], bg: [22, 21, 26, 1] })])]).length, 1);
});

test('coloured word: a page with no message and no beats names nothing, so the check is silent', () => {
  const accent = [37, 54, 255, 1];
  const frame = sample({ texts: [text({ text: 'Design that feels', block: 0 }), text({ text: 'expensive', color: accent, block: 0 })] });
  assert.equal(colouredWords([frame], '').length, 0);
  assert.equal(colouredWords([frame], namedText('one thing', '')).length, 1);
});

test('living ground: a frame with no gradient, blur, image or canvas layer is flat; a blob over 15 percent is not', () => {
  const flat = sample({ boxes: [box({ box: [0, 0, 1920, 1080], bg: [140, 140, 140, 1] })] });
  const blob = (over) => sample({ boxes: [box({ box: [0, 0, 1920, 1080], bg: [140, 140, 140, 1] }), box({ box: [100, 0, 900, 900], decorative: true, image: true, ...over })] });
  const [f] = livingGround([flat]);
  assert.deepEqual([f.code, f.rule, f.at], ['living-ground', 'living-ground', 1]);
  assert.equal(livingGround([blob()]).length, 0);
  assert.equal(livingGround([blob({ image: false, blurred: true, bg: [230, 90, 60, 1] })]).length, 0);
  assert.equal(livingGround([blob({ image: false, tag: 'canvas' })]).length, 0);
  assert.equal(livingGround([blob({ box: [0, 0, 200, 200] })]).length, 1);
  assert.equal(livingGround([blob({ op: 0.1 })]).length, 1);
});

const FULL = [0, 0, 1920, 1080];
const trick = (over) => sample({ boxes: [box({ box: FULL, bg: [20, 20, 30, 1] }), box({ box: FULL, decorative: true, image: true, ...over })] });

test('living ground: a full-frame faint gradient, a grain overlay, a blend layer and an empty canvas do not make a ground', () => {
  const faint = 'radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.03) 0%, rgba(0, 0, 0, 0) 100%)';
  const lit = 'radial-gradient(circle at 30% 40%, rgba(230, 90, 60, 0.6) 0%, rgba(0, 0, 0, 0) 70%)';
  assert.equal(livingGround([trick({ paint: faint })]).length, 1);
  assert.equal(livingGround([trick({ paint: lit })]).length, 0);
  assert.equal(livingGround([trick({ paint: 'url("data:image/svg+xml;utf8,<svg><filter><feTurbulence/></filter></svg>")' })]).length, 1);
  assert.equal(livingGround([trick({ paint: 'url(grain.png)', tilePx: 128 })]).length, 1);
  assert.equal(livingGround([trick({ paint: lit, blend: 'overlay' })]).length, 1);
  assert.equal(livingGround([trick({ image: false, tag: 'canvas', canvasVaries: 0 })]).length, 1);
  assert.equal(livingGround([trick({ image: false, tag: 'canvas', canvasVaries: 0.4 })]).length, 0);
});

test('living ground: fires when more than half the samples are flat, and a one-world sample is judged alone', () => {
  const flat = sample({ boxes: [box({ box: [0, 0, 1920, 1080] })] });
  const live = sample({ boxes: [box({ box: [0, 0, 1920, 1080], image: true })] });
  const [advice] = livingGround([flat, live]);
  assert.match(advice.what, /1 of 2 sampled frames have one flat ground \(at 1 s\)/);
  assert.ok(!advice.what.includes('over the limit'));
  assert.match(livingGround([flat, flat, live])[0].what, /over the limit of 50%/);
  assert.equal(livingGround([live, live]).length, 0);
  assert.equal(livingGround([]).length, 0);
  assert.equal(layoutLint([flat]).filter((f) => f.code === 'living-ground').length, 1);
});
