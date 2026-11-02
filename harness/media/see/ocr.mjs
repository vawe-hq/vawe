import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ffmpegOrDie, drawtext } from '../../lib/scratch.mjs';
import { detectCuts } from '../shot-detect.mjs';
import { trackWords } from '../../lib/ref-measure/words.mjs';
import { EASINGS } from '../../../core/motion/easings.js';
import { computeEnergy, defaultOutDir, die, edgeMean, ENERGY_HZ, findHolds, HOLD_FLOOR, HOLD_MIN, pngDims, probeVideo, ROOT, tileInGrids, writeJsonAtomic } from './core.mjs';


// tesseract's own tsv -> [{text, box}], box a FRACTION of the frame this tsv was run on. Pulled out of
// ocrWords so the adaptive per-timestamp tracker below (wordTracks) runs the exact same parse on a
// single extracted frame, never a second hand-rolled tsv reader that could drift from this one.
export function parseTesseractTsv(tsv, minConf, minLen, frameW, frameH, alnum = false) {
  const words = [];
  for (const line of tsv.split('\n').slice(1)) {
    const cols = line.split('\t');
    if (cols.length < 12) continue;
    const conf = Number(cols[10]), text = (cols[11] || '').trim();
    if (conf >= minConf && text.length >= minLen && (alnum ? /[a-zA-Z0-9]/ : /[a-zA-Z]/).test(text)) {
      const left = Number(cols[6]), top = Number(cols[7]), w = Number(cols[8]), h = Number(cols[9]);
      words.push({ text, conf, px: { cx: left + w / 2, cy: top + h / 2, w, h },
        box: { hFrac: h / frameH, wFrac: w / frameW, cxFrac: (left + w / 2) / frameW, cyFrac: (top + h / 2) / frameH } });
    }
  }
  return words;
}

export function ocrOneFrame(src, base, minConf, minLen, frameW, frameH) {
  // One retry: a non-zero exit right after ffmpeg wrote the frame is cheaper to retry once than to
  // silently read as "no text in this frame" (the failure mode before this: an empty tsv either way).
  // Leptonica 1.86 rewrites any path under /tmp to its own temp dir and then finds no file: pass the
  // real path (/private/tmp on macOS), or every frame reads as "no text" with no error.
  const args = [fs.realpathSync(src), path.join(fs.realpathSync(path.dirname(base)), path.basename(base)), '--psm', '11', 'tsv'];
  let r = spawnSync('tesseract', args, { encoding: 'utf8' });
  if (r.status !== 0) r = spawnSync('tesseract', args, { encoding: 'utf8' });
  const tsv = fs.existsSync(`${base}.tsv`) ? fs.readFileSync(`${base}.tsv`, 'utf8') : '';
  return parseTesseractTsv(tsv, minConf, minLen, frameW, frameH);
}

/**
 * ocrOneFrame for many frames at once: tesseract runs `jobs` processes at a time (one thread each), then any frame without a tsv is read again alone.
 * `frames` is [{ src, base }]; the result lists the words of each frame in order.
 */
export function ocrFrames(frames, minConf, minLen, frameW, frameH, jobs = Math.max(1, os.cpus().length - 1)) {
  const real = frames.map((f) => ({ src: fs.realpathSync(f.src), base: path.join(fs.realpathSync(path.dirname(f.base)), path.basename(f.base)) }));
  spawnSync('xargs', ['-0', '-n', '2', '-P', String(jobs), 'sh', '-c', 'tesseract "$0" "$1" --psm 11 tsv >/dev/null 2>&1'],
    { input: real.flatMap((f) => [f.src, f.base]).join('\0') + '\0', env: { ...process.env, OMP_THREAD_LIMIT: '1' } });
  return frames.map((f, i) => (fs.existsSync(`${real[i].base}.tsv`)
    ? parseTesseractTsv(fs.readFileSync(`${real[i].base}.tsv`, 'utf8'), minConf, minLen, frameW, frameH)
    : ocrOneFrame(f.src, f.base, minConf, minLen, frameW, frameH)));
}

// ── OCR: tesseract on downscaled frames at ocrFps, psm 11 (sparse text, no layout) ─────────────────
// Each surviving word also carries `box`: its own average height/width/centre as a FRACTION of the
// frame, the input the type-scale/placement check (textScaleCheck below) needs to say a headline reads
// smaller or sits lower than the reference, not just that different words were seen. `samples` keeps
// every raw {t, box} the run was built from (not only the averaged `box`): a word that grows or moves
// while it is on screen needs its box AT A GIVEN MOMENT, not one number smeared across its whole run
// (textScaleCheck below reads `samples`, never the averaged `box`, for exactly this reason).
export function ocrWords(video, outDir, ocrFps, minConf, minLen) {
  const ocrDir = path.join(outDir, '.ocr');
  fs.mkdirSync(ocrDir, { recursive: true });
  const framesGlob = path.join(ocrDir, 'f_%05d.png');
  ffmpegOrDie(['-v', 'error', '-y', '-i', video, '-vf', `fps=${ocrFps},scale=640:-2`, framesGlob],
    null, 'ocr frame extraction');
  const files = fs.readdirSync(ocrDir).filter((f) => f.endsWith('.png')).sort();
  const { width: frameW, height: frameH } = files.length ? pngDims(path.join(ocrDir, files[0])) : { width: 640, height: 360 };
  const perFrame = files.map((f, i) => {
    const t = i / ocrFps;
    const base = path.join(ocrDir, `f_${String(i + 1).padStart(5, '0')}`);
    const src = path.join(ocrDir, f);
    return { t, words: ocrOneFrame(src, base, minConf, minLen, frameW, frameH) };
  });
  fs.rmSync(ocrDir, { recursive: true, force: true });
  // One entry per APPEARANCE (words/tracker in lib/ref-measure/words.mjs): a repeated word keeps every
  // appearance and two copies on screen at once stay two. tIn/tOut are the first/last sample, `box` its
  // average geometry (a FRACTION of the frame, for callers that want one number), `samples` the raw
  // {t, box} list a matched-moment lookup needs.
  const avgBox = (boxes) => ({
    hFrac: boxes.reduce((s, b) => s + b.hFrac, 0) / boxes.length,
    wFrac: boxes.reduce((s, b) => s + b.wFrac, 0) / boxes.length,
    cxFrac: boxes.reduce((s, b) => s + b.cxFrac, 0) / boxes.length,
    cyFrac: boxes.reduce((s, b) => s + b.cyFrac, 0) / boxes.length,
  });
  const sampled = perFrame.map((f) => ({ t: f.t, words: f.words.map((w) => ({ text: w.text, conf: w.conf, ...w.px, box: w.box })) }));
  return trackWords(sampled, ocrFps).filter((a) => a.samples.length >= 2)
    .map((a) => ({ text: a.text, tIn: Number(a.t0.toFixed(2)), tOut: Number(a.t1.toFixed(2)),
      box: avgBox(a.samples.map((s) => s.box)), samples: a.samples.map((s) => ({ t: s.t, box: s.box })) }));
}
export function easeProgressCurve(vals) {
  const cum = [];
  let acc = 0;
  for (const v of vals) { acc += v; cum.push(acc); }
  const total = cum[cum.length - 1] || 1;
  return cum.map((c) => c / total);
}
export function fitEase(progress) {
  const n = progress.length;
  if (n < 3) return { name: null, rmse: null };
  let best = null;
  for (const [name, fn] of Object.entries(EASINGS)) {
    let sq = 0;
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1);
      const expect = fn(u);
      sq += (progress[i] - expect) ** 2;
    }
    const rmse = Math.sqrt(sq / n);
    if (!best || rmse < best.rmse) best = { name, rmse: Number(rmse.toFixed(4)) };
  }
  return best;
}

// ── beats: spans between cuts, holds, AND caption changes ──────────────────────────────────────────
// A caption swap is usually a soft crossfade, not a hard cut, so ffmpeg's scene score barely moves for
// it (measured on the kinetic-typography reference this tool was built against: 4 scene cuts, but 11
// readable beats driven mostly by on-screen text changing). OCR's own word onsets are the only signal
// that catches those, so every new word's first-seen time is a candidate split too.
export function buildBeats(cutTimes, holds, ocr, energy, dur) {
  const wordOnsets = [...ocr.map((w) => w.tIn)].sort((a, b) => a - b)
    .reduce((acc, t) => (acc.length && t - acc[acc.length - 1] < 0.5 ? acc : [...acc, t]), []);
  // Two candidate boundaries within MIN_SHOT of each other are the same moment measured two ways (a
  // hold's own edge sits right where the clip cuts): the MORE EXACT signal wins, same priority order as
  // shot-detect.mjs's mergeJoints (cut > everything else), extended with hold-edge and word-onset.
  const MIN_SHOT = 0.4;
  const boundaryCandidates = [
    ...cutTimes.map((t) => ({ t, pri: 0 })),
    ...holds.flatMap((h) => [{ t: h.t0, pri: 1 }, { t: h.t1, pri: 1 }]),
    ...wordOnsets.map((t) => ({ t, pri: 2 })),
  ].sort((a, b) => a.t - b.t);
  const mergedBoundaries = [];
  for (const c of boundaryCandidates) {
    const prev = mergedBoundaries[mergedBoundaries.length - 1];
    if (prev && c.t - prev.t < MIN_SHOT) { if (c.pri < prev.pri) mergedBoundaries[mergedBoundaries.length - 1] = c; continue; }
    mergedBoundaries.push({ ...c });
  }
  const splitPoints = [0, ...mergedBoundaries.map((b) => b.t), dur]
    .filter((t, i, a) => i === 0 || t - a[i - 1] >= 0.05);
  const rawBeats = [];
  for (let i = 0; i < splitPoints.length - 1; i++) {
    const t0 = splitPoints[i], t1 = splitPoints[i + 1];
    if (t1 - t0 > 0.05) rawBeats.push({ t0, t1 });
  }

  return rawBeats.map((b) => {
    const inWindow = energy.filter((p) => p.t >= b.t0 && p.t < b.t1);
    const vals = inWindow.map((p) => p.v);
    const meanSpeed = vals.length ? Number((vals.reduce((a, c) => a + c, 0) / vals.length).toFixed(2)) : 0;
    const peak = vals.length ? Math.max(...vals) : 0;
    const peakIdx = vals.indexOf(peak);
    const peakT = peakIdx >= 0 ? inWindow[peakIdx].t : b.t0;
    const progress = easeProgressCurve(vals.length ? vals : [0]);
    const fit = fitEase(progress);
    const words = ocr.filter((w) => w.tIn >= b.t0 && w.tIn < b.t1);
    // How often something visibly changes (share of samples above HOLD_FLOOR), and the exit-to-entrance
    // speed ratio (last 20% of the beat's energy over its first 20%): a beat that enters fast and dies
    // slow reads as unfinished motion, and neither number was visible before this.
    const changeRate = vals.length ? Number((vals.filter((v) => v > HOLD_FLOOR).length / vals.length).toFixed(2)) : 0;
    const edge = edgeMean(vals.length ? vals : [0], 0.2);
    const exitEntryRatio = edge.entrance > 1e-6 ? Number((edge.exit / edge.entrance).toFixed(2)) : null;
    return {
      t0: Number(b.t0.toFixed(2)), t1: Number(b.t1.toFixed(2)),
      meanSpeed, peak: Number(peak.toFixed(2)), peakT: Number(peakT.toFixed(2)),
      ease: fit.name, easeRmse: fit.rmse, changeRate, exitEntryRatio, words,
    };
  });
}

// ── frame choice: cut frames, each hold's settle frame, each beat's peak, budget-capped, deduped ───
export function pickFrames(cutTimes, holds, beats, dur, budget) {
  const minGap = Math.max(0.15, dur / (budget * 4));
  const cands = [
    ...cutTimes.map((t) => ({ t, tag: 'cut' })),
    ...holds.map((h) => ({ t: Math.min(h.t1, dur - 0.01), tag: 'hold' })),
    ...beats.map((b) => ({ t: b.peakT, tag: 'peak' })),
  ].sort((a, b) => a.t - b.t);
  const picked = [];
  for (const c of cands) {
    if (picked.length >= budget) break;
    if (picked.every((p) => Math.abs(p.t - c.t) >= minGap)) picked.push(c);
  }
  if (picked.length === 0) picked.push({ t: 0, tag: 'start' });
  return picked.sort((a, b) => a.t - b.t);
}
// ── grids: 3x3, <=9 panels, 1568px long edge ────────────────────────────────────────────────────
export function renderGrids(video, outDir, chosen, width, height, dur) {
  const GRID_CELLS = 9;
  const longEdge = 1568;
  const tileW = Math.floor(longEdge / 3);
  const tileH = Math.round((tileW * height) / width);
  const cellFiles = chosen.map((c, i) => {
    const t = Math.max(0, Math.min(c.t, dur - 0.03));
    const out = path.join(outDir, `.cell_${i}.png`);
    const label = c.tag ? `${c.tag} ${t.toFixed(2)}s` : `${t.toFixed(2)}s`;
    ffmpegOrDie(['-v', 'error', '-y', '-ss', t.toFixed(3), '-i', video, '-frames:v', '1', '-vf',
      `scale=${tileW}:${tileH},drawtext=text='${drawtext(label)}':x=6:y=6:fontsize=16:fontcolor=white:box=1:boxcolor=black@0.65`,
      out], out, `grid cell ${i}`);
    return out;
  });
  const gridPaths = tileInGrids(cellFiles, outDir, 'grid', tileW, tileH, GRID_CELLS);
  for (const f of cellFiles) fs.rmSync(f, { force: true });
  return gridPaths;
}
export function writeOutputs({ outDir, video, dur, fps, cutTimes, energy, holds, beats, gridPaths }) {
  const motion = {
    dur: Number(dur.toFixed(2)), fps: Number(fps.toFixed(3)),
    cuts: cutTimes.map((t) => Number(t.toFixed(2))),
    energy: { fps: ENERGY_HZ, values: energy.map((p) => p.v) },
    holds: holds.map((h) => ({ t0: Number(h.t0.toFixed(2)), t1: Number(h.t1.toFixed(2)) })),
    beats,
  };
  writeJsonAtomic(path.join(outDir, 'motion.json'), motion);

  const tokenEstimate = gridPaths.length * 1568 + 400;
  const beatRows = beats.map((b) => {
    const hs = holds.filter((h) => h.t0 >= b.t0 && h.t1 <= b.t1)
      .map((h) => `${h.t0.toFixed(1)}-${h.t1.toFixed(1)}`).join(', ') || '-';
    const ws = b.words.map((w) => `"${w.text}"@${w.tIn}s`).join(', ') || '-';
    return `| ${b.t0}-${b.t1} | ${b.meanSpeed} | ${b.peak} | ${b.changeRate} | ${b.exitEntryRatio ?? '-'} | ${b.ease ?? '-'} (rmse ${b.easeRmse ?? '-'}) | ${hs} | ${ws} |`;
  }).join('\n');

  const index = `# see: ${path.basename(video)}

${dur.toFixed(1)}s, ${fps.toFixed(1)}fps, ${cutTimes.length} cut(s), ${holds.length} hold(s).

## Beats

| span (s) | mean speed | peak speed | change rate | exit:entrance | ease | holds | OCR words |
|---|---|---|---|---|---|---|---|
${beatRows}

## Grids

${gridPaths.map((p) => `- ${path.relative(ROOT, p)}`).join('\n')}

Panels are chronological, left to right, top to bottom.

Token estimate: ${gridPaths.length} grid(s) x ~1568 + text ≈ ${tokenEstimate} tokens.

OCR is a hint (tesseract on downscaled frames, words >=3 chars, conf >=60): it can miss or garble
text. The grids are the truth; look at them before trusting a beat's word list.
`;
  fs.writeFileSync(path.join(outDir, 'index.md'), index);
  console.log(`✓ see: ${beats.length} beat(s), ${gridPaths.length} grid(s), ~${tokenEstimate} tokens -> ${path.relative(ROOT, outDir)}/index.md`);
}
export function runFullFlow(video, positional, flag) {
  if (spawnSync('tesseract', ['-version'], { encoding: 'utf8' }).error)
    die('tesseract is not on PATH. see.mjs needs it for the full flow (--shot/--compare do not); install and re-run.');

  const framesBudget = Number(flag('--frames', 12));
  const holdFloor = Number(flag('--hold-floor', HOLD_FLOOR));
  const holdMin = Number(flag('--hold-min', HOLD_MIN));
  const ocrFps = Number(flag('--ocr-fps', 4));
  const ocrMinConf = Number(flag('--ocr-conf', 60));
  const ocrMinLen = 3;

  const outDir = path.resolve(positional[1] || defaultOutDir(video));
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  const { width, height, dur, fps } = probeVideo(video);

  const { cuts } = detectCuts(video, outDir, 0.3, 0.4);
  const cutTimes = cuts.map((c) => c.t);
  const energy = computeEnergy(video, ENERGY_HZ);
  const holds = findHolds(energy, holdFloor, holdMin);

  const ocr = ocrWords(video, outDir, ocrFps, ocrMinConf, ocrMinLen);
  const beats = buildBeats(cutTimes, holds, ocr, energy, dur);
  const chosen = pickFrames(cutTimes, holds, beats, dur, framesBudget);
  const gridPaths = renderGrids(video, outDir, chosen, width, height, dur);

  writeOutputs({ outDir, video, dur, fps, cutTimes, energy, holds, beats, gridPaths });
}
