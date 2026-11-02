// One key-frame sheet for a draft mp4: 8 evenly spaced frames plus the frame of fastest motion,
// each labelled with its film second, tiled 3 per row in one PNG. The draft render writes it next to
// the mp4 so looking at the film costs no extra command.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const EVEN = 8;
const PROBE_W = 64;
const PROBE_H = 36;
const TILE_H = 360;
const COLS = 3;

// Mean absolute difference between each frame and the one before it, on a tiny grayscale copy.
function motionPerFrame(video, fps) {
  const r = spawnSync('ffmpeg', ['-v', 'error', '-i', video, '-vf', `fps=${fps},scale=${PROBE_W}:${PROBE_H},format=gray`, '-f', 'rawvideo', '-'], { maxBuffer: 1 << 28 });
  if (r.status !== 0) throw new Error(`motion probe failed: ${String(r.stderr || '').trim()}`);
  const size = PROBE_W * PROBE_H;
  const frames = Math.floor(r.stdout.length / size);
  const motion = [0];
  for (let f = 1; f < frames; f++) {
    let sum = 0;
    for (let i = 0; i < size; i++) sum += Math.abs(r.stdout[f * size + i] - r.stdout[(f - 1) * size + i]);
    motion.push(sum / size);
  }
  return motion;
}

/** Where a draft's sheet goes: next to the mp4 as <name>.png for the default out/<film>-draft*.mp4, else <name>-sheet.png, so a --out never overwrites an author's own png. */
export function draftSheetPath(video) {
  const { dir, name } = path.parse(video);
  return path.join(dir, /-draft(-|$)/.test(name) ? `${name}.png` : `${name}-sheet.png`);
}

/** The frame numbers to show: EVEN evenly spaced ones plus the frame of fastest motion, ascending. */
export function pickFrames(motion) {
  const last = motion.length - 1;
  const picks = new Set();
  for (let k = 0; k < EVEN; k++) picks.add(Math.round((k * last) / (EVEN - 1)));
  picks.add(motion.indexOf(Math.max(...motion)));
  return [...picks].sort((a, b) => a - b);
}

/** writeDraftSheet({ video, out, fps, from }) -> { out, frames } where frames are the film seconds shown and fastest is the second of the largest frame change. */
export function writeDraftSheet({ video, out, fps, from = 0 }) {
  const motion = motionPerFrame(video, fps);
  if (motion.length < 2) throw new Error(`${video} has fewer than 2 frames`);
  const picks = pickFrames(motion);
  const select = picks.map((n) => `eq(n\\,${n})`).join('+');
  const seconds = picks.map((n) => Number((from + n / fps).toFixed(2)));
  const labels = seconds.map((t, i) => `drawtext=text='${t}s':enable='eq(n\\,${i})':x=12:y=12:fontsize=44:fontcolor=white:box=1:boxcolor=black@0.6`).join(',');
  const vf = `select='${select}',${labels},scale=-2:${TILE_H},tile=${COLS}x${Math.ceil(picks.length / COLS)}`;
  const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', video, '-vf', vf, '-vsync', '0', '-frames:v', '1', out]);
  if (r.status !== 0 || !fs.existsSync(out)) throw new Error(`draft sheet failed: ${String(r.stderr || '').trim()}`);
  return { out, frames: seconds, fastest: Number((from + motion.indexOf(Math.max(...motion)) / fps).toFixed(2)) };
}
