// The data of `vawe frame --board`: one shot per world with its timecodes, action, move, ease curve and sound cues, the handoff between
// shots, and the rhythm strip. Pure: it assembles what timeline.mjs (worlds, cues), board.mjs (Board, Beats, Motion pass), handoffs.mjs
// and ease-curve.mjs already read; it parses nothing of its own.
import { worldRows, cueRows } from './timeline.mjs';
import { moveRows, sectionOf, rowsOf } from './board.mjs';
import { parseBriefTables } from './brief-tables.mjs';
import { parseHandoff } from './handoffs.mjs';
import { easeSamples } from './ease-curve.mjs';
import { easeName } from './motion-records.mjs';
import { stillCandidates } from '../media/world-sample.mjs';
import { EASE } from '../../core/motion/presets.js';
import { parseSignature } from '../../core/motion/signature.js';

const round = (n) => Math.round(n * 100) / 100;
const CUT_MATCH_S = 0.6;
const NOTE_CHARS = 280;

// Cut at a word boundary so a note never ends in half a word.
const clip = (text) => (text.length <= NOTE_CHARS ? text : `${text.slice(0, NOTE_CHARS).replace(/\s+\S*$/, '')}...`);
const CURVE_POINTS = 24;

/** `m:ss.ss` of a second count. Pure. */
export function timecode(s) {
  const t = Math.max(0, round(s));
  const m = Math.floor(t / 60);
  return `${m}:${(t - m * 60).toFixed(2).padStart(5, '0')}`;
}

/** The second whose frame stands for a world: after its entrances end, else its middle (the same pick as `vawe frame --world all`). Pure. */
export const settledSecond = (span, anims) => stillCandidates(span, anims)[0];

// The ease of the animation that ends last inside the world, before its exit: the one that decides when the world has settled.
function settlingEase(span, anims) {
  const mine = anims.filter((a) => a.world === span.id && a.end > span.start && a.end < span.end - 0.1);
  const last = mine.sort((a, b) => b.end - a.end).find((a) => a.ease !== 'linear') ?? mine[0];
  return last ? { easing: last.ease, anim: last.id } : null;
}

const NAMED = /EASE\.(\w+)|`(\w+)` curve/g;

/** The first named ease (EASE.<name> or "`<name>` curve") that the Board's cut row mentions, or null. Pure. */
export function boardEase(row) {
  const text = `${row?.overshoots ?? ''} ${row?.move ?? ''}`;
  for (const m of text.matchAll(NAMED)) if (EASE[m[1] ?? m[2]]) return m[1] ?? m[2];
  return null;
}

/** { name, easing, points, source } of a shot's ease: the page's own, else a named ease of the Board's cut row, else the signature's ease dial. Null for none. Pure. */
export function easeOf(span, anims, signature = {}, planned = null) {
  const found = settlingEase(span, anims);
  if (found && found.easing !== 'linear') {
    const name = easeName({ easing: found.easing });
    return { name: name ?? found.easing.replace(/^linear\(.*\)$/, 'custom curve'), easing: found.easing, points: easeSamples(found.easing, CURVE_POINTS), source: 'page' };
  }
  const named = planned ? { name: planned, source: 'board' } : signature.ease && EASE[signature.ease] ? { name: signature.ease, source: 'signature' } : null;
  if (named) return { ...named, easing: EASE[named.name], points: easeSamples(EASE[named.name], CURVE_POINTS) };
  return found ? { name: 'linear', easing: 'linear', points: easeSamples('linear', CURVE_POINTS), source: 'page' } : null;
}

// The cut row of the Board that sits on the boundary into shots[i + 1]: by position when counts agree, else by the nearest second.
function cutRowFor(rows, shots, i) {
  if (rows.length === shots.length - 1) return rows[i];
  const target = shots[i + 1].start;
  const near = rows.filter((r) => r.at !== null && Math.abs(r.at - target) <= CUT_MATCH_S).sort((a, b) => Math.abs(a.at - target) - Math.abs(b.at - target))[0];
  return near ?? null;
}

const plain = (cell) => String(cell ?? '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').trim();

/** { name, detail } of a Board move cell: "match-cut: the ring holds" or "speed-ramp, x axis" (markdown links read as their text). Pure. */
export function splitMove(cell) {
  const text = plain(cell);
  const m = /^([^:,]+)[:,]\s*(.*)$/s.exec(text);
  return m ? { name: m[1].trim(), detail: m[2].trim() || null } : { name: text, detail: null };
}

const PLACEHOLDER = /^(pending|-|todo)?$/i;

// The seconds a handoff is on screen. A Board cut with "from to" gives them; a Board overlap runs up to the cut; with no Board the two shots' overlap in the page is the band.
function bandOf(a, b, row, length) {
  if (!length) return null;
  if (row?.at != null && row.end != null) return [row.at, row.end];
  if (row) return [round(b.start - length), b.start];
  return [b.start, a.end];
}

/** The handoff into shots[i + 1]: { name, family, object, length, hard, planned }. A brief's cut gives the plan; without one the overlap of the two shots in the page gives the length. Pure. */
export function transitionOf(shots, i, row) {
  const [a, b] = [shots[i], shots[i + 1]];
  const overlap = round(Math.max(0, a.end - b.start));
  const planned = row ? (row.at !== null && row.end !== null ? round(row.end - row.at) : row.overlap ?? overlap) : overlap;
  const h = parseHandoff(row?.handoff ?? '');
  const length = planned || 0;
  return { from: a.id, to: b.id, name: h.name || (length ? 'overlap' : 'cut'), family: h.id, object: h.object, length, hard: length === 0, planned: Boolean(row), band: bandOf(a, b, row, length) };
}

const labelHasShot = (label, id) => new RegExp(`(^|[^a-z0-9-])${id}([^a-z0-9-]|$)`, 'i').test(label);

// Motion pass rows as notes by shot: the first shot a row's cut label names, else the row's position.
function motionNotes(brief, shots) {
  const section = brief ? sectionOf(brief, 'Motion pass') : undefined;
  if (section === undefined) return { byShot: {}, prose: null };
  const rows = rowsOf(section, 'cut');
  if (!rows.length) {
    const text = section.replace(/^Motion pass\s*/, '').replace(/`/g, '').replace(/\s+/g, ' ').trim();
    return { byShot: {}, prose: text ? clip(text) : null };
  }
  const byShot = {};
  rows.forEach((cells, i) => {
    const hit = shots.find((s) => labelHasShot(cells[0], s.id)) ?? shots[i];
    const said = cells.slice(1).filter((c) => !PLACEHOLDER.test(c.trim()));
    if (hit && said.length) byShot[hit.id] = clip(said.join(' / '));
  });
  return { byShot, prose: null };
}

// The one-line action of a shot: the Shots table's "notices", else the Beats table's "one thing that moves", else the Board's move.
function actionsOf(brief) {
  const out = {};
  const beats = brief ? sectionOf(brief, 'Beats') : undefined;
  if (beats !== undefined) for (const c of rowsOf(beats, 'beat')) if (c[0] && c[3]) out[c[0]] = c[3];
  if (brief) for (const s of parseBriefTables(brief).shots) if (s.notices) out[s.id] = s.notices;
  return out;
}

// The shot a second belongs to: the latest one started by then, with a frame of grace so a landing on the cut belongs to the shot it opens.
const spectacleShot = (shots, at) => shots.filter((s) => s.start <= at + 0.05).at(-1)?.id ?? null;

/**
 * Everything the storyboard page shows. `read` is { duration, spans, specs, anims, spectacle, signature (meta content or null), message },
 * `brief` the text of brief.md or null. A film without a brief gets the page-only fields. Pure.
 */
export function storyboardOf({ film, read, brief = null }) {
  const { duration, spans, specs, anims = [], spectacle = null } = read;
  const signature = parseSignature(read.signature);
  const rows = worldRows(spans);
  const groundOf = Object.fromEntries(spans.map((s) => [s.id, s.ground]));
  const cues = cueRows(specs, spans).sort((a, b) => a.at - b.at);
  const actions = actionsOf(brief);
  const planned = moveRows(brief);
  const tables = brief ? parseBriefTables(brief) : { shots: [] };
  const shots = rows.map((w, i) => {
    const span = spans.find((s) => s.id === w.id);
    const own = cues.filter((c) => c.role !== 'music' && c.at >= w.start - 1e-9 && c.at < w.end);
    return {
      n: i + 1, id: w.id, start: w.start, end: w.end, duration: round(w.end - w.start), in: timecode(w.start), out: timecode(w.end),
      at: settledSecond(span, anims), ground: groundOf[w.id] ?? null, action: actions[w.id] ?? null,
      move: null, moveDetail: null, ease: null, note: null,
      cues: own.map((c) => ({ at: c.at, voice: c.voice, gain: c.gain })),
    };
  });
  const transitions = shots.slice(0, -1).map((_, i) => transitionOf(shots, i, cutRowFor(planned, shots, i)));
  shots.forEach((s, i) => {
    const row = i > 0 ? cutRowFor(planned, shots, i - 1) : null;
    const brief_ = tables.shots.find((t) => t.id === s.id);
    s.ease = easeOf(spans.find((x) => x.id === s.id), anims, signature, boardEase(row));
    const move = splitMove(row?.move);
    s.move = move.name || brief_?.moveIn || null;
    s.moveDetail = move.detail;
  });
  const notes = motionNotes(brief, shots);
  for (const s of shots) s.note = notes.byShot[s.id] ?? null;
  return {
    film, duration, message: read.message ?? null, hasBrief: Boolean(brief),
    spectacle: spectacle === null ? null : { at: spectacle, world: spectacleShot(shots, spectacle) },
    shots, transitions, bed: cues.filter((c) => c.role === 'music'), cues: cues.filter((c) => c.role !== 'music'), motionPass: notes.prose,
  };
}
