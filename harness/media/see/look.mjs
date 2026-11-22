// `vawe see`: measures of light and texture of a film (flashes, clipped pixels, bloom, chromatic offset, screen texture, glow colour), one table, optionally a against b.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { refsDir } from '../../lib/refs.mjs';
import { scratch } from '../../lib/scratch.mjs';
import { die, probeVideo } from './core.mjs';
import { frameRgb, lumaOf } from './frame.mjs';
import { advise, clippedShare, edgeSamples, lookProblem, lookTable, summarise } from './look-math.mjs';
import { resolveInput } from './input.mjs';
import { BLOCK, channelPhase, channelsSplit, DARK_MEAN, DARK_PEAK, describePattern, powerSpectrum, spectrumPeak } from './texture-math.mjs';
import { isMain } from '../../lib/is-main.mjs';

const SERIES_W = 480, SERIES_H = 270, MEAN_W = 160, MEAN_H = 90;
const SAMPLES = 8;
const MAX_FRAMES = 6000;

/** Per-frame mean luma and clipped share of `video` between from and to (one ffmpeg pass, both from the same decode). */
export function lumaSeries(video, from, to) {
  const dir = scratch('look', `run-${process.pid}`);
  const fileMean = path.join(dir, 'mean.rgb'), fileClip = path.join(dir, 'clip.rgb');
  const range = ['-ss', String(from), ...(to === undefined ? [] : ['-t', String(to - from)])];
  const graph = `[0:v]split[a][b];[a]scale=${MEAN_W}:${MEAN_H}:flags=area,format=rgb24[m];[b]scale=${SERIES_W}:${SERIES_H}:flags=neighbor,format=rgb24[c]`;
  const r = spawnSync('ffmpeg', ['-v', 'error', '-y', ...range, '-i', video, '-an', '-filter_complex', graph,
    '-map', '[m]', '-fps_mode', 'passthrough', '-f', 'rawvideo', fileMean, '-map', '[c]', '-fps_mode', 'passthrough', '-f', 'rawvideo', fileClip], { encoding: 'utf8' });
  if (r.status !== 0) die(`could not decode ${video}: ${String(r.stderr).trim().slice(0, 300)}`);
  const mean = fs.readFileSync(fileMean), clip = fs.readFileSync(fileClip);
  fs.rmSync(dir, { recursive: true, force: true });
  const n = Math.floor(mean.length / (MEAN_W * MEAN_H * 3));
  if (n < 2) die(`${video}: fewer than 2 frames between ${from} and ${to ?? 'the end'} s`);
  if (n > MAX_FRAMES) die(`${video}: ${n} frames is too many: pass --from and --to for a window of at most ${MAX_FRAMES} frames`);
  const mp = MEAN_W * MEAN_H, cp = SERIES_W * SERIES_H;
  const means = [], clips = [];
  for (let f = 0; f < n; f++) {
    means.push(lumaOf(mean.subarray(f * mp * 3, (f + 1) * mp * 3), mp).reduce((s, v) => s + v, 0) / mp);
    clips.push(clippedShare(lumaOf(clip.subarray(f * cp * 3, (f + 1) * cp * 3), cp)));
  }
  return { means, clips };
}

function darkBlocks(P) {
  const out = [];
  for (let y = 0; y + BLOCK <= P.h; y += BLOCK) {
    for (let x = 0; x + BLOCK <= P.w; x += BLOCK) {
      const block = new Float64Array(BLOCK * BLOCK);
      let sum = 0, max = 0;
      for (let j = 0; j < BLOCK; j++) {
        for (let i = 0; i < BLOCK; i++) {
          const v = P.L[(y + j) * P.w + x + i];
          block[j * BLOCK + i] = v; sum += v; if (v > max) max = v;
        }
      }
      if (sum / block.length <= DARK_MEAN && max < DARK_PEAK) out.push({ x, y, block });
    }
  }
  return out;
}

function channelBlock(P, x, y, c) {
  const block = new Float64Array(BLOCK * BLOCK);
  for (let j = 0; j < BLOCK; j++) for (let i = 0; i < BLOCK; i++) block[j * BLOCK + i] = P.rgb[((y + j) * P.w + x + i) * 3 + c];
  return block;
}

/** The strongest repeating pattern over the dark blocks of the frames, or null when no block is dark. `at` is the second of the frame and `box` the block in 1920x1080 pixels. */
function bestTexture(frames) {
  let best = null;
  for (const P of frames) {
    for (const b of darkBlocks(P)) {
      const peak = spectrumPeak(powerSpectrum(b.block));
      if (!best || peak.ratio > best.peak.ratio) best = { peak, P, x: b.x, y: b.y };
    }
  }
  if (!best) return null;
  const pattern = describePattern(best.peak);
  if (pattern.kind === 'none') return pattern;
  const [r, g, bl] = [0, 1, 2].map((c) => channelPhase(channelBlock(best.P, best.x, best.y, c), best.peak.fx, best.peak.fy));
  return { ...pattern, ...channelsSplit(r, g, bl), at: best.P.t, box: { x: best.x, y: best.y, w: BLOCK, h: BLOCK } };
}

/** { edges, texture } read from full-size frames of `video` at `times` (seconds): the edge samples of each and the strongest screen texture over them. */
export function edgesAt(video, times, dur = probeVideo(video).dur) {
  const frames = times.map((t) => { const at = Math.min(t, dur - 0.05), f = frameRgb(video, at); return { ...f, t: +at.toFixed(3), L: lumaOf(f.rgb, f.w * f.h) }; });
  return { edges: frames.map((f) => edgeSamples(f)), texture: bestTexture(frames) };
}

/** The look numbers of `video` between from and to (seconds; the whole film when absent), from `samples` full-size frames spread over the window. */
export function measureFilm(video, from = 0, to = undefined, samples = SAMPLES) {
  const { fps, dur } = probeVideo(video);
  const end = Math.min(to ?? dur, dur);
  const { means, clips } = lumaSeries(video, from, to === undefined ? undefined : end);
  const times = Array.from({ length: samples }, (_, i) => from + ((i + 0.5) * (end - from)) / samples);
  return summarise({ means, fps, clips, ...edgesAt(video, times, dur) });
}

async function source(input, label) {
  const found = await resolveInput(input);
  if (found.draftMissing) die(`no draft of ${input} yet: run bin/vawe dev ${found.page} first (it writes ${found.video}), then repeat`);
  const isRef = path.resolve(found.video).startsWith(path.resolve(refsDir()));
  return { ...found, label, isRef, note: found.page ? `last draft of ${found.page}` : isRef ? 'reference film' : 'film' };
}

/** Runs `vawe see`: prints the table of `input` (and `opts.vs`) and the advice lines. */
export async function runLook(input, opts) {
  const problem = lookProblem(opts);
  if (problem) die(problem);
  const from = opts.from === undefined ? 0 : Number(opts.from), to = opts.to === undefined ? undefined : Number(opts.to);
  const a = await source(input, 'a');
  const b = opts.vs ? await source(opts.vs, 'b') : null;
  console.log(`a: ${a.video} (${a.note})`);
  if (b) console.log(`b: ${b.video} (${b.note})`);
  const ma = measureFilm(a.video, from, to), mb = b ? measureFilm(b.video, from, to) : null;
  console.log('');
  for (const l of lookTable(ma, mb, [a.name, b?.name])) console.log(l);
  if (mb) {
    console.log('\nadvice (a is yours, b is the reference):');
    for (const l of advise(ma, mb)) console.log(`  ${l}`);
  }
}

if (isMain(import.meta.url)) {
  const argv = process.argv.slice(2);
  const flag = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
  try {
    await runLook(argv[0], { vs: flag('--vs'), from: flag('--from'), to: flag('--to') });
  } catch (e) {
    die(e.message);
  }
}
