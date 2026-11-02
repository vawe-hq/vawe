// The SPEC and ACCEPTANCE tables of a brief.md, as plain arrays. A missing table gives an empty array, so
// an old brief with no tables parses to nothing. A column is found by its header name ("start s", "the viewer notices"); a table whose
// header names none of the known columns is read by position, in the order COLUMNS lists them.
import fs from 'node:fs';
import path from 'node:path';

export const COLUMNS = {
  Shots: ['id', 'start', 'end', 'notices', 'moveIn', 'moveOut', 'camera', 'ground'],
  Words: ['text', 'shot', 'appear', 'settle', 'cap', 'x', 'y', 'weight', 'colour'],
  Objects: ['id', 'selector', 'shot', 'in', 'settle', 'out'],
  Acceptance: ['metric', 'target'],
};
const NUMERIC = new Set(['start', 'end', 'appear', 'settle', 'cap', 'x', 'y', 'in', 'out']);

export const cellsOf = (line) => line.trim().replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, '|'));
const isSeparator = (cells) => cells.every((c) => /^:?-{2,}:?$/.test(c));
const clean = (c) => c.replace(/^`+|`+$/g, '').trim();

/** "1.2 s", "14%" and "1.2 s*" (a cell spec-sync changed) give a number; "", "-" and prose give null. */
export function numberOf(cell) {
  const m = /^\s*(-?\d+(?:\.\d+)?|-?\.\d+)\s*(?:s|%)?\s*\*?\s*$/.exec(cell);
  return m ? Number(m[1]) : null;
}

const HEADER_NAME = { 'the viewer notices': 'notices', 'move in': 'moveIn', 'move out': 'moveOut' };
const headerKey = (cell) => {
  const name = cell.toLowerCase().replace(/\s+(s|%)$/, '').trim();
  return HEADER_NAME[name] ?? name;
};

/** { header, rows }: the header cells of the table under a heading and its data rows. */
function rowsAfter(lines, from) {
  const rows = [];
  for (let i = from + 1; i < lines.length && !/^#{1,6}\s/.test(lines[i]); i++) {
    if (!lines[i].trim().startsWith('|')) continue;
    rows.push({ line: i, cells: cellsOf(lines[i]) });
  }
  return { header: rows[0]?.cells ?? [], rows: rows.slice(1).filter((r) => !isSeparator(r.cells)) };
}

/** The column index of each key of table `name` in `header`: by header name, or by position when the header names none of the keys. Pure. */
export function columnIndex(name, header) {
  const keys = COLUMNS[name];
  const named = header.map(headerKey);
  return keys.some((k) => named.includes(k)) ? Object.fromEntries(keys.map((k) => [k, named.indexOf(k)])) : Object.fromEntries(keys.map((k, i) => [k, i]));
}

/** The data rows of one table as { line (index in `lines`), cells, row (the parsed object), index (key to column, -1 when the table has none) }; [] when the table is missing. */
export function tableRows(lines, name) {
  const head = lines.findIndex((l) => new RegExp(`^#{2,4}\\s+${name}\\s*$`, 'i').test(l.trim()));
  if (head < 0) return [];
  const { header, rows } = rowsAfter(lines, head);
  const index = columnIndex(name, header);
  return rows.filter((r) => r.cells.some(Boolean)).map(({ line, cells }) => ({ line, cells, index, row: Object.fromEntries(Object.entries(index).map(([k, i]) => {
    const cell = i < 0 ? '' : clean(cells[i] ?? '');
    return [k, NUMERIC.has(k) ? numberOf(cell) : cell];
  })) }));
}

const table = (lines, name) => tableRows(lines, name).map((r) => r.row);

/** { shots, words, objects, acceptance } from the text of a brief.md; null text gives four empty arrays. */
export function parseBriefTables(text) {
  const lines = String(text ?? '').split('\n');
  return { shots: table(lines, 'Shots'), words: table(lines, 'Words'), objects: table(lines, 'Objects'), acceptance: table(lines, 'Acceptance') };
}

const GUESS = '(guess: change me)';
const settled = (rows, key) => rows.filter((r) => !String(r[key]).includes(GUESS));

/** The tables without the rows `vawe new` wrote as template guesses (the guess mark in the first cell), and how many it dropped per table. Pure. */
export function dropGuesses({ shots, words, objects, acceptance }) {
  const set = { shots: settled(shots, 'id'), words: settled(words, 'text'), objects: settled(objects, 'id'), acceptance };
  return { set, guessed: { shots: shots.length - set.shots.length, words: words.length - set.words.length, objects: objects.length - set.objects.length } };
}

/** The text of the brief.md next to a page, or null when there is none. */
export function readBrief(pagePath) {
  try { return fs.readFileSync(path.join(path.dirname(path.resolve(pagePath)), 'brief.md'), 'utf8'); } catch { return null; }
}
