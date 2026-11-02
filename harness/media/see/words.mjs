import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ffmpegOrDie } from '../../lib/scratch.mjs';
import { motionDeltaSeries } from '../shot-detect.mjs';
import { findHolds, HOLD_FLOOR, HOLD_MIN, pngDims, probeVideo, writeJsonAtomic } from './core.mjs';
import { ocrFrames } from './ocr.mjs';


// ── word events: what a beat table's one line ("words build, hold, fade") cannot say: WHERE each word
// came from, WHEN it settled, whether a highlight travelled across them, and whether a small spinning
// region (a star) was there at all. Runs OCR on BOTH the reference video and a rendered film video,
// never DOM-vs-video (this file's own runRequiredMotionMatch note already lost a session mixing a
// DOM's px/s against a video's pixel-diff energy; two OCR passes on two real renders keeps the units
// the same on both sides).

// Adaptive sample times: dense (native frame rate) while the picture is changing, one sample per hold,
// built from this file's OWN motionDeltaSeries/findHolds/HOLD_FLOOR rather than a second motion signal
// (a perceptual hash would say the same thing, slower, and this repo already owns a frame-diff signal).
// Capped to a minimum gap so a long, constantly-changing span still costs a bounded number of tesseract
// calls, not one per native frame.
export const WORD_SAMPLE_MIN_GAP = 0.1;
export function adaptiveSampleTimes(video, from, to) {
  const series = motionDeltaSeries(video).filter((p) => p.t >= from && p.t < to);
  if (!series.length) return [from];
  const holds = findHolds(series, HOLD_FLOOR, HOLD_MIN);
  const changing = series.filter((p) => p.v > HOLD_FLOOR).map((p) => p.t);
  const holdMids = holds.map((h) => (h.t0 + h.t1) / 2);
  const candidates = [...new Set([from, ...changing, ...holdMids, Math.max(from, to - 0.03)])].sort((a, b) => a - b);
  const picked = [];
  for (const t of candidates) if (!picked.length || t - picked[picked.length - 1] >= WORD_SAMPLE_MIN_GAP) picked.push(t);
  return picked;
}

// Native resolution, no downscale: unlike ocrWords' bulk fps-extract (every frame of a whole video,
// where 640px keeps tesseract cheap over hundreds of frames), this only ever pulls the handful of
// stills adaptiveSampleTimes picked, so there is no cost reason to shrink them first, and every reason
// not to: a half-size 960x540 draft render downscaled AGAIN to 640 wide loses exactly the glyph detail
// OCR needs on its own smaller text.
export function extractStillFrame(video, t, outPath) {
  ffmpegOrDie(['-v', 'error', '-y', '-ss', t.toFixed(3), '-i', video, '-frames:v', '1', outPath],
    outPath, `word-event frame @${t.toFixed(2)}s`);
}

/** The frames at `times` in one decode pass, written as f_0.png, f_1.png ... in `dir` (one ffmpeg run, not one seek per frame). Returns the paths. */
export function extractStillFrames(video, times, fps, dir) {
  const frames = [...new Set(times.map((t) => Math.round(t * fps)))].sort((a, b) => a - b);
  ffmpegOrDie(['-v', 'error', '-y', '-i', video, '-vf', `select='${frames.map((n) => `eq(n\\,${n})`).join('+')}'`, '-fps_mode', 'passthrough', path.join(dir, 'f_%d.png')],
    null, 'word-event frames');
  const index = new Map(frames.map((n, i) => [n, i + 1]));
  return times.map((t) => path.join(dir, `f_${index.get(Math.round(t * fps))}.png`));
}

/** True when the centre of an OCR word box lies inside one of the rects ({ x, y, w, h } as fractions of the frame). Pure. */
export const insideRects = (box, rects) => rects.some((r) => box.cxFrac >= r.x && box.cxFrac <= r.x + r.w && box.cyFrac >= r.y && box.cyFrac <= r.y + r.h);

// A frame's mean colour inside one word's box, via ffmpeg's own area-averaging scale filter (a crop
// scaled down to 1x1 IS the crop's average colour): no image-decoding dependency, one subprocess call.
export function cropMeanColor(framePath, box, frameW, frameH) {
  const w = Math.max(1, Math.min(frameW, Math.round(box.wFrac * frameW)));
  const h = Math.max(1, Math.min(frameH, Math.round(box.hFrac * frameH)));
  const x = Math.max(0, Math.min(frameW - w, Math.round((box.cxFrac * frameW) - w / 2)));
  const y = Math.max(0, Math.min(frameH - h, Math.round((box.cyFrac * frameH) - h / 2)));
  const r = spawnSync('ffmpeg', ['-v', 'error', '-i', framePath, '-vf', `crop=${w}:${h}:${x}:${y},scale=1:1:flags=area`,
    '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { encoding: 'buffer' });
  return r.stdout && r.stdout.length >= 3 ? { r: r.stdout[0], g: r.stdout[1], b: r.stdout[2] } : null;
}

// Named, not raw RGB: a travelling highlight in this reference is a blue/white swap, and naming it is
// what lets compareWordEvents say "never changes" in plain words instead of printing three numbers.
export function colorName(c) {
  if (!c) return 'unknown';
  if (c.b - c.r > 20 && c.b > 110) return 'blue';
  if (c.r > 190 && c.g > 190 && c.b > 190) return 'white';
  return 'other';
}

export function grayBuffer(framePath, w, h) {
  const r = spawnSync('ffmpeg', ['-v', 'error', '-i', framePath, '-vf', `scale=${w}:${h},format=gray`, '-f', 'rawvideo', '-'],
    { encoding: 'buffer' });
  return r.stdout && r.stdout.length >= w * h ? r.stdout : null;
}

export function centreDist(a, b) { return Math.hypot(a.cxFrac - b.cxFrac, a.cyFrac - b.cyFrac); }

// Which way a word travelled, in words a person reads, not a signed pixel delta.
export function dirFrom(fromBox, toBox) {
  const dx = fromBox.cxFrac - toBox.cxFrac, dy = fromBox.cyFrac - toBox.cyFrac;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'the right' : 'the left';
  return dy > 0 ? 'below' : 'above';
}

export const SETTLE_FRAC = 0.02; // centre movement (frame fraction) between samples below which a word counts as stopped
export const MOVE_FRAC = 0.08;   // centre movement above which an entrance/exit reads as "moved", not "in place"
export const WORD_TRACK_GAP = 0.6; // a text run absent this long before the same word reappears is a second,
                             // separate appearance (a reused hero word), never one continuous track

export function buildWordTrack(occ) {
  let settledIdx = occ.length - 1;
  for (let i = 0; i < occ.length; i++) {
    let stillRest = true;
    for (let j = i + 1; j < occ.length; j++) if (centreDist(occ[j].box, occ[j - 1].box) >= SETTLE_FRAC) { stillRest = false; break; }
    if (stillRest) { settledIdx = i; break; }
  }
  const enter = occ[0], settled = occ[settledIdx], last = occ[occ.length - 1];
  const enterDist = centreDist(enter.box, settled.box);
  const tail = occ[Math.max(settledIdx, occ.length - 3)];
  const exitDist = centreDist(tail.box, last.box);
  return {
    text: occ[0].text,
    tIn: Number(occ[0].t.toFixed(2)), tSettled: Number(settled.t.toFixed(2)), tOut: Number(last.t.toFixed(2)),
    movedIn: enterDist >= MOVE_FRAC, enterDir: enterDist >= MOVE_FRAC ? dirFrom(enter.box, settled.box) : null,
    movedOut: exitDist >= MOVE_FRAC,
    sizeIn: Number(enter.box.hFrac.toFixed(3)), sizeSettled: Number(settled.box.hFrac.toFixed(3)),
    colors: occ.map((o) => ({ t: Number(o.t.toFixed(2)), name: o.color })).filter((c) => c.name && c.name !== 'unknown'),
  };
}

// Groups one word's raw per-frame sightings (matched by TEXT, case-insensitive) into tracks, splitting
// on a gap over WORD_TRACK_GAP so a reused hero word (on screen twice, far apart) becomes two tracks.
export function trackWords(perFrame) {
  const byKey = new Map();
  for (const f of perFrame) for (const w of f.words) {
    const key = w.text.toLowerCase();
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push({ t: f.t, box: w.box, color: w.color, text: w.text });
  }
  const tracks = [];
  for (const occAll0 of byKey.values()) {
    const occAll = occAll0.sort((a, b) => a.t - b.t);
    let run = [occAll[0]];
    for (let i = 1; i < occAll.length; i++) {
      if (occAll[i].t - occAll[i - 1].t > WORD_TRACK_GAP) { tracks.push(buildWordTrack(run)); run = []; }
      run.push(occAll[i]);
    }
    tracks.push(buildWordTrack(run));
  }
  return tracks.sort((a, b) => a.tIn - b.tIn);
}

// ── non-text moving regions: a frame-diff bounding box with any OCR word box MASKED OUT first, so a
// scattering headline never gets read as "a moving region" twice over. A region whose WIDTH oscillates
// (narrows edge-on, widens face-on) reports a half-turn period: the spacing between successive width
// minima, the one number a spinning star needs and nothing else in this file measures.
export const REGION_SCALE_W = 128, REGION_SCALE_H = 72;
export const REGION_DIFF_THRESHOLD = 24; // 0-255 gray delta, comfortably above encoder noise
export const REGION_MIN_PIXELS = 6;      // a scattered handful of hot pixels is noise, not a region
export const REGION_JUMP = 0.25;         // centroid jump (frame fraction) between samples that starts a new region track

export function maskBoxes(buf, w, h, boxes) {
  const masked = Buffer.from(buf);
  for (const box of boxes) {
    const bw = Math.round(box.wFrac * w) + 2, bh = Math.round(box.hFrac * h) + 2;
    const bx = Math.max(0, Math.round((box.cxFrac * w) - bw / 2)), by = Math.max(0, Math.round((box.cyFrac * h) - bh / 2));
    for (let y = by; y < Math.min(h, by + bh); y++) for (let x = bx; x < Math.min(w, bx + bw); x++) masked[(y * w) + x] = 0;
  }
  return masked;
}

export function diffBBox(a, b, w, h) {
  let minX = w, minY = h, maxX = -1, maxY = -1, count = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w) + x;
      if (Math.abs(a[i] - b[i]) >= REGION_DIFF_THRESHOLD) {
        count++;
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
  }
  if (count < REGION_MIN_PIXELS) return null;
  return { cxFrac: (minX + maxX) / 2 / w, cyFrac: (minY + maxY) / 2 / h,
    wFrac: (maxX - minX + 1) / w, hFrac: (maxY - minY + 1) / h, area: count / (w * h) };
}

export function buildRegionTrack(samples) {
  const widths = samples.map((s) => s.box.wFrac);
  const minimaT = [];
  for (let i = 1; i < widths.length - 1; i++) if (widths[i] < widths[i - 1] && widths[i] < widths[i + 1]) minimaT.push(samples[i].t);
  const gaps = minimaT.slice(1).map((t, i) => t - minimaT[i]);
  const halfTurn = gaps.length ? Number((gaps.reduce((a, b) => a + b, 0) / gaps.length).toFixed(2)) : null;
  return {
    tIn: Number(samples[0].t.toFixed(2)), tOut: Number(samples[samples.length - 1].t.toFixed(2)),
    area: Number((samples.reduce((s, x) => s + x.box.area, 0) / samples.length).toFixed(3)), halfTurn,
  };
}

export function trackRegions(frameFiles, times, wordBoxesByTime) {
  const grays = frameFiles.map((f) => grayBuffer(f, REGION_SCALE_W, REGION_SCALE_H));
  const boxSeries = [];
  for (let i = 1; i < times.length; i++) {
    const a = grays[i - 1], b = grays[i];
    if (!a || !b) continue;
    const boxesHere = [...(wordBoxesByTime.get(times[i - 1]) || []), ...(wordBoxesByTime.get(times[i]) || [])];
    const ma = maskBoxes(a, REGION_SCALE_W, REGION_SCALE_H, boxesHere);
    const mb = maskBoxes(b, REGION_SCALE_W, REGION_SCALE_H, boxesHere);
    const bbox = diffBBox(ma, mb, REGION_SCALE_W, REGION_SCALE_H);
    if (bbox) boxSeries.push({ t: (times[i - 1] + times[i]) / 2, box: bbox });
  }
  const tracks = [];
  let run = [];
  for (const s of boxSeries) {
    if (run.length && centreDist(run[run.length - 1].box, s.box) > REGION_JUMP) { tracks.push(run); run = []; }
    run.push(s);
  }
  if (run.length) tracks.push(run);
  return tracks.filter((r) => r.length >= 2).map(buildRegionTrack);
}

// Extracts a still + OCR + per-word colour at every adaptive sample time, then tracks words and non-text
// regions across them. `outDir` gets a `.word-events` scratch folder, removed before returning.
export function wordEventTracks(video, from, to, outDir, { skip = [] } = {}) {
  // Clamped to the FILE's own probed duration, not the caller's window end: a windowed clip is cut to
  // ~`to` seconds by ffmpeg's own encoder rounding, so a candidate time sitting right at the caller's
  // `to` can land a hair past the last real frame and make `-ss` return nothing.
  const { dur, fps } = probeVideo(video);
  const times = adaptiveSampleTimes(video, from, to).map((t) => Math.min(t, dur - 0.05));
  const workDir = path.join(outDir, '.word-events');
  fs.mkdirSync(workDir, { recursive: true });
  const frameFiles = extractStillFrames(video, times, fps, workDir);
  const { width: frameW, height: frameH } = pngDims(frameFiles[0]);
  const read = ocrFrames(frameFiles.map((src) => ({ src, base: src.replace(/\.png$/, '') })), 60, 3, frameW, frameH);
  const perFrame = times.map((t, i) => {
    const words = read[i].filter((w) => !insideRects(w.box, skip))
      .map((w) => ({ ...w, color: colorName(cropMeanColor(frameFiles[i], w.box, frameW, frameH)) }));
    return { t, words };
  });
  const wordBoxesByTime = new Map(perFrame.map((f) => [f.t, f.words.map((w) => w.box)]));
  const words = trackWords(perFrame);
  const regions = trackRegions(frameFiles, times, wordBoxesByTime);
  fs.rmSync(workDir, { recursive: true, force: true });
  return { words, regions, from, to };
}

export const ENTER_TIME_TOL = 0.3; // seconds; timing hints below this are noise, not a real beat mismatch
export const HALF_TURN_TOL = 0.1;  // seconds; a star's own half-turn period only worth reporting past this gap

// Pairs reference and film words by TEXT (case-insensitive), in temporal order: the nth reference
// occurrence of a word pairs with the nth not-yet-used film occurrence closest to it in time, so two
// repeats of the same word (e.g. "text" used twice) pair the earlier with the earlier.
export function pairWords(refWords, filmWords) {
  const byKey = new Map();
  for (const w of filmWords) { const k = w.text.toLowerCase(); if (!byKey.has(k)) byKey.set(k, []); byKey.get(k).push(w); }
  const used = new Set();
  return refWords.map((rw) => {
    const bucket = (byKey.get(rw.text.toLowerCase()) || []).filter((fw) => !used.has(fw));
    if (!bucket.length) return { ref: rw, film: null };
    let best = bucket[0];
    for (const fw of bucket) if (Math.abs(fw.tIn - rw.tIn) < Math.abs(best.tIn - rw.tIn)) best = fw;
    used.add(best);
    return { ref: rw, film: best };
  });
}

// Contiguous 'blue' stretches per word: the raw material for "does the highlight travel word to word,
// or does it never change" (compareWordEvents below), sorted so the FIRST entry is whichever word the
// highlight visits first.
export function highlightSpans(words) {
  const spans = [];
  for (const w of words) {
    let start = null;
    for (const c of w.colors) {
      if (c.name === 'blue' && start == null) start = c.t;
      if (c.name !== 'blue' && start != null) { spans.push({ text: w.text, t0: start, t1: c.t }); start = null; }
    }
    if (start != null) spans.push({ text: w.text, t0: start, t1: w.colors[w.colors.length - 1].t });
  }
  return spans.sort((a, b) => a.t0 - b.t0);
}

// The one comparator: reference word/region tracks vs a film's, in plain numbers, worst first. Pure and
// framework-free (no ffmpeg, no OCR call inside it), so a test proves it against literal tracks.
export function compareWordEvents(ref, film) {
  const diffs = [];
  for (const { ref: rw, film: fw } of pairWords(ref.words, film.words)) {
    if (!fw) { diffs.push({ sev: 2, text: `'${rw.text}': present in the reference at ${rw.tIn.toFixed(2)}s, missing from yours.` }); continue; }
    if (rw.movedIn !== fw.movedIn) {
      diffs.push({ sev: 2, text: rw.movedIn
        ? `'${rw.text}': reference enters from ${rw.enterDir} at ${rw.tIn.toFixed(2)}s and settles at ${rw.tSettled.toFixed(2)}s; yours appears in place at ${fw.tIn.toFixed(2)}s.`
        : `'${rw.text}': reference appears in place at ${rw.tIn.toFixed(2)}s; yours enters from ${fw.enterDir} and settles at ${fw.tSettled.toFixed(2)}s.` });
    } else if (rw.movedIn && Math.abs(rw.tSettled - fw.tSettled) > ENTER_TIME_TOL) {
      diffs.push({ sev: 1, text: `'${rw.text}': reference settles at ${rw.tSettled.toFixed(2)}s; yours settles at ${fw.tSettled.toFixed(2)}s.` });
    }
    if (rw.movedOut !== fw.movedOut) {
      diffs.push({ sev: 2, text: `'${rw.text}' exit: reference ${rw.movedOut ? 'moves away' : 'fades in place'} by ${rw.tOut.toFixed(2)}s; `
        + `yours ${fw.movedOut ? 'moves away' : 'fades in place'}.` });
    }
  }

  const refSpans = highlightSpans(ref.words), filmSpans = highlightSpans(film.words);
  const refHitWords = new Set(refSpans.map((s) => s.text)), filmHitWords = new Set(filmSpans.map((s) => s.text));
  if (refHitWords.size > 1 && filmHitWords.size <= 1) {
    diffs.push({ sev: 2, text: `highlight: reference colour moves word to word ${refSpans[0].t0.toFixed(2)}-`
      + `${refSpans[refSpans.length - 1].t1.toFixed(2)}s; yours never changes.` });
  } else if (refHitWords.size > 1 && filmHitWords.size > 1 && Math.abs(refSpans[0].t0 - filmSpans[0].t0) > ENTER_TIME_TOL) {
    diffs.push({ sev: 1, text: `highlight: reference starts travelling at ${refSpans[0].t0.toFixed(2)}s; yours at ${filmSpans[0].t0.toFixed(2)}s.` });
  }

  const refRegions = ref.regions || [], filmRegions = film.regions || [];
  if (refRegions.length && !filmRegions.length) {
    for (const r of refRegions) diffs.push({ sev: 2, text: `star: reference shows a spinning region ${r.tIn.toFixed(2)}-`
      + `${r.tOut.toFixed(2)}s${r.halfTurn ? ` (half-turn ${r.halfTurn.toFixed(2)}s)` : ''}; yours has none.` });
  } else {
    for (let i = 0; i < Math.min(refRegions.length, filmRegions.length); i++) {
      const r = refRegions[i], f = filmRegions[i];
      if (r.halfTurn && f.halfTurn && Math.abs(r.halfTurn - f.halfTurn) > HALF_TURN_TOL)
        diffs.push({ sev: 1, text: `star: reference half-turn ${r.halfTurn.toFixed(2)}s, yours ${f.halfTurn.toFixed(2)}s.` });
    }
  }

  diffs.sort((a, b) => b.sev - a.sev);
  return { diffs: diffs.map((d) => d.text), ok: diffs.length === 0 };
}

// Runs wordEventTracks on both sides and prints compareWordEvents' verdict. Shared by --word-events
// (video vs video) and --dom --ref --words (a rendered page vs its reference, reusing the SAME two mp4s
// runCompare already built rather than rendering a third).
export function runWordEventCompare(refVideo, filmVideo, outDir, from, to, label) {
  const refTracks = wordEventTracks(refVideo, from, to, outDir);
  const filmTracks = wordEventTracks(filmVideo, from, to, outDir);
  const { diffs, ok } = compareWordEvents(refTracks, filmTracks);
  console.log(`\n  WORD EVENTS · ${label}, ${from.toFixed(2)}-${to.toFixed(2)}s\n`);
  if (!diffs.length) console.log('  ✓ no per-word differences against the reference.');
  else for (const d of diffs) console.log(`  - ${d}`);
  writeJsonAtomic(path.join(outDir, 'word-events.json'), { from, to, ref: refTracks, film: filmTracks, diffs, ok });
  return ok;
}
