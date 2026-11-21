// The poster of a film: one key frame as a 1280 wide webp, the image a template card and a share link show.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pageStill } from './still.mjs';
import { readPageMeta } from './render-page.mjs';
import { resolveDuration } from './page-duration.mjs';
import { ffmpegOrDie } from '../lib/scratch.mjs';

export const POSTER_WIDTH = 1280;
// With no `spectacle` meta the poster is the frame at this share of the film: past the entrance, before the end card.
const DEFAULT_SHARE = 0.6;

/** The second of the poster: the page's `spectacle` meta when it is a number inside the film, else 60% of the length. Pure. */
export function posterTime(spectacle, duration) {
  const s = spectacle == null || String(spectacle).trim() === '' ? NaN : Number(spectacle);
  return Number.isFinite(s) && s >= 0 && s < duration ? s : +(duration * DEFAULT_SHARE).toFixed(2);
}

/** Writes the poster of `pagePath` to `dest` (a .webp) and returns { at, dest }. `at` overrides the second. */
export async function writePoster(pagePath, dest, { at } = {}) {
  const duration = await resolveDuration(pagePath);
  const second = at ?? posterTime(readPageMeta(pagePath, 'spectacle'), duration);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vawe-poster-'));
  try {
    const png = path.join(dir, 'frame.png');
    await pageStill(pagePath, second, png);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    ffmpegOrDie(['-v', 'error', '-y', '-i', png, '-vf', `scale=${POSTER_WIDTH}:-2`, '-quality', '82', dest], dest, 'poster');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  return { at: second, dest };
}
