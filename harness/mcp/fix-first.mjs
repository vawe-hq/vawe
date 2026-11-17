// The top problems of a draft, read from the files the draft wrote (out/<film>.dev.md advice lines, out/<film>.acceptance.json rows,
// out/<film>.checks.json video problems), ranked by what a viewer sees first. Each item carries the value the draft measured and the fix
// the advice already gives. The ranking is a fact table, not taste: nothing here refuses.
import fs from 'node:fs';
import path from 'node:path';
import { adviceOfDevNotes } from '../live/plan-status.mjs';
import { writeFileAtomic } from '../lib/atomic-write.mjs';

export const FIX_FIRST_MAX = 3;

const KINDS = [
  {
    kind: 'contrast', line: /^text "(.*)" at ([\d.]+) s reads ([\d.]+:1) .*needs ([\d.]+:1)\): (.*)$/, metric: 'text contrast',
    from: (m) => ({ measured: `"${m[1]}" at ${m[2]} s reads ${m[3]} (needs ${m[4]})`, fix: m[5] }),
  },
  {
    kind: 'cap-height', line: /^text "(.*)" at ([\d.]+) s: cap height ([\d.]+%) of frame \(rule readable-text-size asks ([\d.]+%)\)/, metric: 'text cap height',
    from: (m) => ({ measured: `"${m[1]}" at ${m[2]} s has cap height ${m[3]} of frame (needs ${m[4]})`, fix: `raise the font size until the cap height reaches ${m[4]}` }),
  },
  {
    kind: 'static-window', line: /^static window (\S+)-(\S+) s \((.*?)\): (?:[^;]*; )?(.*)$/, metric: 'still windows over 0.5 s outside a declared hold',
    from: (m) => ({ measured: `static window ${m[1]}-${m[2]} s (${m[3]})`, fix: m[4] }),
  },
  {
    kind: 'world-held', line: /^world held (\S+) (\S+)-(\S+) s \((.*)\); (waive: .*)$/,
    from: (m) => ({ measured: `world ${m[1]} held ${m[2]}-${m[3]} s (${m[4]})`, fix: `cut the world where the content changes, or ${m[5]}` }),
  },
  {
    kind: 'spectacle', line: /^board: the Spectacle is at ([\d.]+) s but <meta name="spectacle"> says ([\d.]+) s;.*?\. (Put the big move at .*)$/,
    from: (m) => ({ measured: `the Board's Spectacle is at ${m[1]} s, the page's spectacle meta says ${m[2]} s`, fix: m[3] }),
  },
];

// Unreadable text first, then picture that does not move, then plan mismatches, then every other measured problem.
const RANK = ['contrast', 'cap-height', 'static-window', 'world-held', 'spectacle', 'plan'];
const rankOf = (kind) => { const i = RANK.indexOf(kind); return i < 0 ? RANK.length : i; };

function fromAdvice(line) {
  for (const k of KINDS) {
    const m = k.line.exec(line);
    if (m) return { kind: k.kind, line, ...k.from(m) };
  }
  if (line.startsWith('board: ')) return { kind: 'plan', line, measured: line.slice('board: '.length), fix: 'change the Board in brief.md or the page so they agree' };
  return null;
}

function fromRow(row) {
  const known = KINDS.find((k) => k.metric === row.metric);
  const detail = row.detail ?? [];
  return { kind: known?.kind ?? `row:${row.metric}`, measured: `${row.metric}: ${row.measured} (target ${row.target})`, fix: detail.at(-1) ?? 'see out/<film>.dev.md Acceptance', fromRow: true };
}

const readJson = (file) => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; } };
const readText = (file) => { try { return fs.readFileSync(file, 'utf8'); } catch { return ''; } };

/** Every problem line the draft left: dev.md advice, red acceptance rows of the last draft, the video problems in checks.json. */
function sources(outDir, film) {
  const advice = adviceOfDevNotes(readText(path.join(outDir, `${film}.dev.md`)));
  const history = readJson(path.join(outDir, `${film}.acceptance.json`))?.history ?? [];
  const rows = (history.findLast((e) => e.stage === 'draft')?.rows ?? []).filter((r) => r.status === 'advice');
  const video = readJson(path.join(outDir, `${film}.checks.json`))?.video?.value?.problems;
  return { advice: [...advice, ...(Array.isArray(video) ? video.filter((v) => typeof v === 'string') : [])], rows };
}

/**
 * The top `max` problems of a draft as [{ kind, measured, fix, more }], most visible first. One item per kind: `more` counts the other lines of the
 * same kind. An advice line wins over the acceptance row of its kind, as it names the second and the fix. [] when the draft left none.
 */
export function fixFirst(outDir, film, max = FIX_FIRST_MAX) {
  const { advice, rows } = sources(outDir, film);
  const items = [...advice.map(fromAdvice).filter(Boolean), ...rows.map(fromRow)];
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
