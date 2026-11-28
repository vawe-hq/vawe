// harness/lib/tile.mjs: lay PNG tiles into one contact sheet.
//
// The xstack + pad + fill=white graph was written twice (compare.mjs, judge.mjs) with small differences
// that were accidents rather than decisions. One implementation, so a sheet from one tool reads the same
// as a sheet from the next, and so a fix to the ffmpeg graph lands everywhere at once.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { deltaE, labOf } from './ref-measure/colour.mjs';
import { drawtextFont } from './scratch.mjs';

const ff = (a) => {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-v', 'error', '-nostdin', ...a], { encoding: 'utf8', maxBuffer: 1 << 24 });
  if (r.status === 0) return;
  const why = r.signal ? `killed by ${r.signal}` : String(r.stderr).trim().split('\n').slice(-3).join(' | ');
  throw new Error(`ffmpeg failed (${why}): ${a.filter((x) => !x.includes('pad=')).join(' ').slice(0, 300)}`);
};

// ffmpeg drawtext takes a filtergraph argument: `:` splits options and `'` closes the quote.
export const safeLabel = (s) => String(s).replace(/[:']/g, '');

// extract one frame of `src` at `t` seconds, letterboxed to tw×th on white, optionally labelled.
export function frameTile(src, t, out, { tw, th, label } = {}) {
  const vf = [`scale=${tw}:${th}:force_original_aspect_ratio=decrease`,
    `pad=${tw}:${th}:(ow-iw)/2:(oh-ih)/2:white`];
  if (label) vf.push(`drawtext=${drawtextFont}text='${safeLabel(label)}':x=10:y=10:fontsize=22:fontcolor=black:box=1:boxcolor=white@0.85:boxborderw=6`);
  // -ss AFTER -i, which is the frame-accurate seek. Before -i, ffmpeg does the fast one: it jumps to
  // the nearest KEYFRAME and decodes from there, and a draft render has sparse keyframes, so a tile
  // labelled 13.4s could be seconds off or come back blank. That is not a cosmetic difference here:
  // every sheet this builds is read BY EYE and treated as what the film does at that moment, so an
  // inaccurate seek makes the judging gate lie about the thing it exists to show. It cost a false
  // reading of two defects that were not in the film. Accurate seeking decodes from the last keyframe
  // and is slower per tile; a sheet is a handful of tiles, so the cost is invisible and the alternative
  // is a gate you cannot trust.
  const at = src.endsWith('.png') ? [] : ['-ss', Number(t).toFixed(2)];
  ff(['-y', '-i', src, ...at, '-frames:v', '1', '-vf', vf.join(','), out]);
  return out;
}

// tile PNGs into a grid. `gap` is the white gutter drawn around every tile.
export function tileGrid(tiles, { cols = 3, tw, th, gap = 2, out }) {
  if (!tiles.length) throw new Error('tileGrid: no tiles');
  const W = tw + gap * 2, H = th + gap * 2;
  const rowsN = Math.ceil(tiles.length / cols);
  // One xstack over 30+ inputs desaturates its second half (quality/refs/kinetic-promo/friction.jsonl),
  // so each row is stacked alone and the rows are joined with vstack.
  if (rowsN === 1 || tiles.length <= 12) return stackOnce(tiles, { cols, tw, th, gap, out });
  const dir = fs.mkdtempSync(path.join(path.dirname(path.resolve(out)), '.rows-'));
  try {
    const rowFiles = [];
    for (let r = 0; r < rowsN; r++) {
      const row = path.join(dir, `row${r}.png`);
      stackOnce(tiles.slice(r * cols, (r + 1) * cols), { cols, tw, th, gap, out: row });
      rowFiles.push(row);
    }
    const rowW = cols * W;
    const padded = rowFiles.map((_, i) => `[${i}:v]pad=${rowW}:${H}:0:0:white[r${i}]`).join(';');
    const chain = rowFiles.map((_, i) => `[r${i}]`).join('');
    const filter = rowFiles.length === 1 ? `${padded};[r0]null` : `${padded};${chain}vstack=inputs=${rowFiles.length}`;
    ff(['-y', ...rowFiles.flatMap((f) => ['-i', f]), '-filter_complex', filter, out]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  return out;
}

function stackOnce(tiles, { cols, tw, th, gap, out }) {
  const W = tw + gap * 2, H = th + gap * 2;
  const pads = tiles.map((_, i) => `[${i}:v]pad=${W}:${H}:${gap}:${gap}:white[p${i}]`).join(';');
  const chain = tiles.map((_, i) => `[p${i}]`).join('');
  const filter = tiles.length === 1
    ? `${pads};[p0]null`
    : `${pads};${chain}xstack=inputs=${tiles.length}:layout=${tiles.map((_, i) => `${(i % cols) * W}_${Math.floor(i / cols) * H}`).join('|')}:fill=white`;
  ff(['-y', ...tiles.flatMap((t) => ['-i', t]), '-filter_complex', filter, out]);
  return out;
}

// sampleFrames(video, span, outPrefix, size): ONE ffmpeg pass extracts span.n evenly-spaced frames of
// span.t0..span.t0+span.len as separate files (fps filter, decoding forward from a fast seek). Different
// job from frameTile: that one seeks accurately for a SINGLE judged frame (worth the cost of a fresh
// decode each time); this one wants a dense sequence, where reseeking per frame is the thing that goes
// quadratic on a draft render's sparse keyframes. A fast (pre -i) seek plus one continuous decode scales
// with the span's length, not with the sample count.
export function sampleFrames(video, span, outPrefix, size = {}) {
  const { t0, len, n } = span;
  const { tw, th, stamp } = size;
  fs.mkdirSync(path.dirname(outPrefix), { recursive: true });
  const dur = Math.max(0.05, len);
  const fps = n / dur;
  let vf = tw && th
    ? `fps=${fps},scale=${tw}:${th}:force_original_aspect_ratio=decrease,pad=${tw}:${th}:(ow-iw)/2:(oh-ih)/2:white`
    : `fps=${fps}`;
  // `stamp` is a drawtext expansion such as `f%{eif\:n+12\:d}`, burned into every extracted frame.
  if (stamp) vf += `,drawtext=${drawtextFont}text='${stamp}':x=6:y=6:fontsize=${Math.max(14, Math.round((tw || 360) / 20))}:fontcolor=black:box=1:boxcolor=white@0.85:boxborderw=4`;
  ff(['-y', '-ss', Number(t0).toFixed(3), '-t', dur.toFixed(3), '-i', video, '-vf', vf, '-frames:v', String(n), `${outPrefix}_%04d.png`]);
  return Array.from({ length: n }, (_, i) => `${outPrefix}_${String(i + 1).padStart(4, '0')}.png`)
    .filter((f) => fs.existsSync(f));
}

// blendDiff(a, b, out): ffmpeg's own difference blend between two same-size PNGs, black where they
// agree, lit where they don't. Same "one owner" reasoning as tileGrid: a second hand-rolled
// blend=all_mode=difference call is exactly the kind of duplicate this file exists to prevent.
export function blendDiff(a, b, out) {
  ff(['-y', '-i', a, '-i', b, '-filter_complex', 'blend=all_mode=difference', out]);
  return out;
}

// ssimOf(a, b): mean SSIM (ffmpeg's own "All:" figure) between two same-size PNGs, or null if ffmpeg
// printed no summary line (a size mismatch is the usual cause, and null is a fact worth keeping, not a
// zero to average away).
export function ssimOf(a, b) {
  const r = spawnSync('ffmpeg', ['-i', a, '-i', b, '-filter_complex', 'ssim', '-f', 'null', '-'], { encoding: 'utf8' });
  const m = /All:([\d.]+)/.exec(r.stderr || '');
  return m ? Number(m[1]) : null;
}

// meanColorOf(png): the whole image collapsed to one [r,g,b] (0..255), ffmpeg's own scale=1:1 doing
// the averaging. SSIM measures structure and rewards two frames agreeing on being dark; this feeds
// labDeltaE, which measures colour and brightness instead, so a black-frame beat can't hide behind it.
export function meanColorOf(png) {
  const r = spawnSync('ffmpeg', ['-v', 'error', '-i', png, '-vf', 'scale=1:1', '-frames:v', '1',
    '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 1 << 20 });
  const b = r.stdout;
  return (b && b.length >= 3) ? [b[0], b[1], b[2]] : null;
}

// labDeltaE(a, b): CIE76 distance between two 0..255 sRGB colours, converted through linear light and
// CIE XYZ (D65) to CIELAB. 0 is identical; a few units is a just-noticeable difference; 100+ is
// black-vs-white. The conversion is ref-measure/colour.mjs labOf.
export function labDeltaE(a, b) {
  if (!a || !b) return null;
  return deltaE(labOf(a), labOf(b));
}

// tile box for a given video aspect: scrutiny-sized, not thumbnails.
export const tileBox = (landscape) => (landscape ? { tw: 600, th: 338 } : { tw: 340, th: 604 });

export const baseOf = (p) => path.basename(p).replace(/\.[^.]+$/, '');

// pageRenderOf(pageHtml) -> the mp4 render-page.mjs writes for a page: the final render when it is
// newer than the draft, else the draft (harness/media/render-page.mjs defaultOut names both).
export const pageRenderOf = (pagePath) => {
  const abs = path.resolve(pagePath);
  const base = path.basename(abs, '.html');
  const name = base === 'page' ? path.basename(path.dirname(abs)) : base;
  const final = path.join('out', `${name}.mp4`), draft = path.join('out', `${name}-draft.mp4`);
  const mtime = (p) => (fs.existsSync(p) ? fs.statSync(p).mtimeMs : -1);
  return mtime(final) >= mtime(draft) ? final : draft;
};

// EXISTS IS NOT FRESH: `out/x.mp4` can be the right name for a film the author has since rewritten,
// and a consumer that checks only `existsSync` hands the author a verdict about a video that no longer
// exists, with no error, because it is simply the previous answer.
//
// mtime and not a content hash: the render is minutes of work and the page is a text file, so the
// question is only ever "was the film written after the frames were made". A hash would be exact,
// slower, and would still need a place to keep the answer, which is a second fact to go stale.
// "10228 minute(s)" is a number a reader has to convert before it means anything, and the whole point
// of the line is that it should land immediately.
const ago = (ms) => {
  const m = Math.round(ms / 60000);
  if (m < 90) return `${m} minute(s)`;
  const h = Math.round(m / 60);
  return h < 36 ? `${h} hour(s)` : `${Math.round(h / 24)} day(s)`;
};

export function gradeable(filmPath, mp4) {
  const fix = `bin/vawe dev ${filmPath}`;
  if (!fs.existsSync(mp4)) return { ok: false, why: `no rendered video at ${mp4}`, fix };
  if (!filmPath.endsWith('.html')) return { ok: true, mp4 };
  const src = fs.statSync(filmPath).mtimeMs, out = fs.statSync(mp4).mtimeMs;
  if (src > out) {
    return { ok: false, mp4,
      why: `${mp4} is ${ago(src - out)} older than ${filmPath}. It is a render of a film you have since edited`,
      fix };
  }
  return { ok: true, mp4 };
}

/** n evenly spaced sample times across a duration, each labelled with its time. */
export function evenSamples(duration, n = 6) {
  return Array.from({ length: n }, (_, i) => {
    const t = (duration * (i + 0.5)) / n;
    return { i, start: t, t, label: `@${t.toFixed(1)}s` };
  });
}
