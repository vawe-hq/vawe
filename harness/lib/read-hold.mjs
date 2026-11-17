// harness/lib/read-hold.mjs: the readable-hold rule (taste/rules/readable-hold.md) as a pure function.
import LIMITS from '../../taste/build/limits.json' with { type: 'json' };

const HOLD = LIMITS['readable-hold'];
const READ_PER_WORD = HOLD.prose_s_per_word;
const READ_FLOOR = HOLD.hold_floor_s;
const READ_OTHER_WPS = HOLD.short_words_per_s;
const PROSE_WORDS = HOLD.prose_min_words;
export const MIN_TEXT_H = 0.02; // share of frame height below which text is a caption or credit, not read on the way past
const SAME_TIME = 0.5;          // s: rows that arrive and settle within this of each other are shown together

/** What the readable-hold rule asks, for the judge prompt and this check: one source for the numbers. */
export const HOLD_RULE = { floor: READ_FLOOR, perWord: READ_PER_WORD, shortWps: READ_OTHER_WPS, proseWords: PROSE_WORDS, ceiling: HOLD.ceiling_s, perExtraRow: 1 / READ_OTHER_WPS };

/** Seconds to read one line of `n` words. Pure. */
export const lineNeed = (n) => (n >= PROSE_WORDS ? n * READ_PER_WORD : Math.max(READ_FLOOR, n / READ_OTHER_WPS));

/** Seconds to read rows shown together: the longest row, plus a word's time for each extra row, never past the ceiling (a row that needs more alone keeps its own need). Pure. */
export function rowsNeed(needs) {
  const longest = Math.max(...needs);
  return Math.max(longest, Math.min(longest + (needs.length - 1) * HOLD_RULE.perExtraRow, HOLD_RULE.ceiling));
}

const wordCount = (text) => text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
const together = (a, b) => Math.abs(a.tIn - b.tIn) <= SAME_TIME && Math.abs(a.tSettled - b.tSettled) <= SAME_TIME;
const onScreenTogether = (a, b) => together(a, b) && Math.min(a.tOut, b.tOut) > Math.max(a.tSettled, b.tSettled);
const hasLetter = (text) => /\p{L}/u.test(text);
const COUNTER_VALUES = 3; // a block that shows this many different numbers in turn is a ticking counter

// A ticking counter or clock shows a new number every step: looked at, not read (taste/rules/readable-hold.md).
const counterBlocks = (tracks) => {
  const numbers = new Map();
  for (const w of tracks) if (w.block != null && !hasLetter(w.text)) numbers.set(w.block, (numbers.get(w.block) ?? 0) + 1);
  return new Set([...numbers].filter(([, n]) => n >= COUNTER_VALUES).map(([block]) => block));
};

// A line is one element's text: the tracks of one block that arrive and settle together. A track with no block is a line of its own.
function linesOf(tracks) {
  const counters = counterBlocks(tracks);
  const shown = tracks.filter((w) => w.sizeSettled >= MIN_TEXT_H && w.tOut - w.tIn > 0.3 && !counters.has(w.block)).sort((a, b) => a.tIn - b.tIn);
  const lines = [];
  for (const w of shown) {
    const same = w.block == null ? [] : lines.filter((x) => x.block === w.block);
    const line = w.glued ? same.at(-1) : same.find((x) => together(x, w));
    if (line) line.tracks.push(w); else lines.push({ block: w.block, tIn: w.tIn, tSettled: w.tSettled, tracks: [w] });
  }
  const words = (l) => l.tracks.reduce((s, w, i) => s + Math.max(0, wordCount(w.text) - (w.glued && i ? 1 : 0)), 0);
  return lines.map((l) => ({ ...l, text: l.tracks.map((w, i) => (i && w.glued ? '' : i ? ' ' : '') + w.text).join(''), n: words(l),
    tSettled: Math.max(...l.tracks.map((w) => w.tSettled)), tOut: Math.min(...l.tracks.map((w) => w.tOut)) }));
}

// Lines that settle together are rows of one list: each holds for the longest row plus the extras, not for its own text alone.
function groupsOf(tracks) {
  const lines = linesOf(tracks);
  return lines.map((l) => {
    const rows = lines.filter((x) => onScreenTogether(x, l));
    return { text: l.text, n: l.n, tSettled: l.tSettled, tOut: l.tOut, hold: l.tOut - l.tSettled, rows: rows.length, need: rowsNeed(rows.map((x) => lineNeed(x.n))) };
  });
}

/**
 * The lines as the viewer sees them, for a ceiling on how long one stays: words of one element that show at the same time are one
 * line, however late each arrives. `need` is the read time of the line with the rows that arrive beside it. [{ text, n, tIn, tOut, need }]. Pure.
 */
export function screenLines(tracks) {
  const merged = [];
  for (const l of linesOf(tracks).sort((a, b) => a.tIn - b.tIn)) {
    const same = l.block == null ? null : merged.find((x) => x.block === l.block && l.tIn < x.tOut);
    if (same) Object.assign(same, { n: same.n + l.n, text: `${same.text} ${l.text}`, tOut: Math.max(same.tOut, l.tOut), tSettled: Math.max(same.tSettled, l.tSettled) });
    else merged.push({ block: l.block, text: l.text, n: l.n, tIn: l.tIn, tSettled: l.tSettled, tOut: l.tOut });
  }
  return merged.map((l) => ({ text: l.text, n: l.n, tIn: l.tIn, tOut: l.tOut, need: rowsNeed(merged.filter((x) => onScreenTogether(x, l)).map((x) => lineNeed(x.n))) }));
}

/** Group the tracks of one element into a line, then compare each line's still time to its read time. Rows that arrive together share the longest row's time plus a word's time per extra row. A line that leaves before its settle time has no hold to measure. Pure. */
export const readHoldProblems = (tracks) => groupsOf(tracks).filter((g) => g.hold >= 0 && g.hold < g.need * 0.9);

/** The lines whose settle time is after they left the screen: the Words table or the sampling is wrong, so their hold is not measured. Pure. */
export const readHoldUnmeasured = (tracks) => groupsOf(tracks).filter((g) => g.hold < 0);

/**
 * Tracks for readHoldProblems from the draft's text samples: every run of samples that shows one text is a track, in at
 * the run's first sample minus half a step, out at its last plus half a step. `block` is the sample's element identity
 * (the nearest block-level ancestor): the texts of one element read as one line, two elements never join. A word of the
 * brief's Words table that the text holds gives the settle time; without one the run's start stands in for it, so the hold
 * is the time since the line last changed. A line that grows by appending characters (typed) stays one track: it settles when it stops changing. Text inside data-chrome or data-ui is not a line to read and has no track.
 */
export function probeTracks(samples, { step, frameH }, words = []) {
  const tracks = [];
  const open = new Map();
  const close = (key) => {
    const r = open.get(key);
    open.delete(key);
    tracks.push({ text: r.text, block: r.block, glued: r.glued, sizeSettled: r.h / frameH, tIn: r.tIn, tSettled: r.tSettled, tOut: r.tOut });
  };
  const keyOf = (l) => `${l.block ?? l.text}|${l.text}`;
  for (const { t, lines } of samples) {
    const shown = lines.map((l) => ({ ...l, text: l.text.replace(/\s+/g, ' ').trim() })).filter((l) => l.text && l.box && !l.chrome && !l.ui);
    const now = new Set(shown.map(keyOf));
    const seen = new Set();
    for (const l of shown) {
      const { text } = l;
      const block = l.block ?? text;
      const key = keyOf(l);
      seen.add(key);
      let r = open.get(key);
      if (!r && l.block != null) {
        const typed = [...open].find(([k, x]) => x.block === block && !now.has(k) && text.length > x.text.length && text.startsWith(x.text));
        if (typed) { open.delete(typed[0]); r = Object.assign(typed[1], { text, changedAt: Math.max(0, t - step / 2) }); }
      }
      r ??= { text, block, glued: Boolean(l.glued), h: l.box[3], tIn: Math.max(0, t - step / 2), changedAt: Math.max(0, t - step / 2) };
      const spec = words.find((w) => typeof w.settle === 'number' && text.toLowerCase().includes(w.text.toLowerCase()));
      r.tSettled = Math.max(r.tIn, spec ? spec.settle : r.changedAt);
      r.tOut = t + step / 2;
      open.set(key, r);
    }
    for (const key of [...open.keys()]) if (!seen.has(key)) close(key);
  }
  for (const key of [...open.keys()]) close(key);
  return tracks;
}
