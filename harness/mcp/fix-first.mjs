// The top problems of a draft, read from the files the draft wrote (out/<film>.checks.json "fix-first" items and video items,
// out/<film>.acceptance.json rows), ranked by what a viewer sees first. Each item carries the value the draft measured and the fix
// the check already gives. The ranking is a fact table, not taste: nothing here refuses.
import fs from 'node:fs';
import path from 'node:path';
import { writeFileAtomic } from '../lib/atomic-write.mjs';

export const FIX_FIRST_MAX = 3;

const ROW_KINDS = {
  'text contrast': 'contrast',
  'text cap height': 'cap-height',
  'still windows over 0.5 s outside a declared hold': 'static-window',
  'read hold per line': 'read-hold',
};

// The read-hold row lists only the lines and their times, so its fix is named here.
const ROW_FIXES = {
  'read-hold': 'keep each line it names on screen, settled, for the seconds it needs (0.6 s a word from 4 words): move its exit or the next entrance later, or cut the line to fewer words',
};

// These rows list one line per miss, each already naming the CSS to change: that list is the fix, not the closing generic line.
const NAMED_FIX_ROWS = new Set(['word cap height and position vs spec']);

// Unreadable text first, then picture that does not move, then plan mismatches, then every other measured problem.
const RANK = ['contrast', 'cap-height', 'read-hold', 'static-window', 'world-held', 'spectacle', 'plan'];
const rankOf = (kind) => { const i = RANK.indexOf(kind); return i < 0 ? RANK.length : i; };

function fromRow(row) {
  const detail = row.detail ?? [];
  const kind = ROW_KINDS[row.metric] ?? `row:${row.metric}`;
  const fix = ROW_FIXES[kind] ? `${detail.join('; ')}; ${ROW_FIXES[kind]}` : (NAMED_FIX_ROWS.has(row.metric) && detail.length > 1 ? detail.slice(0, -1).join('; ') : detail.at(-1)) ?? 'see out/<film>.dev.md Acceptance';
  return { kind, measured: `${row.metric}: ${row.measured} (target ${row.target})`, fix, fromRow: true };
}

const readJson = (file) => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; } };

/** Every problem the draft left: the items of checks.json, then the red acceptance rows of the last draft. */
function sources(outDir, film) {
  const checks = readJson(path.join(outDir, `${film}.checks.json`));
  const history = readJson(path.join(outDir, `${film}.acceptance.json`))?.history ?? [];
  const rows = (history.findLast((e) => e.stage === 'draft')?.rows ?? []).filter((r) => r.status === 'advice');
  const items = [checks?.video?.value?.items, checks?.['fix-first']?.value].flatMap((list) => (Array.isArray(list) ? list : []));
  return { items, rows };
}

/**
 * The top `max` problems of a draft as [{ kind, measured, fix, more }], most visible first. One item per kind: `more` counts the other lines of the
 * same kind. A checks.json item wins over the acceptance row of its kind, as it names the second and the fix. [] when the draft left none.
 */
export function fixFirst(outDir, film, max = FIX_FIRST_MAX) {
  const { items: found, rows } = sources(outDir, film);
  const items = [...found, ...rows.map(fromRow)];
  const byKind = new Map();
  for (const item of items) {
    const held = byKind.get(item.kind);
    if (!held) byKind.set(item.kind, { ...item, more: 0 });
    else if (held.fromRow && !item.fromRow) byKind.set(item.kind, { ...item, more: held.more });
    else held.more += 1;
  }
  return [...byKind.values()]
    .map((item, i) => ({ item, i }))
    .sort((a, b) => rankOf(a.item.kind) - rankOf(b.item.kind) || a.i - b.i)
    .slice(0, max)
    .map(({ item: { kind, measured, fix, more } }) => ({ kind, measured, fix, ...(more ? { more } : {}) }));
}

const roundsFile = (outDir, film) => path.join(outDir, `${film}.fix-rounds.json`);

/** How many drafts of this film finished before now (the file counts, not a module variable). */
export const draftsDone = (outDir, film) => readJson(roundsFile(outDir, film))?.drafts ?? 0;

/** Counts one finished draft; returns the new count. */
export function countDraft(outDir, film) {
  const drafts = draftsDone(outDir, film) + 1;
  fs.mkdirSync(outDir, { recursive: true });
  writeFileAtomic(roundsFile(outDir, film), JSON.stringify({ drafts }));
  return drafts;
}

export const FIX_NEXT = 'fix these with vawe_edit_page or vawe_edit_doc (or waive one in the page with a measured _why), then vawe_render_draft again with from and to set to the seconds you changed; after that one round, do the motion pass and show the person the draft';

/** The fix_first list for a draft that just finished: the top problems for the first draft of the film, [] for every later one (the fix round is spent). Counts the draft. */
export function fixRound(outDir, film) {
  const first = draftsDone(outDir, film) === 0;
  countDraft(outDir, film);
  return first ? fixFirst(outDir, film) : [];
}
