// `vawe new` without --from: the film type from the request words and the length. The templates come
// from the table in guides/ROUTING.md; this file holds only the words that point at a row.
import fs from 'node:fs';
import path from 'node:path';
import { READ_MARGIN_S } from '../lib/worlds.mjs';
import { HOLD_RULE } from '../lib/read-hold.mjs';

export const ROUTING = 'guides/ROUTING.md';
export const FALLBACK = 'sting';

// ROUTING.md: a sting is under 10 s, a long form over 60 s.
const STING_MAX_S = 10;
const LONG_MIN_S = 60;

// The beat-sheet template serves a sting and every unmatched request; each other template owns its length in its Length question
// (`vawe new` reads the default from it, also for the typed starters below).
const STING_LENGTH_S = 5;
const UNMATCHED_LENGTH_S = 15;

// A brand launch films a real site with real captures: it needs a URL, and an invented product has none.
const URL_WORDS = /(https?:\/\/|\bwww\.|\b[a-z0-9-]+\.(?:com|io|ai|app|dev|co|net|org|so)\b)/;
const INVENTED_WORDS = /\b(invented|fictional|fictitious|imaginary|made[- ]up|fake|hypothetical|placeholder)\b/;

const WORDS = [
  ['reference rebuild', /\b(recreat\w*|rebuild|remake|reference)\b/],
  ['edit', /\b(my clips?|my footage|raw footage|edit (?:my|these|the) (?:clips?|videos?|recordings?))\b/],
  ['sting', /\b(sting|bumper|ident|logo reveal|intro|outro|title card|lower third|motion graphic|stat hit|teaser)\b/],
  ['long form', /\b(long form|long-form|chapters?|documentary)\b/],
  ['music video', /\b(music video|song|drop|beat synced|beat-synced)\b/],
  ['UI morph', /\b(morph|ui loop)\b/],
  ['story or explainer', /\b(explain\w*|story|article|tutorial|how it works)\b/],
  ['app or game capture', /\b(game|lab|interactive|simulation)\b/],
  ['showreel', /\b(showreel|reel|taste probe)\b/],
  ['brand launch', /\b(launch|promo|product|saas|landing page|website|site|url|ai demo|product demo|demo video|feature tour|walkthrough|proof film|case study)\b/],
];

// The page `vawe new` starts from, by film type: a file in harness/cli/starters/, the start of each of its worlds and the spectacle
// second as fractions of the length (the film at its fullest). A type with an `order` keeps only the first n worlds of it for a shorter
// film (starterWorlds); every other type, and a film under starterMin, takes the general starter.
export const STARTERS = {
  sting: { file: 'sting', beats: [0, 0.3, 0.7], spectacle: 0.36 },
  'brand launch': {
    file: 'brand-launch', order: ['s1', 's2', 's7', 's4', 's5', 's3', 's6'],
    beats: [0, 0.14375, 0.33125, 0.475, 0.6125, 0.7375, 0.8625], spectacle: 0.856,
  },
  'story or explainer': {
    file: 'story', order: ['s1', 's2', 's12', 's6', 's8', 's5', 's3', 's4', 's7', 's11', 's10', 's9'],
    beats: [0, 0.1, 0.1883, 0.2767, 0.4133, 0.491, 0.5577, 0.646, 0.7127, 0.7893, 0.856, 0.9227], spectacle: 0.936,
  },
};

const MIN_WORLDS = 4;
const index = (id) => Number(id.slice(1)) - 1;
const fullShares = ({ beats }) => beats.map((start, i) => (beats[i + 1] ?? 1) - start);

// A world must hold its text's read floor and the entrance and exit margin.
const WORLD_FLOOR_S = HOLD_RULE.floor + READ_MARGIN_S;

/** The first `count` worlds of a type's `order`, in film order: [{ id, share }], the shares adding to 1. A share is the world's share in the full starter, renormalised. */
export function worldShares(type, count) {
  const entry = STARTERS[type];
  const shares = fullShares(entry);
  const kept = (entry.order?.slice(0, count) ?? shares.map((_, i) => `s${i + 1}`)).map(index).sort((x, y) => x - y);
  const total = kept.reduce((sum, i) => sum + shares[i], 0);
  return kept.map((i) => ({ id: `s${i + 1}`, share: shares[i] / total }));
}

const STARTERS_DIR = path.join(import.meta.dirname, 'starters');

/** The ids of a starter's worlds that show no text: they need no read time, only the world-held limit. */
export const wordlessIds = (type) => {
  const body = fs.readFileSync(path.join(STARTERS_DIR, `${STARTERS[type].file}.html`), 'utf8').split('<body>')[1];
  return [...body.matchAll(/<(main|section)\b[^>]*data-world="(s\d+)"[\s\S]*?<\/\1>/g)].filter((m) => !/>[^<>]*\w[^<>]*</.test(m[0])).map((m) => m[2]);
};

const fits = (type, count, length) => {
  const wordless = wordlessIds(type);
  return worldShares(type, count).every((w) => wordless.includes(w.id) || w.share * length >= WORLD_FLOOR_S);
};

/**
 * The worlds a type's starter keeps at a length: the largest count of the first worlds of `order` (at least MIN_WORLDS) whose shortest world still spans WORLD_FLOOR_S.
 * More worlds also keep every span nearer TURN_SECONDS_MAX, the world-held limit, which the read floor makes unreachable for a text world: the two limits meet only at 2 s.
 */
export function starterWorlds(type, length) {
  const { order } = STARTERS[type];
  if (!order) return worldShares(type);
  let count = MIN_WORLDS;
  for (let n = MIN_WORLDS + 1; n <= order.length; n += 1) if (fits(type, n, length)) count = n;
  return worldShares(type, count);
}

/** The shortest whole-second film a type's starter fits: the MIN_WORLDS worlds each span WORLD_FLOOR_S. 0 for a type with no `order`. */
export function starterMin(type) {
  if (!STARTERS[type].order) return 0;
  const wordless = wordlessIds(type);
  return Math.ceil(WORLD_FLOOR_S / Math.min(...worldShares(type, MIN_WORLDS).filter((w) => !wordless.includes(w.id)).map((w) => w.share)));
}

/** The spectacle second: the full starter's offset from its last world's start, kept on the last world kept. */
export function starterSpectacle(type, length) {
  const { beats, spectacle } = STARTERS[type];
  const last = starterWorlds(type, length).at(-1);
  return length * (1 - last.share + spectacle - beats.at(-1));
}

/** The STARTERS key for a routed film, or undefined: an unmatched request, a sting past STING_MAX_S (the invented-product fallback) and a film under starterMin take the general starter. */
export const starterType = (route, length) => (route?.known && route.type in STARTERS && !(route.type === 'sting' && length > STING_MAX_S) && length >= starterMin(route.type) ? route.type : undefined);

// RECIPES.md "Complete videos": one chain per 20 to 30 s film, found by its heading number.
export const RECIPES = 'prompts/moves/RECIPES.md';
const RECIPE_MIN_S = 20;
const RECIPE_MAX_S = 30;
const RECIPE_WORDS = [
  [13, /\b(manifesto|kinetic type|kinetic typography|typographic)\b/],
  [12, /\b(proof|testimonials?|case study|results|metrics)\b/],
  [11, /\b(feature tour|tour|walkthrough|walk-through|features)\b/],
  [10, /\b(ai|agent|assistant|copilot|chatbot|llm)\b/],
  [14, /\b(brand reveal|reveal|rebrand|brand film|identity)\b/],
  [9, /\b(problem|pain|before and after|launch)\b/],
];

/** { number: heading } from the RECIPES.md chain headings ("## 10. AI product demo, 22 s (thread: ...)"). */
export function recipeTable(markdown) {
  const rows = {};
  for (const m of markdown.matchAll(/^## (\d+)\. (.+)$/gm)) rows[m[1]] = `${m[1]}. ${m[2]}`;
  return rows;
}

/** The chain a 20 to 30 s request starts from: { heading, why }, or null. Throws when RECIPES.md lacks the row. */
export function pickRecipe({ request = '', name = '', title = '', length } = {}, recipes) {
  if (!(length >= RECIPE_MIN_S && length <= RECIPE_MAX_S)) return null;
  const text = [request, name.replace(/-/g, ' '), title].join(' ').toLowerCase();
  for (const [n, re] of RECIPE_WORDS) {
    const m = re.exec(text);
    if (!m) continue;
    if (!recipes[n]) throw new Error(`${RECIPES} has no "## ${n}." chain; chains: ${Object.keys(recipes).join(', ')}`);
    return { heading: recipes[n], why: `${length} s and the request says "${m[0]}"` };
  }
  return null;
}

/** The RECIPES.md chain headings read from the repo at `root`. */
export function readRecipes(root) {
  return recipeTable(fs.readFileSync(path.join(root, RECIPES), 'utf8'));
}

/** { type: template } from the ROUTING.md film-type table. */
export function routingTable(markdown) {
  const rows = {};
  for (const line of markdown.split('\n')) {
    const cells = line.split('|').map((c) => c.trim());
    if (!/^\d+$/.test(cells[1] || '')) continue;
    const template = /`([^`]+\.md)`/.exec(cells[4] || '');
    if (template) rows[cells[2]] = `prompts/${template[1]}`;
  }
  return rows;
}

function typeFor(text, length) {
  if (WORDS[0][1].test(text)) return { type: WORDS[0][0], why: 'the request names a reference' };
  const named = WORDS.slice(1).find(([, re]) => re.test(text))?.[0];
  if (named === 'edit') return { type: 'edit', why: 'the request names the person\'s clips' };
  const fits = named in STARTERS && named !== 'sting' && length >= starterMin(named);
  if (length !== undefined && length <= STING_MAX_S && !fits) return { type: 'sting', why: `${length} s is ${STING_MAX_S} s or less` };
  if (length !== undefined && length > LONG_MIN_S) return { type: 'long form', why: `${length} s is over ${LONG_MIN_S} s` };
  for (const [type, re] of WORDS.slice(1)) {
    const m = re.exec(text);
    if (!m) continue;
    if (type === 'brand launch' && INVENTED_WORDS.test(text) && !URL_WORDS.test(text)) return { type: FALLBACK, length: UNMATCHED_LENGTH_S, why: 'the product is invented and has no URL to capture, so the beat sheet, with the launch chain for the beats' };
    return { type, why: `the request says "${m[0]}"` };
  }
  return null;
}

function route({ request = '', name = '', title = '', length: asked } = {}) {
  const text = [request, name.replace(/-/g, ' '), title].join(' ').toLowerCase();
  const hit = typeFor(text, asked);
  if (!hit) return { known: false, type: FALLBACK, why: 'no word or length named a film type, so the motion-graphic row', length: UNMATCHED_LENGTH_S };
  return { known: true, ...hit, length: hit.length ?? (hit.type === 'sting' ? STING_LENGTH_S : undefined) };
}

/** The seconds the beat-sheet template takes for a request, without the ROUTING.md table. */
export const beatSheetLength = (details) => route(details).length ?? UNMATCHED_LENGTH_S;

/**
 * The template for a request: { template, type, why, known, length }, `length` being the route's seconds, set only for a sting or an unmatched request. `known` is false when no word or length
 * matched and the motion-graphic row (a sting) was taken. Throws when ROUTING.md lacks the row.
 */
export function pickTemplate(details = {}, table) {
  const { known, type, why, length } = route(details);
  const template = table[type];
  if (!template) throw new Error(`${ROUTING} has no "${type}" row; rows: ${Object.keys(table).join(', ')}`);
  return { template, type, why, known, length };
}

/** { film type: [min s, max s] } from the "Typical lengths:" sentence of ROUTING.md ("sting 3 to 8 s, story 30 s to 3 min"); a type with one number has no range. */
export function typicalRanges(markdown) {
  const sentence = /Typical lengths: ([^.]*)\./.exec(markdown)?.[1] ?? '';
  const seconds = (n, unit) => Number(n) * (unit === 'min' ? 60 : 1);
  const ranges = {};
  for (const item of sentence.split(', ')) {
    const m = /^(.+?) ([\d.]+)(?: (s|min))? to ([\d.]+) (s|min)$/.exec(item);
    if (m) ranges[m[1]] = [seconds(m[2], m[3] ?? m[5]), seconds(m[4], m[5])];
  }
  return ranges;
}

/** The film type a request names and its typical range, { type, range }, or null when no word named a type or the type has no range. */
export function typicalRangeFor(details, root) {
  const { known, type } = pickTemplate({ request: details.request, name: details.name }, readRouting(root));
  const ranges = typicalRanges(fs.readFileSync(path.join(root, ROUTING), 'utf8'));
  const key = Object.keys(ranges).find((k) => type.startsWith(k));
  return known && key ? { type: key, range: ranges[key] } : null;
}

/** The routing table read from the repo at `root`. */
export function readRouting(root) {
  return routingTable(fs.readFileSync(path.join(root, ROUTING), 'utf8'));
}
