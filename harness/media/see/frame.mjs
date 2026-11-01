// One full-size frame of a film as raw pixels: the frame `vawe frame --auto` and `vawe see` read at 1920x1080.
import { spawnSync } from 'node:child_process';
import { FRAME_H, FRAME_W } from './zoom-math.mjs';

/** { w, h, rgb } of the frame at second `t`, scaled to 1920x1080 when the film is another size. Throws when ffmpeg returns no frame. */
export function frameRgb(video, t, w = FRAME_W, h = FRAME_H) {
  const r = spawnSync('ffmpeg', ['-v', 'error', '-ss', Math.max(0, t).toFixed(3), '-i', video, '-frames:v', '1',
    '-vf', `scale=${w}:${h}:flags=bicubic`, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 1 << 26 });
  if (r.status !== 0 || r.stdout.length < w * h * 3) throw new Error(`no frame at ${t} s of ${video}: ${String(r.stderr || '').trim().slice(0, 300)}`);
  return { w, h, rgb: r.stdout };
}

/** { data, error }: the gray frames of `video` scaled to w x h, back to back in one buffer. `t` starts at that second, `fps` resamples, `frames` stops after that many, `flags` picks the scaler. `error` is the ffmpeg message when it fails. */
export function decodeGray(video, { w, h, t, fps, frames, flags }) {
  const chain = [fps && `fps=${fps}`, `scale=${w}:${h}${flags ? `:flags=${flags}` : ''}`, 'format=gray'].filter(Boolean).join(',');
  const args = ['-v', 'error', ...(t === undefined ? [] : ['-ss', Math.max(0, t).toFixed(3)]), '-i', video, ...(frames ? ['-frames:v', String(frames)] : []), '-vf', chain, '-f', 'rawvideo', '-'];
  const r = spawnSync('ffmpeg', args, { maxBuffer: 1 << 30 });
  return r.status === 0 ? { data: r.stdout, error: null } : { data: null, error: String(r.stderr || '').trim() };
}

/** The luma plane (0 to 255) of an rgb24 buffer. */
export function lumaOf(rgb, n = rgb.length / 3) {
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) out[i] = (rgb[i * 3] * 77 + rgb[i * 3 + 1] * 150 + rgb[i * 3 + 2] * 29) >> 8;
  return out;
}
