// Pure parsing and the range check for the Directions section of a film's brief.md: three slots
// (### A, ### B, ### C) of `- field: value` lines, and a `picked:` line. No I/O. Advice only.
import ATTRACTORS from '../../taste/attractors.json' with { type: 'json' };

export const FIELDS = ['family', 'sentence', 'key frame', 'palette', 'typeface', 'move', 'thread', 'risk', 'from'];

export const FAMILIES = {
  type: { label: 'type-led', hint: 'the film is carried by type', words: /\b(type|typo\w*|letter\w*|word\w*|glyph\w*)/ },
  object: { label: 'object-led', hint: 'a real thing or the product UI', words: /\b(object|product|thing|ui|capture|photo\w*|material)/ },
  graphic: { label: 'graphic-led', hint: 'shape, colour field, rhythm', words: /\b(graphic|shape|colou?r|field|rhythm|geometr\w*|pattern)/ },
};

export { ATTRACTORS };

const wordsRe = (words) => new RegExp(`(?<![\\p{L}])(${[...words].sort((a, b) => b.length - a.length).join('|')})s?(?![\\p{L}])`, 'giu');
const ATTRACTOR = wordsRe(ATTRACTORS.shapes.words);
const NAME = wordsRe(ATTRACTORS.names.words);

/** The attractor words in `text`, longest first, a word inside a longer match left out. */
export function attractorWords(text = '', re = ATTRACTOR) {
  const found = [...String(text).toLowerCase().matchAll(re)].map((m) => m[1]);
  return [...new Set(found)].filter((w, _, all) => !all.some((o) => o !== w && o.includes(w)));
}

const HUE_WORDS = [
  ['red', /\b(red|vermilion|crimson|scarlet|brick|rust)\b/],
  ['orange', /\b(orange|amber|tangerine|copper|terracotta)\b/],
  ['yellow', /\b(yellow|gold\w*|lemon|mustard|ochre)\b/],
  ['green', /\b(green|olive|lime|mint|sage|emerald|forest)\b/],
  ['cyan', /\b(cyan|teal|turquoise|aqua)\b/],
  ['blue', /\b(blue|cobalt|navy|ultramarine|azure|indigo)\b/],
  ['purple', /\b(purple|violet|lilac|lavender|plum)\b/],
  ['magenta', /\b(magenta|pink|fuchsia|rose)\b/],
];

const HUE_BANDS = [[15, 'red'], [45, 'orange'], [70, 'yellow'], [160, 'green'], [200, 'cyan'], [255, 'blue'], [290, 'purple'], [340, 'magenta'], [360, 'red']];

const STOP = new Set(['a', 'an', 'the', 'of', 'to', 'in', 'on', 'into', 'and', 'then', 'with', 'from', 'its', 'it', 'as', 'at', 'by', 'one', 'that', 'each']);

const TYPE_NOISE = /\b(\d+|thin|light|regular|book|medium|semibold|bold|black|heavy|italic|condensed|display|text|variable)\b/g;

function directionsSection(brief) {
  const m = brief.match(/^## Directions[^\n]*\n([\s\S]*?)(?=^## |(?![\s\S]))/m);
  return m ? m[1] : null;
}

/** The three slots and the picked line. `slots` is [{ id, fields: { family, sentence, ... } }]. */
export function parseDirections(brief) {
  const section = brief == null ? null : directionsSection(brief);
  if (section == null) return { found: false, slots: [], picked: null };
  const slots = [];
  for (const line of section.split('\n')) {
    const head = line.match(/^###\s+([A-Z])\b/);
    if (head) { slots.push({ id: head[1], fields: {} }); continue; }
    const field = line.match(/^\s*-\s*([a-z ]+?):\s*(.*)$/i);
    if (field && slots.length && FIELDS.includes(field[1].toLowerCase())) slots[slots.length - 1].fields[field[1].toLowerCase()] = field[2].trim();
  }
  const pick = section.match(/^\s*-?\s*picked:[ \t]*(.*)$/m);
  return { found: true, slots, picked: pick ? parsePicked(pick[1]) : null };
}

function parsePicked(text) {
  const m = text.trim().match(/^([A-Z])\b[\s:,.;()-]*(?:because\s+)?(.*)$/i);
  return m ? { id: m[1].toUpperCase(), reason: m[2].trim() } : { id: null, reason: '' };
}

/** A slot counts as filled when it has a sentence and a key frame. */
export const isFilled = (slot) => Boolean(slot.fields.sentence && slot.fields['key frame']);

export function familyOf(text = '') {
  const t = text.toLowerCase();
  return Object.keys(FAMILIES).find((k) => FAMILIES[k].words.test(t)) || (t.trim() || null);
}

function hexHue(hex) {
  const h = hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  const light = (max + min) / 2;
  const sat = d === 0 ? 0 : d / (1 - Math.abs(2 * light - 1));
  if (d < 0.15 || sat < 0.25) return null;
  const hue = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return HUE_BANDS.find(([edge]) => hue * 60 < edge)[1];
}

/** The chromatic hue families a palette names, by hex code or colour word; neutrals are left out. */
export function hueFamilies(palette = '') {
  const t = palette.toLowerCase();
  const out = new Set();
  for (const m of t.matchAll(/#([0-9a-f]{6}|[0-9a-f]{3})\b/g)) { const h = hexHue(m[1]); if (h) out.add(h); }
  for (const [name, re] of HUE_WORDS) if (re.test(t)) out.add(name);
  return out;
}

export function typefaceKey(text = '') {
  const first = text.toLowerCase().split(/[,;(/]/)[0].replace(TYPE_NOISE, ' ').replace(/\s+/g, ' ').trim();
  return first || null;
}

function moveWords(text = '') {
  return text.toLowerCase().replace(/[^a-z\s-]/g, ' ').split(/\s+/).filter((w) => w && !STOP.has(w));
}

export function sameMove(a, b) {
  const x = moveWords(a), y = moveWords(b);
  if (!x.length || !y.length) return false;
  if (x[0] === y[0]) return true;
  const sy = new Set(y), inter = new Set(x.filter((w) => sy.has(w))).size;
  return inter / new Set([...x, ...y]).size >= 0.5;
}

const heroText = (s) => [s.fields.sentence, s.fields['key frame'], s.fields.thread].join(' ').toLowerCase();

function pairProblems(a, b) {
  const pair = `${a.id} and ${b.id}`;
  const out = [];
  const fa = familyOf(a.fields.family), fb = familyOf(b.fields.family);
  if (fa && fa === fb) out.push(`${pair} are both ${FAMILIES[fa]?.label || fa}; move one to another family (${Object.values(FAMILIES).map((f) => f.label).join(', ')})`);
  const shared = [...hueFamilies(a.fields.palette)].filter((h) => hueFamilies(b.fields.palette).has(h));
  if (shared.length) out.push(`${pair} share the ${shared.join(' and ')} hue family; give one a different palette`);
  const ta = typefaceKey(a.fields.typeface);
  if (ta && ta === typefaceKey(b.fields.typeface)) out.push(`${pair} use the same typeface (${ta}); pick another face for one`);
  if (sameMove(a.fields.move, b.fields.move)) out.push(`${pair} have the same signature move ("${a.fields.move}" / "${b.fields.move}"); give one a different verb`);
  return out;
}

/** Range advice for filled slots: duplicated family, hue family, typeface or move, and more than one attractor hero. */
export function rangeProblems(slots) {
  const filled = slots.filter(isFilled);
  const out = [];
  for (let i = 0; i < filled.length; i++) for (let j = i + 1; j < filled.length; j++) out.push(...pairProblems(filled[i], filled[j]));
  const lit = filled.filter((s) => attractorWords(heroText(s)).length);
  const ids = lit.map((s) => s.id);
  if (lit.length > 1) out.push(`${ids.slice(0, -1).join(', ')} and ${ids.at(-1)} carry the film on a circle, orb, sun, ring or glow; keep at most one, rebuild the others on type, a real object or a colour field`);
  return out;
}

const BRAND_LINE = /^\s*-\s*(?:brand(?: name)?|name|title)\s*:\s*(.+)$/gim;

const quote = (ws) => ws.map((n) => `"${n}"`).join(', ');

/** Advice when a brand or film name is a light-poetry attractor name, else nothing. */
export function brandAdvice(text) {
  const names = attractorWords(text, NAME);
  return names.length ? [`attractor: the brand name ${quote(names)} is a light-poetry name (card Attractors); fix: ${ATTRACTORS.names.fix}`] : [];
}

/** Attractor names in the brief's brand, name or title lines and in each direction's lead name; attractor hero shapes in each filled direction (card Attractors). */
export function attractorProblems(brief, slots = parseDirections(brief).slots) {
  const out = [];
  const brand = [...String(brief ?? '').matchAll(BRAND_LINE)].map((m) => m[1]).filter((v) => !v.includes('[unanswered')).join(' ');
  const names = attractorWords(brand, NAME);
  out.push(...brandAdvice(brand));
  for (const s of slots.filter(isFilled)) {
    const text = `${s.fields.sentence} ${s.fields['key frame']} ${s.fields.thread ?? ''}`;
    const own = attractorWords(s.fields.sentence.split(/[,:;]/)[0], NAME).filter((n) => !names.includes(n));
    if (own.length) out.push(`attractor: direction ${s.id} is named ${quote(own)}, a light-poetry name (card Attractors); fix: ${ATTRACTORS.names.fix}; or waive "attractor@${s.id}" in the page with a _why`);
    const shapes = attractorWords(text);
    if (shapes.length) out.push(`attractor: direction ${s.id}'s hero is ${quote(shapes)} (card Attractors: ${ATTRACTORS.shapes.cards.join('; ').toLowerCase()}); fix: ${ATTRACTORS.shapes.fix}; or waive "attractor@${s.id}" in the page with a _why`);
  }
  return out;
}

/** The lines `vawe dev` prints under the draft check. `dir` is the film folder as the user types it. */
export function directionsLines(brief, dir) {
  if (brief == null) return [];
  const { slots, picked } = parseDirections(brief);
  const attract = attractorProblems(brief, slots);
  if (slots.filter(isFilled).length < 3) return [...attract, `directions: empty; fill three from different families in brief.md and their key frames in ${dir}/directions.html, then \`picked:\` with a reason; the next bin/vawe dev scores the three`];
  const range = rangeProblems(slots).map((p) => `directions: ${p}`);
  if (!picked?.id || !picked.reason) return [...range, ...attract, 'directions: no `picked:` with a reason in brief.md; write `picked: B, because ...` after reading the stills judge'];
  return [...range, ...attract];
}
