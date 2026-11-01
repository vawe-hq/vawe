import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ffmpegOrDie, scratch } from '../../lib/scratch.mjs';
import { motionDeltaSeries } from '../shot-detect.mjs';
import { filmKey } from '../../lib/critique-summary.mjs';


export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
export const die = (msg, code = 2) => { console.error(`✗ ${msg}`); process.exit(code); };

// ── energy: the one owner for "how much did the rendered picture actually move" ────────────────────
// Downsample motionDeltaSeries (shot-detect.mjs's per-frame YAVG-of-difference, 0-255 scale) to ~10/s:
// average |delta| in each 0.1s bucket. Exported so a caller other than this CLI (harness/dev/conform.mjs's
// `hold` claim) can measure a rendered mp4's real motion instead of reading it from this script's stdout.
export const ENERGY_HZ = 10;
export function downsample(series, hz) {
  const step = 1 / hz;
  const buckets = new Map();
  for (const p of series) {
    const k = Math.floor(p.t / step);
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k).push(p.v);
  }
  return [...buckets.keys()].sort((a, b) => a - b).map((k) => ({
    t: Number((k * step).toFixed(3)),
    v: Number((buckets.get(k).reduce((a, b2) => a + b2, 0) / buckets.get(k).length).toFixed(3)),
  }));
}
export function computeEnergy(video, hz = ENERGY_HZ) {
  return downsample(motionDeltaSeries(video), hz);
}

// Below this motionDeltaSeries value, nothing is visibly moving. Measured, not guessed: a moving 40x40
// box on a 320x180 frame never drops under 0.64 while still visibly sliding (its ease-out tail decays to
// 0 only once motion truly stops); a sting's frozen 2.0-4.3s span (mean 0.09, peak 0.35, gold-sting-v2.mp4)
// sits entirely under 0.6. 0.6 splits the two with margin on both sides.
export const HOLD_FLOOR = 0.6;
export const HOLD_MIN = 0.25; // seconds a flat run must hold to count, this CLI's own default

// ── holds: energy under floor for at least minLen ───────────────────────────────────────────────────
export function findHolds(series, floor, minLen) {
  const runs = [];
  let cur = null;
  for (const p of series) {
    if (p.v <= floor) { if (cur) cur.t1 = p.t; else cur = { t0: p.t, t1: p.t }; }
    else { if (cur) runs.push(cur); cur = null; }
  }
  if (cur) runs.push(cur);
  return runs.filter((r) => r.t1 - r.t0 >= minLen);
}

// Default outDir: quality/refs/<name>/see/ when the video already lives in a refs folder (the loop's
// own home for this reference), scratch/see/<name>/ otherwise. One rule, so a caller who omits outDir
// never has to know which.
export function defaultOutDir(video) {
  const abs = path.resolve(video);
  const m = /^(.*\/quality\/refs\/([^/]+))\//.exec(abs);
  const name = filmKey(video);
  if (m) return path.join(m[1], 'see');
  return scratch('see', name);
}

export function probeVideo(video) {
  const probe = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries',
    'stream=width,height,r_frame_rate,avg_frame_rate,duration', '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1', video], { encoding: 'utf8' });
  const fields = Object.fromEntries(String(probe.stdout).trim().split('\n').filter(Boolean)
    .map((l) => l.split('=')).map(([k, v]) => [k, v]).reverse().filter(([k, v]) => v !== 'N/A'));
  const width = +fields.width, height = +fields.height, dur = +fields.duration;
  const rate = (v) => { const m = /^(\d+)(?:\/(\d+))?$/.exec(String(v || '')); return m ? +m[1] / (m[2] ? +m[2] : 1) : 0; };
  const fps = rate(fields.avg_frame_rate) || rate(fields.r_frame_rate) || 30;
  if (!width || !height || !(dur > 0)) die(`${video} has no readable video stream. Is it a video?`);
  return { width, height, dur, fps };
}
/** One line naming both lengths when a reference and a film differ by more than two frames, else null. Pure. */
export function refSpanLine(refDur, pageDur, fps) {
  if (Math.abs(refDur - pageDur) <= 2 / fps) return null;
  return `the reference is ${refDur.toFixed(1)} s and the film ${pageDur.toFixed(1)} s`;
}
// A generated OCR frame's own pixel size (the `scale=640:-2` output, not the source video's): tesseract's
// tsv box columns are in THIS frame's pixels, so a box fraction (of frame height/width) needs this, not
// the source. Falls back to the 640x360 nominal size when no frame exists (nothing to OCR).
export function pngDims(file) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height',
    '-of', 'default=noprint_wrappers=1', file], { encoding: 'utf8' });
  const m = Object.fromEntries(String(r.stdout).trim().split('\n').filter(Boolean).map((l) => l.split('=')));
  return { width: Number(m.width) || 640, height: Number(m.height) || 360 };
}
// Same shape as study.mjs's own stackImages (lifted, not imported: study.mjs is a top-level CLI
// script, not a module of exports). A partial row/column is PADDED to the full tile grid rather than
// left its own width, or ffmpeg's vstack refuses two inputs of different widths.
export function stackImages(files, out, axis, padW, padH) {
  const pad = padW && padH ? `,pad=${padW}:${padH}:0:0:black` : '';
  if (files.length === 1) {
    ffmpegOrDie(['-v', 'error', '-y', '-i', files[0], '-vf', `null${pad}`, '-frames:v', '1', out], out, 'grid stack');
    return;
  }
  const stack = axis === 'h' ? `hstack=inputs=${files.length}` : `vstack=inputs=${files.length}`;
  ffmpegOrDie(['-v', 'error', '-y', ...files.flatMap((c) => ['-i', c]),
    '-filter_complex', `${stack}${pad}`, '-frames:v', '1', out], out, 'grid stack');
}

// Tiles `cellFiles` (already the right size, one image per panel) into <=`cellsPerGrid`-panel grids,
// 3 columns wide, via stackImages for both axes. ONE tiler: renderGrids, buildCompareGrids's stacked
// ref/draft pairs, and --dom's screenshot stills all feed it instead of each re-writing the row/grid
// loop, which is the same math regardless of how a cell's image was produced (ffmpeg -ss or a page
// screenshot).
export function tileInGrids(cellFiles, outDir, prefix, tileW, tileH, cellsPerGrid) {
  const gridPaths = [];
  for (let g = 0; g * cellsPerGrid < cellFiles.length; g++) {
    const chunk = cellFiles.slice(g * cellsPerGrid, (g + 1) * cellsPerGrid);
    const cols = Math.min(3, chunk.length);
    const rowsN = Math.ceil(chunk.length / cols);
    const rowFiles = [];
    for (let r = 0; r < rowsN; r++) {
      const rowCells = chunk.slice(r * cols, (r + 1) * cols);
      const rowOut = path.join(outDir, `.${prefix}row_${g}_${r}.png`);
      stackImages(rowCells, rowOut, 'h', tileW * cols, tileH);
      rowFiles.push(rowOut);
    }
    const gridOut = path.join(outDir, `${prefix}-${String(g + 1).padStart(2, '0')}.png`);
    stackImages(rowFiles, gridOut, 'v', null, null);
    gridPaths.push(gridOut);
    for (const f of rowFiles) fs.rmSync(f, { force: true });
  }
  return gridPaths;
}
// ── shared by --shot and --compare: bucket a computeEnergy series into fixed windows ────────────────
export function bucketMean(series, from, to, winLen) {
  const buckets = new Map();
  for (const p of series) {
    if (p.t < from || p.t >= to) continue;
    const k = Math.floor((p.t - from) / winLen);
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k).push(p.v);
  }
  const n = Math.max(0, Math.ceil((to - from) / winLen));
  return Array.from({ length: n }, (_, k) => {
    const vals = buckets.get(k) || [];
    return {
      t0: from + k * winLen, t1: Math.min(to, from + (k + 1) * winLen),
      mean: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0,
    };
  });
}

// Index-based, not accumulated (`t += step`): float drift on an accumulator (0.1 * 49 = 4.900000000000002)
// can push one extra tick past `to` that a `t < to` guard alone won't catch, which minted a spurious
// 51st sample over a clean 5.0s/10fps window and crashed a later grid on a cell that should not exist.
export function timeRange(from, to, step) {
  const n = Math.max(0, Math.floor((to - from) / step + 1e-9));
  return Array.from({ length: n }, (_, i) => Number((from + i * step).toFixed(6)));
}

// ── edge speeds: mean of a curve's first/last `frac` share, used both for a beat's own
// exit-to-entrance ratio and for --sheet-check's ref-vs-film exit comparison. `vals` is a plain array
// of energy numbers; a `{mean}`-shaped curve maps to one before calling this.
export function edgeMean(vals, frac) {
  const n = Math.max(1, Math.round(vals.length * frac));
  const head = vals.slice(0, n), tail = vals.slice(-n);
  const avg = (a) => a.reduce((s, v) => s + v, 0) / a.length;
  return { entrance: avg(head), exit: avg(tail) };
}

export function describeRatio(ratio) {
  if (!Number.isFinite(ratio) || ratio <= 0) return 'n/a';
  return ratio >= 1 ? `${ratio.toFixed(1)}x faster than the reference` : `${(1 / ratio).toFixed(1)}x slower than the reference`;
}

export function longestHold(holds) {
  return holds.reduce((m, h) => (h.t1 - h.t0 > m.len ? { len: h.t1 - h.t0, at: h.t0 } : m), { len: 0, at: 0 });
}

export function parseRange(spec) {
  const m = /^([\d.]+)-([\d.]+)$/.exec(String(spec || ''));
  if (!m) die(`bad range "${spec}": expected <from>-<to> in seconds, e.g. --shot 12-18`);
  const from = Number(m[1]), to = Number(m[2]);
  if (!(to > from)) die(`bad range "${spec}": <to> (${to}) must be greater than <from> (${from})`);
  return { from, to };
}
// Write-then-rename: a reader that opens `file` either sees the old content or the whole new one,
// never a half-written one (the same failure a compare once hit reading a half-written mp4 mid-render,
// "moov atom not found"). Cheap enough to use for every JSON this file writes.
export function writeJsonAtomic(file, data) {
  const tmp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 1) + '\n');
  fs.renameSync(tmp, file);
}
