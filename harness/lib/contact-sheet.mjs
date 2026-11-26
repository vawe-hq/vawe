// The stills of a video that a person or agent looks at: the contact sheet (one PNG grid of time-labelled tiles)
// and the full-size key frames (the settled moments of harness/lib/key-frames.mjs). The fresh judge and `vawe refs`
// build both with these functions, so our films and the reference films are seen the same way.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { sheetFps, TILE_W } from './sheet-tiles.mjs';
import { settledMoments } from './key-frames.mjs';
import { drawtextFont } from './scratch.mjs';

export const SHEET_COLS = 10;
// The sheet labels keep the macOS system Arial they always had; anywhere else, drawtextFont (a Windows font, or fontconfig's choice).
const MAC_FONT = ['/System/Library/Fonts/Supplemental/Arial.ttf', '/System/Library/Fonts/Helvetica.ttc', '/Library/Fonts/Arial.ttf'].find(fs.existsSync);
const LABEL_FONT = MAC_FONT ? `fontfile=${MAC_FONT}:` : drawtextFont;

/** The duration of a video in seconds; throws when ffprobe cannot read it. */
export function durationOf(file) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { encoding: 'utf8' });
  const d = parseFloat(r.stdout);
  if (!(d > 0)) throw new Error(`cannot read the duration of ${file}`);
  return d;
}

/** Builds <dir>/sheet.png (or `name`) for a video of `dur` seconds: { file, fps }. Throws when ffmpeg fails. */
export function contactSheet(video, dur, dir, name = 'sheet.png') {
  const fps = sheetFps(dur);
  const rows = Math.ceil(dur * fps / SHEET_COLS);
  const label = `drawtext=${LABEL_FONT}text='%{pts\\:flt}s':x=4:y=4:fontsize=20:fontcolor=white:box=1:boxcolor=black@0.7`;
  const out = path.join(dir, name);
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostdin', '-y', '-i', video, '-vf', `fps=${fps},scale=${TILE_W}:-2,${label},tile=${SHEET_COLS}x${rows}`, '-frames:v', '1', out], { encoding: 'utf8', maxBuffer: 1 << 28 });
  if (r.status !== 0 || !fs.existsSync(out)) throw new Error(`could not build the sheet: ${String(r.stderr).split('\n').slice(-4).join(' ')}`);
  return { file: out, fps };
}

const ff = (args, opts = {}) => spawnSync('ffmpeg', ['-hide_banner', '-nostdin', '-y', ...args], { encoding: opts.raw ? 'buffer' : 'utf8', maxBuffer: 1 << 28 });

/** 10 fps thumbnails: [{ t, d, spread }], d the mean change that arrives at second t, spread the grey-level spread of that frame. */
export function thumbMotion(video) {
  const W = 64, H = 36, FPS = 10, size = W * H;
  const buf = ff(['-i', video, '-vf', `fps=${FPS},scale=${W}:${H},format=gray`, '-f', 'rawvideo', '-'], { raw: true }).stdout;
  const n = Math.floor(buf.length / size);
  const motion = [];
  for (let i = 1; i < n; i++) {
    let sum = 0, mean = 0, sq = 0;
    for (let p = 0; p < size; p++) {
      const v = buf[i * size + p];
      sum += Math.abs(v - buf[(i - 1) * size + p]);
      mean += v;
      sq += v * v;
    }
    mean /= size;
    motion.push({ t: i / FPS, d: sum / size, spread: Math.sqrt(Math.max(0, sq / size - mean * mean)) });
  }
  return motion;
}

/**
 * Writes the full-size settled frames of a video into `dir` as key-<n>-<t>s.png: [{ t, file }]. `words` and `shots`
 * are the brief's tables or a measured shot list ({ start, end }); without them the film is cut into equal slices.
 */
export function keyFrameFiles(video, dur, dir, { words = [], shots = [], count = 6 } = {}) {
  const times = settledMoments({ words, shots, motion: thumbMotion(video), dur, count });
  fs.mkdirSync(dir, { recursive: true });
  return times.map((t, i) => {
    const file = path.join(dir, `key-${i + 1}-${t.toFixed(1)}s.png`);
    ff(['-ss', String(t), '-i', video, '-frames:v', '1', file]);
    return { t, file };
  }).filter((k) => fs.existsSync(k.file));
}
