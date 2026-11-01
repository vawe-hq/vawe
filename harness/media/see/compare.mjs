import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ffmpegOrDie, drawtext } from '../../lib/scratch.mjs';
import { bucketMean, computeEnergy, describeRatio, die, edgeMean, findHolds, HOLD_FLOOR, HOLD_MIN, longestHold, probeVideo, refSpanLine, ROOT, stackImages, tileInGrids, timeRange, writeJsonAtomic } from './core.mjs';
import { renderGrids } from './ocr.mjs';
import { runWordEventCompare } from './words.mjs';
import { compareFrames } from '../compare-frames.mjs';
import { approveProblem, fullDraftPath } from '../../lib/approval.mjs';


// ── --shot <from>-<to>: a dense strip of ONE window, plus its motion curve ──────────────────────────
// `opts.energy` is an already computed series (a caller with many windows of one video measures it once); `opts.quiet` skips the summary line.
export function runShot(video, outDirRoot, from, to, fps, opts = {}) {
  const { width, height, dur } = probeVideo(video);
  if (from >= dur) die(`--shot ${from}-${to}: from (${from}s) is past ${video}'s duration (${dur.toFixed(2)}s)`);
  const clampedTo = Math.min(to, dur);
  const outDir = path.join(outDirRoot, `shot-${from}-${to}`);
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  const chosen = timeRange(from, clampedTo, 1 / fps).map((t) => ({ t, tag: '' }));
  const gridPaths = renderGrids(video, outDir, chosen, width, height, dur);

  const energy = (opts.energy ?? computeEnergy(video)).filter((p) => p.t >= from && p.t < clampedTo);
  const curve = bucketMean(energy, from, clampedTo, 0.5)
    .map((w) => ({ t0: Number(w.t0.toFixed(2)), t1: Number(w.t1.toFixed(2)), mean: Number(w.mean.toFixed(3)) }));

  writeJsonAtomic(path.join(outDir, 'motion.json'), { video, from, to: clampedTo, fps, curve });

  const rows = curve.map((w) => `| ${w.t0.toFixed(2)}-${w.t1.toFixed(2)}s | ${w.mean.toFixed(2)} |`).join('\n');
  const index = `# see --shot: ${path.basename(video)} ${from}-${clampedTo}s

${gridPaths.length} grid(s) at ${fps}fps, 1568px long edge, chronological.

## Grids

${gridPaths.map((p) => `- ${path.relative(ROOT, p)}`).join('\n')}

## Motion (0.5s windows)

| window | mean energy |
|---|---|
${rows}
`;
  fs.writeFileSync(path.join(outDir, 'index.md'), index);
  if (!opts.quiet) console.log(`✓ shot ${from}-${clampedTo}s: ${gridPaths.length} grid(s) at ${fps}fps -> ${path.relative(ROOT, outDir)}/index.md`);
  return { gridPaths, outDir, to: clampedTo };
}

// ── --compare <draft.mp4>: reference vs draft at the SAME timestamps ────────────────────────────────
// Side-by-side grids (reference top, draft bottom, every 0.25s) tiled 3x2, plus a per-0.5s energy
// table that marks a window "too still" when the draft's energy is under half the reference's: the
// same HOLD_FLOOR/computeEnergy this file's own `see` flow and conform.mjs's `hold` claim both read.
export function compareCell(clip, t, outDir, tag, tileW, tileH) {
  const at = Math.max(0, Math.min(t, clip.dur - 0.03));
  const out = path.join(outDir, `.${tag}.png`);
  ffmpegOrDie(['-v', 'error', '-y', '-ss', at.toFixed(3), '-i', clip.path, '-frames:v', '1', '-vf',
    `scale=${tileW}:${tileH},drawtext=text='${drawtext(`${clip.label} ${t.toFixed(2)}s`)}':x=6:y=6:fontsize=14:fontcolor=white:box=1:boxcolor=black@0.65`,
    out], out, `compare ${tag} cell`);
  return out;
}

export function buildCompareGrids(ref, draft, outDir, window, dims) {
  const CELLS_PER_GRID = 6; // 3x2
  const longEdge = 1568;
  const tileW = Math.floor(longEdge / 3);
  const tileH = Math.round((tileW * dims.height) / dims.width);
  const times = timeRange(window.from, window.to, 0.25);
  const pairFiles = times.map((t, i) => {
    const refCell = compareCell(ref, t, outDir, `ref_${i}`, tileW, tileH);
    const draftCell = compareCell(draft, t, outDir, `draft_${i}`, tileW, tileH);
    const pairOut = path.join(outDir, `.pair_${i}.png`);
    stackImages([refCell, draftCell], pairOut, 'v', tileW, tileH * 2);
    fs.rmSync(refCell, { force: true }); fs.rmSync(draftCell, { force: true });
    return pairOut;
  });
  const gridPaths = tileInGrids(pairFiles, outDir, 'side', tileW, tileH * 2, CELLS_PER_GRID);
  for (const f of pairFiles) fs.rmSync(f, { force: true });
  return gridPaths;
}

export function runCompare(refPath, draftPath, outDirRoot, fromArg, toArg, words = false) {
  const refP = probeVideo(refPath);
  const draftP = probeVideo(draftPath);
  const from = fromArg != null ? fromArg : 0;
  const to = toArg != null ? toArg : Math.min(refP.dur, draftP.dur);
  if (!(to > from)) die(`--compare: bad window ${from}-${to}`);
  const clampedTo = Math.min(to, refP.dur, draftP.dur);

  const outDir = path.join(outDirRoot, 'compare');
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  const width = Math.min(refP.width, draftP.width);
  const height = Math.round((width * refP.height) / refP.width);
  const ref = { path: refPath, dur: refP.dur, label: 'ref' };
  const draft = { path: draftPath, dur: draftP.dur, label: 'draft' };
  const gridPaths = buildCompareGrids(ref, draft, outDir, { from, to: clampedTo }, { width, height });

  const refEnergy = computeEnergy(refPath).filter((p) => p.t >= from && p.t < clampedTo);
  const draftEnergy = computeEnergy(draftPath).filter((p) => p.t >= from && p.t < clampedTo);
  const refCurve = bucketMean(refEnergy, from, clampedTo, 0.5);
  const draftCurve = bucketMean(draftEnergy, from, clampedTo, 0.5);
  // Required-motion-match's own diff (window ratio + peak/exit speed + a numeric hint per failing
  // window), the same one --dom --ref and --sheet-check run: one owner for "is the motion close
  // enough", not a second bespoke tooStill calc living only here.
  const { rows, tooStillWindows, tooBusyWindows, ok, peakRatio, exitRatio } = sheetCheck({ curve: refCurve }, { curve: draftCurve });

  const refHolds = findHolds(refEnergy, HOLD_FLOOR, HOLD_MIN);
  const draftHolds = findHolds(draftEnergy, HOLD_FLOOR, HOLD_MIN);
  const refLongest = longestHold(refHolds);
  const draftLongest = longestHold(draftHolds);

  const tableRows = rows.map((r) => `| ${r.t0.toFixed(2)}-${r.t1.toFixed(2)}s | ${r.refMean.toFixed(2)} `
    + `| ${r.filmMean.toFixed(2)} |${r.tooStill ? ' <- too still' : r.tooBusy ? ' <- too busy' : ''} |`).join('\n');
  const lines = [
    `# see --compare: ${path.basename(refPath)} vs ${path.basename(draftPath)}`, '',
    `window ${from}-${clampedTo}s · ${gridPaths.length} grid(s) every 0.25s, reference top, draft bottom.`, '',
    '| window | ref energy | draft energy | |', '|---|---|---|---|', tableRows, '',
    `ref longest still span: ${refLongest.len.toFixed(2)}s at ${refLongest.at.toFixed(2)}s`,
    `draft longest still span: ${draftLongest.len.toFixed(2)}s at ${draftLongest.at.toFixed(2)}s`, '',
    '## Grids', '', ...gridPaths.map((p) => `- ${path.relative(ROOT, p)}`),
  ];
  fs.writeFileSync(path.join(outDir, 'compare.md'), `${lines.join('\n')}\n`);
  writeJsonAtomic(path.join(outDir, 'motion.json'), {
    ref: refPath, draft: draftPath, from, to: clampedTo,
    windows: rows.map((r) => ({ t0: Number(r.t0.toFixed(2)), t1: Number(r.t1.toFixed(2)),
      refMean: Number(r.refMean.toFixed(3)), draftMean: Number(r.filmMean.toFixed(3)), tooStill: r.tooStill, tooBusy: r.tooBusy })),
    refLongestStill: refLongest, draftLongestStill: draftLongest, peakRatio, exitRatio,
  });

  console.log(`\n  COMPARE · ${path.basename(refPath)} vs ${path.basename(draftPath)}, ${from}-${clampedTo}s\n`);
  for (const r of rows)
    console.log(`  ${r.t0.toFixed(2)}-${r.t1.toFixed(2)}s  ref ${r.refMean.toFixed(2)}  draft ${r.filmMean.toFixed(2)}${r.tooStill ? '  <- too still' : r.tooBusy ? '  <- too busy' : ''}`);
  console.log(`\n  ✓ wrote ${path.relative(ROOT, path.join(outDir, 'compare.md'))}`);
  if (tooStillWindows.length || tooBusyWindows.length) {
    if (tooStillWindows.length) {
      console.log(`  next: fix motion in ${tooStillWindows.length} window(s) marked "too still":`);
      for (const r of tooStillWindows) console.log(`    - ${r.hint}`);
    }
    if (tooBusyWindows.length) {
      console.log(`  next: fix motion in ${tooBusyWindows.length} window(s) marked "too busy":`);
      for (const r of tooBusyWindows) console.log(`    - ${r.hint}`);
    }
  } else {
    console.log('  next: draft matches the reference\'s motion in every window; proceed to the next post-draft step.');
  }

  // `--words` (opt-in: adaptive OCR is not free): the per-word entrance/highlight/exit/star check, on
  // the SAME two clips this function already has open, never a third render.
  const wordsOk = words ? runWordEventCompare(refPath, draftPath, outDir, from, clampedTo, `${path.basename(refPath)} vs ${path.basename(draftPath)}`) : true;

  const overallOk = ok && wordsOk;
  // Reports, does not block by default (a gate blocks only with --strict or through a caller that
  // opts in, e.g. runRequiredMotionMatch below). `ok` is returned so that caller can refuse.
  return { ok: overallOk, tooStillWindows, tooBusyWindows, peakRatio, exitRatio, wordsOk };
}
// Required-motion-match thresholds: a BAND, not a floor alone. Under HALF the reference reads
// "tooStill" (--compare's original rule, now also applied to peak and exit speed); over TWICE the
// reference reads "tooBusy": a film passed the floor-only check with windows sitting at 4x the
// reference because several glows pulsed at once, everywhere, all at once, reading as noise rather
// than the reference's one deliberate move. Both ends fail `ok`.
export const MATCH_FLOOR = 0.5;
export const BUSY_CEIL = 2;

// Qualitative read of a raw energy number, for a hint a person can act on without knowing this file's
// own units. Bucketed off measured values already on record in this file: sting's frozen span reads
// ~0.1, HOLD_FLOOR is 0.6 (nothing visibly moving below it), a full-frame flash/sweep reads 8+.
export function describeEnergy(v) {
  if (v >= 6) return 'a full-frame flash and sweep';
  if (v >= 2) return 'broad movement across the frame';
  if (v >= HOLD_FLOOR) return 'movement across part of the frame';
  return 'almost nothing moving';
}

// One line, per failing window, built from the numbers this run actually measured: never canned text.
// `filmArea` (0-1, tracked-element box area / frame area) only exists on a `--dom` curve; the mp4-vs-mp4
// path (no DOM to read boxes from) falls back to describing the film side by its energy number alone.
export function windowHint(row, isEdgeWindow) {
  const refDesc = describeEnergy(row.refMean);
  const filmDesc = row.area == null ? describeEnergy(row.filmMean)
    : row.area < 0.15 ? 'in a small area' : row.area < 0.4 ? 'across part of the frame' : 'across most of the frame';
  const actions = [];
  if (row.area != null && row.area < 0.15) actions.push('enlarge the moving area');
  actions.push(isEdgeWindow ? 'speed up the exit' : 'speed up the motion');
  const advice = actions.join(' and ');
  return `${row.t0.toFixed(1)}-${row.t1.toFixed(1)}s: reference moves ${row.refMean.toFixed(1)} ${refDesc}; `
    + `yours ${row.filmMean.toFixed(1)} ${filmDesc}. ${advice[0].toUpperCase()}${advice.slice(1)}.`;
}

// The other end of the band: a window moving MORE than BUSY_CEIL times the reference. Worded the same
// way as windowHint (both sides' numbers, no canned text), but the fix is the opposite direction: this
// window is not too weak, it is too loud, usually several things pulsing/glowing at once where the
// reference commits to one.
export function busyHint(row) {
  const refDesc = describeEnergy(row.refMean);
  const filmDesc = row.area == null ? describeEnergy(row.filmMean)
    : row.area < 0.4 ? 'across part of the frame' : 'across most of the frame';
  return `${row.t0.toFixed(1)}-${row.t1.toFixed(1)}s: reference moves ${row.refMean.toFixed(1)} ${refDesc}; `
    + `yours ${row.filmMean.toFixed(1)} ${filmDesc} (${row.ratio.toFixed(1)}x the reference). `
    + 'Slow it down, or drop one of the simultaneous motion devices in this window.';
}

// ── --sheet-check: compare two ALREADY-COMPUTED motion curves, no render, no ffmpeg ──────────────────
// Both --shot's and --dom's own motion.json share one shape (`curve`: [{t0,t1,mean}], --dom's also
// carrying `area`), so one function diffs either pairing: a reference's `see --shot` sheet against a
// film's `--dom` sheet, or two shots of the same reference. `ok` (required-motion-match's own gate)
// fails on ANY window outside [MATCH_FLOOR, BUSY_CEIL] of the reference, or peak/exit speed under
// MATCH_FLOOR.
export function sheetCheck(refSheet, filmSheet) {
  const refCurve = refSheet.curve || [];
  const filmCurve = filmSheet.curve || [];
  const n = Math.min(refCurve.length, filmCurve.length);
  const edgeCount = Math.max(1, Math.round(n * 0.2));
  const rows = Array.from({ length: n }, (_, i) => {
    const r = refCurve[i], f = filmCurve[i];
    const ratio = r.mean > 1e-6 ? f.mean / r.mean : (f.mean > 1e-6 ? Infinity : 1);
    const tooStill = ratio < MATCH_FLOOR, tooBusy = ratio > BUSY_CEIL;
    const row = { t0: r.t0, t1: r.t1, refMean: r.mean, filmMean: f.mean, area: f.area ?? null, ratio, tooStill, tooBusy };
    const isEdgeWindow = i >= n - edgeCount;
    return { ...row, isEdgeWindow, hint: tooStill ? windowHint(row, isEdgeWindow) : tooBusy ? busyHint(row) : null };
  });
  const peakIdx = (curve) => curve.reduce((bi, c, i) => (c.mean > (curve[bi]?.mean ?? -Infinity) ? i : bi), 0);
  const winLen = refCurve[0] ? refCurve[0].t1 - refCurve[0].t0 : 0.5;
  const refPeakIdx = peakIdx(refCurve), filmPeakIdx = peakIdx(filmCurve);
  const peakOffset = (filmPeakIdx - refPeakIdx) * winLen;

  // Peak and exit speed, not only the mean-energy ratio per window: a draft can hit the reference's
  // AVERAGE motion while its fast whips and its exits are both dead flat, and the per-window table above
  // never says so.
  const refPeak = refCurve.length ? Math.max(...refCurve.map((c) => c.mean)) : 0;
  const filmPeak = filmCurve.length ? Math.max(...filmCurve.map((c) => c.mean)) : 0;
  const refEdge = edgeMean(refCurve.map((c) => c.mean), 0.2);
  const filmEdge = edgeMean(filmCurve.map((c) => c.mean), 0.2);
  const peakRatio = refPeak > 1e-6 ? filmPeak / refPeak : (filmPeak > 1e-6 ? Infinity : 1);
  const exitRatio = refEdge.exit > 1e-6 ? filmEdge.exit / refEdge.exit : (filmEdge.exit > 1e-6 ? Infinity : 1);

  const tooStillWindows = rows.filter((r) => r.tooStill);
  const tooBusyWindows = rows.filter((r) => r.tooBusy);
  const ok = n > 0 && tooStillWindows.length === 0 && tooBusyWindows.length === 0
    && peakRatio >= MATCH_FLOOR && exitRatio >= MATCH_FLOOR;

  return {
    rows, tooStillWindows, tooBusyWindows, ok, peakOffset,
    refPeakT: refCurve[refPeakIdx]?.t0 ?? null, filmPeakT: filmCurve[filmPeakIdx]?.t0 ?? null,
    refPeak, filmPeak, peakRatio, refExit: refEdge.exit, filmExit: filmEdge.exit, exitRatio,
  };
}

// Prints a sheetCheck() result and returns its `ok`. Shared by --sheet-check (two pre-computed JSON
// curves) and --required-motion (a live reference video + a live HTML page), so the table/hints/pass
// line are worded identically wherever this runs.
export function printSheetCheck(result, refLabel, filmLabel) {
  const { rows, tooStillWindows, tooBusyWindows, ok, peakOffset, refPeakT, filmPeakT, refPeak, filmPeak, peakRatio, refExit, filmExit, exitRatio } = result;
  console.log(`\n  SHEET CHECK · ${refLabel} vs ${filmLabel}\n`);
  for (const r of rows) {
    const ratioTxt = Number.isFinite(r.ratio) ? `${r.ratio.toFixed(2)}x` : 'n/a';
    const note = r.tooStill ? '  <- too still' : r.tooBusy ? '  <- too busy' : '';
    console.log(`  ${r.t0.toFixed(2)}-${r.t1.toFixed(2)}s  ref ${r.refMean.toFixed(2)}  film ${r.filmMean.toFixed(2)}  ratio ${ratioTxt}${note}`);
  }
  const dir = peakOffset > 1e-6 ? 'late' : peakOffset < -1e-6 ? 'early' : 'on time';
  const refTxt = refPeakT != null ? refPeakT.toFixed(2) : 'n/a';
  const filmTxt = filmPeakT != null ? filmPeakT.toFixed(2) : 'n/a';
  console.log(`\n  peak motion: reference at ${refTxt}s, film at ${filmTxt}s (${Math.abs(peakOffset).toFixed(2)}s ${dir})`);
  console.log(`  peak speed: ref ${refPeak.toFixed(2)}, film ${filmPeak.toFixed(2)} (film is ${describeRatio(peakRatio)})`);
  console.log(`  exit speed: ref ${refExit.toFixed(2)}, film ${filmExit.toFixed(2)} (film's exit is ${describeRatio(exitRatio)})`);
  if (tooStillWindows.length) {
    console.log(`\n  ${tooStillWindows.length} window(s) read too still (< ${MATCH_FLOOR}x the reference):\n`);
    for (const r of tooStillWindows) console.log(`  - ${r.hint}`);
  }
  if (tooBusyWindows.length) {
    console.log(`\n  ${tooBusyWindows.length} window(s) read too busy (> ${BUSY_CEIL}x the reference):\n`);
    for (const r of tooBusyWindows) console.log(`  - ${r.hint}`);
  }
  if (peakRatio < MATCH_FLOOR) console.log(`\n  peak speed fails required motion match: ${describeRatio(peakRatio)}.`);
  if (exitRatio < MATCH_FLOOR) console.log(`  exit speed fails required motion match: ${describeRatio(exitRatio)}.`);
  console.log(`\n  ${ok ? '✓ passes required motion match.' : '✗ fails required motion match.'}`);
  return ok;
}

export function runSheetCheck(refFile, filmFile) {
  if (!fs.existsSync(refFile)) die(`no such file: ${refFile}`);
  if (!fs.existsSync(filmFile)) die(`no such file: ${filmFile}`);
  const refSheet = JSON.parse(fs.readFileSync(refFile, 'utf8'));
  const filmSheet = JSON.parse(fs.readFileSync(filmFile, 'utf8'));
  const result = sheetCheck(refSheet, filmSheet);
  const { rows, tooStillWindows, tooBusyWindows, ok, peakRatio, exitRatio } = result;
  if (!rows.length) die(`no overlapping curve windows between ${refFile} and ${filmFile} (missing "curve"?)`);
  printSheetCheck(result, path.basename(refFile), path.basename(filmFile));

  if (!ok) process.exitCode = 1;
}
// ── --measure: one instrument for both sides. The reference mp4 and a render of the page are both read by
// ref-spec.mjs, so every number comes from the same pixel code and a delta is a real difference. The page's
// DOM (render-spec.mjs) only NAMES things (`#id`, page.html line) and feeds the page self-checks.
// harness/lib/spec-deltas.mjs turns the two specs into numeric deltas. Writes render-spec.json,
// ref-spec/spec.json, page-spec/spec.json, deltas.json, deltas.md and sheets/ (frames side by side for
// every low-confidence line) into outDirRoot. With no reference it prints the page's self-checks.
const hasTesseract = () => !spawnSync('tesseract', ['-version'], { encoding: 'utf8' }).error;

export async function referenceSpec(refPath, outDirRoot, fps) {
  const dir = path.join(outDirRoot, 'ref-spec');
  const file = path.join(dir, 'spec.json');
  const ocr = hasTesseract();
  if (fs.existsSync(file) && fs.statSync(file).mtimeMs > fs.statSync(refPath).mtimeMs) {
    const cached = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (cached.fps === fps && cached.ocr === ocr) return cached;
  }
  const { refSpec } = await import('../ref-spec.mjs');
  return refSpec({ video: path.resolve(refPath), outDir: dir, fps, ocr });
}

const hasAudioStream = (video) => spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=codec_type', '-of', 'csv=p=0', video], { encoding: 'utf8' }).stdout.trim() !== '';

// The page's full draft (fullDraftPath: the default aspect and the current params) when approval.mjs finds it newer than the page and every file it names,
// as long as the page, at the page's fps and aspect, and with sound when the page has audio tags. The critique renders it first, so a second render adds minutes and no information.
export function reusableDraft(htmlPath, pageDur, fps, aspect, root = '.') {
  if (approveProblem(htmlPath, { root })) return null;
  const draft = fullDraftPath(htmlPath, root);
  const { dur, fps: draftFps, width, height } = probeVideo(draft);
  const [aw, ah] = aspect.split(':').map(Number);
  const fits = dur >= pageDur - 2 / fps && Math.abs(draftFps - fps) < 0.5 && Math.abs(width / height - aw / ah) < 0.02;
  if (!fits) return null;
  return /<audio\b/i.test(fs.readFileSync(htmlPath, 'utf8')) && !hasAudioStream(draft) ? null : draft;
}

// Otherwise the page rendered at the reference's pixel size when the aspects agree, so both mp4s go through the same decode.
export async function pageSpec(htmlPath, refSpecOut, outDirRoot, fps) {
  const { renderPage, readPageMeta } = await import('../render-page.mjs');
  const { refSpec } = await import('../ref-spec.mjs');
  const { resolveDuration } = await import('../page-duration.mjs');
  const draft = reusableDraft(htmlPath, await resolveDuration(htmlPath), fps, readPageMeta(htmlPath, 'aspect') || '16:9');
  if (draft) {
    console.log(`  measuring the draft ${path.relative(process.cwd(), draft)}, not rendering the page again`);
    return { mp4: draft, spec: await refSpec({ video: path.resolve(draft), outDir: path.join(outDirRoot, 'page-spec'), fps, ocr: refSpecOut.ocr }) };
  }
  const mp4 = path.join(outDirRoot, 'page-render.mp4');
  const [aw, ah] = (readPageMeta(htmlPath, 'aspect') || '16:9').split(':').map(Number);
  const sameShape = Math.abs(aw / ah - refSpecOut.media.width / refSpecOut.media.height) < 0.02;
  const size = sameShape ? { w: refSpecOut.media.width, h: refSpecOut.media.height } : {};
  await renderPage(htmlPath, mp4, { fps, audio: fs.readFileSync(htmlPath, 'utf8').includes('<audio') || undefined, ...size });
  const spec = await refSpec({ video: mp4, outDir: path.join(outDirRoot, 'page-spec'), fps, ocr: refSpecOut.ocr });
  return { mp4, spec };
}

const SHEET_LIMIT = 10;

export async function writeSheets(result, mp4, refPath, outDirRoot, lastT) {
  const dir = path.join(outDirRoot, 'sheets');
  fs.mkdirSync(dir, { recursive: true });
  for (const [i, d] of result.deltas.filter((d) => d.confidence === 'low').slice(0, SHEET_LIMIT).entries()) {
    const times = [...new Set([d.refT, d.t].map((t) => Math.round(Math.min(Math.max(t, 0), lastT) * 100) / 100))];
    d.sheet = path.relative(process.cwd(), await compareFrames({ ours: mp4, ref: refPath, times, out: path.join(dir, `delta-${i + 1}.png`) }));
  }
}

export async function runMeasure(htmlPath, refPath, outDirRoot) {
  if (refPath && !fs.existsSync(refPath)) die(`no such --ref file: ${refPath}`);
  if (refPath) {
    const { resolveDuration } = await import('../page-duration.mjs');
    const { readPageMeta } = await import('../render-page.mjs');
    const line = refSpanLine(probeVideo(refPath).dur, await resolveDuration(htmlPath), Number(readPageMeta(htmlPath, 'fps')) || 30);
    if (line) return console.log(`  measured deltas skipped: ${line}. Make them the same length, or compare a window with: bin/vawe critique ${htmlPath} --ref ${refPath} --from s --to s`);
  }
  const { renderSpec, attachNames, MeasureTimeout } = await import('../render-spec.mjs');
  const { compareSpecs, selfChecks, deltasMarkdown, deltaLine } = await import('../../lib/spec-deltas.mjs');
  fs.mkdirSync(outDirRoot, { recursive: true });
  let measured;
  try { measured = await renderSpec({ page: path.resolve(htmlPath), outDir: outDirRoot, withNames: true }); } catch (e) {
    if (!(e instanceof MeasureTimeout)) throw e;
    return console.log(`  measured deltas skipped: ${e.message}. Raise the limit with VAWE_MEASURE_TIMEOUT=<seconds>`);
  }
  const { spec: page, namer } = measured;
  const checks = selfChecks(page);
  let result = null, mp4 = null;
  if (refPath) {
    const ref = await referenceSpec(refPath, outDirRoot, page.fps);
    const rendered = await pageSpec(path.resolve(htmlPath), ref, outDirRoot, page.fps);
    mp4 = rendered.mp4;
    attachNames(rendered.spec, namer);
    result = compareSpecs(ref, rendered.spec);
    await writeSheets(result, mp4, refPath, outDirRoot, Math.min(ref.duration, rendered.spec.duration) - 2 / page.fps);
  }
  const args = { pageName: path.basename(htmlPath), refName: refPath && path.basename(refPath), result, checks, page };
  fs.writeFileSync(path.join(outDirRoot, 'deltas.md'), deltasMarkdown(args));
  writeJsonAtomic(path.join(outDirRoot, 'deltas.json'), { page: args.pageName, ref: args.refName, axes: result ? result.axes : [], deltas: result ? result.deltas : [], notes: result ? result.notes : [], checks });
  const rel = path.relative(process.cwd(), path.join(outDirRoot, 'deltas.md'));
  if (result) {
    const eye = result.deltas.filter((d) => d.confidence === 'low').length;
    console.log(`\n  measured deltas: ${result.deltas.length} (${eye} to confirm by eye), worst first`);
    result.deltas.slice(0, 12).forEach((d, i) => console.log(`  ${i + 1}. ${deltaLine(d)}`));
    if (result.deltas.length > 12) console.log(`  ... ${result.deltas.length - 12} more in ${rel}`);
    result.notes.forEach((n) => console.log(`  note: ${n}`));
    console.log(`\n  starter score per axis: ${result.axes.map((a) => `${a.axis} ${a.score}`).join(', ')}`);
  }
  console.log(`\n  page self-checks: ${checks.length}`);
  checks.forEach((c) => console.log(`  - ${c.code}: ${c.summary}${c.at ? ` [${c.at}]` : ''}. Fix: ${c.fix}`));
  console.log(`\n  ✓ ${rel}, render-spec.json, deltas.json`);
}
