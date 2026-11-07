// What `vawe dev` says before it renders (the plan status) and after it (the top advice): short, ranked, capped. Pure: the page's
// state in, lines out; dev-warn.mjs and dev-end.mjs read the files. Each stage names the one skill file that covers it.
import { motionFilled } from '../lib/board.mjs';
import { emptyPlanParts, isEditFilm, adviceFor } from '../lib/plan-parts.mjs';
import { NOTE_LINES } from '../lib/draft-check.mjs';
import { takenFromCount, missingRungs } from './stage-say.mjs';

export const STATUS_MAX_LINES = 8;
export const ITEMS_SHOWN = 2;
export const LINE_MAX = 200;
export const ADVICE_SHOWN = 3;
export const PAGE_SHOWN = 2;

export const SKILLS = {
  brief: 'skills/vawe-brief/SKILL.md',
  board: 'skills/vawe-transitions/SKILL.md',
  ideas: 'skills/vawe-transitions/SKILL.md',
  study: 'skills/vawe-reference/SKILL.md',
  design: 'skills/vawe-page/SKILL.md',
  motion: 'skills/vawe-page/SKILL.md',
  cut: 'prompts/edit-from-clips.md',
};

const BAN_IDS = { tells: 'no-tells', slideshow: 'thread' };
const ADVICE_RANK = [/^slideshow: score/, /^attractor:/, /^slideshow:/, /^world held/, /^transitions:/];
const SCORE = /^slideshow: score (\d+\/\d+)$/;
const PAGE_PREFIX = '  page: ';

/** `line` cut to LINE_MAX characters. */
export const short = (line, max = LINE_MAX) => (line.length > max ? `${line.slice(0, max - 3)}...` : line);

/** The text of the DIGEST line that ends in `(<id>)`, or null. */
export function digestLine(digest, id) {
  const line = String(digest ?? '').split('\n').find((l) => l.endsWith(` (${id})`));
  return line ? line.replace(/^- /, '').replace(` (${id})`, '') : null;
}

const ATTRACTORS_MAX = 150;

/** The "Attractors" paragraph of the digest: the list the hero is never taken from. */
const attractorList = (digest) => /^## Attractors\n\n(.+)$/m.exec(String(digest ?? ''))?.[1] ?? null;

/** The ban lines that apply to every page (no tells, attractors, slideshow tells), from the taste digest. */
export function banLines(digest) {
  const tells = digestLine(digest, BAN_IDS.tells);
  const slideshow = /slideshow tells: [\w/.-]+/.exec(digestLine(digest, BAN_IDS.slideshow) ?? '')?.[0];
  const attractors = attractorList(digest) ? `${short(attractorList(digest), ATTRACTORS_MAX)} ${slideshow ?? ''}`.trim() : slideshow;
  return [tells, attractors].filter(Boolean).map((l) => `ban: ${short(l)}`);
}

/** The brief sections still empty, in the order they are written: [{ title, skill }]. The Motion pass comes after the first draft, so `early` leaves it out. */
function emptySections(brief, early) {
  return [...emptyPlanParts(brief), ...(!early && motionFilled(brief) === false ? [{ title: 'Motion pass', skill: 'motion' }] : [])];
}

/** What is empty or stale for a page, most costly first: [{ what, fix }]. `early` is true until a draft exists. */
export function openItems({ rel, brief, design, early, frames, storyboardRan, looked = null }) {
  if (brief === null) return [{ what: 'brief.md is missing', fix: SKILLS.brief }];
  const items = [];
  const empty = emptySections(brief, early);
  if (empty.length) items.push({ what: `brief.md sections empty: ${empty.map((e) => e.title).join(', ')}`, fix: SKILLS[empty[0].skill] });
  const designed = !isEditFilm(brief);
  if (early && designed && !storyboardRan) items.push({ what: 'no storyboard run', fix: `bin/vawe frame ${rel} --board` });
  const taken = designed ? takenFromCount(brief) : null;
  if (early && taken !== null && taken < 4) items.push({ what: `the reference study names ${taken} of 4 frames`, fix: SKILLS.study });
  const rungs = early && taken !== null ? missingRungs(design ?? '') : [];
  if (rungs.length) items.push({ what: `DESIGN.md has no line for ${rungs.join(', ')}`, fix: SKILLS.design });
  if (early && designed && frames !== 'ok') items.push({ what: frames === 'stale' ? 'the frames are older than the page' : 'no frames run', fix: `bin/vawe frame ${rel} --world all` });
  if (looked?.printed.length && !looked.hook) items.push({ what: 'the log-read hook is not registered, so the strips you Read are not counted', fix: 'harness/README.md "Hooks"' });
  else if (looked?.unread.length) items.push({ what: `read ${looked.printed.length - looked.unread.length} of ${looked.printed.length} strips of the last draft`, fix: `Read ${looked.unread[0]}` });
  return items;
}

const itemLine = ({ what, fix }) => `  - ${what}: ${fix}`;

/** The finding lines, attractors first, at most one shown with the count of the rest. */
function findingLine(findings, rel) {
  if (!findings.length) return [];
  const ranked = [...findings].sort((a, b) => Number(b.startsWith('attractor:')) - Number(a.startsWith('attractor:')));
  const more = ranked.length > 1 ? ` (+${ranked.length - 1} more: bin/vawe frame ${rel} --board)` : '';
  return [`  plan: ${short(ranked[0])}${more}`];
}

const rankOf = (line) => { const at = ADVICE_RANK.findIndex((re) => re.test(line)); return at < 0 ? ADVICE_RANK.length : at; };

/** Advice lines most costly first (ADVICE_RANK), the rest in their own order. */
const ranked = (lines) => lines.map((line, i) => ({ line, i })).sort((a, b) => rankOf(a.line) - rankOf(b.line) || a.i - b.i).map((x) => x.line);

/** The doc a page advice line comes from: the slideshow tells, the rule file of a lint line, world-turns for a held world; null when none fits. */
export function adviceDoc(line) {
  if (line.startsWith('slideshow:')) return 'taste/craft/transitions.md';
  if (line.startsWith('world held')) return 'taste/rules/world-turns.md';
  const rule = /^rule ([\w-]+) /.exec(line)?.[1];
  return rule ? `taste/rules/${rule}.md` : null;
}

/** A page line cut to LINE_MAX, then its doc added at the end, so the fix and the doc both survive; the doc replaces the "slideshow:" prefix and any mention of itself. */
const withDoc = (line) => {
  const doc = adviceDoc(line);
  const body = short(doc ? line.replace(/^slideshow: /, '').split(` (${doc}`).map((part, i) => (i ? part.replace(/^[^)]*\)/, '') : part)).join('') : line, LINE_MAX - PAGE_PREFIX.length);
  return doc ? `${body} (${doc})` : body;
};

/** The bans the page itself shows, before any render: PAGE_SHOWN lines ranked like the draft advice, each with its doc, then the count of the rest. */
function pageLines(page, rel) {
  const lines = ranked(page);
  const shown = lines.slice(0, PAGE_SHOWN).map((l) => `${PAGE_PREFIX}${withDoc(l)}`);
  const rest = lines.length - shown.length;
  return [...shown, ...(rest > 0 ? [`${PAGE_PREFIX}+${rest} more before the render: bin/vawe frame ${rel} --board`] : [])];
}

/**
 * The block printed before a draft renders, at most STATUS_MAX_LINES lines, ending in one `next:` line; [] when nothing is open and
 * no finding exists. `findings` are plan finding lines (planLines) and attractor lines; `page` the draft advice the opened page shows
 * (plan-read.mjs), ranked first; `digest` is taste/build/DIGEST.md; `next` is nextStep's command.
 */
export function planStatusLines({ name, rel, brief, design, early, frames, storyboardRan, looked = null, findings = [], page: pageAdvice = [], digest = '', next }) {
  const items = openItems({ rel, brief, design, early, frames, storyboardRan, looked });
  const page = adviceFor(brief, pageAdvice);
  const score = page.map((l) => SCORE.exec(l)?.[1]).find(Boolean);
  const tells = page.filter((l) => !SCORE.test(l));
  if (!items.length && !findings.length && !tells.length) return [];
  const shown = items.slice(0, ITEMS_SHOWN).map(itemLine);
  const rest = items.slice(ITEMS_SHOWN);
  const more = rest.length ? [`  - +${rest.length} more: ${rest.map((i) => i.what).join('; ')}`] : [];
  const head = `plan of ${name}: ${items.length + findings.length + tells.length} open${score ? `, slideshow ${score}` : ''}, the draft renders anyway`;
  const body = [head, ...pageLines(tells, rel), ...shown, ...more.map((l) => short(l)), ...findingLine(findings, rel), ...banLines(digest)];
  return [...body.slice(0, STATUS_MAX_LINES - 1), `next: ${next}`];
}

/** The advice lines of out/<film>.dev.md ("advice: ..." under Draft check), without the prefix. */
export function adviceOfDevNotes(text) {
  const section = String(text).split(/^## /m).find((s) => s.startsWith('Draft check')) ?? '';
  return section.split('\n').filter((l) => l.startsWith('advice: ')).map((l) => l.slice('advice: '.length)).filter((l) => !NOTE_LINES.test(l));
}

/** The top ADVICE_SHOWN advice lines of a draft, slideshow score and attractors first, then the count of the rest and where they are. */
export function topAdviceLines(advice, film) {
  const lines = ranked(advice);
  const shown = lines.slice(0, ADVICE_SHOWN).map((l) => `  advice: ${short(l)}`);
  const rest = lines.length - shown.length;
  return lines.length ? [`top advice of ${film}:`, ...shown, ...(rest > 0 ? [`  +${rest} more in out/${film}.dev.md`] : [])] : [];
}
