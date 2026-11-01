// The page as text before any pixel: worlds with their spans, the cut rhythm, the spectacle and every audio cue at its resolved second.
// Pure: spans (harness/lib/worlds.mjs worldSpans) and specs (harness/media/page-audio.mjs readPageAudio) in, data and lines out.
import path from 'node:path';
import { cutAdvice } from './board.mjs';

const round = (n) => Math.round(n * 100) / 100;

/** The id of the world on top at second `t`: of the worlds showing (start inclusive, end exclusive) the one that started last; the film's last second belongs to the last world; null for none. Pure. */
export function worldAt(spans, t) {
  const shown = spans.filter((s) => s.start != null).sort((a, b) => a.start - b.start);
  const hit = shown.filter((s) => t >= s.start && t < s.end).at(-1);
  if (hit) return hit.id;
  const last = shown.at(-1);
  return last && t === last.end ? last.id : null;
}

/** The label of a cue: its synth voice, or the file name of its src. Pure. */
export const voiceOf = (spec) => spec.synth || path.basename(spec.src ?? '?');

/**
 * The worlds that show, in start order, as { id, start, end, cut, hold }: cut is the seconds from this world's start to the next
 * world's start (the last: to its own end), since a world can stay under the next one; hold is the seconds its text needs to be read. Pure.
 */
export function worldRows(spans) {
  const shown = spans.filter((s) => s.start != null).sort((a, b) => a.start - b.start);
  return shown.map((s, i) => ({ id: s.id, start: round(s.start), end: round(s.end), cut: round((shown[i + 1]?.start ?? s.end) - s.start), hold: s.readNeed ?? 0 }));
}

/** One row per cue and bed: { voice, role, at, on, gain, world } with `at` the resolved second. Pure. */
export const cueRows = (specs, spans) => specs.map((s) => ({
  voice: voiceOf(s), role: s.role, at: round(s.at), on: s.on ?? null, gain: round(s.gain), world: worldAt(spans, s.at),
}));

/** Everything `vawe see --plan` prints, as data. `meta` is { duration, spectacle (s or null) }. Pure. */
export function timelineOf({ spans, specs, duration, spectacle }) {
  const worlds = worldRows(spans);
  const cuts = worlds.map((w) => w.cut);
  const cues = cueRows(specs, spans).sort((a, b) => a.at - b.at);
  return {
    duration,
    worlds,
    rhythm: { cuts, advice: cutAdvice(cuts) },
    spectacle: spectacle === null ? null : { at: spectacle, world: worldAt(spans, spectacle) },
    bed: cues.filter((c) => c.role === 'music'),
    cues: cues.filter((c) => c.role !== 'music'),
  };
}

/** The text of `vawe see --plan`, one array of lines. Pure. */
export function timelineLines(t) {
  const lines = [`duration ${t.duration} s, ${t.worlds.length} worlds`];
  lines.push('worlds (id: shows from-until, cut length to the next world, read hold):');
  for (const w of t.worlds) lines.push(`  ${w.id}: ${w.start}-${w.end} s, cut ${w.cut} s, hold ${w.hold} s`);
  lines.push(`rhythm: ${t.rhythm.cuts.join(' ')}`);
  for (const a of t.rhythm.advice) lines.push(`  ${a}`);
  lines.push(t.spectacle ? `spectacle: ${t.spectacle.at} s, in world ${t.spectacle.world ?? 'none'}` : 'spectacle: none (no <meta name="spectacle">)');
  lines.push(t.bed.length ? `bed: ${t.bed.map((b) => `${b.voice} at ${b.at} s, ${b.gain} dB`).join('; ')}` : 'bed: none');
  lines.push(`cues (${t.cues.length}):`);
  for (const c of t.cues) lines.push(`  ${c.at} s  ${c.voice}  ${c.gain} dB  world ${c.world ?? 'none'}${c.on ? `  (${c.on})` : ''}`);
  return lines;
}
