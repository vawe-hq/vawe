// What the planning docs say about a page, before any render: each finding names its rule, the doc line it comes from, the
// measured value and a fix. It reuses the checks that already own each rule (read-hold, tail-motion, ideas, board) and holds no
// threshold of its own; the motion lint and the slideshow tells come from the draft check's page advice (render-page.mjs probeAdvice).
// Advice only. Pure: the page's probes in, findings out; planLines reads the rule files.
import fs from 'node:fs';
import path from 'node:path';
import { readHoldProblems, probeTracks } from './read-hold.mjs';
import { tailMoving } from './tail-motion.mjs';
import { ideaFindings, IDEATE_ASK } from './ideas.mjs';
import { briefLengthLine } from './board.mjs';
import { isWaived } from './waivers.mjs';
import { isEditFilm } from './plan-parts.mjs';

const IDEATE_DOC = 'guides/IDEATE.md';
const s1 = (n) => n.toFixed(1);

function holdFindings(probe, words) {
  if (!probe?.samples?.length) return [];
  return readHoldProblems(probeTracks(probe.samples, probe, words)).map((g) => ({
    code: 'read-hold', rule: 'readable-hold', at: g.tSettled,
    value: `"${g.text.slice(0, 40)}" holds ${s1(g.hold)} s, its text needs ${s1(g.need)} s`,
    fix: 'add hold time to that line (its out literal in the page); keep the move quick',
  }));
}

function tailFindings(probe) {
  if (!probe?.whole || probe.canvasFilm || !probe.tail) return [];
  if (tailMoving(probe.tail)) return [];
  return [{ code: 'tail-static', rule: 'moving-tail', at: null, value: 'no part of the held lockup moves in the last second',
    fix: 'give one part of the last lockup its own last key (a caret, a value that ticks, a highlight that moves on)' }];
}

function briefFindings(brief, duration, worlds) {
  if (!brief) return [];
  const stale = briefLengthLine(brief, duration);
  const found = isEditFilm(brief) ? [] : ideaFindings(brief, worlds).map((f) => ({ ...f, text: f.text.replace(` (${IDEATE_DOC})`, '') }));
  const gaps = found.filter((f) => f.code === 'ideas-missing' && f.at);
  const others = found.filter((f) => !gaps.includes(f));
  const ideas = [
    ...(gaps.length ? [{ code: 'ideas-missing', at: gaps[0].at, value: `no row in the "Ideas" ledger for world ${gaps.map((g) => g.at).join(', ')}`, fix: IDEATE_ASK }] : []),
    ...others.map((f) => ({ code: f.code, at: f.at, value: f.text, fix: f.code === 'ideas-missing' ? IDEATE_ASK : 'rewrite the row with four different devices, then pick a less typical idea and say why' })),
  ].map((f) => ({ rule: null, doc: IDEATE_DOC, ...f }));
  return [
    ...(stale ? [{ code: 'brief-stale', rule: null, doc: 'brief.md "Length"', at: null, value: stale, fix: 'bring Length, Board and Spec in brief.md to the page' }] : []),
    ...ideas,
  ];
}

/**
 * The plan findings of a page: [{ code, rule (taste rule id or null), doc (path or null: planLines fills it from the rule), at (s or row id or null), value, fix }].
 * `probe` is the text and tail probe (null before the page is opened), `words` the brief's Words rows,
 * `worlds` the data-world ids, `authoring` the page's waivers. The brief's findings come first, then the page's in time order. Pure.
 */
export function planFindings({ brief, duration, probe, words = [], worlds = null, authoring = {} }) {
  const page = [...holdFindings(probe, words), ...tailFindings(probe)].filter((f) => !isWaived(authoring, f.code, typeof f.at === 'number' ? f.at.toFixed(2) : null));
  const timed = page.sort((a, b) => (a.at ?? Infinity) - (b.at ?? Infinity));
  return [...briefFindings(brief, duration, worlds).filter((f) => !isWaived(authoring, f.code, f.at)), ...timed];
}

/** `taste/rules/<id>.md:<line of its key: field>` for a rule id; the file alone when it has no such line or cannot be read. */
export function ruleDoc(id, root, key = 'limit') {
  const rel = `taste/rules/${id}.md`;
  try {
    const at = fs.readFileSync(path.join(root, rel), 'utf8').split('\n').findIndex((l) => l.startsWith(`${key}:`));
    return at < 0 ? rel : `${rel}:${at + 1}`;
  } catch { return rel; }
}

/** One printed line per finding: the second, the value, the doc line and the fix. */
export function planLines(findings, root) {
  return findings.map((f) => {
    const at = typeof f.at === 'number' ? `@${f.at.toFixed(2)}s ` : '';
    const doc = f.doc ?? (f.rule ? ruleDoc(f.rule, root) : null);
    return `${at}${f.value} (${f.rule ? `rule ${f.rule}, ` : ''}${doc}); fix: ${f.fix}`;
  });
}
