// The one reader of a track's sound for cutting to it: hits, tempo and beat grid, bars, sections, loudness, and the cuts of a film against them.
// `vawe sound`, `vawe see` and the draft check all read sound through here; core/beats/detect.js and ref-measure/audio-attack.mjs do the estimating.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { onsetEnvelope, estimateTempo, estimatePhase, beatGrid, fitGrid } from '../../core/beats/detect.js';
import { attackTimes } from './ref-measure/audio-attack.mjs';
import { decodeMono } from './audio-onsets.mjs';
import { classifyHit } from './sound-class.mjs';
import { measureFile } from './loudness.mjs';
import { WORK } from './workspace.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const RATE = 22050;
const HOP = 256;
const WIN = 512;
const PER_BAR = 4;
const SECTION_WINDOW_S = 0.5;
const SECTION_MIN_S = 1;
const QUIET_DB = -8;
const LOUD_DB = 3;
const SILENT_DB = -70;
const SLOW_RISE_MS = 25;
const FRAMES = [30, 60];

const TEMPO_USABLE = 1.6;
const SOFT_HIT = 0.25;
export const ON_BEAT_FRAMES = 1;
export const NEAR_FRAMES = 3;
const STRONG_HIT = 0.5;
const EPS = 1e-6;

const r1 = (v) => Math.round(v * 10) / 10;
const r3 = (v) => Math.round(v * 1000) / 1000;

/** soft: a weak hit; sustained: a slow rise (a pad or swell, not a strike); hit: a clear strike. */
export const hitKind = ({ strength, errMs }) => (strength < SOFT_HIT ? 'soft' : errMs > SLOW_RISE_MS ? 'sustained' : 'hit');

/**
 * Hits, tempo and beat grid of a mono signal: the one onset reader of the repo. `hits` carry t (the peak of the energy flux), attack
 * (where the sound starts), strength (0 to 1 of the loudest) and errMs. The tempo comes from the envelope and is then fitted to the
 * attack times, so the BPM is not a whole number of envelope hops. Returns null for an empty signal.
 */
export function analyseMono(mono, sampleRate, { fps, duration }) {
  const { env, hopSeconds } = onsetEnvelope(mono, sampleRate, HOP, WIN);
  if (!env.length) return null;
  const mean = env.reduce((a, b) => a + b, 0) / env.length;
  const sd = Math.sqrt(env.reduce((a, b) => a + (b - mean) ** 2, 0) / env.length);
  const max = Math.max(...env, 1e-9), thr = mean + 1.2 * sd, hits = [];
  for (let i = 3; i < env.length - 3; i++) {
    if (env[i] < thr) continue;
    let isMax = true;
    for (let k = -3; k <= 3; k++) if (env[i + k] > env[i]) { isMax = false; break; }
    const t = (i * HOP + WIN / 2) / sampleRate;
    if (isMax && (!hits.length || t - hits[hits.length - 1].t >= 0.06)) hits.push({ t: r3(t), frame: Math.round(t * fps), strength: r3(env[i] / max) });
  }
  attackTimes(mono, sampleRate, hits.map((h) => h.t)).forEach((a, i) => Object.assign(hits[i], { attack: r3(a.attack), attackFrame: r1(a.attack * fps), errMs: a.errMs }));
  const tempo = estimateTempo(env, hopSeconds), phase = estimatePhase(env, tempo.periodFrames);
  const fit = tempo.periodFrames ? fitGrid(hits.filter((h) => h.strength >= SOFT_HIT).map((h) => h.attack), tempo.periodFrames * hopSeconds, phase * hopSeconds) : null;
  const beats = fit ? beatGrid(fit.periodSeconds, fit.phaseSeconds, 1, duration) : beatGrid(tempo.periodFrames, phase, hopSeconds, duration);
  const bpm = fit ? 60 / fit.periodSeconds : tempo.bpm;
  return { hits, bpm, confidence: tempo.confidence, beats };
}

function barOffset(beats, hits) {
  const weight = new Array(PER_BAR).fill(0);
  for (const h of hits) {
    const i = beats.reduce((best, b, k) => (Math.abs(b - h.attack) < Math.abs(beats[best] - h.attack) ? k : best), 0);
    if (beats.length && Math.abs(beats[i] - h.attack) <= 0.05) weight[i % PER_BAR] += h.strength;
  }
  return weight.reduce((best, w, k) => (w > weight[best] ? k : best), 0);
}

/** The quiet and loud runs of a signal, against its own median level: [{ from, to, level, db }]. */
function sectionsOf(mono, sampleRate) {
  const size = Math.round(SECTION_WINDOW_S * sampleRate), db = [];
  for (let o = 0; o + size <= mono.length; o += size) {
    let s = 0;
    for (let i = o; i < o + size; i++) s += mono[i] * mono[i];
    db.push(s > 0 ? 10 * Math.log10(s / size) : -120);
  }
  const live = db.filter((v) => v > SILENT_DB).sort((a, b) => a - b);
  if (!live.length) return [];
  const ref = live[live.length >> 1];
  const smooth = db.map((_, i) => [db[i - 1] ?? db[i], db[i], db[i + 1] ?? db[i]].sort((a, b) => a - b)[1]);
  const level = smooth.map((v) => (v - ref <= QUIET_DB ? 'quiet' : v - ref >= LOUD_DB ? 'loud' : 'mid'));
  const out = [];
  for (let i = 0; i < level.length; i++) {
    const last = out.at(-1);
    if (last && last.level === level[i]) { last.to = (i + 1) * SECTION_WINDOW_S; last.sum += smooth[i]; last.n++; } else out.push({ from: i * SECTION_WINDOW_S, to: (i + 1) * SECTION_WINDOW_S, level: level[i], sum: smooth[i], n: 1 });
  }
  return out.filter((s) => s.level !== 'mid' && s.to - s.from >= SECTION_MIN_S).map((s) => ({ from: s.from, to: Math.min(s.to, r3(mono.length / sampleRate)), level: s.level, db: r1(s.sum / s.n) }));
}

function loudnessOf(file) {
  try { const m = measureFile(file); return { loudness: { lufs: m.I, truePeakDb: m.TP } }; } catch (e) {
    return { loudness: null, loudnessNote: `loudness not read: ${String(e.message).split('\n')[0]}` };
  }
}

const sha = (...parts) => { const h = crypto.createHash('sha1'); for (const p of parts) h.update(p); return h.digest('hex'); };
const CODE = ['harness/lib/sound-read.mjs', 'harness/lib/sound-class.mjs', 'harness/lib/ref-measure/audio-attack.mjs', 'core/beats/detect.js'];
const codeHash = () => sha(...CODE.map((f) => fs.readFileSync(path.join(ROOT, f))));

/**
 * The sound of one file, in the file's own seconds: { duration, loudness (null with a loudnessNote saying why), tempo: { bpm, confidence, usable, periodS, firstBeatS },
 * beats: [seconds], barOffset, onsets: [{ attack, peak, strength, errMs, kind, sound }], sections }. Any format ffmpeg reads (m4a, mp3, wav, mp4).
 * Kept in out/sound-cache/ by the content hash of the file and of this code.
 */
export function readSound(file, { cache = true } = {}) {
  const key = sha(fs.readFileSync(file), codeHash());
  const kept = path.join(WORK, 'out', 'sound-cache', `${key}.json`);
  if (cache && fs.existsSync(kept)) return JSON.parse(fs.readFileSync(kept, 'utf8'));
  const decoded = decodeMono(file, RATE, { minSeconds: 0.02 });
  if (!decoded.samples) throw new Error(`${file} has no audio to read: ${decoded.error}`);
  const mono = new Float32Array(decoded.samples);
  const duration = r3(mono.length / RATE);
  const a = analyseMono(mono, RATE, { fps: 30, duration });
  if (!a) throw new Error(`${file} is too short to read`);
  const onsets = a.hits.map((h) => ({ attack: h.attack, peak: h.t, strength: h.strength, errMs: h.errMs, kind: hitKind(h), sound: classifyHit(mono, RATE, h.attack, h.errMs).cls }));
  const usable = a.confidence >= TEMPO_USABLE && a.beats.length > 1;
  const sound = { duration, ...loudnessOf(file),
    tempo: { bpm: r1(a.bpm), confidence: r1(a.confidence), usable, periodS: a.beats.length > 1 ? r3((a.beats.at(-1) - a.beats[0]) / (a.beats.length - 1)) : null, firstBeatS: a.beats[0] ?? null },
    beats: a.beats, barOffset: barOffset(a.beats, a.hits), onsets, sections: sectionsOf(mono, RATE) };
  if (cache) { fs.mkdirSync(path.dirname(kept), { recursive: true }); fs.writeFileSync(kept, `${JSON.stringify(sound)}\n`); }
  return sound;
}

const frameOf = (t, fps) => Math.round(t * fps);

/** The cut seconds of a page's world spans, each on its frame: a world starts on a frame, and the spans are rounded to 10 ms. */
export const cutTimesOf = (spans, fps) => spans.filter((w) => w.start != null && w.start > EPS).map((w) => frameOf(w.start, fps) / fps);

/**
 * The sound set on a film's clock: every time moved by `offset` (the bed's data-at minus its data-trim) and cut to `from`..`to`,
 * with the beat grid as lines (beat, half, quarter), the bars and the frame numbers at 30 and 60 fps.
 */
export function placeSound(sound, { offset = 0, from = 0, to = Infinity } = {}) {
  const inside = (t) => t >= from && t <= to;
  const period = sound.tempo.periodS;
  const beats = sound.beats.map((t, i) => ({ i, t: r3(t + offset) }));
  const lines = [];
  for (const b of beats) {
    const bar = Math.floor((b.i - sound.barOffset) / PER_BAR) + 1, beat = (((b.i - sound.barOffset) % PER_BAR) + PER_BAR) % PER_BAR + 1;
    lines.push({ t: b.t, kind: 'beat', bar, beat });
    if (period) for (const [kind, share] of [['quarter', 0.25], ['half', 0.5], ['quarter', 0.75]]) lines.push({ t: r3(b.t + period * share), kind, bar, beat });
  }
  const frames = (t) => Object.fromEntries(FRAMES.map((fps) => [`f${fps}`, frameOf(t, fps)]));
  const grid = lines.filter((l) => l.t < sound.duration + offset && inside(l.t)).map((l) => ({ ...l, ...frames(l.t) }));
  const onsets = sound.onsets.map((o) => ({ ...o, attack: r3(o.attack + offset), peak: r3(o.peak + offset) })).filter((o) => o.attack >= 0 && inside(o.attack))
    .map((o) => ({ ...o, ...frames(o.attack) }));
  const ranked = [...onsets].sort((a, b) => b.strength - a.strength).slice(0, 10).map((o) => o.attack);
  const bars = grid.filter((l) => l.kind === 'beat' && l.beat === 1).map((l) => ({ bar: l.bar, t: l.t, ...frames(l.t) }));
  const sections = sound.sections.map((s) => ({ ...s, from: r3(s.from + offset), to: r3(s.to + offset) })).filter((s) => s.to > from && s.from < to);
  return { ...sound, offset, window: { from, to: Number.isFinite(to) ? to : null }, grid, bars, onsets, top: ranked, sections };
}

/** The lines a cut may land on: every hit that is not soft, and, when the tempo is usable, every beat and half beat. */
function targetsOf(placed) {
  const hits = placed.onsets.filter((o) => o.kind !== 'soft').map((o) => ({ t: o.attack, what: 'hit', strength: o.strength }));
  const lines = placed.tempo.usable ? placed.grid.filter((l) => l.kind !== 'quarter').map((l) => ({ t: l.t, what: l.kind === 'beat' ? `beat ${l.bar}.${l.beat}` : 'half beat' })) : [];
  return [...hits, ...lines];
}

const nearest = (list, t) => list.reduce((best, x) => (best == null || Math.abs(x.t - t) < Math.abs(best.t - t) ? x : best), null);

/**
 * Every cut set against the sound: [{ n, t, hit, line, best, frames, ms, verdict, move }] and the strong hits no cut carries.
 * frames and ms are the cut minus its nearest target (positive: the cut comes after the sound). verdict: `on beat` within 1 frame,
 * `near` within 3, `off` beyond. `move` is the second to move an off or near cut to.
 */
export function cutsVsSound(cuts, placed, fps) {
  const hits = targetsOf(placed).filter((x) => x.what === 'hit'), lines = targetsOf(placed).filter((x) => x.what !== 'hit');
  const rows = cuts.map((t, i) => {
    const hit = nearest(hits, t), line = nearest(lines, t);
    const best = [hit, line].filter(Boolean).reduce((b, x) => (b == null || Math.abs(x.t - t) < Math.abs(b.t - t) ? x : b), null);
    const ms = best ? Math.round((t - best.t) * 1000) : null, frames = best ? r1((t - best.t) * fps) : null;
    const verdict = !best ? 'off' : Math.abs((t - best.t) * fps) <= ON_BEAT_FRAMES + EPS ? 'on beat' : Math.abs((t - best.t) * fps) <= NEAR_FRAMES + EPS ? 'near' : 'off';
    const view = (x) => (x ? { t: x.t, what: x.what, ms: Math.round((t - x.t) * 1000), frames: r1((t - x.t) * fps) } : null);
    return { n: i + 1, t, hit: view(hit), line: view(line), best: view(best), frames, ms, verdict, move: verdict === 'on beat' || !best ? null : best.t };
  });
  const carried = (o) => cuts.some((c) => Math.abs(c - o.attack) * fps <= NEAR_FRAMES + EPS);
  const uncut = placed.onsets.filter((o) => o.kind === 'hit' && o.strength >= STRONG_HIT && !carried(o)).map((o) => ({ t: o.attack, strength: o.strength, f: frameOf(o.attack, fps) }));
  const onBeat = rows.filter((r) => r.verdict === 'on beat').length;
  return { rows, uncut, onBeat, share: rows.length ? onBeat / rows.length : null };
}

const BED_ATTR = (tag, name) => { const m = tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, 'i')); return m ? m[1] : null; };

/** The page's <audio> elements as data. `loop` is the native attribute: the music bed. */
export function pageAudio(html) {
  return (html.match(/<audio\b[^>]*>/gi) || []).map((tag) => ({
    src: BED_ATTR(tag, 'src'), synth: BED_ATTR(tag, 'data-synth'), at: BED_ATTR(tag, 'data-at'), trim: BED_ATTR(tag, 'data-trim'),
    loop: /\bloop\b/i.test(tag.replace(/(["'])[^"']*\1/g, '')),
  }));
}

/** { file, offset } of the page's music bed (a local `<audio loop src>`), or null. `offset` is the film second of the file's second 0. */
export function pageBed(html, pagePath) {
  const bed = pageAudio(html).find((a) => a.loop && a.src && !/^https?:/.test(a.src));
  const file = bed && path.resolve(path.dirname(pagePath), decodeURI(bed.src.split(/[?#]/)[0]));
  return file && fs.existsSync(file) ? { file, offset: Number(bed.at || 0) - Number(bed.trim || 0) } : null;
}

const t2 = (t) => t.toFixed(2);

/** The draft-check line for a page with a music bed: the share of cuts on a hit or beat line and the cuts that are off. [] when there is nothing to say. */
export function beatAdvice(pagePath, spans, { fps = 30 } = {}) {
  const bed = pageBed(fs.readFileSync(pagePath, 'utf8'), pagePath);
  const cuts = cutTimesOf(spans, fps);
  if (!bed || !cuts.length) return [];
  const { rows, onBeat } = cutsVsSound(cuts, placeSound(readSound(bed.file), { offset: bed.offset }), fps);
  if (onBeat === rows.length) return [];
  const off = rows.filter((r) => r.verdict !== 'on beat').map((r) => `cut ${r.n} at ${t2(r.t)} s is ${Math.abs(r.frames)} f ${r.frames > 0 ? 'after' : 'before'} the ${r.best?.what ?? 'sound'} at ${r.best ? t2(r.best.t) : '-'} s`);
  return [`cut-off-beat: ${onBeat} of ${rows.length} cuts are within ${ON_BEAT_FRAMES} frame of a hit or beat line (${Math.round((100 * onBeat) / rows.length)}%); ${off.join('; ')}; fix: vawe sound ${path.relative(process.cwd(), pagePath)} gives the second to move each cut to`];
}
