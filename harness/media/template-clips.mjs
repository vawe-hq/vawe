// What a rendered layer clip holds, read back with ffmpeg: which frames paint anything, and whether every frame is the same picture.
// The template export drops a clip that paints nothing and turns a clip that never changes into one PNG.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

// Alpha above this, of 255, counts as painted: the edge of a glyph's antialiasing, never a rounding remainder.
const PAINTED_ALPHA = 2;

function ffmpeg(args, file) {
  const r = spawnSync('ffmpeg', ['-v', 'error', ...args], { encoding: 'utf8', maxBuffer: 1 << 28 });
  if (r.status !== 0) throw new Error(`ffmpeg could not read ${file}: ${(r.stderr || '').trim().split('\n').at(-1)}`);
  return r.stdout;
}

/** One bool per frame of an alpha clip: whether any pixel is painted. */
export function paintedFrames(file) {
  const out = ffmpeg(['-i', file, '-vf', 'alphaextract,format=gray,signalstats,metadata=print:file=-', '-f', 'null', '-'], file);
  return [...out.matchAll(/lavfi\.signalstats\.YMAX=(\d+)/g)].map(([, v]) => Number(v) > PAINTED_ALPHA);
}

/** The md5 of each decoded frame. */
export const frameHashes = (file) => ffmpeg(['-i', file, '-map', '0:v', '-f', 'framemd5', '-'], file)
  .split('\n').filter((l) => l && !l.startsWith('#')).map((l) => l.split(',').at(-1).trim());

/** Writes the first frame of `file` as a 16-bit RGBA PNG beside it, deletes `file` and returns the PNG's name. */
export function toStill(file) {
  const png = file.replace(/\.mov$/, '.png');
  ffmpeg(['-y', '-i', file, '-frames:v', '1', '-pix_fmt', 'rgba64be', png], file);
  fs.rmSync(file);
  return path.basename(png);
}

// A layer longer than this is kept as ProRes: a PNG for each frame is thousands of files and an editor scrubs one clip faster.
export const LONG_SECONDS = 20;
// A PNG sequence that is not under half the ProRes size holds photographic detail, which ProRes keeps better.
const MAX_SEQUENCE_SHARE = 0.5;

/** 'sequence' or 'prores': what a layer that moves is kept as in a light export. Pure. */
export function chooseFormat({ frames, fps, sequenceBytes, movBytes }) {
  if (frames / fps > LONG_SECONDS) return 'prores';
  return sequenceBytes <= movBytes * MAX_SEQUENCE_SHARE ? 'sequence' : 'prores';
}

/** Writes each frame of `file` as an 8-bit RGBA PNG in a folder named after it (<name>/<name>_00001.png on) and returns { dir, first, bytes }. The clip stays. */
export function toSequence(file) {
  const base = path.basename(file, '.mov');
  const dir = path.join(path.dirname(file), base);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  ffmpeg(['-y', '-i', file, '-start_number', '1', '-pix_fmt', 'rgba', path.join(dir, `${base}_%05d.png`)], file);
  const names = fs.readdirSync(dir).sort();
  return { dir, first: names[0], bytes: names.reduce((sum, n) => sum + fs.statSync(path.join(dir, n)).size, 0) };
}

/** 'empty' (no frame paints), 'still' (more than one frame, all the same picture) or 'moving'. `painted`: paintedFrames(file). */
export function clipKind(file, painted) {
  if (!painted.some(Boolean)) return 'empty';
  return painted.length > 1 && new Set(frameHashes(file)).size === 1 ? 'still' : 'moving';
}
