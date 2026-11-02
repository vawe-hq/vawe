// `vawe new <name>`: writes films/<name>/page.html (the starter of the film type, harness/cli/starters/), films/<name>/directions.html
// (three key frames side by side) and films/<name>/brief.md. brief.md takes the template's question
// bank with every default filled in and marked unanswered, then the measured-brief sections in the order of
// prompts/ANATOMY.md (harness/lib/measured-brief.mjs), a Taken from table (the references' frames, filled before
// any design file), the Design system and States budget sections, a Directions section (three slots from three families,
// a picked line) after Task, and the template's own tagged sections: a section named like a skeleton section
// puts its text above that one's fields (so a table ends its section), the others follow as headings.
import fs from 'node:fs';
import path from 'node:path';
import { UsageError } from './parse.mjs';
import { ensureFonts } from '../lib/ensure-fonts.mjs';
import { pickTemplate, beatSheetLength, readRouting, ROUTING, pickRecipe, readRecipes, RECIPES, STARTERS, starterWorlds, starterSpectacle, starterType } from './route.mjs';
import { tasteLines } from '../lib/taste-steps.mjs';
import { isAspect, aspectProblem } from '../lib/page-params.mjs';
import { FAMILIES, FIELDS, brandAdvice } from '../lib/directions.mjs';
import { adviceBlock } from '../lib/advice.mjs';
import { SAY } from '../live/stage-say.mjs';
import { measuredSections, DEFAULT_LENGTH, GUESS, DETAIL_KEYS, answeredDetails, unansweredDetails, questionCalls, PLACEHOLDER, STARTER_LINE } from '../lib/measured-brief.mjs';
import { dialRanges, signatureSection } from '../lib/signature.mjs';
import { recentFromDisk, varietyFor, namesBrandKit } from '../lib/variety.mjs';
import { DIALS } from '../../core/motion/signature.js';
import { starterBeats } from '../lib/worlds.mjs';
import { fontsLine } from '../lib/asset-lists.mjs';
import { SEEDS, pickSeed, seedLine } from '../lib/palette-seeds.mjs';

const STARTER_TEMPLATE = `<!doctype html>
<html data-aspect="{{aspect}}">
<head>
<meta charset="utf-8">
<meta name="duration" content="{{length}}">
<meta name="aspect" content="{{aspect}}">
<meta name="message" content="one thing to remember">
<meta name="signature" content="{{signature}}">
<title>{{title}}</title>
<!-- signature: choose the six dials in the tag above (ranges: brief.md, ## Signature).
  enter, leave, stagger and layer take band, ease and stagger from it; bin/vawe dev names each dial still unchosen
  budget (taste/build/DIGEST.md); change any line on purpose:
  colours: --ground and --ink are grey placeholders until the palette dial is chosen; one accent on one thing, if any
  typefaces: 1, {{family}} (assets/{{font}}), a stand-in; bundle the face the direction needs
  signature move: one, named here, used once
  thread: the one object, type line, colour or rhythm that carries through (rule thread)
  sound cues: small effects at default gains, a real recorded one first, at most one soft swell (rule sound-cues)
  world turns: a new element, cut or ground every 1 to 2 s (rule world-turns) -->
<style>
  @font-face { font-family: "{{family}}"; src: url("assets/{{font}}") format("woff2"); font-weight: 100 900; }
  :root { --ground: {{ground}} /* unchosen: palette dial */; --ink: {{ink}} /* unchosen: palette dial */; {{beats}} }
  html, body { margin: 0; height: 100%; background: var(--ground); overflow: hidden; }
  .world { position: absolute; inset: 0; isolation: isolate; box-sizing: border-box; display: grid; align-content: end; gap: calc(var(--vh) * 0.03);
           padding: 0 calc(var(--vw) * 0.07) calc(var(--vh) * 0.12); font-family: "{{family}}", sans-serif; }
{{groundCss}}
  h1 { margin: 0; font-size: calc(var(--vh) * 0.14); font-weight: 700; line-height: 1; }
  .line { margin: 0; font-size: calc(var(--vh) * 0.09); }
  .facts { margin: 0; padding: 0; list-style: none; font-size: calc(var(--vh) * 0.09); font-weight: 600; line-height: 1.15; }
  h1, .line, .facts { letter-spacing: -0.03em; }
  [data-aspect="9:16"] h1 { font-size: calc(var(--vw) * 0.13); }
  .thread { position: absolute; left: 0; top: 0; width: calc(var(--vh) * 0.07); height: calc(var(--vh) * 0.07); border-radius: 18%;
            background: color-mix(in srgb, var(--ground), white 60%); }
</style>
<script type="module">
// core/motion/README.md: enter, leave, stagger and layer carry the house motion; change the options, keep the calls
import { enter, keys, layer, leave, stagger, EASE } from '../../core/motion/presets.js';
const root = document.documentElement;
const beat = (n) => parseFloat(getComputedStyle(root).getPropertyValue('--beat-' + n));
const end = window.vawe?.duration ?? parseFloat(document.querySelector('meta[name="duration"]').content);
const $ = (s) => document.querySelector(s);
const worlds = [...document.querySelectorAll('[data-world]')];
// each ground blob drifts by [x, y] fractions of the frame while its world shows; a world with no words also blooms them
const DRIFT = [[-0.2, 0.1], [0.18, -0.2], [0.14, -0.16]];
const blobs = (world, from, to, keyframes, easing) => world.querySelectorAll('.ground i').forEach((blob, k) => blob.animate(keyframes(k), { delay: from * 1000, duration: (to - from) * 1000, easing, fill: 'both' }));
const drift = (world, from, to) => blobs(world, from, to, (k) => [{ translate: '0 0' }, { translate: 'calc(var(--vw) * ' + DRIFT[k][0] + ') calc(var(--vh) * ' + DRIFT[k][1] + ')' }], EASE.glide);
const bloom = (world, from, to) => blobs(world, from, to, () => [{ scale: 0.7 }, { scale: 1.25 }], EASE.land);
const cutTo = (el, visibility, at, fill) => el.animate([{ visibility: visibility === 'visible' ? 'hidden' : 'visible' }, { visibility }], { delay: at * 1000, duration: 1, fill });
worlds.forEach((world, i) => {
  const last = i + 1 === worlds.length;
  const stop = last ? end : beat(i + 2);
  if (i === 0) {
    cutTo(world, 'hidden', stop, 'forwards');
    drift(world, 0, stop);
    layer($('h1'), $('.line'), { at: beat(1), blur: 14, from: '0 0.4em', secondary: { blur: 8 } });
    leave($('.line'), { end: stop - 0.06 });
    leave($('h1'), { end: stop });
    return;
  }
  // the cut frame already carries the first fact moving: a blank frame there fails the draft check
  const cut = beat(i + 1) - 0.03;
  cutTo(world, 'visible', cut, 'both');
  if (!last) cutTo(world, 'hidden', stop, 'forwards');
  drift(world, cut, stop);
  const facts = world.querySelector('.facts');
  if (!facts) return bloom(world, cut, stop);
  stagger(facts.querySelectorAll('li'), { at: cut, blur: 10, ...(i % 2 ? { from: '0.6em 0' } : { from: '0 0.6em', ease: 'pop' }) });
  facts.animate([{ translate: '0 0' }, { translate: '0 -0.4em' }], { delay: cut * 1000, duration: (stop - cut) * 1000, easing: EASE.glide, fill: 'both' });
});
// the thread (rule thread): one object carried across every cut, from its place in one world to its place in the next; make it the film's own
const PLACE = [[0.78, 0.2], [0.62, 0.32], [0.86, 0.48], [0.7, 0.14]];
const place = (k) => 'calc(var(--vw) * ' + PLACE[k % PLACE.length][0] + ') calc(var(--vh) * ' + PLACE[k % PLACE.length][1] + ')';
const carry = worlds.slice(1).flatMap((world, k) => [[beat(k + 2) - 0.23, place(k), 'fling'], [beat(k + 2) + 0.27, place(k + 1), 'hang']]);
enter($('.thread'), { at: 0.3, from: '0 0', scale: 0.4, ease: 'pop' });
keys($('.thread'), 'translate', [[0, place(0)], ...carry, [end, place(worlds.length - 1)]]);
</script>
</head>
<body>
{{worlds}}
<div class="thread"></div>
</body>
</html>
`;

// Three key frames side by side, one per family, before any motion. Each column is a small working
// still the agent rewrites into its own direction; the judge reads them left to right as A, B, C.
const DIRECTIONS_TEMPLATE = `<!doctype html>
<html data-aspect="16:9">
<head>
<meta charset="utf-8">
<meta name="duration" content="1">
<title>{{title}}: three directions</title>
<style>
  :root { --sheet: #e4e1da; --label: #14161a; }
  html, body { margin: 0; height: 100%; background: var(--sheet); overflow: hidden; }
  body { box-sizing: border-box; display: grid; align-items: start; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 2vw;
         padding: 7vh 3vw; align-content: center; font: 400 1.9vh/1.35 ui-monospace, Menlo, monospace; color: var(--label); }
  figure { margin: 0; display: grid; grid-template-rows: auto 1fr; align-content: start; gap: 1.6vh; min-width: 0; }
  .frame { aspect-ratio: {{ratio}}; position: relative; overflow: hidden; container-type: inline-size; }
  figcaption b { display: block; font-size: 1.15em; }

  /* A, type-led: the words are the picture */
  .a .frame { background: #efe9dc; color: #16151a; }
  .a h1 { position: absolute; left: 7%; bottom: 9%; margin: 0; max-width: 88%;
          font: 900 13cqw/0.88 "Iowan Old Style", "Palatino", Georgia, serif; letter-spacing: -0.03em; }
  .a h1 em { color: #d8432b; font-style: italic; }

  /* B, object-led: one real thing, lit from one side */
  .b .frame { background: #25211d; }
  .b .card { position: absolute; left: 30%; top: 16%; width: 46%; height: 64%; background: #f3efe6; border-radius: 1cqw;
             transform: rotate(-7deg); box-shadow: -3cqw 4cqw 6cqw rgb(0 0 0 / 0.55); }
  .b .card::before { content: ""; position: absolute; left: 9%; top: 8%; width: 36%; height: 8%; background: #2f7d5b; }
  .b .card p { position: absolute; left: 9%; right: 9%; bottom: 8%; margin: 0; color: #25211d; font: 600 6.5cqw/1.05 ui-monospace, Menlo, monospace; }

  /* C, graphic-led: colour fields in a rhythm */
  .c .frame { background: #f2c14e; }
  .c .bars { position: absolute; inset: 0; display: grid; grid-template-columns: 5fr 1fr 8fr 1fr 3fr; gap: 7%; padding: 0 0 0 6%; }
  .c .bars i { background: #2336c8; }
  .c .bars i:nth-child(2n) { background: #16151a; }
  .c h1 { position: absolute; right: 6%; top: 8%; margin: 0; color: #16151a; background: #f2c14e; padding: 0 2cqw;
          font: 800 8cqw/1 "Avenir Next Condensed", "Arial Narrow", sans-serif; text-transform: uppercase; }
</style>
</head>
<body>
<figure class="a"><div class="frame"><h1>{{title}} <em>now.</em></h1></div>
  <figcaption><b>A, type-led</b>serif set huge, one word in vermilion; move: the words fold in line by line</figcaption></figure>
<figure class="b"><div class="frame"><div class="card"><p>{{title}}</p></div></div>
  <figcaption><b>B, object-led</b>the real thing on a dark table (swap in a capture); move: it slides in and turns flat</figcaption></figure>
<figure class="c"><div class="frame"><div class="bars"><i></i><i></i><i></i><i></i><i></i></div><h1>{{title}}</h1></div>
  <figcaption><b>C, graphic-led</b>ultramarine and black bars on yellow; move: the bars wipe across on the beat</figcaption></figure>
</body>
</html>
`;

export function directionsPage({ aspect = '16:9', title = 'Say the one thing' }) {
  return DIRECTIONS_TEMPLATE.replaceAll('{{ratio}}', aspect.replace(':', ' / '))
    .replaceAll('{{title}}', title.replace(/&/g, '&amp;').replace(/</g, '&lt;'));
}

function slotText(id, family) {
  const f = FAMILIES[family];
  return [`### ${id}`, '', `- family: ${f.label} (${f.hint})`, ...FIELDS.slice(1).map((k) => `- ${k}:`)].join('\n');
}

function directionsText(name) {
  return `## Directions

Three directions from three families before any motion; the first idea is the one every agent has.
Each slot: one sentence; the key frame (what is on screen at the one big moment); the palette (hex);
the typeface; the one signature move (a verb: fold, pour, slice, stamp); the thread (the one thing that
carries through the film); the risk (how it fails); from (a real frame path or ref id it is drawn from). No two slots share a hue family, a typeface or a move, and at most one is
carried by a circle, orb, sun, ring or glow. Budget: 2 colours, 1 typeface, 1 signature move, 1 sound.
Story and structure: the spine is taste/craft/story.md (hook, build, proof, payoff, CTA); what carries across each cut is taste/craft/film-structure.md; reject the median first (guides/PITCH.md).

films/${name}/directions.html holds one working still per family: rewrite each into its slot's key frame.
Show the three to the person as one board: bin/vawe frame films/${name}/page.html --directions. The person picks one, and later types /vawe-approve.
bin/vawe dev scores the three with the stills judge by itself, once per change of directions.html or their brief lines.

${slotText('A', 'type')}

${slotText('B', 'object')}

${slotText('C', 'graphic')}

- picked: [A, B or C], because [one reason]`;
}

// Variable faces fetched by generators/media/fonts.mjs, none a house default. The film name picks one,
// so eight starters do not open on one face.
export const STARTER_FACES = [
  ['Fraunces.woff2', 'Fraunces'], ['HankenGrotesk.woff2', 'Hanken Grotesk'], ['Unbounded.woff2', 'Unbounded'], ['Manrope.woff2', 'Manrope'],
];

export function starterFace(name = '') {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const [font, family] = STARTER_FACES[h % STARTER_FACES.length];
  return { font, family };
}

const beatVars = (beats) => beats.map((b, i) => `--beat-${i + 1}: ${b.start}s;`).join(' ');

const GROUND = '<div class="ground" aria-hidden="true"><i></i><i></i><i></i></div>';

function worldsHtml(beats, title) {
  const rest = beats.slice(1).map((b, k) => `<section class="world" data-world="s${k + 2}">
  ${GROUND}${b.wordless ? '' : `\n  <ul class="facts"><li>fact ${k + 2}</li><li>its proof</li></ul>`}
</section>`);
  return [`<main class="world" data-world="s1">
  ${GROUND}
  <h1>${title}</h1>
  <p class="line">${STARTER_LINE}</p>
</main>`, ...rest].join('\n');
}

const STARTERS_DIR = path.join(import.meta.dirname, 'starters');
const readStarterFile = (name) => fs.readFileSync(path.join(STARTERS_DIR, name), 'utf8');

const fill = (template, values) => template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
  if (!(key in values)) throw new Error(`starter: no value for {{${key}}}`);
  return values[key];
});

/** The worlds of a film type's starter: [{ id, start, end, wordless }], the starts being the STARTERS fractions of the length. */
export function typeBeats(type, length) {
  let start = 0;
  return starterWorlds(type, length).map(({ id, share }) => {
    const beat = { id, start: +start.toFixed(2), end: +(start + share * length).toFixed(2), wordless: false };
    start += share * length;
    return beat;
  });
}

const keepWorlds = (html, ids) => html.replace(/<(main|section)\b[^>]*data-world="(s\d+)"[\s\S]*?<\/\1>\n/g, (world, _tag, id) => (ids.includes(id) ? world : ''));

/** The starter for a film type listed in STARTERS, else the general one. */
export function starterPage({ length = DEFAULT_LENGTH, aspect = '16:9', title = 'Say the one thing', face = starterFace(), type }) {
  const own = type && STARTERS[type];
  const safe = title.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const beats = own ? typeBeats(type, length) : starterBeats(length, [title, STARTER_LINE]);
  const template = own ? keepWorlds(readStarterFile(`${own.file}.html`), beats.map((b) => b.id)) : STARTER_TEMPLATE;
  return fill(template, {
    length, aspect, title: safe, font: face.font, family: face.family, ground: PLACEHOLDER.ground, ink: PLACEHOLDER.ink,
    signature: DIALS.map((d) => `${d}=`).join('; '), beats: beatVars(beats), groundCss: readStarterFile('ground.css').trimEnd(),
    worlds: own ? beats.map((b) => `<div class="world" data-world="${b.id}">${GROUND}</div>`).join('\n') : worldsHtml(beats, safe),
    spectacle: own ? +starterSpectacle(type, length).toFixed(2) : '', wordFit: +(0.64 / (0.52 * title.length)).toFixed(3),
  });
}

export const STARTER = starterPage({});

export const UNANSWERED = '[unanswered: default taken]';

const QUESTION = /^\*\*(.+?)\*\*:\s+(.+?)\s+Default:\s+(.+?)\s+Why:\s+(.+)$/;

// A question bank is the template's `## Questions` list: `N. **key**: question Default: value Why: reason`,
// one item per line or wrapped onto indented lines. Returns [] when the template has no bank.
export function parseQuestions(markdown) {
  const section = markdown.split(/^## /m).find((s) => s.startsWith('Questions'));
  if (!section) return [];
  const items = [];
  for (const line of section.split('\n').slice(1)) {
    const start = line.match(/^\d+\.\s+(.*)$/);
    if (start) items.push(start[1]);
    else if (/^\s+\S/.test(line) && items.length) items[items.length - 1] += ' ' + line.trim();
  }
  return items.map((item) => {
    const m = item.match(QUESTION);
    if (!m) throw new UsageError(`question is not "**key**: question Default: value Why: reason": ${item}`);
    return { key: m[1], question: m[2], default: m[3].replace(/\.$/, ''), why: m[4] };
  });
}

// The template's tagged sections in file order (<direction> ... </direction>), the inputs tag excluded.
export function parseSections(markdown) {
  const sections = [];
  for (const m of markdown.matchAll(/^<([a-z]+)>\n([\s\S]*?)^<\/\1>/gm)) {
    if (m[1] !== 'inputs') sections.push({ name: m[1], body: m[2].trim() });
  }
  return sections;
}

// Answers given as flags go in as answered lines, never as a default with the unanswered marker.
function inputLines(questions, answers) {
  const given = { ...answers };
  const format = questions.find((q) => /length|platform/i.test(q.key));
  if (format && (answers.length || answers.aspect)) given[format.key.toLowerCase()] = [answers.aspect, answers.length].filter(Boolean).join(', ');
  const lines = questions.map((q) => (given[q.key.toLowerCase()] ? `- ${q.key}: ${given[q.key.toLowerCase()]}` : `- ${q.key}: ${q.default} ${UNANSWERED}`));
  const known = new Set(questions.map((q) => q.key.toLowerCase()));
  const extra = Object.entries(answers).filter(([k]) => !known.has(k)).map(([k, v]) => `- ${k}: ${v}`);
  return [...extra, ...lines];
}

const recipeLine = (recipe) => `chain to start from: ${RECIPES}, "## ${recipe.heading}" (${recipe.why}); copy it, then change two moves`;

const takenFromText = () => `## Taken from

Phase 2, before any design file. Study the references (\`bin/vawe refs list\`, then \`bin/vawe refs frames <id>\`, then Read each \`~/.vawe/refs/frames/<id>/<shot>.png\` at full size), then name 4 to 6 frames, not all. One row each: the exact path, and what you take (ground or light, type, colour, layout, motion). Fill it before DESIGN.md and page.html; \`bin/vawe\` says "Taken from not filled" until it holds a frame path.

| frame (exact path) | what you take |
|---|---|
| [path/to/frame.png] | [ground or light, type, colour, layout or motion] |

Then study how the references MOVE, since stills do not show it: run \`bin/vawe frame <ref-id> --cuts\` on 2 reference films, Read the strips, and name 3 moves you take (the ref id, the cut second, the move from prompts/moves).

| move taken | ref id | cut s |
|---|---|---|
| [move name] | [ref id] | [s] |`;

const FONT_LOCK = path.join(import.meta.dirname, '../media/fonts.lock.json');

/** The free faces and the palette seed for a film: the same seed each time for a name. */
const designStarter = (name) => ({
  fonts: fontsLine(JSON.parse(fs.readFileSync(FONT_LOCK, 'utf8')).faces),
  seed: seedLine(pickSeed(SEEDS, { from: name })),
});

const systemText = (name, { fonts, seed }) => `## Design system and kit

Phase 3. Write films/${name}/DESIGN.md: the palette as roles, the type, the ground and light devices, the text treatment. Write films/${name}/kit/: the ground layers, and every moving part as its own element (words, marks, bars, cards, icons, the wordmark).
Free faces (copy the file from assets/fonts/ to films/${name}/assets/, then @font-face with src: url("assets/<file>")): ${fonts}.
Palette seed for ${name}: ${seed}. It anchors the primary; keep its hue within 10 degrees, and compose bg, ink and one accent around it in OKLCH roles.
Type is chosen from taste/craft/typography.md and colour from taste/craft/color.md. Start from a PROVEN combo in prompts/skill-combos.md and record \`Combo: <name>\` in DESIGN.md. Skill ladder: apply one skill per rung, in this order, fetched with \`command npx -y ui-skills get <slug>\`. DESIGN.md records each rung as \`Skill <rung>: <slug>: what it decided\`, or \`Skipped <rung>: <reason>\`; \`bin/vawe\` advises on a missing rung.
1. builder: build the product UI and the kit parts as a real, beautiful interface (leonxlnx/soft-skill or emilkowalski/emil-design-eng). Real-looking data; never placeholder bars.
2. type: scale, weight, tracking (jakubkrehel/better-typography or pbakaus/typeset).
3. colour: roles and one accent (pbakaus/colorize or jakubkrehel/better-colors).
4. depth: shadows, light, blur layers (mengto/beautiful-shadows or mengto/progressive-blur).
5. frame: compose the video frame with vawe's own rules: about 1 line and 2 or 3 things, a ground that is never flat, an eye path. The frame rejects web-page patterns (nav, CTA button, pill, eyebrow, section padding); rung 1 still builds the UI parts. The kit format and an example: skills/vawe-page/SKILL.md, films/examples/colour-sting/kit/.
Product UI inside the film (app screens, cards, panels) is a designed interface placed under the density budget. For an invented product the UI is invented but designed; only chrome with no function is a pitfall.`;

const statesText = () => `## States

Phase 4: one static key frame per world, built from the kit, before any motion. Budget: the reference frames show a median of 1 text line, 1 word and 2 objects. A state shows about 1 line and 2 or 3 things; layout: taste/craft/layout.md. Its ground is never flat: one light, grain or depth device per film, named from a Taken from frame, and the ground changes at each world turn.`;

const ideasText = () => `## Ideas

Phase 5, first part: after the states and before the Board. One row per beat (the world id) and per cut (\`s1 to s2\`), plus one for the film (\`film\`) and one for the hero motion moment. Method: guides/IDEATE.md. Write the plain meaning, then 4 ideas from 4 different devices (metaphor, transformation, show the invisible, scale shift, personification, literalise, part for whole, reversal, collision, literal), each as \`device: the idea, typicality\` with typicality 0 to 1 (how likely a model with no guidance writes it first). Take every idea from the subject's own world. Chosen is the idea number. Pick one that is not the most typical, and write "because ..." in why. Build the pick: the frames must show it.

| at | meaning | idea 1 (device: idea, typicality) | idea 2 | idea 3 | idea 4 | chosen (1 to 4) | why |
|---|---|---|---|---|---|---|---|
| [s1] | [what the beat says, one sentence] | [device: idea, 0.0] | [device: idea, 0.0] | [device: idea, 0.0] | [device: idea, 0.0] | [n] | [because ...] |`;

const boardText = () => `## Board

Phase 5, after the states and before any motion. The board is a plan for time: rhythm, spectacle, transitions, sound. It is not a list of frames. Name each move from prompts/moves (\`prompts/moves/README.md\`), never "fade" by default. Replace every bracket.

Rhythm: cut lengths and holds are NOT all equal. At least one cut under 0.4 s, one over 0.9 s, and holds that vary.

| beat | in s | hold s | cut out s (length) |
|---|---|---|---|
| [s1] | [0] | [s] | [s] |

Spectacle: the one big moment at [second] (also \`<meta name="spectacle">\`). Quiet before it: [1 to 2 s of fewer, slower moves, what stays]. Release after: [what drifts, what stops arriving]. Build it from recipe 15 in prompts/moves/RECIPES.md.

| cut | move (prompts/moves) | what carries the eye | what leaves first | overlap s | camera (push, drift, whip, none) | depth | overshoots (EASE.nudge, one EASE.pop) | handoff (family: object) |
|---|---|---|---|---|---|---|---|---|
| [s1 to s2] | [move] | [object] | [object] | [0.2] | [kind] | [layers] | [which arrivals] | [family: the one thing that carries over] |

Pick each cut by the feeling it must give (taste/craft/selection.md). Plan its handoff with the skill \`vawe-transitions\` (skills/vawe-transitions/SKILL.md): the family is one of the twelve in taste/craft/transitions.md, the object is the one thing that carries over, and "deliberate cut: <reason>" is a family. Fill the ledger from the handoff column.

| family | cuts |
|---|---|
| [family] | [s1 to s2] |

Sound is part of every film, subtle: small effects on actions, only on the cuts and actions that earn one, plus one for the spectacle. A real recorded effect first (the film's assets, or the sites in resources/README.md); with none that fits, no cue; a synth voice from \`bin/vawe sound\` only when you choose one. No synth bed, pad or chord. A music track only from a file the user gives. Why and how: taste/craft/sound.md.

Gain: leave the column empty to take the voice's default (\`bin/vawe sound\` lists it). Write a number only to move one cue on purpose: \`data-gain\` is absolute dB and replaces the default.

| at s | voice | gain dB | for |
|---|---|---|---|
| [s] | [voice] | | [a cut or the spectacle] |`;

const motionText = () => `## Motion pass

Phase 7, after the first draft. Done when \`bin/vawe dev\` shows overshoot-share, live-hold, constant-camera and seam-variety clean or waived with a reason, and you have Read \`bin/vawe frame films/<name>/page.html --cuts\` for every cut. For the spectacle second also run \`bin/vawe frame <page> --moment <s> --onion\` and \`--velocity\`. Check each cut against taste/craft/motion-craft.md and the principles in core/motion/README.md; one row per cut, ok, fix or n/a per principle. \`bin/vawe ship\` warns while this table holds a placeholder.

| cut | anticipation (hero) | follow-through, overlap | spacing eased | arcs | secondary action | exits faster | hold alive | camera still | what read flat | what I fixed (or why it stays) |
|---|---|---|---|---|---|---|---|---|---|---|
| [s1 to s2] | [ok] | [ok] | [ok] | [ok] | [ok] | [ok] | [ok] | [ok] | [the strip showed] | [the change, or the reason it stays] |`;

const SKELETON = [['task', 'Task'], ['taken'], ['directions'], ['signature'], ['look', 'Look'], ['system'], ['states'], ['ideas'], ['board'], ['motion'], ['swap', 'Keep and swap'], ['spec', 'Spec'], ['acceptance', 'Acceptance'], ['gates', 'Gates'], ['pitfalls', 'Pitfalls'], ['deliver', 'Deliver']];

const heading = (text) => `${text[0].toUpperCase()}${text.slice(1)}`;

function briefText(name, templateRel, questions, sections, answers, measured, recipe = null, variety = {}) {
  const lines = inputLines(questions, answers);
  const inputs = questions.length || lines.length
    ? lines.join('\n')
    : '- the template has no question bank: write the promise, the moments and the platform';
  const own = Object.fromEntries(sections.map((s) => [s.name, s.body.replaceAll('<name>', name)]));
  const fixed = { taken: takenFromText(), directions: directionsText(name), signature: signatureSection(undefined, variety), system: systemText(name, designStarter(name)), states: statesText(), ideas: ideasText(), board: boardText(), motion: motionText() };
  const skeleton = SKELETON.filter(([key]) => fixed[key] || measured.sections[key]).map(([key, title]) => (
    fixed[key] ?? `## ${title}\n\n${own[key] ? `${own[key]}\n\n` : ''}${measured.sections[key]}`));
  const rest = sections.filter((s) => !SKELETON.some(([key]) => key === s.name))
    .map((s) => `## ${heading(s.name)}\n\n${own[s.name]}`);
  const tail = `## First draft\n\n${recipe ? `${recipeLine(recipe)}.\n\n` : ''}Taste: taste/build/DIGEST.md (the full card is for the judge). Moves to copy: prompts/moves/README.md. Sound: the Board's sound rows, subtle (rule sound-swell).\n\nbin/vawe dev films/${name}/page.html\n`;
  const head = `# ${name}: brief\n\nTemplate: ${templateRel}. Shape: prompts/ANATOMY.md. Replace each ${UNANSWERED} with the answer, or keep the default. Replace each ${GUESS} with a measured value or your own choice.\n\n## Inputs\n\n${inputs}`;
  return [head, ...skeleton, ...rest, tail].join('\n\n');
}

function readAnswers({ length, aspect }) {
  if (length !== undefined && !(length > 0)) throw new UsageError(`--length must be a number of seconds above 0, got ${length}`);
  if (aspect !== undefined && aspectProblem(aspect)) throw new UsageError(`--aspect ${aspectProblem(aspect)}`);
}

const DETAIL_LINE = /^\s*(?:[-*]\s+|\d+\.\s+)?([a-z]+)\s*:\s*(.+?)\s*$/;

function checkKey(key, where) {
  if (!DETAIL_KEYS.includes(key)) throw new UsageError(`${where}: "${key}" is not a detail; valid: ${DETAIL_KEYS.join(' ')}`);
}

/** The details from an --answers file (markdown or `key: value` lines) and repeated --detail key=value. */
export function readDetails({ answers, detail = [] }) {
  const details = {};
  if (answers) {
    for (const line of fs.readFileSync(answers, 'utf8').split('\n')) {
      const m = line.match(DETAIL_LINE);
      if (m && DETAIL_KEYS.includes(m[1])) details[m[1]] = m[2];
    }
  }
  for (const item of [detail].flat()) {
    const [key, ...value] = item.split('=');
    checkKey(key, '--detail');
    if (!value.length || !value.join('=').trim()) throw new UsageError(`--detail needs key=value, got "${item}"`);
    details[key] = value.join('=').trim();
  }
  return details;
}

// A length in seconds and an aspect written in the format answer, else in the request; flags win over both.
function formatFrom(text = '') {
  const s = text.match(/(\d+(?:\.\d+)?)\s*(?:s|sec|secs|seconds?)\b/);
  const a = text.match(/\b(\d+:\d+)\b/);
  return { length: s ? Number(s[1]) : undefined, aspect: a && isAspect(a[1]) ? a[1] : undefined };
}

/** The seconds the template's Length (or Platform) question names as its default, or undefined. */
export function templateLength(questions) {
  return formatFrom(questions.find((q) => /length|platform/i.test(q.key))?.default).length;
}

function askedFormat(details, request) {
  const [format, ask] = [formatFrom(details.format), formatFrom(request)];
  return { length: format.length ?? ask.length, aspect: format.aspect ?? ask.aspect };
}

const answerCommand = (name, request, from, fromUrl) => `bin/vawe new ${name} --request ${JSON.stringify(request ?? '<the ask>')}${from ? ` --from ${from}` : ''}${fromUrl ? ` --from-url ${fromUrl}` : ''}`;

/** The folder of site captures a film started from a website keeps. */
export const siteAssets = (name) => `films/${name}/assets/site`;

const withSite = (name, fromUrl, details) => (fromUrl ? { assets: `the website ${fromUrl}, captured in ${siteAssets(name)}/ (the real UI to show; invent nothing else)`, ...details } : details);

/** The open details as AskUserQuestion calls; writes nothing. */
export function questionsJson(name, { request, from, fromUrl, details = {}, length, aspect }) {
  const format = askedFormat(details, request);
  const answered = answeredDetails({ request, given: withSite(name, fromUrl, details), length: length ?? format.length, aspect: aspect ?? format.aspect });
  return { calls: questionCalls(unansweredDetails(answered), request), answer_with: `${answerCommand(name, request, from, fromUrl)} --answers <file>` };
}

export function askLines(name, request, from, open, fromUrl) {
  const lines = ['agents: with AskUserQuestion, run --questions-json; without it, write the answers file shown below', '', `vawe new: ${open.length} facts needed before a good brief`, '',
    'Nothing is written yet. Answer these, most film-changing first. Skip an optional one to take a guess.', ''];
  open.forEach((d, i) => {
    lines.push(`${i + 1}. ${d.key}${d.required ? '' : ' (optional)'}: ${d.question}`, `   why: ${d.why}`, `   example: ${d.example}`);
  });
  const base = answerCommand(name, request, from, fromUrl);
  lines.push('', 'Write the answers to a file (Write tool), one `key: value` line each, for example:', ...open.slice(0, 3).map((d) => `  ${d.key}: ${d.example}`), 'then run:', `  ${base} --answers <file>`,
    'or give each one on the command line:', `  ${base} --detail ${open[0].key}="..." --detail ${open[1]?.key ?? open[0].key}="..."`,
    'For an unattended run that guesses instead, add --defaults.');
  return lines;
}

function chooseTemplate(root, { from, request, name, title, length }) {
  if (from) return { template: path.resolve(from), route: null, length: path.basename(from) === 'beat-sheet.md' ? beatSheetLength({ request, name, title, length }) : undefined };
  const route = pickTemplate({ request, name, title, length }, readRouting(root));
  const recipe = pickRecipe({ request, name, title, length }, readRecipes(root));
  return { template: path.join(root, route.template), route: recipe ? { ...route, recipe } : route, length: route.length };
}

// The starter's face goes into the film's own assets folder: a film carries its files.
function copyFace(root, dir, face) {
  const src = path.join(root, 'assets', 'fonts', face.font);
  ensureFonts(root, [face.font]);
  if (!fs.existsSync(src)) throw new UsageError(`${path.relative(root, src)} is missing and the fetch failed; run: node generators/media/fonts.mjs`);
  fs.mkdirSync(path.join(dir, 'assets'), { recursive: true });
  fs.copyFileSync(src, path.join(dir, 'assets', face.font));
}

const LATER_DOCS = [
  'for the later stages: cuts, the twelve handoff families: taste/craft/transitions.md; moves to copy, with clips: prompts/moves/README.md',
  'sound effects, recorded first: taste/craft/sound.md; lens (depth of field, bloom, LED grid): prompts/moves/lens.md',
  'skill combos for DESIGN.md: prompts/skill-combos.md; ideas before the board: guides/IDEATE.md',
];

export function newFilmLines(name, { page, route, title, guesses = [], asked, request, from, fromUrl, defaulted = [], variety = { lines: [] } }) {
  if (asked) return askLines(name, request, from, asked, fromUrl);
  const lines = [`wrote ${page}, films/${name}/brief.md and films/${name}/directions.html`];
  if (defaulted.length) lines.push(`--defaults: details guessed, not asked: ${defaulted.join(', ')}`);
  if (guesses.length) lines.push(`guessed, each marked "${GUESS}" in brief.md: ${guesses.join(', ')}`);
  if (route) {
    lines.push(`template: ${route.template} (${route.type}: ${route.why})`);
    if (route.recipe) lines.push(recipeLine(route.recipe));
    lines.push(`another film type: delete films/${name}, then bin/vawe new ${name} --from prompts/<template>.md (rows in ${ROUTING}) or --request "<the ask>" --length <s>`);
  }
  const advice = [
    `directions: films/${name}/directions.html holds one starter still per family (type, object, graphic); fill the three slots in brief.md, then pick one`,
    ...brandAdvice(`${name} ${title ?? ''}`),
  ];
  const spread = variety.lines.length ? ['', ...variety.lines] : [];
  return [...lines, ...spread, '', 'rules for authors: taste/build/DIGEST.md; the judge scores taste/build/CARD.md; every rule is in taste/README.md', '', ...tasteLines('explore'), '',
    ...adviceBlock(advice, '(advice only)'), '', ...LATER_DOCS, '', `next: ${SAY.study(name)}; then ${SAY.moves()}. The stages after it are in AGENTS.md, The loop; bin/vawe names the next one after each step.`];
}

/**
 * Writes the film folder; returns { page, route, template, length, answered } (route is null when --from chose the template).
 * When a required detail is unanswered and `defaults` is off it writes nothing and returns { asked }.
 */
export function newFilm(name, { from, fromUrl, root, length, aspect, title, request, details = {}, defaults = false }) {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) throw new UsageError(`film name "${name}" must be lowercase letters, digits and dashes`);
  const dir = path.join(root, 'films', name);
  if (fs.existsSync(path.join(dir, 'page.html'))) throw new UsageError(`${path.relative(root, dir)}/page.html already exists`);
  const format = askedFormat(details, request);
  length ??= format.length;
  aspect ??= format.aspect;
  readAnswers({ length, aspect, title });
  details = withSite(name, fromUrl, details);
  const answered = answeredDetails({ request, given: details, length, aspect });
  const open = unansweredDetails(answered);
  if (!defaults && open.some((d) => d.required)) return { asked: open, request, from, fromUrl };
  const { template, route, length: routedLength } = chooseTemplate(root, { from, request: fromUrl ? `${request ?? ''} website` : request, name, title, length });
  const markdown = fs.readFileSync(template, 'utf8');
  const questions = parseQuestions(markdown);
  length ??= routedLength;
  const pageLength = length ?? templateLength(questions);
  const type = starterType(route, pageLength);
  const face = starterFace(name);
  copyFace(root, dir, face);
  const given = Object.fromEntries(Object.entries({ length: pageLength, aspect, title }).filter(([, v]) => v !== undefined));
  fs.writeFileSync(path.join(dir, 'page.html'), starterPage({ ...given, face, type }));
  fs.writeFileSync(path.join(dir, 'directions.html'), directionsPage(given));
  const answers = {};
  if (request !== undefined) answers.request = request;
  if (length !== undefined) answers.length = `${length} s`;
  if (aspect !== undefined) answers.aspect = aspect;
  if (title !== undefined) answers.title = title;
  const sections = parseSections(markdown);
  const measured = measuredSections({ name, request, title, length: pageLength, beats: type && typeBeats(type, pageLength), face, reference: sections.some((s) => s.name === 'swap'), details, answered });
  const variety = varietyFor(recentFromDisk(root, name), namesBrandKit([request, title, ...Object.values(details)].join(' ')));
  fs.writeFileSync(path.join(dir, 'brief.md'), briefText(name, path.relative(root, template), questions, sections, answers, measured, route?.recipe, variety));
  return { variety, page: `films/${name}/page.html`, route, title, ranges: dialRanges(), guesses: measured.guesses, defaulted: defaults ? open.map((d) => d.key) : [], template: path.relative(root, template), length: pageLength, answered: [...answered] };
}
