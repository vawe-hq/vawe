import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ffmpegOrDie, drawtext } from '../../lib/scratch.mjs';
import { openPreview } from '../preview-server.mjs';
import { motionStampFresh, writeMotionStamp } from '../../lib/motion-stamp.mjs';
import { bucketMean, die, probeVideo, refSpanLine, ROOT, tileInGrids, timeRange, writeJsonAtomic } from './core.mjs';
import { ocrWords } from './ocr.mjs';
import { runCompare } from './compare.mjs';
import { seekPage } from './inspect.mjs';
import { resolveDuration } from '../page-duration.mjs';


// ── --dom: read a film's motion straight from the DOM, no video, no screenshot per sample ────────────
// Loads `html` once (preview-server.mjs's own openPreview, the same loader every other check in this
// file uses), then SEEKS every `document.getAnimations()` (the Web
// Animations API this repo's `element.animate()` scenes already use) by setting `currentTime`, reading
// each tracked element's box/opacity straight from the live page: 30x/s costs one page.evaluate call
// each, not a screenshot decode. Also captures screenshots at the --compare cadence (4/s) into the same
// side-by-side style grid via tileInGrids, without spinning up a second page or a second browser.
export async function domSample(page, ids, t) {
  return page.evaluate((ms, trackedIds) => {
    for (const a of document.getAnimations()) { a.pause(); a.currentTime = ms; }
    // Looked up by `data-see-track`, not `id`: most animated elements in a real authored page (a
    // per-letter/word span, a particle, an icon wrapper) carry a class, never an id, so tracking only
    // `document.getAnimations()` targets that HAPPEN to have one misses almost everything real pages
    // animate. `sampleDomMotion`'s own setup pass tags every target with this attribute once, using its
    // real id when it has one so this stays a superset of the old id-only behaviour, never a narrower one.
    return trackedIds.map((id) => {
      const el = document.querySelector(`[data-see-track="${id}"]`);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const opacity = Number(getComputedStyle(el).opacity);
      return { id, x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height, opacity };
    });
  }, t * 1000, ids);
}

// `area`: at each sample, the tracked elements' own box area (summed, uncapped at the frame) as a
// fraction of the viewport. Not "how much moved" (`energy` already answers that) but "how much of the
// frame the moving elements occupy" - the number required-motion-match's hint needs to say a fix is
// "enlarge the moving area" rather than only "speed it up".
export function domCurveAndEvents(samples, ids, frameArea) {
  const perElement = new Map(ids.map((id) => [id, []]));
  for (const s of samples) {
    for (const row of s.boxes) {
      if (row) perElement.get(row.id).push({ t: s.t, x: row.x, y: row.y, opacity: row.opacity });
    }
  }
  const energy = [];
  const area = [];
  for (let i = 1; i < samples.length; i++) {
    const dt = samples[i].t - samples[i - 1].t;
    let total = 0;
    for (const id of ids) {
      const a = samples[i - 1].boxes.find((b) => b?.id === id);
      const b = samples[i].boxes.find((b2) => b2?.id === id);
      if (!a || !b) continue;
      const dist = Math.hypot(b.x - a.x, b.y - a.y);
      total += (dist / (dt || 1)) * Math.max(a.opacity, b.opacity);
    }
    energy.push({ t: samples[i].t, v: total });
    const visibleArea = samples[i].boxes.reduce((sum, b) => sum + (b && b.opacity > 0.05 ? b.w * b.h : 0), 0);
    area.push({ t: samples[i].t, v: frameArea > 0 ? visibleArea / frameArea : 0 });
  }
  const VISIBLE = 0.05;
  const events = [];
  for (const [id, pts] of perElement) {
    let wasVisible = false;
    for (const p of pts) {
      const visible = p.opacity > VISIBLE;
      if (visible && !wasVisible) events.push({ id, type: 'appear', t: Number(p.t.toFixed(2)) });
      if (!visible && wasVisible) events.push({ id, type: 'leave', t: Number(p.t.toFixed(2)) });
      wasVisible = visible;
    }
  }
  return { energy, area, events: events.sort((a, b) => a.t - b.t) };
}

export async function domStillGrid(page, outDir, from, to, w, h) {
  const times = timeRange(from, to, 0.25);
  const longEdge = 1568;
  const tileW = Math.floor(longEdge / 3);
  const tileH = Math.round((tileW * h) / w);
  const cellFiles = [];
  for (const [i, t] of times.entries()) {
    await domSample(page, [], t); // seeks currentTime; ids irrelevant here, only the seek matters
    const raw = path.join(outDir, `.domraw_${i}.png`);
    await page.screenshot({ path: raw });
    const out = path.join(outDir, `.domcell_${i}.png`);
    ffmpegOrDie(['-v', 'error', '-y', '-i', raw, '-frames:v', '1', '-vf',
      `scale=${tileW}:${tileH},drawtext=text='${drawtext(`${t.toFixed(2)}s`)}':x=6:y=6:fontsize=16:fontcolor=white:box=1:boxcolor=black@0.65`,
      out], out, `dom still ${i}`);
    fs.rmSync(raw, { force: true });
    cellFiles.push(out);
  }
  const gridPaths = tileInGrids(cellFiles, outDir, 'dom-still', tileW, tileH, 9);
  for (const f of cellFiles) fs.rmSync(f, { force: true });
  return gridPaths;
}

// Boots `htmlPath`, resolves its tracked element ids and window, and samples domSample() across it at
// `fps`, bucketed to 0.5s windows: `{energy, area}`-curved, plus raw events. The one path both `--dom`
// and the reference-required-motion-match check sample through, so a page's ids/window/box-reading are
// resolved exactly once per caller, never twice.
export async function sampleDomMotion(page, url, opts) {
  const { from: fromArg, to: toArg, fps: domFps, w, h, ids: idsArg } = opts;
  await page.goto(url, { waitUntil: 'load' });
  const info = await page.evaluate(() => {
    const anims = document.getAnimations();
    // Tag EVERY animation target with `data-see-track`, using its real id when it has one, a
    // synthetic `_N` otherwise: most animated elements on a real authored page (a per-letter span, a
    // particle, an icon wrapper) carry a class, never an id, so tracking id'd elements only would miss
    // almost everything such a page actually moves.
    const targets = [...new Set(anims.map((a) => a.effect && a.effect.target).filter(Boolean))];
    const ids = targets.map((el, i) => {
      const key = el.id || `_${i}`;
      el.setAttribute('data-see-track', key);
      return key;
    });
    const maxEndMs = anims.reduce((m, a) => {
      const timing = a.effect.getComputedTiming();
      return Math.max(m, (timing.delay || 0) + (timing.duration || 0) * (timing.iterations || 1));
    }, 0);
    return { ids, maxEndMs, animCount: anims.length };
  });
  if (!info.animCount) die(`${url} has no document.getAnimations() (no element.animate() calls ran).`);

  const ids = idsArg || info.ids;
  const to = toArg != null ? toArg : (opts.duration > 0 ? opts.duration : info.maxEndMs / 1000);
  if (!(to > fromArg)) die(`--dom: bad window ${fromArg}-${to}`);

  const times = timeRange(fromArg, to, 1 / domFps);
  const samples = [];
  for (const t of times) samples.push({ t, boxes: await domSample(page, ids, t) });
  const { energy, area, events } = domCurveAndEvents(samples, ids, w * h);
  const energyCurve = bucketMean(energy, fromArg, to, 0.5);
  const areaCurve = bucketMean(area, fromArg, to, 0.5);
  const curve = energyCurve.map((wnd, i) => ({
    t0: Number(wnd.t0.toFixed(2)), t1: Number(wnd.t1.toFixed(2)),
    mean: Number(wnd.mean.toFixed(3)), area: Number((areaCurve[i]?.mean ?? 0).toFixed(3)),
  }));
  return { ids, from: fromArg, to, curve, events };
}

export async function runDom(htmlPath, outDirRoot, opts) {
  const { fps: domFps, w, h } = opts;
  const { page, url, close } = await openPreview(htmlPath, { width: w, height: h });
  try {
    const { ids, from, to, curve, events } = await sampleDomMotion(page, url, { ...opts, duration: await resolveDuration(htmlPath) });

    const outDir = path.join(outDirRoot, 'dom');
    fs.rmSync(outDir, { recursive: true, force: true });
    fs.mkdirSync(outDir, { recursive: true });

    const gridPaths = await domStillGrid(page, outDir, from, to, w, h);

    const sheet = { html: htmlPath, from, to, fps: domFps, ids, events, curve };
    writeJsonAtomic(path.join(outDir, 'motion.json'), sheet);

    console.log(`\n  DOM · ${path.basename(htmlPath)}, ${from}-${to}s, ${ids.length} tracked element(s)\n`);
    for (const c of curve) console.log(`  ${c.t0.toFixed(2)}-${c.t1.toFixed(2)}s  ${c.mean.toFixed(2)}`);
    console.log(`\n  ${events.length} event(s): ${events.map((e) => `${e.id} ${e.type}@${e.t}s`).join(', ') || 'none'}`);
    console.log(`  ✓ wrote ${path.relative(ROOT, path.join(outDir, 'motion.json'))}, ${gridPaths.length} still grid(s)`);
  } finally {
    await close();
  }
}

// ── --dom --ref <mp4>: required-motion-match on a BARE HTML PAGE, no scene.json, no wiring into a
// film first. A recreation agent authors the fragment before it is ever wired in; this renders it with
// harness/media/render-page.mjs (item 4's own batched, reliable HTML-page renderer: write-then-rename,
// fails loudly, one ffmpeg pass) into a scratch mp4, then hands both mp4s to the SAME runCompare() the
// post-draft loop already runs on a scene's own draft. A DOM-sampled curve (this file's --dom) reads in
// px/s; a video's own pixel-energy curve reads in a wholly different unit (0-255 frame-diff intensity):
// diffing one against the other produced a ratio in the THOUSANDS, meaningless noise, not a hint. Two
// curves of the SAME unit (pixel energy, both from a real render) is the one comparison that means
// anything, so this never invents a second one.
//
// `from`/`to` window the check to one slice instead of the whole page (a draft's whole point:
// iteration speed, not full-length fidelity). The reference is cut to the SAME window before compare
// (`runCompare`'s own from/to assumes both sides start at the same origin; the page render starts its
// mp4 at 0 regardless of `from`, so the reference is re-cut to 0-relative too, never left absolute).
// `--final` ignores any window and renders full length, matching what `vawe ship` will actually cut.
// A --final pass's own render already IS the shippable cut (full size, full length, real blur): the
// path this persists to once every check passes, next to the page, so `vawe critique <page> --ref <mp4> FINAL=1`
// is both the check and the one render an agent would otherwise run again by hand right after.
export function finalOutputFor(htmlPath) {
  const base = path.basename(htmlPath).replace(/\.[^.]+$/, '');
  return path.join(path.dirname(htmlPath), `${base}.mp4`);
}

export async function runRequiredMotionMatch(htmlPath, refPath, outDirRoot, opts) {
  if (!fs.existsSync(refPath)) die(`no such --ref file: ${refPath}`);
  const finalOut = opts.final ? finalOutputFor(htmlPath) : null;
  // Nothing changed since the last passing FINAL: the stamp (keyed on the page's own content hash) is
  // still fresh AND the render it produced is still on disk, so re-running ffmpeg buys nothing.
  if (opts.final && motionStampFresh(htmlPath) && fs.existsSync(finalOut)) {
    console.log(`✓ ${finalOut}: already verified and rendered for this page's current content, skipping.`);
    return;
  }
  const refP = probeVideo(refPath);
  const from = opts.final ? 0 : (opts.from || 0);
  const pageDur = await resolveDuration(htmlPath);
  const spanLine = refSpanLine(refP.dur, pageDur, opts.fps || 30);
  const to = opts.final ? refP.dur : (opts.to != null ? opts.to : Math.min(refP.dur, pageDur));
  if (spanLine && opts.to == null && !opts.final) console.log(`  ${spanLine}: comparing the first ${to.toFixed(1)} s only`);
  if (!(to > from)) die(`--dom --ref: bad window ${from}-${to}`);
  const windowed = from > 0 || to < refP.dur;

  const outDir = path.join(outDirRoot, 'required-motion');
  fs.mkdirSync(outDir, { recursive: true });
  const tmpMp4 = path.join(outDir, `.page-render-${process.pid}.mp4`);
  const refWindow = windowed ? path.join(outDir, `.ref-window-${process.pid}.mp4`) : refPath;
  try {
    const { renderPage, readPageMeta } = await import('../render-page.mjs');
    const authoringFps = Number(readPageMeta(htmlPath, 'fps')) || 30;
    if (opts.final) console.log(`  rendering FINAL ${htmlPath} (foreground, one pass)...`);
    await renderPage(htmlPath, tmpMp4, {
      fps: authoringFps, w: opts.w, h: opts.h, blur: opts.blur, from, durArg: to - from, progress: opts.final,
    });
    if (windowed) {
      ffmpegOrDie(['-v', 'error', '-y', '-i', refPath, '-ss', String(from), '-to', String(to),
        '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', refWindow], refWindow, 'ref window slice');
    }
    // Unlike a bare `--compare` (report-only, this repo's own house rule), a bare-page check has no
    // film/post-draft step wrapping it to refuse the ship on its behalf, so THIS is the one place that
    // must actually fail the process: a recreation agent running this standalone needs a non-zero exit.
    const { ok } = runCompare(refWindow, tmpMp4, outDirRoot, 0, to - from, opts.words);
    const textOk = await runTextScaleCheck(htmlPath, refWindow, outDirRoot, { from, windowDur: to - from, w: opts.w, h: opts.h });
    if (!ok || !textOk) process.exitCode = 1;
    else {
      // A pass (motion AND text-scale/placement) stamps the PAGE'S CURRENT content hash
      // (harness/lib/motion-stamp.mjs), so render-page.mjs can refuse a FINAL render for a page never
      // checked since its last edit, without re-running ffmpeg.
      writeMotionStamp(htmlPath);
      if (opts.final) {
        fs.copyFileSync(tmpMp4, finalOut);
        console.log(`✓ ${finalOut}`);
      }
    }
  } finally {
    fs.rmSync(tmpMp4, { force: true });
    if (windowed) fs.rmSync(refWindow, { force: true });
  }
}

// ── text-scale/placement: does the page's on-screen text match the reference's SCALE and PLACEMENT,
// never its glyphs (a recreation writes its own words on purpose, so comparing text CONTENT is the
// wrong check)? Buckets the reference's OCR word boxes (ocrWords, now carrying box geometry) and the
// page's own DOM text boxes (domTextBoxes) into the SAME 0.5s windows runCompare already uses for
// motion, and flags a window where the two disagree by more than TEXT_SCALE_TOLERANCE on height, width,
// or either centre axis: a headline typeset at the reference's own timing but the wrong size, or sitting
// in the wrong place, reads exactly as broken as one moving at the wrong speed, and nothing before this
// ever compared type at all.
export const TEXT_SCALE_TOLERANCE = 0.2;

// Reads text geometry off the actual rendered GLYPH rects (Range.getClientRects() on every visible text
// node), never off a container element's own box: a hand-authored headline is usually built from many
// nested per-letter/per-word spans (this repo's own typing effect included) inside a background/stage
// wrapper that is itself sized to the full frame (`inset:0`), so a container-based box either fragments
// into one box per glyph or, worse, inherits the wrapper's full-frame size and says nothing. Clustering
// glyph rects by vertical proximity into "lines" mirrors exactly what an OCR pass reads a text line as
// (tesseract's own box), regardless of how the DOM built it.
export async function domTextBoxes(page) {
  return page.evaluate(() => {
    const vw = window.innerWidth, vh = window.innerHeight;
    const isVisible = (el) => { const cs = getComputedStyle(el); return cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity) > 0.05; };
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => (node.textContent.trim() && node.parentElement && isVisible(node.parentElement)
        ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
    });
    const glyphRects = [];
    let node;
    while ((node = walker.nextNode())) {
      const range = document.createRange();
      range.selectNodeContents(node);
      for (const r of range.getClientRects()) if (r.width > 0 && r.height > 0) glyphRects.push(r);
    }
    const lines = [];
    for (const r of glyphRects.sort((a, b) => (a.top + a.height / 2) - (b.top + b.height / 2))) {
      const cy = r.top + r.height / 2;
      const line = lines.find((l) => Math.abs(l.cy - cy) < r.height / 2 + 4);
      if (line) { line.rects.push(r); line.cy = (line.cy * (line.rects.length - 1) + cy) / line.rects.length; }
      else lines.push({ cy, rects: [r] });
    }
    return lines.map((line) => {
      const left = Math.min(...line.rects.map((r) => r.left)), right = Math.max(...line.rects.map((r) => r.right));
      const top = Math.min(...line.rects.map((r) => r.top)), bottom = Math.max(...line.rects.map((r) => r.bottom));
      return { hFrac: (bottom - top) / vh, wFrac: (right - left) / vw,
        cxFrac: (left + right) / 2 / vw, cyFrac: (top + bottom) / 2 / vh };
    }).filter((b) => b.hFrac > 0 && b.wFrac > 0);
  });
}

// The single largest box in a set, by area: the most prominent text on screen at that instant, the one
// a viewer's eye actually lands on, not an average across every caption and label sharing the frame.
export function biggestBox(boxes) {
  return boxes.reduce((best, b) => (!best || b.hFrac * b.wFrac > best.hFrac * best.wFrac ? b : best), null);
}

// One line per mismatched window, built from the numbers this run measured: never canned text, same
// discipline windowHint/busyHint already follow.
export function textScaleHint(row) {
  const refPct = Math.round(row.ref.hFrac * 100), filmPct = Math.round(row.film.hFrac * 100);
  const centreDelta = Math.round((row.film.cyFrac - row.ref.cyFrac) * 100);
  const vDir = centreDelta === 0 ? '' : centreDelta > 0 ? `, ${Math.abs(centreDelta)}% lower` : `, ${Math.abs(centreDelta)}% higher`;
  return `${row.t0.toFixed(1)}-${row.t1.toFixed(1)}s: reference text ${refPct}% of frame height centred; yours ${filmPct}%${vDir}.`;
}

// The sample nearest a given instant, from a word's `samples` list (or its single averaged `box` when
// no per-sample list exists, e.g. an older sheet or a hand-built test fixture): the one lookup every
// window below uses, so "closest sample" is defined once, not re-picked per caller.
export function boxAtMoment(word, t) {
  if (!word.samples || !word.samples.length) return word.box;
  let best = word.samples[0];
  for (const s of word.samples) if (Math.abs(s.t - t) < Math.abs(best.t - t)) best = s;
  return best.box;
}

// textScaleCheck(refWords, filmBoxesByWindow, windows) -> {rows, mismatched, ok}. `refWords` is
// ocrWords()'s own return (each word carries `tIn`/`tOut` and `samples`); `filmBoxesByWindow` maps each
// window's `t0` to the DOM text boxes sampled at that window's midpoint.
//
// A word is compared in EVERY window it is visible during (`tIn <= t1 && tOut >= t0`), each time at the
// SAMPLE NEAREST THAT WINDOW'S OWN MIDPOINT, the same instant the film side was sampled at
// (runTextScaleCheck seeks the page to `(t0+t1)/2` before reading its DOM box). Comparing a word's box
// AVERAGED OVER ITS WHOLE ON-SCREEN RUN against the film's box AT ONE INSTANT is a unit mismatch, not a
// bug in the film: a headline that grows from 0 to full size over 1s averages to roughly HALF its
// settled height, so a film that renders it correctly at full size reads as "too big" the moment its own
// run has finished growing. Matching moments, not averaging spans, is the fix.
//
// Pure and framework-free on purpose, so a test can prove it against literal boxes with no browser and
// no OCR.
export function textScaleCheck(refWords, filmBoxesByWindow, windows) {
  const rows = [];
  for (const w of windows) {
    const tMid = (w.t0 + w.t1) / 2;
    const visible = refWords.filter((word) => word.tIn <= w.t1 && (word.tOut ?? word.tIn) >= w.t0);
    const refBox = biggestBox(visible.map((word) => boxAtMoment(word, tMid)));
    const filmBox = biggestBox(filmBoxesByWindow.get(w.t0) || []);
    if (!refBox || !filmBox) continue;
    const hDiff = Math.abs(filmBox.hFrac - refBox.hFrac) / Math.max(refBox.hFrac, 1e-6);
    const wDiff = Math.abs(filmBox.wFrac - refBox.wFrac) / Math.max(refBox.wFrac, 1e-6);
    const cxDiff = Math.abs(filmBox.cxFrac - refBox.cxFrac);
    const cyDiff = Math.abs(filmBox.cyFrac - refBox.cyFrac);
    const mismatch = hDiff > TEXT_SCALE_TOLERANCE || wDiff > TEXT_SCALE_TOLERANCE
      || cxDiff > TEXT_SCALE_TOLERANCE || cyDiff > TEXT_SCALE_TOLERANCE;
    const row = { t0: w.t0, t1: w.t1, ref: refBox, film: filmBox, hDiff, wDiff, cxDiff, cyDiff, mismatch };
    rows.push({ ...row, hint: mismatch ? textScaleHint(row) : null });
  }
  const mismatched = rows.filter((r) => r.mismatch);
  return { rows, mismatched, ok: mismatched.length === 0 };
}

// Drives textScaleCheck for a live page against a live (already windowed) reference clip: OCR's the
// reference once, samples the page's own DOM text boxes at each window's midpoint (seekPage, the same
// seek --probe/--look/--layout already share), then prints and returns `ok`. Skips, never fails, when
// tesseract is not on PATH, the same house rule the full `see` flow already applies.
export async function runTextScaleCheck(htmlPath, refWindowPath, outDirRoot, { from, windowDur, w, h }) {
  if (spawnSync('tesseract', ['-version'], { encoding: 'utf8' }).error) {
    console.log('\n  (skipping text-scale/placement check: tesseract not on PATH)');
    return true;
  }
  const outDir = path.join(outDirRoot, 'required-motion');
  const refWords = ocrWords(refWindowPath, outDir, 4, 60, 3);
  const windows = timeRange(0, windowDur, 0.5).map((t0) => ({ t0, t1: Math.min(windowDur, t0 + 0.5) }));
  const { page, url, close } = await openPreview(htmlPath, { width: w, height: h });
  const filmBoxesByWindow = new Map();
  try {
    await page.goto(url, { waitUntil: 'load' });
    for (const win of windows) {
      await seekPage(page, from + (win.t0 + win.t1) / 2);
      filmBoxesByWindow.set(win.t0, await domTextBoxes(page));
    }
  } finally { await close(); }
  const result = textScaleCheck(refWords, filmBoxesByWindow, windows);
  if (result.mismatched.length) {
    console.log(`\n  ${result.mismatched.length} window(s) fail text-scale/placement match (> ${Math.round(TEXT_SCALE_TOLERANCE * 100)}% off):\n`);
    for (const r of result.mismatched) console.log(`  - ${r.hint}`);
  } else if (result.rows.length) {
    console.log('\n  ✓ text scale and placement matches the reference in every checked window.');
  }
  return result.ok;
}
