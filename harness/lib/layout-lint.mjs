// The layout lint: advice lines on how a frame is built, read from the DOM at settled moments (harness/media/draft-check.mjs
// layoutSample). Each finding is { code, rule, at, what, fix } like the motion lint's. Every number is read from
// taste/build/limits.json under the rule that owns it. Pure. A sample is { t, w, h, accent, texts, blocks, boxes }.
// Not measured: SVG, and a ground the page never paints (the browser's white).
import LIMITS from '../../taste/build/limits.json' with { type: 'json' };
import { heldPlaces, placeKey } from './draft-check.mjs';
import { groundOf, paintsGround } from './ground-paint.mjs';

const L = LIMITS;
const finding = (code, rule, at, what, fix) => ({ code, rule, at, what, fix });
const scaled = (px, s) => (px * s.w) / 1920;
const copy = (s) => s.texts.filter((t) => !t.chrome);
const by = (samples, size) => samples.reduce((a, s) => (a && size(a) >= size(s) ? a : s), null);

/** More distinct text sizes in one frame than the limit (rule type-scale). */
export function typeSizes(samples, { max = L['type-scale'].sizes_max } = {}) {
  const sizes = (s) => [...new Set(copy(s).map((t) => Math.round(t.fontPx)))].sort((a, b) => b - a);
  const worst = by(samples, (s) => sizes(s).length);
  if (!worst || sizes(worst).length <= max) return [];
  return [finding('type-sizes', 'type-scale', worst.t, `${sizes(worst).length} distinct text sizes in one frame (${sizes(worst).join(', ')} px); the rule allows ${max}`,
    'set every text to one of three sizes: hero, support, label')];
}

/** More font families in one frame than the limit (rule typeface-system). */
export function fontFamilies(samples, { max = L['typeface-system'].faces_max } = {}) {
  const faces = (s) => [...new Set(copy(s).map((t) => t.family))];
  const worst = by(samples, (s) => faces(s).length);
  if (!worst || faces(worst).length <= max) return [];
  return [finding('font-families', 'typeface-system', worst.t, `${faces(worst).length} font families in one frame (${faces(worst).join(', ')}); the rule allows ${max}`,
    'give each face a role and keep one to three')];
}

/** Display text (a headline size, not capitals) tracked outside the display range (rule type-setting). */
export function displayTracking(samples) {
  const { display_px_min_1920: size, display_tracking_em_min: lo, display_tracking_em_max: hi, display_tracking_tol_em: tol } = L['type-setting'];
  for (const s of samples) {
    const off = copy(s).filter((t) => t.fontPx >= scaled(size, s) && !t.caps && t.text.length >= 3 && (t.trackingEm < lo - tol || t.trackingEm > hi + tol));
    if (!off.length) continue;
    const t = off[0];
    return [finding('display-tracking', 'type-setting', s.t, `"${t.text.slice(0, 30)}" is ${Math.round(t.fontPx)} px tracked ${t.trackingEm.toFixed(3)} em${off.length > 1 ? ` (${off.length} display texts)` : ''}; display tracking is ${lo} to ${hi} em`,
      'set letter-spacing between -0.02em and -0.05em on the display line')];
  }
  return [];
}

const surface = (b) => Boolean(b.bg) || b.shadow || [b.border.l, b.border.r, b.border.t, b.border.b].some(([w]) => w >= 1);
const inside = (inner, outer) => inner[0] >= outer[0] - 1 && inner[1] >= outer[1] - 1 && inner[0] + inner[2] <= outer[0] + outer[2] + 1 && inner[1] + inner[3] <= outer[1] + outer[3] + 1;
const SURFACE_MAX = 0.8;

/** True for a text that sits on a surface (a card, a panel, a button) that is not the frame's ground: product UI, not copy. */
const onSurface = (t, s) => s.boxes.some((b) => !b.decorative && surface(b) && area(b.box, s) < SURFACE_MAX * s.w * s.h && inside(t.box, b.box));

const clusters = (xs, tol) => xs.slice().sort((a, b) => a - b).reduce((n, x, i, all) => n + (i === 0 || x - all[i - 1] > tol ? 1 : 0), 0);

/** More distinct left edges among the left-aligned text blocks of one frame than the limit; a block centred on the frame is not a left edge (rule shared-edges). */
export function leftEdges(samples) {
  const { left_edges_max: max, edge_tol_px_1920: tol } = L['shared-edges'];
  const lefts = (s) => {
    const used = new Set(copy(s).filter((t) => !onSurface(t, s)).map((t) => t.block));
    return s.blocks.filter((b, i) => used.has(i) && Math.abs(b.box[0] + b.box[2] / 2 - s.w / 2) > 2 * scaled(tol, s)).map((b) => b.box[0]);
  };
  const edges = (s) => clusters(lefts(s), scaled(tol, s));
  const worst = by(samples, edges);
  if (!worst || edges(worst) <= max) return [];
  return [finding('left-edges', 'shared-edges', worst.t, `${edges(worst)} distinct left edges among the text blocks of one frame (x = ${lefts(worst).map(Math.round).join(', ')} px); the rule allows ${max}`,
    'snap the blocks to one margin and one indent')];
}

/** Text outside the title-safe area (rule safe-margin). */
export function textMargin(samples) {
  const m = (100 - L['safe-margin'].safe_pct) / 200;
  const past = (t, s) => Math.max(s.w * m - t.box[0], t.box[0] + t.box[2] - s.w * (1 - m), s.h * m - t.box[1], t.box[1] + t.box[3] - s.h * (1 - m));
  for (const s of samples) {
    const worst = copy(s).reduce((a, t) => (a && past(a, s) >= past(t, s) ? a : t), null);
    if (!worst || past(worst, s) <= 1) continue;
    return [finding('text-margin', 'safe-margin', s.t, `"${worst.text.slice(0, 30)}" reaches ${Math.round(past(worst, s))} px past the title-safe area (${L['safe-margin'].safe_pct}% of the frame)`,
      'move the text in; check the real box after layout')];
  }
  return [];
}

const sameSize = (a, b, tol) => Math.abs(a[2] - b[2]) <= tol * a[2] && Math.abs(a[3] - b[3]) <= tol * a[3];
const area = (b, s) => Math.max(0, Math.min(b[0] + b[2], s.w) - Math.max(b[0], 0)) * Math.max(0, Math.min(b[1] + b[3], s.h) - Math.max(b[1], 0));
const GRID = [64, 36];

/** The share (0 to 1) of the frame covered by the boxes: a grid of cell centres, so overlaps count once. */
export function coveredShare(boxes, s) {
  let hit = 0;
  for (let i = 0; i < GRID[0]; i++) {
    for (let j = 0; j < GRID[1]; j++) {
      const [x, y] = [((i + 0.5) * s.w) / GRID[0], ((j + 0.5) * s.h) / GRID[1]];
      if (boxes.some((b) => x >= b[0] && x < b[0] + b[2] && y >= b[1] && y < b[1] + b[3])) hit++;
    }
  }
  return hit / (GRID[0] * GRID[1]);
}

const TOL = 6;
const sameColour = (a, b) => Boolean(a && b) && [0, 1, 2].every((k) => Math.abs(a[k] - b[k]) <= TOL);

/** The share of the frame whose background or text is the declared accent (:root --accent) over the flood limit (rule accent-share). Null accent: not measured. */
export function accentFlood(samples) {
  const max = L['accent-share'].accent_share_pct_atmosphere_max;
  const shareOf = (s) => {
    const onAccent = s.boxes.filter((b) => b.bg && b.bg[3] * b.op >= 0.5 && sameColour(b.bg, s.accent)).map((b) => b.box);
    return coveredShare([...onAccent, ...copy(s).filter((t) => sameColour(t.color, s.accent)).map((t) => t.box)], s) * 100;
  };
  const measured = samples.filter((s) => s.accent);
  const worst = by(measured, shareOf);
  if (!worst || shareOf(worst) <= max) return [];
  return [finding('accent-flood', 'accent-share', worst.t, `the accent covers ${Math.round(shareOf(worst))}% of the frame; the limit is ${max}% (atmosphere), about ${L['accent-share'].accent_share_pct_typical}% is typical`,
    'put the accent on one thing: a caret, one numeral, the CTA')];
}

const pure = (c) => Boolean(c) && c[3] >= 0.95 && (c.slice(0, 3).every((v) => v === 0) || c.slice(0, 3).every((v) => v === 255));
const hex = (c) => (c[0] === 0 ? '#000' : '#fff');

/** Pure #000 or #fff as the ground: an element over the limit share of the frame. Pure ink on it is named too. Pure ink on a tinted ground is not flagged: the house ink is #fff (rule palette-from-brand). */
export function pureBlackWhite(samples) {
  const min = L['palette-from-brand'].ground_area_pct_min;
  for (const s of samples) {
    const ground = s.boxes.find((b) => pure(b.bg) && b.op >= 0.95 && (100 * area(b.box, s)) / (s.w * s.h) >= min);
    if (!ground) continue;
    const inks = copy(s).filter((t) => pure(t.color));
    const ink = inks.length ? ` and pure ${hex(inks[0].color)} ink on ${inks.length} text(s), e.g. "${inks[0].text.slice(0, 24)}"` : '';
    return [finding('pure-black-white', 'palette-from-brand', s.t, `pure ${hex(ground.bg)} as the ground${ink}`, 'tint the neutrals: a warm or cool near-black and off-white from the palette')];
  }
  return [];
}

const MEDIA = /^(img|video|canvas)$/;
const layered = (b) => b.image || b.blurred || MEDIA.test(b.tag);

/**
 * Advice when a frame has no living ground (rule living-ground); one sample is one world in `bin/vawe frame --world all`.
 * A layer is a CSS gradient or image background (on the element, or on its ::before or ::after), a blur filter, an img, a video or a canvas,
 * at opacity 0.5 or more, that paints at least ground_layer_strength_min against the ground (harness/lib/ground-paint.mjs: grain, a blend overlay and a faint gradient do not),
 * covering the ground_layer_area_pct_min of the frame. The finding names every flat frame, and says when they pass the limit.
 */
export function livingGround(samples) {
  const { ground_layer_area_pct_min: min, flat_samples_share_max_pct: max } = L['living-ground'];
  const read = samples.filter((s) => s.boxes.length);
  const flat = read.filter((s) => { const ground = groundOf(s.boxes); return coveredShare(s.boxes.filter((b) => b.op >= 0.5 && layered(b) && paintsGround(b, ground)).map((b) => b.box), s) * 100 < min; });
  if (!flat.length) return [];
  const over = (100 * flat.length) / read.length > max;
  const at = flat.map((s) => `${s.t} s`).join(', ');
  return [finding('living-ground', 'living-ground', flat[0].t, `${flat.length} of ${read.length} sampled frames have one flat ground (at ${at}): no gradient, image or blurred layer behind the content that differs from the ground${over ? `; over the limit of ${max}%` : ''}`,
    'give each world a light or colour layer that differs from the ground and from the last world (grain and a faint overlay do not count; prompts/moves/gradient-mesh-field.md, light-pool.md)')];
}

const MARKER = /^\(?0\d\)?(\s*[/.]\s*0\d)*\.?$/;
const SLASHED = /[/]/;

function eyebrows(s) {
  const { eyebrow_tracking_em_min: track, eyebrow_size_share_max: share } = L['no-tells'];
  const texts = copy(s);
  const title = texts.reduce((a, t) => (a && a.fontPx >= t.fontPx ? a : t), null);
  if (!title) return [];
  const over = (t) => t.box[0] < title.box[0] + title.box[2] && t.box[0] + t.box[2] > title.box[0];
  return texts.filter((t) => t.caps && t.trackingEm >= track && t.text.length >= 3 && t.fontPx <= title.fontPx * share && over(t)
    && t.box[1] + t.box[3] <= title.box[1] + 1 && title.box[1] - (t.box[1] + t.box[3]) <= 2 * title.fontPx);
}

function markers(s) {
  const found = copy(s).filter((t) => MARKER.test(t.text));
  const plain = new Set(found.filter((t) => !SLASHED.test(t.text)).map((t) => t.text));
  return found.some((t) => SLASHED.test(t.text)) || plain.size >= L['no-tells'].markers_min ? found : [];
}

const isCard = (b, i, s) => {
  const { card_radius_px_min_1920: radius, card_area_pct_min: pct } = L['no-tells'];
  const share = (100 * area(b.box, s)) / (s.w * s.h);
  return !b.decorative && surface(b) && b.radius >= scaled(radius, s) && share >= pct && share <= 80 && s.boxes.filter((c) => c.p === i).length >= 2;
};

function stripes(s) {
  const min = scaled(L['no-tells'].stripe_px_min, s);
  return s.boxes.filter((b) => {
    const [l, r, t, bt] = [b.border.l, b.border.r, b.border.t, b.border.b];
    const side = [l, r].find(([w, c]) => w >= min && c && c[3] > 0);
    const rest = [l, r, t, bt].filter((x) => x !== side);
    return !b.decorative && side && rest.every(([w]) => w <= 1);
  });
}

function cardTells(s) {
  const cards = s.boxes.map((b, i) => ({ b, i })).filter(({ b, i }) => isCard(b, i, s));
  const ids = new Set(cards.map((c) => c.i));
  const nested = cards.filter(({ b }) => { for (let p = b.p; p >= 0; p = s.boxes[p].p) if (ids.has(p)) return true; return false; });
  const sibs = new Map();
  for (const { b } of cards) (sibs.get(b.p) || sibs.set(b.p, []).get(b.p)).push(b);
  const { identical_cards_min: min, card_size_tolerance: tol } = L['no-tells'];
  const same = [...sibs.values()].find((g) => g.filter((x) => g.filter((y) => sameSize(x.box, y.box, tol)).length >= min).length >= min);
  return { nested, same };
}

/** Template chrome in one frame: eyebrow above a title, step markers, a side stripe, nested or identical cards (rule no-tells). */
export function templateChrome(samples) {
  const out = [];
  for (const s of samples) {
    const { nested, same } = cardTells(s);
    const tells = [
      [eyebrows(s), (x) => `a tracked-caps label above the title ("${x[0].text.slice(0, 24)}")`],
      [markers(s), (x) => `step markers (${x.slice(0, 3).map((t) => `"${t.text}"`).join(', ')})`],
      [stripes(s), () => 'a coloured side-stripe border on a card'],
      [nested, () => 'a card inside a card'],
      [same ? [same] : [], () => `${L['no-tells'].identical_cards_min} or more identical sibling cards`],
    ].filter(([found]) => found.length).map(([found, say]) => say(found));
    if (tells.length) out.push(finding('template-chrome', 'no-tells', s.t, tells.join('; '), 'drop the label, number only a true sequence, replace the stripe with space, vary the cards'));
  }
  return out.slice(0, 1);
}

const dist = (a, b) => Math.max(...[0, 1, 2].map((k) => Math.abs(a[k] - b[k])));
const WORD = /[\p{L}\p{N}]{2,}/gu;

/** [{ text, colour }] per block of one frame that holds text in two or more colours: the pieces that differ from the block's main colour. */
function colouredPieces(s) {
  const blocks = new Map();
  for (const t of copy(s)) (blocks.get(t.block) || blocks.set(t.block, []).get(t.block)).push(t);
  const out = [];
  for (const nodes of blocks.values()) {
    const weight = new Map();
    for (const t of nodes) weight.set(t.color.slice(0, 3).join(), (weight.get(t.color.slice(0, 3).join()) ?? 0) + t.text.length);
    const main = [...weight].sort((a, b) => b[1] - a[1])[0][0].split(',').map(Number);
    const odd = nodes.filter((t) => dist(t.color, main) > L['word-colour'].colour_diff_min);
    if (odd.length && odd.length < nodes.length) out.push(odd.map((t) => t.text).join(' '));
  }
  return out;
}

/** Text the beat names: the page's message and the brief's Beats section. */
export const namedText = (message, brief) => `${message ?? ''}\n${(String(brief ?? '').split(/^## /m).find((sec) => /^Beats\b/.test(sec)) ?? '')}`.toLowerCase();

/** A word coloured inside a line that neither the message nor the beats name, or more coloured words in a line than the limit (rule word-colour). */
export function colouredWords(samples, named = '') {
  const max = L['word-colour'].coloured_words_max;
  if (!named.trim()) return [];
  for (const s of samples) {
    for (const piece of colouredPieces(s)) {
      const words = piece.match(WORD) ?? [];
      const unnamed = words.filter((w) => !new RegExp(`\\b${w.toLowerCase()}`).test(named));
      if (unnamed.length) return [finding('coloured-word', 'word-colour', s.t, `"${unnamed.slice(0, 3).join(' ')}" is coloured inside a line, and neither the message nor the beats name it`,
        'say in the beat what the colour points at, or drop the colour')];
      if (words.length > max) return [finding('coloured-word', 'word-colour', s.t, `${words.length} coloured words in one line; the rule allows ${max}`, 'colour the one word the beat is about')];
    }
  }
  return [];
}

/** Every layout finding of the samples, in time order. `held` (a Set of placeKey) keeps only the texts that hold one place; null keeps all. */
export function layoutLint(samples, { named = '', held = null } = {}) {
  if (held) samples = samples.map((s) => ({ ...s, texts: s.texts.filter((t) => held.has(placeKey(t.text, t.box))) }));
  return [...typeSizes(samples), ...fontFamilies(samples), ...displayTracking(samples), ...leftEdges(samples), ...textMargin(samples), ...accentFlood(samples),
    ...pureBlackWhite(samples), ...templateChrome(samples), ...colouredWords(samples, named), ...livingGround(samples)].sort((a, b) => a.at - b.at);
}

/** The layout findings of a draft probe (its layout samples and its text samples), in time order. */
export const probeLayoutLint = (probe, named) => layoutLint(probe.layout ?? [], { named, held: heldPlaces(probe.samples, probe) });
