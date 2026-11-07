// harness/media/page-audio.mjs: offline audio for page films. A page holds plain <audio> elements
// (never played live); this reads them and mixes ONE ffmpeg graph onto the rendered video.
//   <audio src="music.mp3" loop data-at="0" data-gain="-3" data-fade-out="0.4"></audio>   (loop = the music bed)
//   <audio data-synth="whoosh" data-at="2.4"></audio>   (voices: core/audio/kit.mjs CUES; no data-gain
//                                                        takes the voice's DEFAULT_GAIN_DB)
//   <audio data-synth="air" data-at="2.4" data-length="0.6"></audio>   (data-length: the move's seconds, for the
//                                                        palette voices air and swoosh-long)
//   <audio data-synth="tap" data-on="world:s4" data-at="0.1"></audio>  (data-on: data-at counts from the first
//                                                        second world s4 shows; needs the page's seek)
//   <audio src="hit.wav" data-trim="0.2" data-trim-end="0.9"></audio>   (play seconds 0.2 to 0.9 of the file; a 8 ms fade
//                                                        at each cut avoids a click)
//   <audio src="vo.wav" data-role="vo"></audio>          (ducks music -18 dB while it plays)
//   <video src="footage/a.mp4" data-at="2" data-trim="5.2" data-trim-end="8.4" data-rate="1" data-gain="-6" muted></video>
//                                                        (a clip's own sound: film second 2 on, source 5.2 to 8.4 s at
//                                                        data-rate speed, pitch kept; `muted` or no audio stream adds none)
//   <meta name="loudness" content="-14">   (wins over the default below)
// The mix is as written: the sum of the cues at their gains, nothing raised or lowered. Only a -1 dBTP
// safety limiter runs, and it never raises a level. <meta name="loudness"> opts in to normalising to it.
// A cue that peaks more than 6 dB above the median cue is warned about, never refused.
// CLI: node harness/media/page-audio.mjs <page.html> <video.mp4> <out.mp4>
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { playableOf } from '../lib/audio-view.mjs';
import { resolveDuration } from './page-duration.mjs';
import { balanceLines } from '../lib/cue-balance.mjs';
import { spectralChange, BED_RATE } from '../lib/bed-motion.mjs';
import { decodeMono } from '../lib/audio-onsets.mjs';
import { measureFile } from '../lib/loudness.mjs';
import { CUES, DEFAULT_GAIN_DB, renderCue, renderCueStereo, normalize, normalizeStereo, encodeWav, wavDuration } from '../../core/audio/kit.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const RATE = 48000;
const BANNED_SYNTH = new Set(['bed', 'pad', 'drone', 'hum', 'chord', 'swell-soft', 'braam']);
export const BANNED_MESSAGE = 'synth beds are banned (owner rule: no constant synthy sounds, pads or chords): use a real music file (<audio loop src=...>) or no bed. Sparse effects on actions are fine.';
const VO_DUCK_DB = -18;
const DUCK_ATTACK = 0.05;
const DUCK_RELEASE = 0.3;
const CUT_FADE = 0.008;
const CUE_CEILING = 0.8;
const CUE_SPREAD_DB = 6;
const PEAK_LIMIT_DB = -1;
const LIMITER_DB = -1.5;

function run(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`${cmd} failed (${r.status}): ${(r.stderr || r.error?.message || '').split('\n').slice(-12).join('\n')}`);
  return r.stderr;
}

function probeSeconds(file) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { encoding: 'utf8' });
  const d = parseFloat(r.stdout);
  if (!(d > 0)) throw new Error(`page-audio: cannot read the duration of ${file}`);
  return d;
}

function hasAudioStream(file) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=codec_type', '-of', 'csv=p=0', file], { encoding: 'utf8' });
  return r.stdout.trim().length > 0;
}

// atempo runs 0.5 to 100 per filter; 0.25 to 4 is two stages at most and stays clean.
const RATE_RANGE = [0.25, 4];

function tempoFilters(rate) {
  if (rate === 1) return [];
  if (rate < 0.5) return ['atempo=0.5', `atempo=${f(rate / 0.5)}`];
  if (rate > 2) return ['atempo=2', `atempo=${f(rate / 2)}`];
  return [`atempo=${f(rate)}`];
}

function toFilePath(rawSrc, pageUrl, pagePath) {
  if (pagePath) return path.resolve(path.dirname(pagePath), decodeURI(rawSrc.split(/[?#]/)[0]));
  const u = new URL(rawSrc, pageUrl);
  if (u.protocol === 'file:') return fileURLToPath(u);
  return path.join(REPO_ROOT, decodeURIComponent(u.pathname));
}

/**
 * readPageAudio(page, { pagePath, spans, duration }?) -> { specs, loudness, duration }  (loudness: the <meta name="loudness"> value, or null;
 * duration: the film's seconds, by default the page's own, harness/media/page-duration.mjs)
 * `page` is a puppeteer Page on a loaded film. `pagePath` (the page's file) makes src resolution exact;
 * without it a src resolves against the repo root that the preview server serves.
 * spec: { src | synth, at, gain (dB), fadeIn, fadeOut, trim, trimEnd, duck (dB or null), role, rate (<video> clips only) }
 * A <video> with sound is a spec with role "clip" after the <audio> specs; a muted or silent one, or one with data-rate outside 0.25 to 4, adds none.
 */
export async function readPageAudio(page, { pagePath, spans, duration } = {}) {
  duration ??= pagePath ? await resolveDuration(pagePath) : NaN;
  const raw = await page.evaluate(() => {
    const num = (el, k, d) => { const v = parseFloat(el.dataset[k]); return Number.isFinite(v) ? v : d; };
    const tracks = [...document.querySelectorAll('audio')].map((el) => ({
      src: el.getAttribute('src') || el.querySelector('source')?.getAttribute('src') || null,
      synth: el.dataset.synth || null, on: el.dataset.on || null, length: num(el, 'length', null),
      at: num(el, 'at', 0), gain: num(el, 'gain', null), fadeIn: num(el, 'fadeIn', 0), fadeOut: num(el, 'fadeOut', 0),
      trim: num(el, 'trim', 0), trimEnd: num(el, 'trimEnd', null), duck: num(el, 'duck', null), role: el.dataset.role || (el.loop ? 'music' : null),
    }));
    const clips = [...document.querySelectorAll('video')].map((el) => ({
      tag: 'video', muted: el.hasAttribute('muted'), src: el.getAttribute('src') || el.querySelector('source')?.getAttribute('src') || null,
      at: num(el, 'at', 0), gain: num(el, 'gain', null), fadeIn: num(el, 'fadeIn', 0), fadeOut: num(el, 'fadeOut', 0),
      trim: num(el, 'trim', 0), trimEnd: num(el, 'trimEnd', null), duck: num(el, 'duck', null), role: el.dataset.role || 'clip', rate: num(el, 'rate', 1),
    }));
    tracks.push(...clips);
    const meta = parseFloat(document.querySelector('meta[name="loudness"]')?.content);
    return { tracks, loudness: Number.isFinite(meta) ? meta : null, url: location.href };
  });
  const problems = [];
  const specs = raw.tracks.flatMap(({ src, tag, muted, ...t }) => {
    if (tag === 'video') return clipSpec({ src, muted, ...t }, raw.url, pagePath, problems);
    const where = `<audio> at ${t.at} s`;
    if (t.synth) {
      if (BANNED_SYNTH.has(t.synth)) problems.push(`${where}: ${BANNED_MESSAGE}`);
      else if (!CUES[t.synth]) problems.push(`${where}: data-synth="${t.synth}" is not a voice. Voices: ${Object.keys(CUES).join(' ')}`);
      return [{ ...t, gain: t.gain ?? DEFAULT_GAIN_DB[t.synth] ?? 0, gainSet: t.gain !== null, defaultGain: DEFAULT_GAIN_DB[t.synth] ?? 0 }];
    }
    if (!src) { problems.push(`${where}: an <audio> element needs src or data-synth`); return [t]; }
    const file = toFilePath(src, raw.url, pagePath);
    if (!fs.existsSync(file)) problems.push(`${where}: src="${src}" resolved to ${file}, which does not exist`);
    return [{ ...t, src: file, gain: t.gain ?? 0, gainSet: t.gain !== null, defaultGain: 0 }];
  });
  problems.push(...await startOnWorlds(page, specs, duration, spans));
  if (problems.length) throw new Error(problems.join('\n'), { cause: { problems } });
  for (const s of specs) s.role ||= 'sfx';
  return { specs, loudness: raw.loudness, duration };
}

// One <video> to [] (muted, silent, unusable rate) or [spec]. Same spec shape as an <audio> src.
function clipSpec({ src, muted, ...t }, pageUrl, pagePath, problems) {
  const where = `<video> at ${t.at} s`;
  if (muted || !src) return [];
  const file = toFilePath(src, pageUrl, pagePath);
  if (!fs.existsSync(file)) { problems.push(`${where}: src="${src}" resolved to ${file}, which does not exist`); return []; }
  if (!hasAudioStream(file)) return [];
  if (!(t.rate >= RATE_RANGE[0] && t.rate <= RATE_RANGE[1])) {
    console.warn(`page-audio: ${where}: data-rate="${t.rate}" is outside ${RATE_RANGE[0]} to ${RATE_RANGE[1]}, so the clip is muted in the mix`);
    return [];
  }
  return [{ ...t, src: file, trimEnd: t.trimEnd ?? probeSeconds(file), gain: t.gain ?? 0, gainSet: t.gain !== null, defaultGain: 0 }];
}

/** Moves each data-on="world:<id>" spec to the second world <id> first shows, plus its data-at. Returns the problems. Pure but for the `at` it sets. */
export function startOnSpans(specs, spans) {
  return specs.filter((s) => s.on).flatMap((s) => {
    if (!/^world:\S+$/.test(s.on)) return [`<audio> at ${s.at} s: data-on="${s.on}" is not world:<id>`];
    const span = spans.find((w) => w.id === s.on.slice(6));
    if (span?.start == null) return [`<audio> data-on="${s.on}": no world shows with that id (worlds: ${spans.map((w) => w.id).join(' ')})`];
    s.at += span.start;
    return [];
  });
}

// data-on="world:<id>" follows the page's own seek, so the cue follows the film when the animation changes.
// `spans` (from sampleWorlds) saves a second sampling when the caller has them.
async function startOnWorlds(page, specs, duration, spans) {
  const on = specs.filter((s) => s.on);
  if (!on.length) return [];
  if (!spans) {
    const bad = on.filter((s) => !/^world:\S+$/.test(s.on));
    if (bad.length) return startOnSpans(bad, []);
    if (!(duration > 0) || !(await page.evaluate(() => typeof window.__pageSeek === 'function'))) {
      return ['data-on needs <meta name="duration"> and the renderer\'s page seek: it cannot run here'];
    }
    const { sampleWorlds } = await import('./world-sample.mjs');
    spans = await sampleWorlds(page, duration, (ms) => page.evaluate((t) => window.__pageSeek(t / 1000), ms));
  }
  return startOnSpans(specs, spans);
}

function probePeakDb(file) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-af', 'volumedetect', '-f', 'null', '-'], { encoding: 'utf8' });
  const m = r.stderr.match(/max_volume:\s*(-?[\d.]+) dB/);
  return m ? parseFloat(m[1]) : 0;
}

// peakDb is the cue's loudest sample after data-gain, in dBFS, before the limiter.
function materialise(spec, tmp, i) {
  if (spec.src) return { file: spec.src, seconds: probeSeconds(spec.src), peakDb: probePeakDb(spec.src) + spec.gain };
  const cue = CUES[spec.synth];
  // A palette voice draws pitch, timing and detune from its seed: the index gives each use its own.
  const samples = cue.voice
    ? normalizeStereo(renderCueStereo(cue, i + 1, { ...(spec.length == null ? {} : { length: spec.length }) }), CUE_CEILING)
    : normalize(renderCue(cue), CUE_CEILING);
  const file = path.join(tmp, `cue${i}-${spec.synth}.wav`);
  fs.writeFileSync(file, encodeWav(samples));
  return { file, seconds: wavDuration(samples), peakDb: 20 * Math.log10(CUE_CEILING) + spec.gain };
}

const cueOf = ({ spec, peakDb }) => ({ name: spec.synth || path.basename(spec.src), at: spec.at, peakDb, gain: spec.gain, gainSet: Boolean(spec.gainSet), defaultGain: spec.defaultGain ?? 0 });

/** cueSpreadWarnings(tracks) -> string[]: the balance lines of the sfx cues (harness/lib/cue-balance.mjs). */
export function cueSpreadWarnings(tracks) {
  return balanceLines(tracks.filter(({ spec }) => spec.role === 'sfx').map(cueOf));
}

const f = (n) => Number(n.toFixed(4));

function duckWindows(tracks, duration) {
  return tracks.flatMap(({ spec, seconds }) => {
    const db = spec.duck ?? (spec.role === 'vo' ? VO_DUCK_DB : null);
    if (db === null || spec.role === 'music') return [];
    const end = Math.min(duration, spec.at + playableOf(spec, seconds));
    return [{ a: spec.at, b: end, linear: 10 ** (db / 20) }];
  });
}

function duckExpr(windows) {
  return windows
    .map((w) => `(1-${f(1 - w.linear)}*clip(min((t-${f(w.a)})/${DUCK_ATTACK},(${f(w.b + DUCK_RELEASE)}-t)/${DUCK_RELEASE}),0,1))`)
    .join('*');
}

function trackChain({ spec, seconds }, i, duration, windows) {
  const isMusic = spec.role === 'music';
  const room = Math.max(0.01, duration - spec.at);
  const playable = playableOf(spec, seconds);
  const len = isMusic && playable < room ? room : Math.min(room, playable);
  const c = [`atrim=start=${f(spec.trim)}`, 'asetpts=PTS-STARTPTS', `aresample=${RATE}`, 'aformat=channel_layouts=stereo'];
  if (spec.rate) c.push(`atrim=end=${f(playable * spec.rate)}`, 'asetpts=PTS-STARTPTS', ...tempoFilters(spec.rate), 'asetpts=PTS-STARTPTS');
  if (isMusic) c.push('aloop=loop=-1:size=2147483647', 'asetpts=N/SR/TB');
  c.push(`atrim=end=${f(len)}`, 'asetpts=PTS-STARTPTS', `volume=${f(spec.gain)}dB`);
  const cutIn = !isMusic && spec.trim > 0 ? CUT_FADE : 0;
  const cutOut = !isMusic && spec.trimEnd != null && spec.trimEnd < seconds ? CUT_FADE : 0;
  const fadeIn = Math.max(spec.fadeIn, cutIn), fadeOut = Math.max(spec.fadeOut, cutOut);
  if (fadeIn > 0) c.push(`afade=t=in:st=0:d=${f(fadeIn)}`);
  if (fadeOut > 0) c.push(`afade=t=out:st=${f(Math.max(0, len - fadeOut))}:d=${f(fadeOut)}`);
  const ms = Math.round(spec.at * 1000);
  if (ms > 0) c.push(`adelay=${ms}|${ms}`, 'asetpts=N/SR/TB');
  if (isMusic && windows.length) c.push(`volume=eval=frame:volume='${duckExpr(windows)}'`);
  return `[${i}:a]${c.join(',')}[a${i}]`;
}

function lastJson(stderr) {
  const m = stderr.match(/\{[^{}]*"input_i"[^{}]*\}/g);
  if (!m) throw new Error('page-audio: loudnorm printed no measurement');
  return JSON.parse(m[m.length - 1]);
}

// The limiter lowers peaks above LIMITER_DB and passes everything below it untouched.
const LIMITER = `alimiter=limit=${f(10 ** (LIMITER_DB / 20))}:level=false`;

function normaliseFilter(mixWav, loudness) {
  const p1 = lastJson(run('ffmpeg', ['-hide_banner', '-nostats', '-i', mixWav, '-af', `loudnorm=I=${loudness}:TP=${PEAK_LIMIT_DB}:LRA=11:print_format=json`, '-f', 'null', '-']));
  if (!(parseFloat(p1.input_i) > -70)) return `aresample=${RATE}`;
  const measured = `measured_I=${p1.input_i}:measured_TP=${p1.input_tp}:measured_LRA=${p1.input_lra}:measured_thresh=${p1.input_thresh}:offset=${p1.target_offset}`;
  return `loudnorm=I=${loudness}:TP=${PEAK_LIMIT_DB}:LRA=11:${measured}:linear=true,aresample=${RATE}`;
}

/** Mix the specs into `<tmp>/mix.wav` as written (no limiter, no normalising). Returns the wav path, the cue-spread warnings and the tracks ({ spec, file, seconds, peakDb }). */
function writeMix(specs, duration, tmp) {
  const tracks = specs.map((spec, i) => ({ spec, ...materialise(spec, tmp, i) }));
  const windows = duckWindows(tracks, duration);
  const chains = tracks.map((t, i) => trackChain(t, i, duration, windows));
  const labels = tracks.map((_, i) => `[a${i}]`).join('');
  const graph = `${chains.join(';')};${labels}amix=inputs=${tracks.length}:normalize=0:duration=longest:dropout_transition=0,apad,atrim=end=${f(duration)}[mix]`;
  const mixWav = path.join(tmp, 'mix.wav');
  run('ffmpeg', ['-y', '-loglevel', 'error', ...tracks.flatMap((t) => ['-i', t.file]), '-filter_complex', graph, '-map', '[mix]', '-c:a', 'pcm_f32le', mixWav]);
  return { warnings: cueSpreadWarnings(tracks), mixWav, tracks };
}

const mixKey = (specs, duration) => crypto.createHash('sha1').update(JSON.stringify({
  specs, duration, kit: fs.statSync(path.join(REPO_ROOT, 'core/audio/kit.mjs')).mtimeMs,
  files: specs.filter((s) => s.src).map((s) => { const st = fs.statSync(s.src); return [st.size, st.mtimeMs]; }),
})).digest('hex');

/**
 * renderMixCached({ specs, duration, dir }) -> { mixWav, tracks, measured: { I, TP }, cached }
 * The mix as written, kept in `dir` with its tracks and loudness; a second call with the same specs, duration, source files and
 * synth kit returns them without rendering. `dir` is owned by this function.
 */
export function renderMixCached({ specs, duration, dir }) {
  const key = mixKey(specs, duration);
  const info = path.join(dir, 'mix.json');
  if (fs.existsSync(info)) {
    const kept = JSON.parse(fs.readFileSync(info, 'utf8'));
    if (kept.key === key && fs.existsSync(kept.mixWav)) return { ...kept, cached: true };
  }
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const { mixWav, tracks } = writeMix(specs, duration, dir);
  const kept = { key, mixWav, tracks, measured: measureFile(mixWav) };
  fs.writeFileSync(info, JSON.stringify(kept));
  return { ...kept, cached: false };
}

/** [{ name, change }] for every looped music file: how far its spectrum moves from half second to half second (harness/lib/bed-motion.mjs). The first BED_SECONDS only. */
function measureBeds(specs) {
  return specs.filter((s) => s.role === 'music' && s.src).map((s) => {
    const { samples } = decodeMono(s.src, BED_RATE, { seconds: 40 });
    return { name: path.basename(s.src), change: samples ? spectralChange(samples) : null };
  });
}

/** { I, TP, cues, beds }: integrated LUFS and true peak dBFS of the mix as written, before the limiter, each cue's { name, at, peakDb, gain, gainSet, defaultGain, role } and each music file's { name, change }; null when there are no specs. */
export function measureMixLevel({ specs, duration }) {
  if (!specs.length) return null;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vawe-audio-'));
  try {
    const { mixWav, tracks } = writeMix(specs, duration, tmp);
    const cues = tracks.map(cueOf).map((c, i) => ({ ...c, role: tracks[i].spec.role }));
    return { ...measureFile(mixWav), cues, beds: measureBeds(specs) };
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

/**
 * mixAndMux({ specs, duration, video, out, loudness = null }) -> { out, measured: { I, TP }, warnings }
 * The audio track is the mix as written plus a -1 dBTP limiter; `loudness` (LUFS) opts in to normalising
 * to it. `measured` is the loudness of the audio track as written into `out`, and one line prints it.
 * With no specs, `out` is the video copied with no audio track and `measured` is null. `warnings`
 * (cueSpreadWarnings) are printed to stderr and never fail the mix.
 */
export async function mixAndMux({ specs, duration, video, out, loudness = null }) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vawe-audio-'));
  const tmpOut = `${out}.tmp-${process.pid}.mp4`;
  try {
    fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
    if (!specs.length) {
      run('ffmpeg', ['-y', '-loglevel', 'error', '-i', video, '-c', 'copy', '-movflags', '+faststart', tmpOut]);
      fs.renameSync(tmpOut, out);
      return { out, measured: null, warnings: [] };
    }
    const { warnings, mixWav } = writeMix(specs, duration, tmp);
    for (const w of warnings) console.warn(`page-audio: ${w}`);
    const af = loudness === null ? `${LIMITER},aresample=${RATE}` : `${normaliseFilter(mixWav, loudness)},${LIMITER}`;
    run('ffmpeg', ['-y', '-hide_banner', '-nostats', '-i', video, '-i', mixWav, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-af', af,
      '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', tmpOut]);
    fs.renameSync(tmpOut, out);
    const measured = measureFile(out);
    console.log(`page-audio: ${loudness === null ? 'mix as written' : `normalised to ${loudness} LUFS`}: ${measured.I.toFixed(1)} LUFS, ${measured.TP.toFixed(1)} dBTP`);
    return { out, measured, warnings };
  } finally {
    fs.rmSync(tmpOut, { force: true });
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

async function cli([pagePath, video, out]) {
  if (!pagePath || !video || !out) {
    console.error('usage: node harness/media/page-audio.mjs <page.html> <video.mp4> <out.mp4>');
    process.exit(2);
  }
  const { openPreview } = await import('./preview-server.mjs');
  const { page, url, close } = await openPreview(pagePath);
  let read;
  try {
    await page.goto(url, { waitUntil: 'load' });
    read = await readPageAudio(page, { pagePath: path.resolve(pagePath) });
  } finally {
    await close();
  }
  const r = await mixAndMux({ specs: read.specs, duration: probeSeconds(video), video, out, loudness: read.loudness });
  console.log(`${r.out}: ${read.specs.length} tracks${r.measured ? `, ${r.measured.I.toFixed(1)} LUFS, ${r.measured.TP.toFixed(1)} dBTP` : ', no audio'}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await cli(process.argv.slice(2));
