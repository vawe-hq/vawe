// image that was never written.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

/** The base every review artifact lives under. CLAUDE_JOB_DIR keeps concurrent agents from reading
 *  each other's sheets; without it this is the OS temp dir (real path), which is what the docs and Makefile promise. */
export const scratchBase = () =>
  process.env.CLAUDE_JOB_DIR ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : fs.realpathSync(os.tmpdir());

/** Resolve a path under the scratch base and guarantee its parent directory exists. Callers pass path
 *  segments; the last one may be a file. Returns the absolute path. */
export function scratch(...parts) {
  const p = path.join(scratchBase(), ...parts);
  fs.mkdirSync(path.extname(p) ? path.dirname(p) : p, { recursive: true });
  return p;
}

/** Run ffmpeg and refuse to continue quietly. `out` is the file ffmpeg was told to produce: a zero
 *  status with no file is still a failure, and is the shape that hid here for as long as it did. */
export function ffmpegOrDie(args, out, what = 'ffmpeg') {
  const r = spawnSync('ffmpeg', args, { encoding: 'utf8' });
  if (r.error) throw new Error(`${what}: could not run ffmpeg (${r.error.message})`);
  if (r.status !== 0) throw new Error(`${what}: ffmpeg exited ${r.status}\n${(r.stderr || '').trim().slice(0, 600)}`);
  if (out && !fs.existsSync(out)) throw new Error(`${what}: ffmpeg reported success but wrote no ${out}`);
  return r;
}

/** Make a string safe for ffmpeg's drawtext: a colon or quote ends the filter argument, so strip them. */
export const drawtext = (s, max = 46) => String(s).replace(/[^\w @.,%·/+-]/g, ' ').slice(0, max);

// drawtext with no fontfile asks fontconfig for a font. macOS and Linux ffmpeg find one; a Windows ffmpeg has no fontconfig config (or crashes in it).
const WINDOWS_FONTS = ['arial.ttf', 'segoeui.ttf', 'tahoma.ttf'].map((f) => path.join(process.env.WINDIR || 'C:\\Windows', 'Fonts', f));
const fontFile = process.platform === 'win32' ? WINDOWS_FONTS.find((f) => fs.existsSync(f)) : undefined;

/** A file path as an unquoted filtergraph option value: forward slashes, and two backslashes before each colon (C\\:/x), or the drive colon ends the option. */
export const filterPath = (file) => file.replace(/\\/g, '/').replace(/:/g, '\\\\:');

/** The `fontfile=<file>:` option that starts a drawtext filter; '' leaves the font to fontconfig. */
export const drawtextFont = fontFile ? `fontfile=${filterPath(fontFile)}:` : '';
