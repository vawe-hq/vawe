// The "Board" section of a brief.md (written by harness/cli/new.mjs boardText) as data, and the advice a filled board earns.
// Pure: brief text in, lines out. Advice only: a board is a plan, so no check here refuses.
import { cellsOf, numberOf } from './brief-tables.mjs';
import { metaOf } from './page-meta.mjs';

export const CUT_SHORT_S = 0.4;
export const CUT_LONG_S = 0.9;
export const SPECTACLE_TOLERANCE_S = 0.25;
export const LENGTH_TOLERANCE_S = 0.5;

/** The text of the `## <title>` section of a brief, or undefined when it has none. */
export const sectionOf = (brief, title) => brief.split(/^## /m).find((s) => s.startsWith(title));

/** The table rows of a section text that hold an answer: no separator row and no bracketed placeholder in the first cell. */
export const filledRows = (section) => section.split('\n').filter((l) => l.startsWith('|') && !/^\|[-| ]+\|$/.test(l) && !l.split('|')[1].trim().startsWith('['));

/** False while the Board section still holds a bracketed placeholder row; null when the brief has no Board section. */
export function boardFilled(brief) {
  const section = sectionOf(brief, 'Board');
  if (section === undefined) return null;
  return !section.split('\n').some((l) => l.startsWith('| ['));
}

// The answer rows of the table whose header row starts with `head` (a first-cell label), as arrays of cells.
export function rowsOf(section, head) {
  const lines = section.split('\n');
  const at = lines.findIndex((l) => l.startsWith('|') && cellsOf(l)[0] === head);
  if (at < 0) return [];
  const rows = [];
  for (let i = at + 1; i < lines.length && lines[i].startsWith('|'); i++) rows.push(lines[i]);
  return filledRows(rows.join('\n')).map(cellsOf);
}

const NUMBERS = /\d+(?:\.\d+)?/g;

/** The cut rows of the Board's move table as { label, at, end, move, camera, overshoots, handoff (the "handoff (family: object)" cell, null when the table has no such column) }: `at` is the first second in the cut cell ("warm to hot, 1.00 to 2.00" gives 1 and 2), null for none. */
export function moveRows(brief) {
  const section = brief ? sectionOf(brief, 'Board') : undefined;
  if (section === undefined) return [];
  const header = section.split('\n').find((l) => l.startsWith('|') && cellsOf(l)[0] === 'cut');
  const handoffAt = header ? cellsOf(header).findIndex((h) => h.startsWith('handoff')) : -1;
  return rowsOf(section, 'cut').map((c) => {
    const nums = ((c[0] ?? '').split(',').slice(1).join(',').match(NUMBERS) ?? []).map(Number);
    return { label: c[0] ?? '', at: nums[0] ?? null, end: nums[1] ?? null, move: c[1] ?? '', overlap: numberOf(c[4] ?? ''), camera: c[5] ?? '', overshoots: c[7] ?? '', handoff: handoffAt < 0 ? null : (c[handoffAt] ?? '') };
  });
}

const SECOND = '(\\d+(?:\\.\\d+)?)\\s*(?:s\\b)?';
const AT = new RegExp(`\\bat\\s+${SECOND}(?:\\s*(?:to|-|\u2013)\\s*${SECOND})?`);
const FIRST = new RegExp(`${SECOND}(?:\\s*(?:to|-|\u2013)\\s*${SECOND})?`);

/** The second of the Board's "Spectacle:" line: "7.2", "7.2 s", "at 7.2 s", or a range ("6.55 to 7.85 s") as its middle. A bracketed template hint is not a second. Null for none. */
function spectacleSecond(section) {
  const line = /Spectacle:(.*)$/m.exec(section)?.[1].replace(/\[[^\]]*\]/g, '');
  const m = line && (AT.exec(line) ?? FIRST.exec(line));
  return m ? Math.round(((Number(m[1]) + Number(m[2] ?? m[1])) / 2) * 100) / 100 : null;
}

/** { starts (seconds), cuts (seconds), moves (cells), sound (cells), spectacle (seconds or null) } of the Board section, or null when the brief has none. */
export function parseBoard(brief) {
  const section = brief ? sectionOf(brief, 'Board') : undefined;
  if (section === undefined) return null;
  return {
    starts: rowsOf(section, 'beat').map((c) => numberOf(c[1] ?? '')).filter((v) => v !== null),
    cuts: rowsOf(section, 'beat').map((c) => numberOf(c[3] ?? '')).filter((v) => v !== null),
    moves: rowsOf(section, 'cut').map((c) => c[1] ?? ''),
    sound: rowsOf(section, 'at s'),
    spectacle: spectacleSecond(section),
  };
}

/** True when the brief declares a silent film: every Board sound row has the voice "none", or a line says "sound none". */
export function declaredSilent(brief) {
  const rows = parseBoard(brief)?.sound ?? [];
  return /^[^|\n]*\bsound:?\s+none\b/im.test(brief ?? '') || (rows.length > 0 && rows.every((c) => /^none\b/i.test(c[1] ?? '')));
}

/** True when the brief's request or Facts say the film has no text ("no text"): the text dial and the type axis cannot apply. */
export function declaredNoText(brief) {
  return /^[-*] [^\n]*\bno text\b/im.test(brief ?? '');
}

/** The second in `<meta name="spectacle">` of page html, or null when the page has none or it is not a number. */
export function spectacleOf(html) {
  const s = metaOf(html, 'spectacle');
  return s !== null && s.trim() !== '' && Number.isFinite(Number(s)) ? Number(s) : null;
}

/**
 * The spectacle second the checks read: the Board's, when a filled Board names one, else the page's meta. The meta is the page's copy of the
 * plan, so moving it to the strongest moment cannot change a verdict.
 */
export function lockedSpectacle(brief, pageSpectacle) {
  const planned = boardFilled(brief ?? '') === true ? parseBoard(brief).spectacle : null;
  return planned ?? pageSpectacle;
}

const s1 =(x) => `${Math.round(x * 100) / 100}`;

/** Rhythm advice for cut lengths in seconds: all equal, none under CUT_SHORT_S, none over CUT_LONG_S. [] for fewer than 2 cuts. Pure. */
export function cutAdvice(cuts) {
  if (cuts.length < 2) return [];
  const lines = [];
  if (cuts.every((c) => c === cuts[0])) lines.push(`all ${cuts.length} cuts last ${s1(cuts[0])} s; vary them`);
  if (cuts.every((c) => c >= CUT_SHORT_S)) lines.push(`no cut under ${CUT_SHORT_S} s; add one quick cut`);
  if (cuts.every((c) => c <= CUT_LONG_S)) lines.push(`no cut over ${CUT_LONG_S} s; add one slow cut`);
  return lines;
}

/** Advice lines for a filled board: rhythm, spectacle, sound, moves. `pageSpectacle` is the page's `<meta name="spectacle">` in seconds, or null. [] for a brief with no filled board. */
export function boardChecks(brief, pageSpectacle = null) {
  if (boardFilled(brief ?? '') !== true) return [];
  const { cuts, moves, sound, spectacle } = parseBoard(brief);
  const lines = cutAdvice(cuts).map((l) => `board: ${l}`);
  if (spectacle === null) lines.push('board: the Spectacle line names no second ("at 7.2"); name the one big moment');
  else if (pageSpectacle !== null && Math.abs(spectacle - pageSpectacle) > SPECTACLE_TOLERANCE_S) {
    lines.push(`board: the Spectacle is at ${s1(spectacle)} s but <meta name="spectacle"> says ${s1(pageSpectacle)} s; the spectacle checks read ${s1(spectacle)} s, the Board's. Put the big move at ${s1(spectacle)} s, or change the Board's Spectacle line with the reason`);
  }
  if (!sound.length) lines.push('board: no sound rows; add a real effect for each action or cut that earns one, or one row with "none" for a silent film');
  moves.forEach((m, i) => { if (!m || /\bfade\b/i.test(m)) lines.push(`board: cut ${i + 1} names ${m ? `"${m}"` : 'no move'}; name a move from prompts/moves`); });
  return lines;
}

/** False while the Motion pass section keeps its bracketed placeholder row or the instruction `vawe new` wrote before the table; null when the brief has no such section. */
export function motionFilled(brief) {
  const section = sectionOf(brief, 'Motion pass');
  if (section === undefined) return null;
  const oldTemplateOnly = !section.includes('| cut |') && section.includes('The motion is done when `bin/vawe dev` shows');
  return !section.split('\n').some((l) => l.startsWith('| [')) && !oldTemplateOnly;
}

/** The names in the first column of the "move taken" table of Taken from, placeholders left out; [] when the brief has none. */
export function movesTaken(brief) {
  const section = sectionOf(brief, 'Taken from');
  const at = section?.indexOf('| move taken');
  if (at === undefined || at < 0) return [];
  return filledRows(section.slice(at)).slice(1).map((l) => cellsOf(l)[0]).filter(Boolean);
}

const plain = (s) => s.toLowerCase().replace(/[-_]+/g, ' ');

/** The moves named in Taken from that appear nowhere in the Board section. [] for a brief with no filled Board. Pure. */
export function movesUnused(brief) {
  if (boardFilled(brief ?? '') !== true) return [];
  const board = plain(sectionOf(brief, 'Board'));
  return movesTaken(brief).filter((m) => !board.includes(plain(m)));
}

const START_TOLERANCE_S = 0.25;

/** The line when the brief's "- length: N s" differs from the page's duration by more than LENGTH_TOLERANCE_S; null for no length or a match. Pure. */
export function briefLengthLine(brief, duration) {
  const said = Number(/^- length:\s*(\d+(?:\.\d+)?)/im.exec(brief ?? '')?.[1]);
  if (!said || !(duration > 0) || Math.abs(said - duration) <= LENGTH_TOLERANCE_S) return null;
  return `the brief says ${said} s and the page is ${duration} s`;
}

/** Lines where the Board's beat starts differ from the page's world starts, both in seconds (harness/lib/timeline.mjs worldRows). [] for a brief with no filled Board. Pure. */
export function boardVsPage(brief, pageStarts) {
  if (boardFilled(brief ?? '') !== true) return [];
  const { starts } = parseBoard(brief);
  const lines = [];
  if (starts.length !== pageStarts.length) lines.push(`the Board lists ${starts.length} beats and the page has ${pageStarts.length} worlds`);
  const off = starts.map((b, i) => ({ i, b, p: pageStarts[i] })).filter(({ b, p }) => p !== undefined && Math.abs(b - p) > START_TOLERANCE_S);
  for (const { i, b, p } of off.slice(0, 3)) lines.push(`beat ${i + 1} starts at ${s1(b)} s in the Board and at ${s1(p)} s in the page`);
  if (off.length > 3) lines.push(`${off.length - 3} more beats differ`);
  return lines;
}

/** What ship warns about before it renders: an unfilled Board or Motion pass, a Board that differs from the page, a move from Taken from that the Board never uses. `pageStarts` (the world start seconds) may be null (not measured). Pure. */
export function shipWarnings(brief, pageStarts = null) {
  if (!brief) return [];
  const lines = [];
  if (boardFilled(brief) === false) lines.push('the Board is not filled: write the rhythm, the spectacle, a move per cut and the sound rows in brief.md "Board"');
  if (motionFilled(brief) === false) lines.push('the Motion pass is not filled: Read `bin/vawe frame <page> --cuts` for every cut, then write one row per cut in brief.md "Motion pass" (what read flat, what you fixed)');
  if (pageStarts) lines.push(...boardVsPage(brief, pageStarts).map((l) => `Board and page differ: ${l}`));
  const unused = movesUnused(brief);
  if (unused.length) {
    const seen = parseBoard(brief).moves.filter(Boolean).map((m) => `"${m}"`).join(', ') || 'none';
    lines.push(`Taken from names ${unused.map((m) => `"${m}"`).join(', ')} but no Board move cell contains that move name (matched as written, "-" and "_" read as spaces); Board moves seen: ${seen}. Write the name in a cut's move cell, or remove the row`);
  }
  return lines;
}
