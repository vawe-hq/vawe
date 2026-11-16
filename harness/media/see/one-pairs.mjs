// The paired images of `vawe see --vs`: the same moment of both films side by side, and the same box zoomed in both.
import fs from 'node:fs';
import path from 'node:path';
import { ffmpegOrDie } from '../../lib/scratch.mjs';
import { stackImages } from './core.mjs';
import { effectBox } from './one-images.mjs';
import { zoomCell } from './zoom.mjs';

const ZOOM = 8;
const PAIR_H = 540;
const RELATIVE = [0.2, 0.5, 0.8];

/** The moments to pair: `--at` (b at `--at-b` or the same second), else the first flash of each and three relative positions. */
export function pairMoments(a, b, opts) {
  if (opts.at != null) return [{ label: `at ${opts.at} s`, ta: opts.at, tb: opts.atB ?? opts.at }];
  const out = [];
  const fa = a.look.flashes[0], fb = b.look.flashes[0];
  if (fa && fb) out.push({ label: 'first flash peak', ta: fa.peakAt, tb: fb.peakAt });
  for (const k of RELATIVE) out.push({ label: `${Math.round(k * 100)}% of the film`, ta: +(k * a.media.duration).toFixed(2), tb: +(k * b.media.duration).toFixed(2) });
  return out;
}

function half(video, t, file) {
  ffmpegOrDie(['-v', 'error', '-y', '-ss', Math.max(0, t).toFixed(3), '-i', video, '-frames:v', '1', '-vf', `scale=-2:${PAIR_H}`, file], file, 'pair frame');
}

/** Writes the pair images of every moment into `root/pairs` and returns [{ label, ta, tb, frames, zoom }]. */
export function pairImages([{ src: srcA, m: a }, { src: srcB, m: b }], root, opts, log) {
  const dir = path.join(root, 'pairs', `${srcA.hash.slice(0, 8)}-${srcB.hash.slice(0, 8)}`);
  fs.mkdirSync(dir, { recursive: true });
  const clipA = { video: srcA.video, dur: a.media.duration, label: 'a', name: srcA.name }, clipB = { video: srcB.video, dur: b.media.duration, label: 'b', name: srcB.name };
  return pairMoments(a, b, opts).map((p, i) => {
    log(`paired images ${i + 1}: ${p.label}`);
    const ta = Math.min(p.ta, a.media.duration - 0.05), tb = Math.min(p.tb, b.media.duration - 0.05);
    const fa = path.join(dir, `.a${i}.png`), fb = path.join(dir, `.b${i}.png`), frames = path.join(dir, `pair-${i + 1}-frames.png`);
    half(srcA.video, ta, fa); half(srcB.video, tb, fb);
    stackImages([fa, fb], frames, 'h', null, null);
    fs.rmSync(fa); fs.rmSync(fb);
    const box = effectBox(srcA.video, ta);
    let zoom = null;
    if (box) {
      const za = path.join(dir, `.za${i}.png`), zb = path.join(dir, `.zb${i}.png`), out = path.join(dir, `pair-${i + 1}-zoom.png`);
      zoomCell(clipA, ta, box, ZOOM, za); zoomCell(clipB, tb, box, ZOOM, zb);
      stackImages([za, zb], out, 'h', box.w * ZOOM * 2, box.h * ZOOM);
      fs.rmSync(za); fs.rmSync(zb);
      zoom = { file: out, box };
    }
    return { ...p, ta, tb, frames, zoom };
  });
}
