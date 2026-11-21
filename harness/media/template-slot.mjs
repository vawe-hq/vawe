// Puts a person's picture or clip into a template's media slot: the engine resizes it to the slot's size and crops from the centre, so
// the page keeps loading the same relative path. ffmpeg runs here, never in a caller.
import fs from 'node:fs';
import path from 'node:path';
import { ffmpegOrDie } from '../lib/scratch.mjs';
import { probe, GOP } from './footage.mjs';
import { parseSize } from '../lib/template-slots.mjs';

/** The scale-and-crop filter: cover the box, then cut the overflow evenly from both sides. */
export const coverFilter = ({ width, height }) => `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height}`;

const OUT_ARGS = { png: [], jpg: ['-q:v', '2'], jpeg: ['-q:v', '2'], webp: ['-quality', '90'] };

function fitImage(src, dest, size) {
  const ext = path.extname(dest).slice(1).toLowerCase();
  ffmpegOrDie(['-v', 'error', '-y', '-i', src, '-vf', coverFilter(size), '-frames:v', '1', ...(OUT_ARGS[ext] ?? []), dest], dest, 'slot image');
}

/** The input flags that loop a clip shorter than `span` and the output flags that cut it at `span`. */
export function spanArgs(seconds, span) {
  if (!span) return { input: [], output: [] };
  return { input: seconds < span ? ['-stream_loop', '-1'] : [], output: ['-t', String(span)] };
}

function fitVideo(src, dest, size, span) {
  const { seconds } = probe(src);
  const { input, output } = spanArgs(seconds, span);
  const args = ['-v', 'error', '-y', ...input, '-i', src, '-vf', `${coverFilter(size)},format=yuv420p`, ...output, '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-g', String(GOP), '-movflags', '+faststart', dest];
  ffmpegOrDie(args, dest, 'slot video');
}

/** Writes `file` into `film` at the slot's `file` path, fitted to the slot's size (and, for a video, to its `span` seconds). */
export function fillSlot(filmDir, { slot, path: file }) {
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) throw new Error(`slot ${slot.key}: no such file ${file}`);
  const dest = path.join(filmDir, slot.file);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const size = parseSize(slot.size);
  if (slot.kind === 'image') fitImage(file, dest, size);
  else fitVideo(file, dest, size, slot.span);
  return dest;
}
