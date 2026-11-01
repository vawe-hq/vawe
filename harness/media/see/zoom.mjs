// `vawe frame`: one region of a frame, enlarged with nearest-neighbour so every pixel stays a square, optionally beside the same region of a second film.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { drawtext, ffmpegOrDie } from '../../lib/scratch.mjs';
import { die, probeVideo, stackImages } from './core.mjs';
import { frameRgb, lumaOf } from './frame.mjs';
import { resolveInput } from './input.mjs';
import { autoBox, commonBox, FRAME_H, FRAME_W, parseBox, ZOOM_SCALE, zoomProblem } from './zoom-math.mjs';

async function film(input, label) {
  const found = await resolveInput(input);
  if (found.draftMissing) die(`no draft of ${input} yet: run bin/vawe dev ${found.page} first (it writes ${found.video}), then repeat`);
  if (found.draftOld) console.log(`note: ${found.video} is older than ${found.page}; run bin/vawe dev ${found.page} for the current page`);
  return { ...found, label, dur: probeVideo(found.video).dur };
}

/** Writes the box of `clip` at second `at`, enlarged `scale` times with nearest-neighbour, to `file`; the clip is { video, dur, label, name }. */
export function zoomCell(clip, at, box, scale, file) {
  const t = Math.max(0, Math.min(at, clip.dur - 0.03));
  const label = drawtext(`${clip.label} ${clip.name} ${at.toFixed(2)}s x${scale}`, 60);
  ffmpegOrDie(['-v', 'error', '-y', '-ss', t.toFixed(3), '-i', clip.video, '-frames:v', '1', '-vf',
    `scale=${FRAME_W}:${FRAME_H},crop=${box.w}:${box.h}:${box.x}:${box.y},scale=${box.w * scale}:${box.h * scale}:flags=neighbor,`
    + `drawtext=text='${label}':x=6:y=6:fontsize=16:fontcolor=white:box=1:boxcolor=black@0.65`, file], file, `zoom ${clip.label}`);
}

/** The --auto boxes: one box bright in both films, else each film's own best box (the note says so). */
function autoBoxes(a, b, at, atB) {
  const lumaA = lumaOf(frameRgb(a.video, at).rgb);
  if (!b) return { a: autoBox(lumaA), b: null, note: '' };
  const lumaB = lumaOf(frameRgb(b.video, atB).rgb);
  const both = commonBox(lumaA, lumaB);
  if (both) return { a: both, b: both, note: ', bright in both' };
  return { a: autoBox(lumaA), b: autoBox(lumaB), note: ': the films share no bright edge, so each side shows its own brightest region' };
}

/** Runs `vawe frame`: writes one PNG and prints its absolute path. `opts`: { at, atB, box (text), auto, scale, vs, out }. */
async function runZoom(input, opts) {
  const problem = zoomProblem({ ...opts, box: opts.box });
  if (problem) die(problem);
  const a = await film(input, 'a');
  const b = opts.vs ? await film(opts.vs, 'b') : null;
  const at = Number(opts.at);
  const atB = opts.atB === undefined ? at : Number(opts.atB);
  const boxes = opts.auto ? autoBoxes(a, b, at, atB) : { a: parseBox(opts.box), b: parseBox(opts.box), note: '' };
  if (!boxes.a || (b && !boxes.b)) die(`no bright edge in ${boxes.a ? b.video : a.video} at ${boxes.a ? atB : at} s: give --box x,y,w,h`);
  const box = boxes.a;
  const outFile = opts.out?.endsWith('.png') ? path.resolve(opts.out) : null;
  const outDir = outFile ? path.dirname(outFile) : path.resolve(opts.out ?? path.join('out', 'zoom', a.name));
  fs.mkdirSync(outDir, { recursive: true });
  const stem = `zoom-${at.toFixed(2)}-${box.x}_${box.y}_${box.w}x${box.h}x${opts.scale}${b ? `-vs-${b.name}` : ''}`.replace(/[^\w.+-]/g, '_');
  const out = outFile ?? path.join(outDir, `${stem}.png`);
  const fileA = path.join(outDir, `.${stem}-a.png`);
  zoomCell(a, at, box, opts.scale, fileA);
  if (b) {
    const fileB = path.join(outDir, `.${stem}-b.png`);
    zoomCell(b, atB, boxes.b, opts.scale, fileB);
    stackImages([fileA, fileB], out, 'h', box.w * opts.scale * 2, box.h * opts.scale);
    fs.rmSync(fileB, { force: true });
  } else {
    fs.renameSync(fileA, out);
  }
  fs.rmSync(fileA, { force: true });
  console.log(`zoom of ${a.video}${b ? ` (a, left) and ${b.video} (b, right)` : ''}: box ${box.x},${box.y},${box.w},${box.h} at ${opts.scale}x, nearest-neighbour, a at ${at.toFixed(2)} s${b ? `, b at ${atB.toFixed(2)} s` : ''}${opts.auto ? ` (box found by --auto${boxes.note})` : ''}`);
  console.log(out);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2);
  const flag = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
  try {
    await runZoom(argv[0], { at: flag('--at'), atB: flag('--at-b'), box: flag('--box'), auto: argv.includes('--auto'), scale: Number(flag('--scale', ZOOM_SCALE)), vs: flag('--vs'), out: flag('--out') });
  } catch (e) {
    die(e.message);
  }
}
