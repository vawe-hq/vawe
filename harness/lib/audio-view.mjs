// The mix as numbers and a picture: which tracks sound at a second and how loud, the loudness curve, and the waveform SVG.
// Pure: decoded mono samples and specs in, data and strings out. Decoding and the PNG are in harness/media/audio-view.mjs.
import { voiceOf } from './timeline.mjs';

const SILENT_DB = -120;
const LEVEL_WINDOW_S = 0.05;
const CURVE_WINDOW_S = 0.4;
const CURVE_STEP_S = 0.1;

/** Seconds a source sounds in the film: between data-trim and data-trim-end (or its end), divided by data-rate. */
export const playableOf = (spec, seconds) => Math.max(0.01, (Math.min(seconds, spec.trimEnd ?? Infinity) - spec.trim) / (spec.rate ?? 1));

const round1 = (n) => Math.round(n * 10) / 10;
const toDb = (linear) => (linear > 1e-6 ? Math.max(SILENT_DB, 20 * Math.log10(linear)) : SILENT_DB);

/** The seconds in a --at value ("0.8,2.75") as numbers; throws on anything that is not a non-negative number. Pure. */
export function parseSeconds(text) {
  const times = String(text).split(',').map((p) => p.trim()).filter(Boolean).map(Number);
  if (!times.length || times.some((t) => !Number.isFinite(t) || t < 0)) throw new Error(`--at needs seconds like 0.8,2.75, got "${text}"`);
  return times;
}

/** RMS of samples[from, to) in dBFS, SILENT_DB for an empty or silent range. Pure. */
export function rmsDb(samples, from, to) {
  const a = Math.max(0, from);
  const b = Math.min(samples.length, to);
  if (b <= a) return SILENT_DB;
  let sum = 0;
  for (let i = a; i < b; i++) sum += samples[i] * samples[i];
  return toDb(Math.sqrt(sum / (b - a)));
}

/**
 * The tracks sounding at second `t`: [{ index, voice, role, into, length, offset }]. `into` is the seconds since the track
 * started, `length` how long it sounds, `offset` the second inside its source file (a looped bed wraps). A track is
 * { spec, seconds } with seconds the source length. Pure.
 */
export function activeAt(tracks, t, duration) {
  return tracks.flatMap(({ spec, seconds }, index) => {
    const playable = playableOf(spec, seconds);
    const bed = spec.role === 'music';
    const length = bed ? duration - spec.at : Math.min(playable, duration - spec.at);
    const into = t - spec.at;
    if (into < 0 || into >= length) return [];
    return [{ index, voice: voiceOf(spec), role: spec.role, into, length, offset: spec.trim + (bed ? into % playable : into * (spec.rate ?? 1)) }];
  });
}

/** The data-fade-in and data-fade-out gain of a track at `into` seconds of `length`, in dB (0 outside a fade). Pure. */
export function fadeDb(spec, into, length) {
  let linear = 1;
  if (spec.fadeIn > 0 && into < spec.fadeIn) linear = Math.min(linear, into / spec.fadeIn);
  if (spec.fadeOut > 0 && length - into < spec.fadeOut) linear = Math.min(linear, (length - into) / spec.fadeOut);
  return toDb(linear);
}

/** The level of a track at one moment in dBFS, one decimal: the RMS of its source over LEVEL_WINDOW_S, plus data-gain and its fades. Pure. */
export function levelDb({ samples, rate, spec, hit }) {
  const half = (LEVEL_WINDOW_S / 2) * rate;
  const centre = Math.round(hit.offset * rate);
  const fade = spec.fadeIn > 0 || spec.fadeOut > 0 ? fadeDb(spec, hit.into, hit.length) : 0;
  return round1(Math.max(SILENT_DB, rmsDb(samples, centre - half, centre + half) + spec.gain + fade));
}

/** Short-window RMS of the mix, [{ t, db }] every CURVE_STEP_S: the loudness curve. Pure. */
export function loudnessCurve(samples, rate) {
  const win = CURVE_WINDOW_S * rate;
  const out = [];
  for (let i = 0; i * CURVE_STEP_S * rate < samples.length; i++) {
    const c = Math.round(i * CURVE_STEP_S * rate);
    out.push({ t: Math.round(i * CURVE_STEP_S * 10) / 10, db: rmsDb(samples, c - win / 2, c + win / 2) });
  }
  return out;
}

/** `bins` [min, max] pairs of the samples. Pure. */
export function peaksOf(samples, bins) {
  const per = samples.length / bins;
  return Array.from({ length: bins }, (_, b) => {
    let lo = 0;
    let hi = 0;
    for (let i = Math.floor(b * per); i < Math.min(samples.length, Math.floor((b + 1) * per)); i++) {
      lo = Math.min(lo, samples[i]);
      hi = Math.max(hi, samples[i]);
    }
    return [lo, hi];
  });
}

const W = 1600;
const LEFT = 70;
const RIGHT = 30;
const TOP = 44;
const WAVE_H = 200;
const GAP = 16;
const CURVE_H = 110;
const LABELS_H = 150;
const CURVE_FLOOR_DB = -60;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

/**
 * The waveform picture as an SVG string: mixed waveform, loudness curve below it, a dashed line per world start labelled by id,
 * an orange tick per cue at its start labelled by voice. `worlds` is [{ id, start }], `cues` [{ voice, at }]. Pure.
 */
export function waveformSvg({ samples, rate, duration, worlds, cues, title }) {
  const plotW = W - LEFT - RIGHT;
  const x = (t) => LEFT + (t / duration) * plotW;
  const waveMid = TOP + WAVE_H / 2;
  const curveTop = TOP + WAVE_H + GAP;
  const bottom = curveTop + CURVE_H;
  const peaks = peaksOf(samples, plotW);
  const wave = peaks.map(([lo, hi], i) => `<line x1="${LEFT + i + 0.5}" x2="${LEFT + i + 0.5}" y1="${waveMid - hi * (WAVE_H / 2)}" y2="${waveMid - lo * (WAVE_H / 2)}"/>`).join('');
  const curvePts = loudnessCurve(samples, rate)
    .map(({ t, db }) => `${x(t).toFixed(1)},${(curveTop + CURVE_H * (1 - (Math.max(CURVE_FLOOR_DB, db) - CURVE_FLOOR_DB) / -CURVE_FLOOR_DB)).toFixed(1)}`).join(' ');
  const step = duration > 20 ? 5 : 1;
  const ticks = Array.from({ length: Math.floor(duration / step) + 1 }, (_, i) => i * step)
    .map((t) => `<text x="${x(t)}" y="${bottom + 16}" text-anchor="middle" class="axis">${t} s</text>`).join('');
  const worldLines = worlds.map((w) => `<line x1="${x(w.start)}" x2="${x(w.start)}" y1="${TOP - 6}" y2="${bottom}" class="world"/><text x="${x(w.start) + 4}" y="${TOP - 12}" class="world-id">${esc(w.id)} ${w.start}</text>`).join('');
  const cueTicks = cues.map((c) => `<line x1="${x(c.at)}" x2="${x(c.at)}" y1="${TOP}" y2="${TOP + WAVE_H}" class="cue"/><text x="${x(c.at) + 5}" y="${bottom + 30}" transform="rotate(90 ${x(c.at) + 5} ${bottom + 30})" class="cue-label">${esc(c.voice)} ${c.at}</text>`).join('');
  const dbLines = [0, -20, -40, -60].map((db) => `<text x="${LEFT - 6}" y="${curveTop + CURVE_H * (1 - (db - CURVE_FLOOR_DB) / -CURVE_FLOOR_DB) + 4}" text-anchor="end" class="axis">${db} dB</text>`).join('');
  const height = bottom + LABELS_H;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${height}" viewBox="0 0 ${W} ${height}">
<style>text{font:12px ui-monospace,Menlo,monospace;fill:#222}.axis{fill:#666}.world{stroke:#888;stroke-dasharray:5 4}.world-id{font-weight:700;fill:#444}.cue{stroke:#e8590c;stroke-width:2.5}.cue-label{fill:#c2410c}.wave line{stroke:#3b5bdb}.curve{fill:none;stroke:#2b8a3e;stroke-width:2}</style>
<rect width="100%" height="100%" fill="#fff"/>
<text x="${LEFT}" y="20" style="font-size:15px;font-weight:700">${esc(title)}</text>
<rect x="${LEFT}" y="${TOP}" width="${plotW}" height="${WAVE_H}" fill="#f6f7fb"/><rect x="${LEFT}" y="${curveTop}" width="${plotW}" height="${CURVE_H}" fill="#f4faf5"/>
<g class="wave">${wave}</g>
<polyline class="curve" points="${curvePts}"/>
${dbLines}${worldLines}${cueTicks}${ticks}
</svg>`;
}
