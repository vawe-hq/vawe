// A world is one beat of the page: an element with data-world="<id>". Pure span math over the samples that
// harness/media/world-sample.mjs reads. A sample is { t, worlds: [{ id, visible, ground }] }.
import LIMITS from '../../taste/build/limits.json' with { type: 'json' };
import { insideHold } from './still-limit.mjs';
import { waiverHint } from './waivers.mjs';
import { lineNeed, rowsNeed, HOLD_RULE } from './read-hold.mjs';

export const TURN_SECONDS_MAX = LIMITS['world-turns'].turn_seconds_max;
// A span is measured on the draft's 30 fps frame grid and a cut shows its world a frame or two early (the starter's does), so a world of exactly the limit measures up to about 0.1 s longer.
export const SPAN_SLACK_S = 0.1;

// A world must outlast its text's read time by an entrance settling and an exit clearing (each about 0.4 s in the house presets).
export const READ_MARGIN_S = 0.8;

const WORDLESS_EVERY = 4;

const round = (n) => +n.toFixed(3);

// A clip shows a new source frame when the source it plays through the world (rate x seconds, at most its trim range) is at least one frame of the 30 fps draft; an unknown range counts as playing.
const FRAME_S = 1 / 30;
const clipPlays = (c, seconds) => c.range == null || Math.min(c.rate * seconds, c.range) >= FRAME_S;
const wordCount = (text) => text.split(/\s+/).filter(Boolean).length;

/** Seconds to read the texts one world shows (rows read together: harness/lib/read-hold.mjs rowsNeed), 0 for none. Pure. */
export const readNeed = (texts) => (texts.length ? round(rowsNeed(texts.map((t) => lineNeed(wordCount(t))))) : 0);

/** The longest a world may stay: the world-turns limit, or longer when its own text needs more time to read. The text counts for at most the readable-hold ceiling (one line holds about 5 s): padding words buy no more. */
export const worldLimit = (span, max = TURN_SECONDS_MAX) => Math.max(max, Math.min(span.readNeed ?? 0, HOLD_RULE.ceiling) + READ_MARGIN_S);

/** The [a, b] seconds each text world is held to be read: from its start for its read time (at most the ceiling), never past its end. The margin is for the entrance and exit, which move. Pure. */
export const readHolds = (spans) => spans.filter((s) => s.start != null && s.readNeed > 0)
  .map((s) => [s.start, round(Math.min(s.end, s.start + Math.min(s.readNeed, HOLD_RULE.ceiling)))]);

/** Every world id in page order. Pure. */
export const worldIds = (samples) => [...new Set(samples.flatMap((s) => s.worlds.map((w) => w.id)))];

/** A world's content as one string, or null when nothing of it can be read (no ground, no words, no visible parts): such a world is never called a copy of another. */
const contentSignature = (ground, texts, shape) => (ground || texts.length || shape.length ? JSON.stringify([ground, texts.map((t) => t.toLowerCase()).sort(), shape]) : null);

/**
 * [{ id, start, end, ground, readNeed }] per world in page order: the span covers the first to the last sample where the world was visible,
 * widened by half a sample step and kept inside [0, dur]. `ground` is read at the middle visible sample; `readNeed` is the read time of every
 * text the world showed. A world never visible has null start, end and ground. Pure.
 */
export function worldSpans(samples, { step, dur }) {
  return worldIds(samples).map((id) => {
    const seen = samples.filter((s) => s.worlds.some((w) => w.id === id && w.visible));
    if (!seen.length) return { id, start: null, end: null, ground: null, readNeed: 0 };
    const mid = seen[Math.floor((seen.length - 1) / 2)];
    const texts = [...new Set(seen.flatMap((x) => x.worlds.find((w) => w.id === id).texts ?? []))];
    const ground = mid.worlds.find((w) => w.id === id).ground ?? null;
    const start = seen[0].t - step / 2, end = seen.at(-1).t + step / 2;
    const playing = (mid.worlds.find((w) => w.id === id).clips ?? []).some((c) => clipPlays(c, end - start));
    return {
      id,
      signature: contentSignature(ground, texts, mid.worlds.find((w) => w.id === id).shape ?? []),
      start: round(Math.max(0, seen[0].t - step / 2)),
      end: round(Math.min(dur, seen.at(-1).t + step / 2)),
      playing,
      ground,
      readNeed: readNeed(texts),
    };
  });
}

/** The second to take the still of one world: the middle of its visible span, or 0 when the page never shows it. Pure. */
export const stillTime = (span) => (span && span.start != null ? round((span.start + span.end) / 2) : 0);

/** The second of the one full-size look at a draft: the spectacle second, else the middle of the longest world, else null. Pure. */
export function reviewStillSecond(spans, spectacle) {
  if (Number.isFinite(spectacle)) return spectacle;
  const shown = (spans ?? []).filter((s) => s.start != null);
  if (!shown.length) return null;
  const longest = shown.reduce((a, b) => (b.end - b.start > a.end - a.start ? b : a));
  return stillTime(longest);
}

/** True when the run { a, b } lies inside worlds that show text: a flat ground with words on it is a frame to read, not a blank. Pure. */
export function insideTextWorlds(spans, run) {
  const covering = spans.filter((s) => s.start != null && s.readNeed > 0).sort((x, y) => x.start - y.start);
  let reached = run.a;
  for (const s of covering) {
    if (s.start > reached + SPAN_SLACK_S) break;
    reached = Math.max(reached, s.end);
  }
  return reached >= run.b - SPAN_SLACK_S;
}

/** The spans with adjacent worlds that show the same ground, words and things merged into one: a world turns when its content changes, not when its id does. */
export function mergeSameContent(spans) {
  const out = [];
  for (const s of spans.filter((x) => x.start != null).sort((a, b) => a.start - b.start)) {
    const last = out.at(-1);
    if (last && last.signature && last.signature === s.signature && s.start <= last.end + SPAN_SLACK_S) out[out.length - 1] = { ...last, id: `${last.id}+${s.id}`, end: Math.max(last.end, s.end) };
    else out.push(s);
  }
  return out;
}

/** The world-held problems of measured spans: one { len, text } per world visible longer than `max` seconds, outside a declared hold; a world playing a video clip is not held still. Worlds with the same content count as one. */
export function heldWorlds(spans, max = TURN_SECONDS_MAX, authoring = {}) {
  const held = insideHold(authoring, 'world-held');
  return mergeSameContent(spans)
    .filter((s) => s.start != null && !s.playing && s.end - s.start > worldLimit(s, max) + SPAN_SLACK_S && !held({ a: s.start, b: s.end }))
    .map((s) => ({ len: s.end - s.start, text: `world held ${s.id} ${s.start}-${s.end} s (${round(s.end - s.start)} s, limit ${round(worldLimit(s, max))} s${s.readNeed + READ_MARGIN_S > max ? ': its text needs that long' : ''}${s.id.includes('+') ? `; ${s.id.split('+').join(' and ')} show the same ground, words and things, so they are one world: cut the world where the content changes` : ''}); ${waiverHint(`world-held@${s.start}-${s.end}`)}` }));
}

/**
 * The starter's beats: the first world lasts as long as its texts need to be read (at least the world-turns limit, at most half the film),
 * the rest split equally with none longer than the limit; at least 2 worlds: [{ id, start, end, wordless }]. Every fourth world after the
 * first three, never the last, shows no words and lasts the full limit, so the eye rests (rule text-breathing). Pure.
 */
export function starterBeats(length, firstTexts = []) {
  const first = Math.min(length / 2, Math.max(TURN_SECONDS_MAX, readNeed(firstTexts) + READ_MARGIN_S));
  const n = Math.max(1, Math.ceil((length - first) / TURN_SECONDS_MAX - 1e-9));
  const wordless = (i) => i % WORDLESS_EVERY === WORDLESS_EVERY - 1 && i < n;
  const quiet = Math.floor(n / WORDLESS_EVERY);
  const shared = (length - first - quiet * TURN_SECONDS_MAX) / (n - quiet);
  const lasts = Array.from({ length: n + 1 }, (_, i) => (i === 0 ? first : wordless(i) ? TURN_SECONDS_MAX : shared));
  const ends = lasts.map((_, i) => (i === n ? length : +lasts.slice(0, i + 1).reduce((a, b) => a + b, 0).toFixed(2)));
  return ends.map((end, i) => ({ id: `s${i + 1}`, start: i === 0 ? 0 : ends[i - 1], end, wordless: wordless(i) }));
}
