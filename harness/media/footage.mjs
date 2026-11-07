// The person's own clips, made into proxies a page <video> can seek exactly, and a log of what is in them.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ffmpegOrDie } from '../lib/scratch.mjs';
import { measureFile } from '../lib/loudness.mjs';
import { detectCuts } from './shot-detect.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const EXT = /\.(mp4|mov|m4v|webm|mkv)$/i;
const STANDARD_FPS = [[24000, 1001], [24, 1], [25, 1], [30000, 1001], [30, 1], [50, 1], [60000, 1001], [60, 1]];
const MAX_FPS = 60;
// Measured on a 12 s 1080p30 clip, 40 random seeks in Chrome, median ms / MB: -g 1 166 / 25.4, -g 15 145 / 15.1, -g 30 228 / 14.5, -g 250 878 / 14.1.
export const GOP = 15;
const SOURCES = '.sources.json';
const MODEL_NAMES = ['ggml-base.en.bin', 'ggml-small.en.bin', 'ggml-base.bin', 'ggml-small.bin'];
const MODEL_URL = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin';
const SHEET_TILES = 8;

export const filmDirOf = (film) => (fs.existsSync(film) && fs.statSync(film).isDirectory() ? path.resolve(film) : path.join(ROOT, 'films', film));
const footageDir = (filmDir) => path.join(filmDir, 'footage');

export function slugOf(file, taken) {
  const base = path.basename(file).replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'clip';
  let slug = base;
  for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`;
  return slug;
}

function parseRate(r) {
  const [n, d] = String(r).split('/').map(Number);
  return d > 0 && n > 0 ? n / d : 0;
}

/** The standard rate nearest the measured one (a variable-rate phone clip reports an average), as [num, den]. */
export function standardRate(fps) {
  const capped = Math.min(fps, MAX_FPS);
  const best = STANDARD_FPS.map(([n, d]) => ({ n, d, err: Math.abs(n / d - capped) / capped })).sort((a, b) => a.err - b.err)[0];
  return best.err <= 0.04 ? [best.n, best.d] : [Math.max(1, Math.round(capped)), 1];
}

export function probe(file) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_streams', '-show_format', file], { encoding: 'utf8', maxBuffer: 1 << 26 });
  if (r.status !== 0) throw new Error(`footage: ffprobe cannot read ${file}`);
  const j = JSON.parse(r.stdout);
  const v = j.streams.find((s) => s.codec_type === 'video');
  if (!v) throw new Error(`footage: ${file} has no video stream`);
  const rotated = Math.abs(Number(v.side_data_list?.find((s) => s.rotation !== undefined)?.rotation ?? v.tags?.rotate ?? 0)) % 180 === 90;
  const [w, h] = rotated ? [v.height, v.width] : [v.width, v.height];
  const fps = parseRate(v.avg_frame_rate) || parseRate(v.r_frame_rate) || 30;
  return { width: w, height: h, fps, seconds: Number(v.duration) || Number(j.format.duration) || 0, hasAudio: j.streams.some((s) => s.codec_type === 'audio') };
}

/** The scale filter: fit inside the box (landscape 1920x1080, portrait 1080x1920; double with `full`), never crop, never enlarge. */
export function fitFilter(width, height, full) {
  const k = full ? 2 : 1;
  const [bw, bh] = (height > width ? [1080, 1920] : [1920, 1080]).map((n) => n * k);
  return `scale=w=min(${bw}\\,iw):h=min(${bh}\\,ih):force_original_aspect_ratio=decrease:force_divisible_by=2`;
}

function listInputs(inputs) {
  const files = [];
  for (const input of inputs) {
    if (!fs.existsSync(input)) throw new Error(`footage: no such clip or folder: ${input}`);
    if (fs.statSync(input).isDirectory()) files.push(...fs.readdirSync(input).filter((f) => EXT.test(f) && !f.startsWith('.')).sort().map((f) => path.join(input, f)));
    else if (EXT.test(input)) files.push(input);
    else throw new Error(`footage: ${input} is not mp4, mov, m4v, webm or mkv`);
  }
  if (!files.length) throw new Error('footage: no clip found in the inputs');
  return files.map((f) => path.resolve(f));
}

function readSources(dir) {
  try { return JSON.parse(fs.readFileSync(path.join(dir, SOURCES), 'utf8')); } catch { return {}; }
}

function encode(src, dest, info, { full, gop }) {
  const [n, d] = standardRate(info.fps);
  const vf = `${fitFilter(info.width, info.height, full)},fps=${n}/${d},format=yuv420p`;
  const audio = info.hasAudio ? ['-c:a', 'aac', '-ar', '48000', '-ac', '2', '-b:a', '160k'] : ['-an'];
  ffmpegOrDie(['-v', 'error', '-y', '-i', src, '-map', '0:v:0', ...(info.hasAudio ? ['-map', '0:a:0'] : []), '-vf', vf, '-fps_mode', 'cfr',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-g', String(gop), '-keyint_min', String(gop), '-sc_threshold', '0', '-bf', '2',
    ...audio, '-movflags', '+faststart', dest], dest, `footage ${path.basename(src)}`);
}

/** Writes films/<film>/footage/<slug>.mp4 for each clip and returns [{ slug, file, seconds, fps, width, height, hasAudio }]. A proxy newer than its source is kept. */
export function addFootage(filmDir, inputs, opts = {}) {
  const dir = footageDir(filmDir);
  const files = listInputs(inputs);
  fs.mkdirSync(dir, { recursive: true });
  const sources = readSources(dir);
  const bySource = new Map(Object.entries(sources).map(([slug, src]) => [src, slug]));
  const taken = new Set(Object.keys(sources));
  const out = [];
  for (const src of files) {
    const known = bySource.get(src);
    const slug = known ?? slugOf(src, taken);
    taken.add(slug);
    sources[slug] = src;
    const file = path.join(dir, `${slug}.mp4`);
    const fresh = fs.existsSync(file) && fs.statSync(file).mtimeMs >= fs.statSync(src).mtimeMs;
    if (!fresh) encode(src, file, probe(src), { full: opts.full, gop: opts.gop ?? GOP });
    const p = probe(file);
    out.push({ slug, file, seconds: +p.seconds.toFixed(3), fps: +p.fps.toFixed(3), width: p.width, height: p.height, hasAudio: p.hasAudio, skipped: fresh });
  }
  fs.writeFileSync(path.join(dir, SOURCES), `${JSON.stringify(sources, null, 2)}\n`);
  return out;
}

/** The whisper model on disk, or null: VAWE_WHISPER_MODEL, then ~/.vawe/models, then the whisper.cpp folders brew and a checkout use. */
export function findWhisperModel(env = process.env) {
  if (env.VAWE_WHISPER_MODEL) return fs.existsSync(env.VAWE_WHISPER_MODEL) ? env.VAWE_WHISPER_MODEL : null;
  const folders = [path.join(os.homedir(), '.vawe', 'models'), '/opt/homebrew/share/whisper-cpp', '/usr/local/share/whisper-cpp', path.join(ROOT, 'models')];
  for (const f of folders) for (const m of MODEL_NAMES) if (fs.existsSync(path.join(f, m))) return path.join(f, m);
  return null;
}

/** Words with start and end seconds from whisper-cli's `-ml 1 -sow` JSON: one segment per word, bracketed tags (music, silence) dropped. Pure. */
export function wordsOf(json) {
  return (json.transcription ?? []).map((s) => ({ word: s.text.trim(), start: s.offsets.from / 1000, end: s.offsets.to / 1000 }))
    .filter((w) => w.word && !/^[[(].*[\])]$/.test(w.word));
}

function transcribe(proxy, model, wordsFile) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vawe-footage-'));
  try {
    const wav = path.join(tmp, 'a.wav');
    ffmpegOrDie(['-v', 'error', '-y', '-i', proxy, '-vn', '-ac', '1', '-ar', '16000', wav], wav, 'footage audio');
    const lang = model.endsWith('.en.bin') ? 'en' : 'auto';
    const r = spawnSync('whisper-cli', ['-m', model, '-f', wav, '-l', lang, '-ml', '1', '-sow', '-oj', '-of', path.join(tmp, 'w'), '-np'], { encoding: 'utf8', maxBuffer: 1 << 26 });
    if (r.error || r.status !== 0) throw new Error(`whisper-cli failed: ${(r.error?.message || r.stderr || '').trim().slice(-300)}`);
    const words = wordsOf(JSON.parse(fs.readFileSync(path.join(tmp, 'w.json'), 'utf8')));
    fs.writeFileSync(wordsFile, `${JSON.stringify(words, null, 2)}\n`);
    return words;
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}

function whisperReady() {
  if (spawnSync('which', ['whisper-cli']).status !== 0) return { problem: 'transcripts need whisper-cli: `brew install whisper-cpp`' };
  if (!findWhisperModel()) return { problem: `transcripts need a whisper model: \`mkdir -p ~/.vawe/models && curl -L -o ~/.vawe/models/ggml-base.en.bin ${MODEL_URL}\` (148 MB; or set VAWE_WHISPER_MODEL to a ggml file)` };
  return { model: findWhisperModel() };
}

function contactSheet(filmDir, slug, proxy, seconds) {
  const out = path.join(ROOT, 'out', `${path.basename(filmDir)}-footage-${slug}.png`);
  const at = Array.from({ length: SHEET_TILES }, (_, i) => +((i + 0.5) * seconds / SHEET_TILES).toFixed(2)).join(',');
  const r = spawnSync(process.execPath, [path.join(ROOT, 'harness/media/sheet.mjs'), proxy, '--at', at, '--out', out], { encoding: 'utf8', cwd: ROOT });
  return r.status === 0 && fs.existsSync(out) ? out : null;
}

function shotRows(proxy, seconds) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vawe-footage-'));
  try {
    const { cuts } = detectCuts(proxy, tmp, 0.3, 0.4);
    const edges = [0, ...cuts.map((c) => c.t), seconds];
    return edges.slice(0, -1).map((t, i) => `${i + 1}. ${t.toFixed(2)}-${edges[i + 1].toFixed(2)} s`);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}

function loudness(proxy) {
  try { const { I, TP } = measureFile(proxy); return `${I.toFixed(1)} LUFS, peak ${TP.toFixed(1)} dBFS`; } catch { return 'n/a'; }
}

function clipSection(filmDir, c, whisper) {
  const lines = [`## ${c.slug}`, ''];
  lines.push(`Shots (hard cuts only): ${shotRows(c.file, c.seconds).join('; ')}`, '');
  const sheet = contactSheet(filmDir, c.slug, c.file, c.seconds);
  lines.push(sheet ? `Contact sheet: ${path.relative(ROOT, sheet)}` : 'Contact sheet: not made', '');
  if (c.hasAudio) {
    if (!whisper.model) lines.push(`Transcript: ${whisper.problem}`);
    else {
      const wordsFile = path.join(footageDir(filmDir), `${c.slug}.words.json`);
      const fresh = fs.existsSync(wordsFile) && fs.statSync(wordsFile).mtimeMs >= fs.statSync(c.file).mtimeMs;
      let words;
      try { words = fresh ? JSON.parse(fs.readFileSync(wordsFile, 'utf8')) : transcribe(c.file, whisper.model, wordsFile); } catch (e) { words = null; lines.push(`Transcript: ${e.message}`); }
      if (words) lines.push(words.length ? `Transcript (word times in footage/${c.slug}.words.json): ${words.map((w) => w.word).join(' ')}` : 'Transcript: no speech found');
    }
    lines.push('');
  }
  return lines;
}

/** Writes films/<film>/footage.md: a row per clip, then each clip's shots, contact sheet and transcript. Returns { path }. */
export function logFootage(filmDir) {
  const dir = footageDir(filmDir);
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.mp4')).sort() : [];
  if (!files.length) throw new Error(`footage: no proxies in ${dir}; run bin/vawe footage add <film> <clip>... first`);
  const clips = files.map((f) => ({ slug: f.replace(/\.mp4$/, ''), file: path.join(dir, f), ...probe(path.join(dir, f)) }));
  const whisper = clips.some((c) => c.hasAudio) ? whisperReady() : {};
  const rows = clips.map((c) => `| ${c.slug} | ${c.seconds.toFixed(2)} | ${+c.fps.toFixed(2)} | ${c.width}x${c.height} | ${c.hasAudio ? 'yes' : 'no'} | ${c.hasAudio ? loudness(c.file) : '-'} |`);
  const text = ['# Footage', '', '| slug | seconds | fps | size | audio | loudness |', '| --- | --- | --- | --- | --- | --- |', ...rows, '', ...clips.flatMap((c) => clipSection(filmDir, c, whisper))].join('\n');
  const file = path.join(filmDir, 'footage.md');
  fs.writeFileSync(file, `${text}\n`);
  return { path: file };
}
