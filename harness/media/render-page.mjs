// harness/media/render-page.mjs: render a bare HTML page (seeked CSS/Web Animations motion) to an
// mp4, with an optional N-subframe motion blur blended into each output frame.
//
//   node harness/media/render-page.mjs <page.html> [out.mp4] [--aspect W:H|all] [--fps N]
//     [--from s] [--dur s | --to s] [--blur N] [--w px] [--h px] [--final] [--silent] [--small] [--profile]
//
// Default is a DRAFT: half size, 30 fps, no blur, the page's <audio> mixed in (--silent for a picture-only draft), and --from/--to windows the render to one
// slice instead of the whole page; a window is silent, because the mix has no offset. --final renders the way `vawe ship` does: full size, 60 fps, the
// whole page from 0, up to 32 subframes of motion blur a frame, and the page's <audio> elements mixed in (harness/media/page-audio.mjs);
// it writes the master and, beside it, a small web copy (<name>.web.mp4). --profile prints the cost table.
// A final logs a `ship` event in out/<film>.runs.jsonl; --job (the ship job, harness/media/ship-job.mjs) leaves that to the job.
// The canvas is the page's <meta name="aspect"> (else 16:9), overridden by --aspect; `all` renders every
// aspect to its own file. The CSS viewport is always the aspect's full size (core/layout/aspects.js ASPECTS),
// so a draft lays out exactly like the final; a draft only captures at device scale 0.5.
//
// The page is seeked, never played. Before any page script runs, core/engine/page-clock.js replaces Date,
// performance.now, requestAnimationFrame, setTimeout/setInterval and Math.random with functions of the
// seek time, and the renderer sets <html data-aspect>, --vw/--vh on :root and window.vawe.aspect/width/
// height/fps (fps is the page's authoring <meta name="fps">; the render fps is independent). Each seek
// sets the clock, calls window.seek(t) when the page defines it, then seeks CSS/WAAPI/SMIL animations and
// vawe.onFrame hooks, then waits for fonts, image decode and two real paints before the screenshot.
//
// A render first takes one of the machine-wide render slots (harness/lib/render-slots.mjs) and waits for one.
// Capture is split into fixed 60-frame slices, `--workers` of them at once (default VAWE_WORKERS, else 2 while
// another render holds a slot, else the lane budget of harness/lib/lane-budget.mjs), each on
// its own page of the shared browser (harness/media/preview-server.mjs); the speed pass below runs the same
// way. Slice boundaries do not depend on the worker count, so the pixels never do either. When
// blur > 1, a per-frame speed pass decides how many subframes that frame actually needs: a still frame
// gets 1, a fast one enough subframes to blend into one streak, at most `blur`. The pass reads paused-animation bounding-box deltas (no
// screenshots); a page driven by window.seek or onFrame hooks, or with no animations, has no boxes to
// read, so it falls back to a mean pixel difference between downscaled frames.
// Counts are powers of two and run-length-encoded before capture, so the ffmpeg filter graph below
// (one trim+tmix+select+concat chain per motion-regime segment, still ONE ffmpeg process) stays at a
// few dozen segments; a pathological frame-by-frame alternation collapses back to a uniform max-blur
// capture (`clampSegments`) rather than building an unbounded graph.
//
// Replaces the scratchpad csskit prototype (render.mjs --blur), which wrote a 0-byte mp4 and exited
// silently under load: it spawned ONE ffmpeg process PER FRAME to blend that frame's subframes
// (spawnSync, exit code never checked, stderr never read) and wrote straight to the final output path,
// so a render killed mid-way left a corrupt or empty file behind with nothing on screen saying why.
// This instead: writes every subframe to one directory, blends+encodes in ONE ffmpeg pass, checks its
// exit code and prints its stderr on failure, and only renames the encode into place once ffmpeg
// succeeds (`writeJsonAtomic`'s same write-then-rename discipline, harness/media/see.mjs).
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { scratch } from '../lib/scratch.mjs';
import { drewNothingHint, ensurePageFonts, missingFontsLine } from '../lib/ensure-fonts.mjs';
import { BLANK_RETRY_WAIT_MS, isBlankShot, shouldRetake } from '../lib/blank-shot.mjs';
import { installPageClock } from '../../core/engine/page-clock.js';
import { seekTo, awaitFonts, awaitReady, installPageReady, installPageFrame } from '../../core/engine/page-seek.js';
import { EASE_VARS } from '../../core/motion/presets.js';
import { ASPECTS, aspectDims } from '../../core/layout/aspects.js';
import { appendRun, filmKeyOf, readRuns } from '../lib/runlog.mjs';
import { finalFailedLine, lastFailedShip, failedShipLine } from '../lib/ship-status.mjs';
import { devEvent, devFailedEvent, shipEvent } from '../lib/run-events.mjs';
import { REPO_ROOT, serveRepo, trackBrowser, pageArgs, insideRoot, PROTOCOL_TIMEOUT_MS, loadPuppeteer } from '../lib/render-harness.mjs';
import { openPreview, treeSignature } from './preview-server.mjs';
import { pageQuery, paramsFilm, paramsFlags, aspectOverride, aspectProblem, aspectSlug } from '../lib/page-params.mjs';
import { writeDraftSheet, draftSheetPath } from './draft-sheet.mjs';
import { sampleWorlds } from './world-sample.mjs';
import { sampleTail } from './tail-sample.mjs';
import { tailMoving } from '../lib/tail-motion.mjs';
import { sampleLens } from './lens-probe.mjs';
import { lensLines } from '../lib/lens-advice.mjs';
import { sampleText, sampleTextMotion, sampleLayout, sampleContrast, sampleSpec, sampleObjects, reviveObjects, readVideo, videoProblems } from './draft-check.mjs';
import { parseBriefTables, readBrief, dropGuesses } from '../lib/brief-tables.mjs';
import { createChecks, timeLine } from '../lib/check-runner.mjs';
import { MODES } from '../lib/draft-tiers.mjs';
import { redLine, summaryLine, fullTable } from '../lib/acceptance.mjs';
import { draftAcceptance, videoMeasures } from './acceptance-run.mjs';
import { readDecls, rulesWith } from '../lib/design-decls.mjs';
import { RULES, textProblems, frameUnitLines, hiddenTextLines, soundLine, soundSummary, briefLine, mergeProblems, draftAdvice, draftCheckLines, layoutTimes, NOTE_LINES } from '../lib/draft-check.mjs';
import { probeLayoutLint, namedText } from '../lib/layout-lint.mjs';
import { directionsLines } from '../lib/directions.mjs';
import { recipeEchoLines } from '../lib/recipe-echo.mjs';
import { metaOf } from '../lib/page-meta.mjs';
import { resolveLength, autoDuration, DurationError, statedLength, lockPageLength } from './page-duration.mjs';
import { lengthLines } from '../lib/length-line.mjs';
import { boardChecks, boardFilled, spectacleOf, lockedSpectacle, moveRows } from '../lib/board.mjs';
import { handoffAdvice } from '../lib/handoffs.mjs';
import { ideasAdvice } from '../lib/ideas.mjs';
import { slideshowTells, slideshowLines } from '../lib/slideshow.mjs';
import { worldRows } from '../lib/timeline.mjs';
import { moveDocLines } from '../lib/move-docs.mjs';
import { referenceFor, motionStampFresh, pageAuthoring } from '../lib/motion-stamp.mjs';
import { isWaived, waiverAdvice, waiverHint, waiverProblems } from '../lib/waivers.mjs';
import { beatAdvice } from '../lib/sound-read.mjs';
import { draftTasteLines, firedRules, firedLines, TASTE_RULES } from '../lib/taste-steps.mjs';
import { parseSignature } from '../../core/motion/signature.js';
import { unchosenAdvice, signatureLine } from '../lib/signature.mjs';
import { cameraOnlySpans, cameraSpans } from '../lib/camera-moves.mjs';
import { typingSpans } from '../lib/typing-spans.mjs';
import { boardVerify } from '../lib/board-verify.mjs';
import { runMotionCollector, motionLint, measureMotion, unwaived, lintLines, sightedRecords, unseenMotionLines } from '../lib/motion-lint.mjs';
import { sampleBoxTracks, lintTimes } from '../lib/box-track.mjs';
import { barLint, boxMotion, overshootPct, timedArrivals } from '../lib/bar-lint.mjs';
import { measureDraftShape, overshootLine, rangeLines } from '../lib/draft-range.mjs';
import { groundHueLines, GROUND_HUE } from '../lib/ground-hue.mjs';
import { namedRef, refsDir, refGround } from '../lib/refs.mjs';
import { adviceBlock, errorLine } from '../lib/advice.mjs';
import { edgeTravelDeltas } from '../lib/edge-travel.mjs';
import { textCollisionLines } from '../lib/text-collision.mjs';
import { contrastLines, unwaivedContrast } from '../lib/text-contrast.mjs';
import { peakLine } from '../lib/peak-limit.mjs';
import { balanceLines } from '../lib/cue-balance.mjs';
import { bedLine } from '../lib/bed-motion.mjs';
import { watchPageErrors, pageErrorLines } from '../lib/page-errors.mjs';
import { readPageVideos } from './page-video.mjs';
import { watchLoad, loadStallLines } from '../lib/load-stall.mjs';
import { canvasCoversFrame, CANVAS_SHARE, DOM_PICTURE_CHECKS, canvasFilmNote } from '../lib/canvas-film.mjs';
import { takeRenderSlot, slotsInUse } from '../lib/render-slots.mjs';
import { noteVerb } from '../lib/verb-log.mjs';
import { createPhaseTimer } from '../lib/phase-timer.mjs';
import { machineLanes } from '../lib/lane-budget.mjs';

// A laptop running two renders at 4 workers each overheats and throttles; the second render starts cool.
const COOL_WORKERS = 2;

export function defaultWorkers(env = process.env, busy = () => slotsInUse().length > 1, lanes = machineLanes) {
  if (Number(env.VAWE_WORKERS) > 0) return Number(env.VAWE_WORKERS);
  return busy() ? Math.min(COOL_WORKERS, lanes()) : lanes();
}

// A page with several WebGL canvases slows down over a long run until one CDP call times out; a fresh
// page every 300 subframes keeps it fast, and a seek is a pure function of time so the pixels do not change.
const RECYCLE_SUBFRAMES = 300;

const LARGE_FINAL_SUBFRAMES = 8000;
const SUBFRAMES_PER_MINUTE = 1000;

// A page keeps raster state between seeks: the first frame on a fresh page differs from the same frame
// reached by seeking on (a sparse SSIM 0.99997 drift on gradient text). So the slice boundaries are fixed
// by this constant, never by the worker count, and each slice starts on its own fresh page: the pixels
// are then identical for any --workers. A draft trades that for speed: its slices are sized to the work.
const SLICE_FRAMES = 60;
const MIN_DRAFT_SLICE_FRAMES = 15;

// A final keeps SLICE_FRAMES. A draft splits the frames evenly over the worker lanes (several slices per lane
// only when a lane would carry more than SLICE_FRAMES), so a short window still uses every worker.
export function sliceFramesFor(frames, workers, final) {
  if (final) return SLICE_FRAMES;
  const perLane = Math.ceil(frames / workers);
  return Math.max(MIN_DRAFT_SLICE_FRAMES, Math.ceil(perLane / Math.ceil(perLane / SLICE_FRAMES)));
}

// A final captures lossless PNG. A draft captures JPEG at quality 92 (about 73 KB a frame on colour-sting).
const DRAFT_JPEG_QUALITY = 92;
export const frameFormat = (final) => (final
  ? { ext: 'png', label: 'final: png, software', shot: { type: 'png', optimizeForSpeed: true } }
  : { ext: 'jpg', label: 'draft: jpeg, gpu', shot: { type: 'jpeg', quality: DRAFT_JPEG_QUALITY, optimizeForSpeed: true } });

// page.screenshot must keep its browser-wide lock: parallel Page.captureScreenshot calls on several tabs
// returned 1200x818 frames (measured). Only its result decode is slow (a per-character Uint8Array.from,
// about 70 ms a 1 MB PNG on the one node thread), so take the base64 string and decode it with Buffer.
async function captureShot(page, shot, stats = null) {
  const t0 = performance.now();
  const b64 = await page.screenshot({ ...shot, encoding: 'base64' });
  const t1 = performance.now();
  const bytes = Buffer.from(b64, 'base64');
  if (stats) Object.assign(stats, { call: t1 - t0, decode: performance.now() - t1 });
  return bytes;
}

const die = (msg, code = 1) => { console.error(errorLine(msg)); process.exit(code); };

// Page meta the renderer needs before the page loads (its canvas, its authoring rate), read from the
// file so the viewport is right before any page script runs.
export function readPageMeta(pagePath, name) {
  return metaOf(fs.readFileSync(pagePath, 'utf8'), name);
}

// Profile only: per-subframe stage times (seek, settle, screenshot call and decode, write) appended here as JSONL.
const BENCH_TIMING_FILE = process.env.VAWE_BENCH_TIMING_FILE || null;

const NAV_TIMEOUT_MS = 30_000;
const NAV_RETRY_TIMEOUT_MS = 120_000;

// Puppeteer's 30 s navigation limit fired on two drafts that ran beside a loaded machine: a second try with a longer limit,
// but only when nothing explains the stall. An unfinished request, a blocked main thread or a console error fails at once, naming it.
export async function gotoLoaded(page, url, pagePath = url) {
  const watch = watchLoad(page);
  try { await page.goto(url, { waitUntil: 'load', timeout: NAV_TIMEOUT_MS }); } catch (e) {
    if (e?.name !== 'TimeoutError') throw e;
    const why = await loadStallLines(page, watch, pagePath);
    if (why.length) throw new InvariantError([`${pagePath}: no load event after ${NAV_TIMEOUT_MS / 1000} s`, ...why]);
    await page.goto(url, { waitUntil: 'load', timeout: NAV_RETRY_TIMEOUT_MS });
  }
}

export async function openPage(pagePath, frame, { warm = false, final = true, lane = null, measure = false } = {}) {
  const opened = lane ? await openLanePage(lane, pagePath, frame) : await openPreview(pagePath, { width: frame.width, height: frame.height, scale: frame.scale, final, warm, frameKey: `${frame.aspect}@${frame.width}x${frame.height}` });
  if (opened.reused) return opened;
  // The tab that holds browser focus rasterizes edges differently from the others (sub-pixel text and
  // shape edges, SSIM 0.9994), so which slice was frontmost changed the pixels with --workers.
  const cdp = await opened.page.createCDPSession();
  await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true });
  // The document timeline runs in real time from page load, and the compositor rasterizes the animated layers against that
  // time before the first seek pauses them: a first seek 1.5 s after load painted other edge pixels than one at 0.05 s.
  // Rate 0 freezes the timeline, so only a seek moves an animation.
  await cdp.send('Animation.enable');
  await cdp.send('Animation.setPlaybackRate', { playbackRate: 0 });
  opened.cdp = cdp;
  const duration = measure ? undefined : frame.duration ?? await autoDuration(pagePath, frame);
  await opened.page.evaluateOnNewDocument(`(${installPageClock})();(${installPageFrame})(${JSON.stringify({ ...frame, eases: EASE_VARS, duration })});(${installPageReady})();window.__pageFonts = ${awaitFonts};window.__pageReady = ${awaitReady};window.__pageSeek = ${seekTo};window.__stillKey = ${stillKey};`);
  return opened;
}

async function openLane(software) {
  const puppeteer = await loadPuppeteer();
  const server = await serveRepo({ root: REPO_ROOT });
  const browser = trackBrowser(await puppeteer.launch({ headless: true, args: pageArgs(software), protocolTimeout: PROTOCOL_TIMEOUT_MS }));
  return { browser, port: server.port, close: async () => { await browser.close().catch(() => {}); server.close(); } };
}

// GPU compositing rasterised an SVG filter in two different states at random (the gooey move: 70 of 216 draft
// frames differed between two renders in one shared browser, 1 of 1296 with a Chrome per lane). Software compositing
// gave 0 of 648 but costs a draft about 2.5x, so only a page that draws a filter pays it.
const SVG_FILTER = /<filter[\s>]|\bfe[A-Z][a-zA-Z]+\b|filter\s*:[^;}]*url\(|createElementNS\([^)]*['"]filter['"]/;
const IMPORTED = /(?:from\s*|import\s*\(?\s*)['"]([^'"]+\.m?js)['"]/g;

/** Whether the page, or a module it imports (relative or from the repo root), has text matching `pattern`. */
export function pageSourceMatches(pagePath, pattern, seen = new Set()) {
  const file = path.resolve(pagePath);
  if (seen.has(file) || !fs.existsSync(file)) return false;
  seen.add(file);
  const text = fs.readFileSync(file, 'utf8');
  if (pattern.test(text)) return true;
  return [...text.matchAll(IMPORTED)].some(([, spec]) => pageSourceMatches(spec.startsWith('/') ? path.join(REPO_ROOT, spec) : path.resolve(path.dirname(file), spec), pattern, seen));
}

export const usesSvgFilter = (pagePath) => pageSourceMatches(pagePath, SVG_FILTER);

async function openLanePage(lane, pagePath, frame) {
  const page = await lane.browser.newPage();
  await page.setViewport({ width: frame.width, height: frame.height, deviceScaleFactor: frame.scale });
  const url = `http://127.0.0.1:${lane.port}/${path.relative(REPO_ROOT, path.resolve(pagePath))}${pageQuery()}`;
  return { page, url, persistent: true, close: () => page.close() };
}

// The seek itself is core/engine/page-seek.js seekTo, installed as window.__pageSeek so the studio runs the
// same code. Here it is followed by settle(), which only a screenshot needs.
export async function seekAll(page, ms) {
  await page.evaluate((t) => window.__pageSeek(t / 1000), ms);
  await settle(page);
}

// A screenshot must never catch a half-painted frame: fonts loaded, images decoded, and two real paints
// after the seek. The real rAF is raced against a real timer because a background tab can starve rAF.
export async function settle(page) {
  await page.evaluate(async () => {
    const real = window.__pageClock ? window.__pageClock.real : { raf: requestAnimationFrame.bind(window), setTimeout: setTimeout.bind(window), clearTimeout: clearTimeout.bind(window) };
    const paint = () => new Promise((resolve) => {
      const guard = real.setTimeout(resolve, 250);
      real.raf(() => { real.clearTimeout(guard); resolve(); });
    });
    if (window.__pageReady) await window.__pageReady();
    await window.__pageFonts();
    await Promise.all([...document.images].map((img) => img.decode().catch(() => {})));
    await paint();
    await paint();
  });
}

// Per-output-frame displacement in px, no screenshots: the largest paused-animation target edge travel
// (move, resize, turn or inset clip) between consecutive frame times, over every animated element. A pure function of the page's own
// animation timing, so it is as deterministic as the capture itself. Returns null when the page has
// nothing to measure this way (window.seek, onFrame hooks, or no animations at all).
async function frameSpeedsFromBoxes(page, frames, fps, from) {
  if (await page.evaluate(isScripted) || !(await page.evaluate(() => document.getAnimations().length))) return null;
  const times = Array.from({ length: frames + 1 }, (_, i) => from + i / fps);
  return edgeTravelDeltas((await sampleBoxTracks(page, times, 'animated')).tracks);
}

const isScripted = () => typeof window.seek === 'function' || (window.__vaweFrameHooks || []).length > 0;

const PIXEL_W = 64;

// Mean absolute luma difference (0-255) between consecutive frames downscaled to PIXEL_W wide, one
// low-quality screenshot per frame. An estimate of "how much of the picture moved", enough to tell a
// held frame from a fast one, decoded inside the page so the renderer needs no image library.
async function frameSpeedsFromPixels(pagePath, frame, frames, fps, from, workers, stallMs, final) {
  const speeds = new Array(frames);
  const lumaAt = async (page, i, mark) => {
    mark('seek');
    await seekAll(page, from * 1000 + (i / fps) * 1000);
    mark('speed screenshot');
    const shot = await page.screenshot({ type: 'jpeg', quality: 40, encoding: 'base64', clip: { x: 0, y: 0, width: frame.width, height: frame.height, scale: PIXEL_W / (frame.width * frame.scale) } });
    return page.evaluate(async (b64, w) => {
      const blob = await (await fetch(`data:image/jpeg;base64,${b64}`)).blob();
      const bmp = await createImageBitmap(blob);
      const h = Math.max(1, Math.round((bmp.height / bmp.width) * w));
      const ctx = new OffscreenCanvas(w, h).getContext('2d', { willReadFrequently: true });
      ctx.drawImage(bmp, 0, 0, w, h);
      const px = ctx.getImageData(0, 0, w, h).data;
      const out = [];
      for (let k = 0; k < px.length; k += 4) out.push(0.299 * px[k] + 0.587 * px[k + 1] + 0.114 * px[k + 2]);
      return out;
    }, shot, PIXEL_W);
  };
  await runShards(pagePath, frame, frames, workers, async (page, i, local, mark) => {
    local.prev ??= await lumaAt(page, i, mark);
    const next = await lumaAt(page, i + 1, mark);
    let sum = 0;
    for (let k = 0; k < next.length; k++) sum += Math.abs(next[k] - local.prev[k]);
    speeds[i] = sum / next.length;
    local.prev = next;
    return 2;
  }, { fps, from, stallMs, final, sliceFrames: sliceFramesFor(frames, workers, final) });
  return speeds;
}

// The pixels of a render are a pure function of the page folder, core/ and the render settings: this key names
// both the speed pass answer and the frames dir, so a second render of an unchanged page reuses them.
// It hashes bytes, not mtimes: a touch, checkout or rebase between a failed final and its resume must keep the key.
export function renderKey({ pagePath, frame, frames, fps, from, blur, draftVariant = null, query = pageQuery() }) {
  const files = [path.dirname(path.resolve(pagePath)), path.join(REPO_ROOT, 'core')];
  return createHash('sha1').update(JSON.stringify([treeSignature(files, { content: true }), path.resolve(pagePath), frame, frames, fps, from, blur, ...(draftVariant ? [draftVariant] : []), ...(query ? [query] : [])])).digest('hex').slice(0, 16);
}

async function frameSubframes(page, job, key) {
  const cacheFile = scratch('render-prepass', `${key}.json`);
  try { return JSON.parse(fs.readFileSync(cacheFile, 'utf8')); } catch { /* not cached yet */ }
  const kArr = await measureSubframes(page, job);
  fs.writeFileSync(cacheFile, JSON.stringify(kArr));
  return kArr;
}

// Returns bucketed subframe counts per output frame.
export async function measureSubframes(page, { pagePath, frame, frames, fps, from, blur, workers, stallMs, final }) {
  const boxes = await frameSpeedsFromBoxes(page, frames, fps, from);
  if (boxes) return clampSegments(boxes.map((px) => subframesForTravel(px * frame.scale, blur)));
  return clampSegments(bucketize(await frameSpeedsFromPixels(pagePath, frame, frames, fps, from, workers, stallMs, final), blur, PIXEL_BANDS));
}

// A fast move blended from too few subframes shows as separate copies of the object (3 ghosts at 3
// subframes); enough subframes that neighbours sit at most STEP_PX apart read as one smooth streak.
// SHUTTER is the share of the frame interval the blur spans (0.5 = a film camera's 180 degree shutter).
// Counts are powers of two so the ffmpeg graph's segment count follows motion regimes, not frames.
export const SHUTTER = 0.5;
const STEP_PX = 3;
export function subframesForTravel(px, cap) {
  let k = 1;
  while (k < cap && (px * SHUTTER) / k > STEP_PX) k = Math.min(cap, k * 2);
  return k;
}

// The pixel estimate cannot measure travel: mean luma difference bands [still below, fast from]. It cannot
// tell a frame that needs 32 subframes from one that needs 16, so its fast band stops at 16 (a measured 5 s
// three.js film: 4,017 subframes at 16, 7,805 at 32).
const PIXEL_BANDS = [0.15, 1.5];
function bucketize(speeds, blur, [still, fast]) {
  const mid = Math.min(blur, 4), top = Math.min(blur, 16);
  return speeds.map((s) => (s < still ? 1 : s < fast ? mid : top));
}

function clampSegments(kArr, cap = 200) {
  let segs = kArr.length ? 1 : 0;
  for (let i = 1; i < kArr.length; i++) if (kArr[i] !== kArr[i - 1]) segs++;
  if (segs <= cap) return kArr;
  const maxK = Math.max(1, ...kArr);
  return kArr.map(() => maxK);
}

// Runs work(page, i, local, mark) for every frame 0..frames-1 in slices of run.sliceFrames, `workers` slices at
// a time, each slice on its own recycled page. work returns how many seeks it made; `local` is that slice's own state;
// work calls mark('<step>') before each await so a stall can name it.
// A slice whose browser or page dies, or that makes no progress for `stallMs`, runs again from its first frame on a
// fresh page, up to SLICE_ATTEMPTS in all; then the render throws an InvariantError. Returns the retried slices as
// "lo-hi s" strings, one per retry. `run` is { fps, from } (they only name the time range) and optionally stallMs,
// resume { done(slice), finish(slice) } to skip the slices an earlier run finished, and fault(slice, attempt), a test
// hook that may throw at the start of an attempt. `run.final` picks the browser flags and `run.sliceFrames` the slice size.
const LOST_PAGE = /Connection closed|Target closed|No target with given id|Session closed|Protocol error|timed out|timeout/i;

// Measured slowest step: 0.38 s (a colour-sting draft screenshot); awaitFonts gives up at 10 s. A step at 60 s
// is stuck, and the 30 min CDP protocol timeout would fire far too late.
export const STALL_MS = 60000;

// A step inside a frame is stuck when it runs this many times the median frame of the same render, between a floor (awaitFonts
// alone may wait 10 s) and STALL_MS. Until STALL_SAMPLES frames are done, or for a page open, STALL_MS stands.
const STALL_MEDIAN_X = 10;
const STALL_FLOOR_MS = 15000;
const STALL_SAMPLES = 5;
const SLOW_FRAME_MS = 5000;
const PAGE_STEPS = new Set(['open page', 'load page', 'close page']);

const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

/** The idle time after which a step is stalled, from the durations of the frames done so far. Pure. */
export function stallLimitMs(frameMs, step, ceilingMs, floorMs = Math.min(STALL_FLOOR_MS, ceilingMs)) {
  if (PAGE_STEPS.has(step) || frameMs.length < STALL_SAMPLES) return ceilingMs;
  return Math.min(ceilingMs, Math.max(floorMs, STALL_MEDIAN_X * median(frameMs)));
}

const STALL_CAUSES = {
  seek: 'the page does heavy or endless work per seek (a window.seek or onFrame hook that loops or waits on the network)',
  'settle (fonts, image decode, two paints)': 'a font, image or texture fetch that never finishes, or a paint that never completes',
  screenshot: 'the browser cannot paint the frame: a GPU stall, a WebGL or canvas scene too heavy for the size, a filter on a huge layer',
  'open page': 'the browser did not open a page: the machine is starved or another process closed Chrome',
  'load page': 'the page does not finish loading: a request, tile or module that never answers',
};

export const stallCause = (step) => STALL_CAUSES[step] ?? 'a step that never finishes';

export const SLICE_ATTEMPTS = 4;

class StallError extends Error {}

async function runShards(pagePath, frame, frames, workers, work, run) {
  const { stallMs = STALL_MS, resume = null, fault = null, final, sliceFrames } = run;
  const software = final || usesSvgFilter(pagePath);
  const slices = [];
  for (let lo = 0; lo < frames; lo += sliceFrames) slices.push([lo, Math.min(frames, lo + sliceFrames)]);
  const restarted = [];
  const frameMs = [];
  let slowNoted = false;
  const noteSlow = () => {
    if (slowNoted || frameMs.length < STALL_SAMPLES || median(frameMs) < SLOW_FRAME_MS) return;
    slowNoted = true;
    const each = median(frameMs);
    console.error(`slow frames: ${(each / 1000).toFixed(1)} s each (median of ${frameMs.length}), about ${Math.round((each * frames) / workers / 60000)} min for ${frames} frames. Likely cause: ${stallCause('seek')}; or ${stallCause('screenshot')}. Draft a shorter range with --from and --to, or fix the cause.`);
  };
  let next = 0;
  // A page opened or closed during another lane's screenshot gave that frame a corrupt 1200x818 tile (3 of 9 renders, tide-v).
  let queue = Promise.resolve();
  const exclusive = (fn) => { const turn = queue.then(fn); queue = turn.catch(() => {}); return turn; };
  const range = ([lo, hi]) => `${(run.from + lo / run.fps).toFixed(2)}-${(run.from + hi / run.fps).toFixed(2)}s`;
  const runSliceOnce = async ([lo, hi], worker, attempt, lane) => {
    const ex = lane ? (fn) => fn() : exclusive;
    const at = { frame: lo, step: 'open page', since: Date.now(), stuck: false, opened: null };
    const mark = (step, i = at.frame) => {
      if (at.stuck) throw new StallError('abandoned after a stall');
      Object.assign(at, { step, frame: i, since: Date.now() });
    };
    const loop = (async () => {
      const local = {};
      let sinceOpen = 0;
      try {
        if (fault) await fault([lo, hi], attempt, lane);
        for (let i = lo; i < hi; i++) {
          if (at.opened && sinceOpen >= RECYCLE_SUBFRAMES) { mark('close page', i); await ex(() => at.opened.close().catch(() => {})); at.opened = null; }
          if (!at.opened) {
            mark('open page', i);
            at.opened = await ex(() => openPage(pagePath, frame, { final, lane }));
            mark('load page', i);
            await gotoLoaded(at.opened.page, at.opened.url, pagePath);
            sinceOpen = 0;
          }
          mark('frame', i);
          const frameStart = Date.now();
          sinceOpen += await work(at.opened.page, i, local, (step) => mark(step, i), ex);
          frameMs.push(Date.now() - frameStart);
          noteSlow();
        }
      } finally { if (at.opened) await ex(() => at.opened.close().catch(() => {})); }
    })();
    let timer;
    const stalled = new Promise((_, reject) => {
      timer = setInterval(() => {
        const idle = Date.now() - at.since;
        const limit = stallLimitMs(frameMs, at.step, stallMs, run.stallFloorMs);
        if (idle < limit) return;
        at.stuck = true;
        if (at.opened) at.opened.close().catch(() => {});
        const t = (run.from + at.frame / run.fps).toFixed(2);
        const basis = frameMs.length >= STALL_SAMPLES && limit < stallMs ? `${(limit / 1000).toFixed(1)} s is ${STALL_MEDIAN_X} times the median frame of ${(median(frameMs) / 1000).toFixed(2)} s` : `${(limit / 1000).toFixed(0)} s is the limit`;
        reject(new StallError(`render stalled: worker ${worker}, frame ${at.frame} (${t} s), in ${at.step} for ${(idle / 1000).toFixed(0)} s (${basis}). Likely cause: ${stallCause(at.step)}`));
      }, Math.min(1000, stallMs / 4));
    });
    loop.catch(() => {});
    try { await Promise.race([loop, stalled]); } finally { clearInterval(timer); }
  };
  const runSlice = async (slice, worker, lane) => {
    if (resume && resume.done(slice)) return;
    for (let attempt = 1; ; attempt++) {
      try {
        if (lane && !lane.browser.connected) { await lane.close(); Object.assign(lane, await openLane(software)); }
        await runSliceOnce(slice, worker, attempt, lane);
        if (resume) resume.finish(slice);
        return;
      } catch (e) {
        const stall = e instanceof StallError;
        if (!stall && !LOST_PAGE.test(String(e && e.message))) throw e;
        if (attempt === SLICE_ATTEMPTS) {
          if (stall) throw new InvariantError([`${e.message}, ${SLICE_ATTEMPTS} times on slice ${range(slice)}`]);
          throw new InvariantError([`slice ${slice[0]}-${slice[1]} (${range(slice)}) lost its page ${SLICE_ATTEMPTS} times: another process closed the shared browser, or the page crashed (${e.message})`]);
        }
        console.error(`${stall ? e.message : `slice ${range(slice)} lost its page (${e.message})`}; retrying slice ${range(slice)} on a fresh page (attempt ${attempt + 1} of ${SLICE_ATTEMPTS})`);
        restarted.push(range(slice));
      }
    }
  };
  // After a failure no new slice starts, but the slices already running finish, so a later run resumes them.
  let failure = null;
  const lane = async (worker) => {
    // Each lane gets its own Chrome: lanes in one browser queue every screenshot, open and close, and a 20 s film captured 3x slower (140 s against 47 s); tabs of one browser also changed filter pixels.
    const own = insideRoot(REPO_ROOT, path.resolve(pagePath)) ? await openLane(software) : null;
    try {
      while (next < slices.length && !failure) await runSlice(slices[next++], worker, own).catch((e) => { failure ??= e; });
    } finally { if (own) await own.close(); }
  };
  await Promise.all(Array.from({ length: Math.min(workers, slices.length) }, (_, w) => lane(w + 1)));
  if (failure) throw failure;
  return restarted;
}

// Runs inside the page after a seek: a key for everything time can change, or null when time can reach
// the pixels some other way (window.seek, onFrame hooks, pending clock callbacks, canvas, video, SMIL).
// Two subframes with the same key paint the same pixels, so the second reuses the first capture.
const stillKey = () => {
  if (typeof window.seek === 'function' || (window.__vaweFrameHooks || []).length || window.__pageClock?.pending?.()) return null;
  if (document.querySelector('canvas, video, iframe, animate, animateTransform, animateMotion, set')) return null;
  return JSON.stringify(document.getAnimations().map((a) => { const c = a.effect.getComputedTiming(); return [c.progress, c.currentIteration]; }));
};

// One round trip: a CDP call costs about as much as the seek itself on a page with a heavy frame hook.
const seekThenKey = async (ms) => { await window.__pageSeek(ms / 1000); return window.__stillKey(); };

// A reused capture is only ever the previous one on the same page, so the pixels stay independent of --workers.
// A slice that finished writes slice-<lo>.done in tmpDir; a later render into the same tmpDir skips it and calls onResumed.
async function captureFrames(pagePath, tmpDir, frames, kArr, subframeStart, fps, from, frame, workers, onSubframe, { stallMs, stallFloorMs, fault, onResumed, final, sliceFrames }) {
  const format = frameFormat(final);
  const marker = ([lo]) => path.join(tmpDir, `slice-${lo}.done`);
  const resume = {
    done: (slice) => { const found = fs.existsSync(marker(slice)); if (found) onResumed(slice); return found; },
    finish: (slice) => fs.writeFileSync(marker(slice), ''),
  };
  return runShards(pagePath, { ...frame, scale: 1 }, frames, workers, async (page, i, local, mark, exclusive) => {
    const baseMs = from * 1000 + (i / fps) * 1000;
    const k = kArr[i];
    for (let j = 0; j < k; j++) {
      const file = path.join(tmpDir, `f${String(subframeStart[i] + j).padStart(6, '0')}.${format.ext}`);
      mark('seek');
      const t0 = performance.now();
      const key = await page.evaluate(seekThenKey, baseMs + (j / k) * SHUTTER * (1000 / fps));
      const t1 = performance.now();
      const reused = key !== null && key === local.key;
      if (reused) { fs.rmSync(file, { force: true }); fs.linkSync(local.file, file); } else {
        mark('settle (fonts, image decode, two paints)');
        await settle(page);
        const t2 = performance.now();
        mark('screenshot');
        const stats = BENCH_TIMING_FILE ? {} : null;
        let bytes = await exclusive(() => captureShot(page, format.shot, stats));
        for (let retake = 0; shouldRetake(bytes.length, local.size, retake); retake++) {
          mark('screenshot (taken again: the first of a slice, or a blank one)');
          await new Promise((resolve) => setTimeout(resolve, BLANK_RETRY_WAIT_MS));
          await page.evaluate(seekThenKey, baseMs + (j / k) * SHUTTER * (1000 / fps));
          await settle(page);
          bytes = await exclusive(() => captureShot(page, format.shot, stats));
        }
        if (!isBlankShot(bytes.length, local.size)) local.size = bytes.length;
        const t3 = performance.now();
        fs.writeFileSync(file, bytes);
        if (stats) fs.appendFileSync(BENCH_TIMING_FILE, `${JSON.stringify({ i, j, seek: t1 - t0, settle: t2 - t1, shot: t3 - t2, call: stats.call, decode: stats.decode, write: performance.now() - t3, bytes: bytes.length })}\n`);
      }
      Object.assign(local, { key, file });
      onSubframe(i, reused);
    }
    return k;
  }, { fps, from, stallMs, stallFloorMs, fault, resume, final, sliceFrames });
}

// A draft's slice size follows the worker count, which follows how busy the machine is: a kept frames dir keeps the size its first run chose, so a resume finds the same slices.
function pinnedSliceFrames(dir, wanted) {
  const file = path.join(dir, 'slice-frames');
  const kept = Number(fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : 0);
  if (kept > 0) return kept;
  fs.writeFileSync(file, String(wanted));
  return wanted;
}

// Same libx264 settings the Go renderer uses for its final and draft encodes (renderer/internal/encode/
// encode.go), except CRF 16 where encode.go uses 20: a page is captured lossless and CRF 16 keeps thin
// type and gradients clean. The final uses preset fast: against medium it encodes 25% faster for a 15% larger file, 49 dB PSNR apart
// (preset faster is 2x quicker but leaves a 54 px flat run on the dark ramp of render-banding.test.mjs). Draft is ultrafast. aq-mode=3 spends bits on dark flat areas, where 8-bit bands.
// A small draft (dev --small) is a file to post, such as a share loop: preset fast at CRF 24 measured 1.0 MB against
// 4.7 MB for the plain draft on a 5 s print-grain loop at 960x504, 37.6 dB PSNR.
function x264Args(final, small = false) {
  if (final) return ['-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-preset', 'fast', '-crf', '16', '-x264-params', 'aq-mode=3', '-movflags', '+faststart'];
  return small
    ? ['-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-preset', 'fast', '-crf', '24', '-movflags', '+faststart']
    : ['-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'ultrafast', '-crf', '20', '-movflags', '+faststart'];
}

// The web copy: AV1 10-bit needs no dither, since 10 bits do not band. Measured on a 1080p dark ramp and
// two 5 s films: 1.7 and 3.6 MB, and the ramp's longest flat run 20 px (lossless 14, undithered 8-bit 98).
// An 8-bit x264 copy at that size bands (CRF 22: 121 px).
const WEB_ARGS = ['-c:v', 'libsvtav1', '-pix_fmt', 'yuv420p10le', '-crf', '30', '-preset', '8', '-svtav1-params', 'lp=2', '-movflags', '+faststart'];

// 8-bit yuv420p bands a dark gradient into visible rings; a faint fixed-seed temporal noise before the
// master encode dithers them away (the final only, so draft pixels stay comparable). Measured on a dark
// ramp: strength 3 with aq-mode=3 leaves a 20 px longest flat run at half the size of strength 4 with -tune film.
// Chromium saves some frames as RGBA (mix-blend-mode, for one); a pixel-format change mid-sequence makes
// ffmpeg rebuild the filter graph, which resets the trims and drops frames. Keep one graph, one format.
const ONE_FORMAT_IN = ['-reinit_filter', '0'];

const DITHER = 'noise=alls=3:allf=t:all_seed=7';

// One trim+tmix+select chain per run of equal subframe counts, concatenated to [blend].
function blendGraph(kArr, subframeStart, fps) {
  const segments = [];
  let segStart = 0;
  for (let i = 1; i <= kArr.length; i++) {
    if (i === kArr.length || kArr[i] !== kArr[segStart]) { segments.push({ start: segStart, end: i, k: kArr[segStart] }); segStart = i; }
  }
  const filters = segments.map((seg, idx) => {
    const s = subframeStart[seg.start], e = subframeStart[seg.end];
    const label = `s${idx}`;
    if (seg.k === 1) return `[in${idx}]trim=start_frame=${s}:end_frame=${e},setpts=N/${fps}/TB[${label}]`;
    const weights = Array(seg.k).fill('1').join(' ');
    return `[in${idx}]trim=start_frame=${s}:end_frame=${e},tmix=frames=${seg.k}:weights='${weights}',`
      + `select='not(mod(n+1\\,${seg.k}))',setpts=N/${fps}/TB[${label}]`;
  });
  const joins = segments.map((_, idx) => `[s${idx}]`).join('');
  // Each segment restarts its pts, so a 1-frame segment carries no duration and the next one overlaps
  // it; re-stamp after the concat and never let -r rate-convert, or ffmpeg drops the overlapped frames.
  const split = `[0:v]format=rgb24,split=${segments.length}${segments.map((_, idx) => `[in${idx}]`).join('')}`;
  return `${split};${filters.join(';')};${joins}concat=n=${segments.length}:v=1:a=0,setpts=N/${fps}/TB[blend]`;
}

function blendEncode(tmpDir, fps, kArr, subframeStart, final, tail, codecArgs, out) {  const seq = path.join(tmpDir, `f%06d.${frameFormat(final).ext}`);
  const args = ['-y', '-v', 'error', ...ONE_FORMAT_IN, '-framerate', String(fps), '-i', seq,
    '-filter_complex', `${blendGraph(kArr, subframeStart, fps)};[blend]${tail}[outv]`,
    '-map', '[outv]', '-fps_mode', 'passthrough', ...codecArgs, out];
  return spawnSync('ffmpeg', args, { encoding: 'utf8', maxBuffer: 1024 * 1024 * 16 });
}

// One ffmpeg pass over the blended frames: the master (x264).
// `size` is the output [width, height] when the capture is larger: the browser's own downscale gave different pixels run to run.
export function ffmpegEncode(tmpDir, fps, kArr, subframeStart, tmpOut, { final, size = null, small = false }) {
  const tail = size ? `scale=${size[0]}:${size[1]}:flags=area` : `null${final ? `,${DITHER}` : ''}`;
  return blendEncode(tmpDir, fps, kArr, subframeStart, final, tail, x264Args(final, small), tmpOut);
}

// The web copy is its own pass, run after the master is delivered.
export function ffmpegWebEncode(tmpDir, fps, kArr, subframeStart, webOut) {
  return blendEncode(tmpDir, fps, kArr, subframeStart, true, 'format=yuv420p10le', WEB_ARGS, webOut);
}

// The cost table `--profile` prints. Subframes and screenshots per film second are a pure function of the
// page and the settings; capture seconds are the measured total shared out by screenshots.
export function costLines({ kArr, reused, fps, from, prepassMs, captureMs, encodeMs }) {
  const shots = kArr.map((k, i) => k - reused[i]);
  const allShots = shots.reduce((a, b) => a + b, 0);
  const seconds = [];
  kArr.forEach((k, i) => {
    const s = Math.floor(from + i / fps);
    seconds[s] ??= { s, frames: 0, subframes: 0, shots: 0 };
    seconds[s].frames++; seconds[s].subframes += k; seconds[s].shots += shots[i];
  });
  const cost = (row) => (allShots ? (captureMs / 1000) * (row.shots / allShots) : 0).toFixed(1);
  const top = seconds.filter(Boolean).sort((a, b) => b.shots - a.shots || a.s - b.s).slice(0, 5);
  const sub = kArr.reduce((a, b) => a + b, 0);
  return [
    `cost: ${kArr.length} frames, ${sub} subframes, ${allShots} screenshots (${sub - allShots} reused), max ${Math.max(1, ...kArr)} subframes a frame`,
    `      prepass ${(prepassMs / 1000).toFixed(1)} s, capture ${(captureMs / 1000).toFixed(1)} s (${allShots ? (captureMs / allShots).toFixed(0) : 0} ms a screenshot), encode ${(encodeMs / 1000).toFixed(1)} s`,
    '  second  frames  subframes  screenshots  capture s',
    ...top.map((r) => `  ${`${r.s}-${r.s + 1}`.padEnd(6)}  ${String(r.frames).padStart(6)}  ${String(r.subframes).padStart(9)}  ${String(r.shots).padStart(11)}  ${cost(r).padStart(9)}`),
  ];
}

// Render invariants. Each check returns one line per problem; renderPage throws them together as an
// InvariantError and the CLI prints `error: <line>` for each and exits 2. An intended exception is declared
// on the page: <meta name="blank" content="0-0.4, 4.8-5"> (or data-blank on <html>) for empty frames.
export class RenderError extends Error {}

export class InvariantError extends Error {
  constructor(problems) { super(problems.join('\n')); this.problems = problems; }
}

const BLANK_RANGE_MAX = 6;
const BLANK_PROBE_WIDTH = 480;

async function fontProblems(page, pagePath) {
  const bad = await page.evaluate(() => [...new Set([...document.fonts].filter((f) => f.status === 'error').map((f) => f.family))]);
  const missing = bad.length ? missingFontsLine(REPO_ROOT, pagePath) : '';
  return bad.map((family) => `font ${family} failed to load: fix its src or remove the @font-face${missing ? `; ${missing}` : ''}`);
}

// Reads the page's <audio> specs once, before the capture: the tab that read them can be gone by the time the mux needs them
// (a 49 min final failed with "detached Frame" at 19198/19200). Returns { read: null } for a page with no <audio>.
async function readAudio(page, pagePath, duration) {
  if (!(await page.evaluate(() => document.querySelector('audio') !== null))) return { read: null, problems: [] };
  const { readPageAudio } = await import('./page-audio.mjs');
  try { return { read: await readPageAudio(page, { pagePath, duration }), problems: [] }; } catch (e) { return { read: null, problems: String(e.message).split('\n') }; }
}

// Null when the page has no <audio> or sets <meta name="loudness"> (the delivery is then normalised, so
// the as-written level is not the result).
async function mixLevel(read, duration) {
  if (!read) return null;
  const { measureMixLevel } = await import('./page-audio.mjs');
  return read.loudness === null ? measureMixLevel({ specs: read.specs, duration }) : null;
}

async function assertProblems(page) {
  const count = await page.evaluate(() => (window.__vaweAsserts || []).length);
  const problems = [];
  for (let i = 0; i < count; i++) {
    const r = await page.evaluate(async (k) => {
      const a = window.__vaweAsserts[k];
      await window.__pageSeek(a.t);
      try { return (await a.fn()) ? null : `assert at ${a.t} s failed: ${a.message}`; } catch (e) { return `assert at ${a.t} s threw (${e.message}): ${a.message}`; }
    }, i);
    if (r) problems.push(r);
  }
  return problems;
}

export function parseBlankRanges(html) {
  const tag = (html.match(/<meta\b[^>]*\bname\s*=\s*["']blank["'][^>]*>/i) || [''])[0];
  const raw = [tag.match(/\bcontent\s*=\s*["']([^"']*)["']/i)?.[1], html.match(/<html\b[^>]*\bdata-blank\s*=\s*["']([^"']*)["']/i)?.[1]].filter(Boolean).join(',');
  return raw.split(',').map((r) => r.trim().match(/^([\d.]+)\s*-\s*([\d.]+)$/)).filter(Boolean).map((m) => [Number(m[1]), Number(m[2])]);
}

// One ffmpeg pass over the encode: per frame, whether its luma and chroma are near-uniform, and its mean [Y, U, V].
export function probeStats(file) {
  const r = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-vf', `scale=${BLANK_PROBE_WIDTH}:-2:flags=area,signalstats,metadata=print:file=-`, '-f', 'null', '-'],
    { encoding: 'utf8', maxBuffer: 1024 * 1024 * 256 });
  const stats = [];
  for (const line of (r.stdout || '').split('\n')) {
    if (line.startsWith('frame:')) stats.push({});
    const m = line.match(/^lavfi\.signalstats\.([YUV](?:MIN|MAX|AVG))=([\d.]+)/);
    if (m && stats.length) stats[stats.length - 1][m[1]] = Number(m[2]);
  }
  return stats.map((f) => ({ flat: Math.max(f.YMAX - f.YMIN, f.UMAX - f.UMIN, f.VMAX - f.VMIN) <= BLANK_RANGE_MAX, avg: [f.YAVG, f.UAVG, f.VAVG] }));
}

export const probeFrames = (file) => probeStats(file).map((s) => s.flat);

/** Whether every frame is flat and all of them are one colour: a page that drew nothing, not a film of colour blocks. Pure. */
export const oneFlatColour = (stats) => stats.length > 0 && stats.every((s) => s.flat)
  && [0, 1, 2].every((k) => Math.max(...stats.map((s) => s.avg[k])) - Math.min(...stats.map((s) => s.avg[k])) <= BLANK_RANGE_MAX);

const secs = (t) => String(+t.toFixed(2));

// An entrance from opacity 0, or an exit to the ground, leaves a few empty frames at the ends; that is motion, not a bug.
const EDGE_BLANK_SEC = 0.25;

export function frameProblems(blank, { frames, fps, from, declared, hint = '', oneColour = true }) {
  const problems = [];
  if (blank.length !== frames) problems.push(`the encode has ${blank.length} frame(s), expected ${frames} (round(duration x fps))`);
  const half = 0.5 / fps;
  const declaredAt = (i) => { const t = from + i / fps; return declared.some(([a, b]) => t >= a - half && t <= b + half); };
  if (oneColour && blank.length && blank.every((b, i) => b && !declaredAt(i))) return [...problems, `every frame is one flat colour: the page drew nothing${hint ? `; ${hint}` : ''}; if intended, declare it with <meta name="blank" content="${secs(from)}-${secs(from + frames / fps)}">`];
  for (let i = 0; i < blank.length; i++) {
    if (!blank[i] || declaredAt(i)) continue;
    let j = i;
    while (j + 1 < blank.length && blank[j + 1] && !declaredAt(j + 1)) j++;
    const t0 = from + i / fps, t1 = from + j / fps;
    const atEdge = i === 0 || j === blank.length - 1;
    if (atEdge && (j - i + 1) / fps <= EDGE_BLANK_SEC) { i = j; continue; }
    const what = i === j ? `frame ${i} (${secs(t0)} s)` : `frames ${i}-${j} (${secs(t0)}-${secs(t1)} s)`;
    problems.push(`${what} blank; declare it with <meta name="blank" content="${secs(t0)}-${secs(t1 + 1 / fps)}"> if intended`);
    i = j;
  }
  return problems;
}

// The brief.md next to a page states the length and aspect the film was asked for; a page that drifted
// from them fails before any frame is drawn. Only answered lines count (`- length: 5 s`, `- aspect: 16:9`).
export function briefProblems(pagePath) {
  const briefPath = path.join(path.dirname(path.resolve(pagePath)), 'brief.md');
  if (!fs.existsSync(briefPath)) return [];
  const brief = fs.readFileSync(briefPath, 'utf8');
  const answered = (key) => brief.match(new RegExp(`^- ${key}:\\s*([^\\n]*)$`, 'im'))?.[1];
  const line = (key) => { const v = answered(key); return v && !v.includes('[unanswered') ? v : null; };
  const wantLength = Number(line('length')?.match(/^([\d.]+)\s*s\b/)?.[1]);
  const wantAspect = line('aspect')?.match(/^\d+:\d+/)?.[0];
  const haveLength = statedLength(fs.readFileSync(pagePath, 'utf8')) ?? 0;
  const haveAspect = readPageMeta(pagePath, 'aspect') || '16:9';
  const lengthDrift = wantLength > 0 && haveLength !== 'auto' && haveLength !== wantLength;
  const aspectDrift = wantAspect && haveAspect !== wantAspect;
  if (!lengthDrift && !aspectDrift) return [];
  return [`brief: ${wantLength > 0 ? wantLength : haveLength} s ${wantAspect || haveAspect}; page: ${haveLength} s ${haveAspect}`];
}

// The canvas a page renders at: an `aspect` option, else --aspect (VAWE_ASPECT), else the page's own <meta name="aspect">, else 16:9. width and
// height are the CSS viewport, always the aspect's full size from core/layout/aspects.js, so px values lay
// out the same in a draft and a final; scale is the device scale of the capture (0.5 draft, 1 final).
// w/h set the output size: scale = w / full width (else h / full height), CSS size = output / scale.
// Returns { aspect, width, height, scale, outWidth, outHeight }: the output is outWidth x outHeight, each side
// rounded to an even number because libx264 with yuv420p refuses an odd side (a 4:5 draft is 540x675 before rounding).
export function resolveFrame(pagePath, { aspect, w, h, final = false } = {}) {
  const name = aspect || aspectOverride() || readPageMeta(pagePath, 'aspect') || '16:9';
  const problem = aspectProblem(name);
  if (problem) throw new RenderError(`${pagePath}: unknown aspect ${problem}`);
  const [fw, fh] = aspectDims(name);
  const scale = w ? w / fw : h ? h / fh : final ? 1 : 0.5;
  const outW = w || Math.round(fw * scale), outH = h || Math.round(fh * scale);
  const even = (n) => Math.max(2, 2 * Math.round(n / 2));
  return { aspect: name, width: Math.round(outW / scale), height: Math.round(outH / scale), scale, outWidth: even(outW), outHeight: even(outH) };
}

// The page's <audio> elements are read from the loaded page before the capture (readAudio) and mixed offline, never played
// (harness/media/page-audio.mjs). Returns false when the page has no <audio> and none was demanded.
async function muxPageAudio(read, pagePath, { video, out, duration, explicit, fault }) {
  if (!read) {
    if (explicit) throw new RenderError(`${pagePath}: --audio given but the page has no <audio> element`);
    return false;
  }
  let audio;
  try { audio = await import('./page-audio.mjs'); } catch (e) {
    if (e.code === 'ERR_MODULE_NOT_FOUND') throw new RenderError(`${pagePath} has <audio> elements but harness/media/page-audio.mjs is missing: ${e.message}`);
    throw e;
  }
  if (fault) fault();
  const muxed = `${out}.mux-${process.pid}.mp4`;
  try { await audio.mixAndMux({ specs: read.specs, duration, video, out: muxed, loudness: read.loudness }); } catch (e) { fs.rmSync(muxed, { force: true }); throw e; }
  fs.renameSync(muxed, out);
  return true;
}

/**
 * renderPage(pagePath, outPath, opts) -> { frames, subframes, captureMs, encodeMs, dur }.
 * opts: aspect (the page's <meta name="aspect">, else 16:9), w/h (the output pixel size; see resolveFrame),
 * muxFault (test hook: called before the audio mux), final (false: half-size capture of the same layout, ultrafast x264), audio (mix the page's <audio> elements in; a whole render does by default, a windowed render stays silent unless true), fps (30), blur (1, the MAX subframes blended per output frame; each
 * frame gets what its fastest move needs, a still frame 1), from (0, seconds into the page's own timeline the
 * render starts at), durArg (seconds rendered from `from`; defaults to the page's own <meta
 * name="duration"> minus `from`), progress (false; prints a single overwriting capture-progress line), stallMs (STALL_MS, the most a step may run without progress before its slice restarts; after 5 frames the limit is 10 times their median, at least 15 s), stallFloorMs (test hook: the least that limit may be).
 */
export async function renderPage(pagePath, outPath, opts = {}) {
  const { fps = 30, blur = 1, durArg = null, from = 0, progress = false, final = false } = opts;
  if (!fs.existsSync(pagePath)) throw new RenderError(`no such file: ${pagePath}`);
  const canvas = resolveFrame(pagePath, opts);
  const length = await resolveLength(pagePath, canvas).catch((e) => { throw e instanceof DurationError ? new RenderError(e.message) : e; });
  const frame = length.auto ? { ...canvas, duration: length.seconds } : canvas;
  const wantAudio = opts.audio ?? (from === 0 && durArg == null);
  if (opts.audio && from > 0) throw new RenderError('--audio needs a render from 0: the mix has no offset');
  const phases = createPhaseTimer();
  const startS = process.uptime();
  const slot = await phases.time('slot', () => takeRenderSlot({ kind: process.env.VAWE_RENDER_KIND || (final ? 'final' : 'draft'), who: filmKeyOf(pagePath) }));
  noteVerb({ slotWaitS: phases.seconds('slot') });
  removeStaleFrames(path.dirname(path.resolve(outPath)));
  const { page, url, close, chrome } = await phases.time('chrome', () => openPage(pagePath, frame, { final }));
  const scriptErrors = watchPageErrors(page);
  try {
    const audioRead = await phases.time('load', async () => {
      await gotoLoaded(page, url, pagePath);
      const videos = await readPageVideos(page, pagePath);
      if (videos.warnings.length) console.error(adviceBlock(videos.warnings).join('\n'));
      if (videos.problems.length) throw new InvariantError(videos.problems.map((p) => `${pagePath}: ${p}`));
      try { await settle(page); } catch (e) {
        const msg = String(e.message).replace(/^.*?Error: /, '');
        if (/^(font (still loading|failed)|page not ready|video failed)/.test(msg)) throw new InvariantError([msg]);
        throw e;
      }
      const read = await readAudio(page, pagePath, length.seconds);
      const early = [...pageErrorLines(scriptErrors, pagePath), ...await fontProblems(page, pagePath), ...read.problems, ...await assertProblems(page)];
      if (early.length) throw new InvariantError(early);
      return read;
    });

    const dur = durArg != null ? durArg : Math.max(0, length.seconds - from);
    if (!(dur > 0)) throw new RenderError(`${pagePath}: no duration (add <meta name="duration" content="<seconds>"> or pass --dur/--to)`);

    const { motion = null, probe = null } = opts.checks ? await probePage(page, dur, pagePath, { checks: opts.checks, from, whole: from === 0 && durArg == null, length: length.seconds }) : {};
    const frames = Math.round(dur * fps);
    if (!(frames > 0)) throw new RenderError(`${pagePath}: ${dur}s at ${fps}fps rounds to 0 frames`);

    const workers = opts.workers || defaultWorkers(process.env, () => slot.others > 0);
    const tPre = Date.now();
    const draftVariant = final ? null : 'jpeg';
    const key = renderKey({ pagePath, frame, frames, fps, from, blur, draftVariant });
    const kArr = blur > 1 ? await frameSubframes(page, { pagePath, frame, frames, fps, from, blur, workers, stallMs: opts.stallMs, final }, key) : Array(frames).fill(1);
    const tmpDir = `${outPath}.frames-${key}`;
    fs.mkdirSync(tmpDir, { recursive: true });
    const sliceFrames = pinnedSliceFrames(tmpDir, sliceFramesFor(frames, workers, final));
    const subframeStart = new Array(frames + 1);
    subframeStart[0] = 0;
    for (let i = 0; i < frames; i++) subframeStart[i + 1] = subframeStart[i] + kArr[i];
    const totalSub = subframeStart[frames];
    if (final && totalSub > LARGE_FINAL_SUBFRAMES) console.error(adviceBlock([`${totalSub} subframes to capture: about ${Math.round(totalSub / SUBFRAMES_PER_MINUTE)} min (measured: 19200 took 15 to 23 min). Lower --blur, the most subframes blended per frame (now ${blur}), or shorten the fast moves`]).join('\n'));

    const t0 = Date.now();
    const prepassMs = t0 - tPre;
    let doneSub = 0;
    const reused = new Array(frames).fill(0);
    const tick = progress ? setInterval(() => {
      process.stdout.write(`\r  capturing ${doneSub}/${totalSub} subframe(s)...`);
    }, 1000) : null;
    let resumed = 0;
    const onResumed = ([lo, hi]) => { resumed++; doneSub += subframeStart[hi] - subframeStart[lo]; };
    let restarted;
    try {
      restarted = await captureFrames(pagePath, tmpDir, frames, kArr, subframeStart, fps, from, frame, workers, (i, again) => { doneSub++; if (again) reused[i]++; }, { stallMs: opts.stallMs, stallFloorMs: opts.stallFloorMs, fault: opts.sliceFault, onResumed, final, sliceFrames });
    } catch (e) {
      throw Object.assign(e, { progress: doneSub / totalSub, framesDir: tmpDir });
    } finally {
      if (tick) { clearInterval(tick); process.stdout.write(`\r${' '.repeat(40)}\r`); }
    }
    const captureMs = Date.now() - t0;

    const tmpOut = `${outPath}.tmp-${process.pid}.mp4`;
    const webPath = final ? webOut(outPath) : null;
    const tmpWeb = webPath && `${webPath}.tmp-${process.pid}.mp4`;
    const t1 = Date.now();
    const res = ffmpegEncode(tmpDir, fps, kArr, subframeStart, tmpOut, { final, small: opts.small, size: final && frame.outWidth === Math.round(frame.width * frame.scale) && frame.outHeight === Math.round(frame.height * frame.scale) ? null : [frame.outWidth, frame.outHeight] });
    const encodeMs = Date.now() - t1;
    if (res.status !== 0 || res.error) {
      fs.rmSync(tmpOut, { force: true });
      throw new RenderError(`ffmpeg encode failed (${res.error ? res.error.message : `exit ${res.status}`}):\n`
        + `${(res.stderr || '').trim().split('\n').slice(-15).join('\n')}`);
    }
    if (!fs.existsSync(tmpOut) || fs.statSync(tmpOut).size === 0) {
      throw new RenderError(`ffmpeg reported success but wrote no bytes to ${tmpOut}; stderr:\n${(res.stderr || '').trim()}`);
    }
    const late = await phases.time('verify', async () => {
      const stats = probeStats(tmpOut);
      const oneColour = oneFlatColour(stats) && from === 0 && durArg == null;
      return frameProblems(stats.map((s) => s.flat), { frames, fps, from, declared: parseBlankRanges(fs.readFileSync(pagePath, 'utf8')), oneColour, hint: oneColour ? drewNothingHint(REPO_ROOT, pagePath) : '' });
    });
    // A missing frame is a broken encode; a flat frame may be a colour block or a flash, so it only advises.
    const broken = late.filter((l) => !l.includes(' blank;'));
    if (broken.length) { fs.rmSync(tmpOut, { force: true }); fs.rmSync(tmpDir, { recursive: true, force: true }); throw new InvariantError(broken); }
    const advice = late.filter((l) => l.includes(' blank;'));
    const place = async (video, out) => {
      const mixed = wantAudio && await muxPageAudio(audioRead.read, pagePath, { video, out, duration: dur, explicit: opts.audio === true, fault: opts.muxFault });
      if (mixed) fs.rmSync(video, { force: true });
      else fs.renameSync(video, out);
      return mixed;
    };
    let mixed;
    try { mixed = await phases.time('audio', () => place(tmpOut, outPath)); } catch (e) {
      fs.rmSync(tmpOut, { force: true });
      throw Object.assign(e, { stage: 'audio mux', progress: 1, framesDir: tmpDir });
    }
    const reusedFrames = reused.reduce((a, b) => a + b, 0);
    const timing = {
      phases: { start: startS, slot: phases.seconds('slot'), chrome: phases.seconds('chrome'), load: phases.seconds('load'), prepass: prepassMs / 1000, capture: captureMs / 1000, verify: phases.seconds('verify'), encode: encodeMs / 1000, audio: phases.seconds('audio') },
      shape: { chrome, frames, reused: reusedFrames, fps, width: frame.outWidth, height: frame.outHeight, workers, slices: Math.ceil(frames / sliceFrames), durS: dur },
    };
    const result = { length, frames, subframes: totalSub, reused: reusedFrames, prepassMs, captureMs, encodeMs, dur, audio: Boolean(mixed), restarted, resumed, advice, ...timing };
    opts.onMaster?.(result);
    if (tmpWeb) {
      const webRes = ffmpegWebEncode(tmpDir, fps, kArr, subframeStart, tmpWeb);
      if (webRes.status !== 0 || webRes.error) {
        fs.rmSync(tmpWeb, { force: true });
        throw new RenderError(`ffmpeg web copy failed, the master ${outPath} is complete (${webRes.error ? webRes.error.message : `exit ${webRes.status}`}):\n`
          + `${(webRes.stderr || '').trim().split('\n').slice(-15).join('\n')}`);
      }
      await place(tmpWeb, webPath);
    }
    if (!process.env.LOCAL_KEEP) fs.rmSync(tmpDir, { recursive: true, force: true });
    const level = opts.checks && !mixed && from === 0 && durArg == null ? await opts.checks.run('sound', () => mixLevel(audioRead.read, dur)) : null;
    const profile = costLines({ kArr, reused, fps, from, prepassMs, captureMs, encodeMs });
    return { ...result, probe, level, motion, profile, web: webPath };
  } finally {
    await close();
    slot.release();
  }
}

const STALE_FRAMES_DAYS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

// A failed render keeps its frames dir so the next run resumes it; one untouched this long is never coming back.
export function removeStaleFrames(dir, now = Date.now(), log = (l) => console.error(l)) {
  if (!fs.existsSync(dir)) return [];
  const removed = [];
  for (const name of fs.readdirSync(dir).filter((n) => /\.frames-[0-9a-f]+$/.test(n))) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    const days = (now - st.mtimeMs) / DAY_MS;
    if (!st.isDirectory() || days < STALE_FRAMES_DAYS) continue;
    fs.rmSync(full, { recursive: true, force: true });
    log(`removed stale frames ${full} (${days.toFixed(0)} days old)`);
    removed.push(full);
  }
  return removed;
}

// A page whose folder declares a reference (the recreation starter writes `reference.json`) refuses a
// FINAL render until the required-motion-match has passed for this page's CURRENT content (a stamp
// keyed on the page's own hash, harness/lib/motion-stamp.mjs: an edit invalidates the old pass). A
// bare page with no declared reference is untouched. The one way out is the existing `authoring.allow`
// + `_why` mechanism, read out of the page's own `#authoring` script tag, never a second waiver path.
export function assertFinalReady(pagePath) {
  const ref = referenceFor(pagePath);
  if (!ref) return;
  if (motionStampFresh(pagePath)) return;
  const code = 'unverified-final';
  if (isWaived(pageAuthoring(pagePath), code)) return;
  throw new RenderError(`${pagePath}: FINAL render refused, no passing required-motion-match for this page's current `
    + `content. Run: vawe critique ${pagePath} --ref ${ref}\n`
    + `Waivable only in the page: ${waiverHint(code)}`);
}

// A final writes two files: the master (x264, dithered) and next to it a small web copy (AV1 10-bit).
export const webOut = (outPath) => outPath.replace(/(\.mp4)?$/, '.web.mp4');

export function defaultOut(pagePath, { aspect, suffixAspect, final, from = 0, to = null }) {
  const abs = path.resolve(pagePath);
  const base = path.basename(abs, '.html');
  const name = base === 'page' ? path.basename(path.dirname(abs)) : base;
  const range = !final && (from > 0 || to != null) ? `-${from}-${to ?? 'end'}` : '';
  return path.join('out', `${paramsFilm(name)}${suffixAspect ? `-${aspectSlug(aspect)}` : ''}${final ? '' : '-draft'}${range}.mp4`);
}

const motionRecords = (motion) => sightedRecords(motion) ?? motion.records;

// A page that paints in window.seek with no sampled boxes, or on a canvas, has no records that tell a camera move from an element move.
const cameraOnlyOf = (motion) => (motion.scripted && !motion.boxes) || motion.boxes?.canvas ? [] : cameraOnlySpans(motionRecords(motion));

const chosenSignature = (pagePath) => parseSignature(readPageMeta(pagePath, 'signature'));

function motionFindings(pagePath, motion) {
  const boxes = motion.boxes;
  const records = motionRecords(motion);
  return unwaived(motionLint({ records, scripted: motion.scripted && !boxes }), pageAuthoring(pagePath));
}

const layoutFindings = (pagePath, probe) => unwaived(probeLayoutLint(probe, namedText(readPageMeta(pagePath, 'message'), readBrief(pagePath))), pageAuthoring(pagePath));

const barFindings = (pagePath, motion, probe) => unwaived(barLint({ records: motionRecords(motion), boxes: probe.speed, text: probe.whole ? { samples: probe.samples, ctx: probe } : null, spectacle: lockedSpectacle(readBrief(pagePath), spectacleOf(fs.readFileSync(pagePath, 'utf8'))), film: { dur: probe.length, worlds: probe.worlds }, camera: readDecls(pagePath).camera }), pageAuthoring(pagePath));

const barAdvice = (pagePath, motion, probe) => barFindings(pagePath, motion, probe).flatMap((f) => [...lintLines([f]), waiverHint(f.code)]);

function motionAdvice(pagePath, motion) {
  const findings = motionFindings(pagePath, motion);
  if (!findings.length) return [];
  const out = [...lintLines(findings), waiverHint(findings[0].code)];
  if (motion.boxes?.canvas) out.push(`motion lint read element boxes over time; the motion inside ${motion.boxes.canvas} canvas (2D or WebGL) is out of its scope`);
  return out;
}

// Text and spec probes read layout only, so their seeks skip the paint barrier that a screenshot needs.
const seekLayout = (page) => (ms) => page.evaluate((t) => window.__pageSeek(t / 1000, window, true), ms);

/**
 * The live page's motion records and text samples: what the draft check reads besides the video. `checks` (harness/lib/check-runner.mjs)
 * gates each probe by tier and caches it; the default runs every tier with no cache. `from` is the film second the
 * samples start at, and `whole` is false for a window, where the brief's spec rows (film-long times) are not read.
 */
export async function probePage(page, dur, pagePath, { checks: all = createChecks({ pagePath, mode: 'full', cache: false }), from = 0, whole = true, length = dur } = {}) {
  const window = { from, dur };
  const canvasFilm = await page.evaluate(canvasCoversFrame, CANVAS_SHARE);
  const checks = canvasFilm ? { ...all, run: (check, fn, settings) => (DOM_PICTURE_CHECKS.has(check) ? null : all.run(check, fn, settings)) } : all;
  const tables = dropGuesses(parseBriefTables(readBrief(pagePath))).set;
  const found = await checks.run('motion', () => runMotionCollector(page), window);
  const boxes = found?.scripted ? await checks.run('box-motion', () => sampleBoxTracks(page, lintTimes(dur), 'visible'), window) : undefined;
  const speed = boxes ? boxMotion(boxes) : await checks.run('speed', async () => boxMotion(await sampleBoxTracks(page, lintTimes(dur).map((t) => +(from + t).toFixed(4)), 'visible')), window);
  const text = await checks.run('text', () => sampleText(page, dur, seekLayout(page), from), window);
  const motionText = await checks.run('text-motion', () => sampleTextMotion(page, dur, seekLayout(page), from), window);
  const worlds = whole ? await checks.run('worlds', () => sampleWorlds(page, dur, seekLayout(page)), window) : null;
  const tail = whole ? await checks.run('tail', () => sampleTail(page, dur, seekLayout(page)), window) : null;
  const contrast = await checks.run('contrast', () => sampleContrast(page, text.samples, (ms) => seekAll(page, ms)), window);
  const layout = await checks.run('layout', () => sampleLayout(page, layoutTimes(text.samples, window), seekLayout(page)), window);
  const lens = whole ? await checks.run('lens', () => sampleLens(page, dur, (ms) => seekAll(page, ms)), window) : null;
  const specKey = { tables, dur };
  const spec = whole ? await checks.run('spec', () => sampleSpec(page, tables, seekLayout(page), dur, { objects: false }), specKey) : null;
  const objects = spec && tables.objects.length ? reviveObjects(await checks.run('objects', () => sampleObjects(page, tables, spec, dur), specKey)) : undefined;
  return { motion: { ...found, ...(boxes ? { boxes } : {}) }, probe: { ...text, length, canvasFilm, motionText: motionText?.samples, whole, speed, contrast, layout, worlds, tail, lens, spec: spec && { ...spec, objects: objects ?? null } } };
}

/** The cut-off-beat advice of a page with a music bed; [] for a window, a waiver with its reason, no bed, or a bed that cannot be read (advice must never stop a draft). */
function beatLines(pagePath, worlds, authoring) {
  if (!worlds || isWaived(authoring, 'cut-off-beat')) return [];
  try { return beatAdvice(pagePath, worlds).flatMap((l) => [l, waiverHint('cut-off-beat')]); } catch (e) { return [`cut-off-beat: the music bed was not read: ${e.message}`]; }
}

/** The slideshow tells a draft shows without a video (entrances, exits, world spans); [] for a window or a waiver naming the code. */
function slideshowAdvice(pagePath, motion, probe, authoring) {
  if (!probe.worlds) return [];
  const { tells } = slideshowTells({ worlds: worldRows(probe.worlds), records: sightedRecords(motion) });
  const live = tells.filter((t) => !isWaived(authoring, 'slideshow', t.at[0]));
  return [...(live.length ? [...slideshowLines({ score: live.length, of: 10, tells: live }), waiverHint('slideshow')] : [])];
}

/** The waiver count line and the "fix first" lines, from the rules the earlier drafts of this film fired. */
const earlierWaiverAdvice = (pagePath, authoring) => waiverAdvice(authoring, readRuns(pagePath).filter((e) => e.cmd === 'dev' && Array.isArray(e.rules_fired)).map((e) => e.rules_fired.map((f) => f.id)), TASTE_RULES);

/** The advice lines read from the probed page alone (text, motion, slideshow, bar and layout lint), waivers applied; no brief line and no video. */
export function probeAdvice(pagePath, { probe, motion }) {
  const authoring = pageAuthoring(pagePath);
  const contrast = contrastLines(unwaivedContrast(probe.contrast, authoring));
  return [...(probe.canvasFilm ? [canvasFilmNote()] : []), ...waiverProblems(authoring), ...earlierWaiverAdvice(pagePath, authoring), ...frameUnitLines(probe.samples, probe), ...hiddenTextLines(probe.hidden), ...textCollisionLines(probe.samples, probe.motionText), ...contrast, ...unseenMotionLines(motion), ...motionAdvice(pagePath, motion), ...slideshowAdvice(pagePath, motion, probe, authoring), ...barAdvice(pagePath, motion, probe), ...lintLines(layoutFindings(pagePath, probe))];
}

/** The draft-check advice that needs the live page but no video: { text, brief, lines }, waivers applied. */
export function pageAdvice(pagePath, { probe, motion }) {
  const authoring = pageAuthoring(pagePath);
  const brief = readBrief(pagePath);
  const dir = path.relative(process.cwd(), path.dirname(path.resolve(pagePath)));
  const directions = directionsLines(brief, dir).filter((l) => !(l.startsWith('attractor:') && isWaived(authoring, 'attractor', /^attractor: direction (\w+)/.exec(l)?.[1] ?? null)));
  return {
    text: textProblems(probe.samples, { ...probe, rules: rulesWith(readDecls(pagePath), RULES) }),
    brief: authoring._clip || isWaived(authoring, 'no-brief') ? null : briefLine(brief),
    lines: [...probeAdvice(pagePath, { probe, motion }), ...directions, ...recipeEchoLines(brief),
      ...boardChecks(brief, spectacleOf(fs.readFileSync(pagePath, 'utf8'))), ...(isWaived(authoring, 'transitions') || boardFilled(brief ?? '') !== true ? [] : handoffAdvice(moveRows(brief)).flatMap((l) => [l, waiverHint('transitions')])), ...ideasAdvice(brief, authoring), ...moveDocLines(brief),
      ...beatLines(pagePath, probe.worlds, authoring),
      ...(authoring._clip || isWaived(authoring, 'signature-unchosen') ? [] : unchosenAdvice(chosenSignature(pagePath)))],
  };
}

/** { problems, measures } of the draft video from one read (stills, held worlds, blank runs, tail tiles, smoothness), or null when ffmpeg fails. */
export async function videoChecks(mp4, pagePath, checks, probe = {}, cameraOnly = []) {
  const typing = typingSpans(probe.motionText ?? []);
  const authoring = pageAuthoring(pagePath);
  const shots = dropGuesses(parseBriefTables(readBrief(pagePath))).set.shots;
  const page = { worlds: probe.worlds, tailMoving: tailMoving(probe.tail), canvasFilm: Boolean(probe.canvasFilm), cameraOnly, typing };
  try {
    return await checks.run('video', () => { const read = readVideo(mp4); return { problems: videoProblems(read, authoring, page), measures: videoMeasures(read, authoring, shots, page.tailMoving, page.worlds, cameraOnly, typing) }; }, { authoring, shots, page });
  } catch (e) { console.error(`  video not read: ${e.message}`); return null; }
}

export { NOTE_LINES };

/**
 * What a draft says about itself: { red, notes, rows, was, sync }. `red` is what the terminal shows (the red acceptance
 * rows, then the advice that no row covers); `notes` is every line, for out/<film>.dev.md. A window has no acceptance
 * table and no video checks: its text and motion advice is all red.
 */
async function draftReport(mp4, pagePath, { probe, level, motion, advice: blanks, whole, checks }) {
  const authoring = pageAuthoring(pagePath);
  const page = pageAdvice(pagePath, { probe, motion });
  const cameraOnly = cameraOnlyOf(motion);
  const video = whole ? await videoChecks(mp4, pagePath, checks, probe, cameraOnly) : null;
  const problems = mergeProblems(video?.problems ?? [], page.text);
  const sound = soundLine(level?.I ?? null, undefined, level);
  const peak = peakLine(level?.TP ?? null, level?.cues);
  const bedAdvice = [...(level?.beds ?? []).map(bedLine), ...balanceLines((level?.cues ?? []).filter((c) => c.role === 'sfx'))].filter(Boolean);
  const planAdvice = boardVerify(readBrief(pagePath), {
    cameraSpans: (motion.scripted && !motion.boxes) || motion.boxes?.canvas ? null : cameraSpans(motionRecords(motion)),
    arrivals: timedArrivals(motionRecords(motion), probe.speed?.arrivals ?? []),
    cues: (level?.cues ?? []).filter((c) => c.role === 'sfx'), dur: probe.length,
  });
  const advice = [...blanks, ...draftAdvice(problems, sound, page.brief), ...[peak].filter(Boolean), ...bedAdvice, ...planAdvice, ...page.lines];
  const table = whole ? await checks.time('acceptance', async () => draftAcceptance({ mp4, pagePath, probe, level, findings: motionFindings(pagePath, motion), video: video?.measures, mode: checks.mode, cameraOnly, typing: typingSpans(probe.motionText ?? []) })) : null;
  const inRows = new Set(whole ? [...problems, sound, peak, ...textCollisionLines(probe.samples, probe.motionText), ...contrastLines(probe.contrast)] : []);
  const loose = advice.filter((l) => !inRows.has(l) && !NOTE_LINES.test(l)).map((l) => `advice: ${l}`);
  const hard = [...problems, sound, peak].filter(Boolean);
  const fired = firedRules([...motionFindings(pagePath, motion), ...layoutFindings(pagePath, probe), ...barFindings(pagePath, motion, probe)], hard, table?.rows ?? []);
  const chosen = chosenSignature(pagePath);
  const measured = measureMotion(motionRecords(motion));
  const taste = draftTasteLines(hard);
  const signature = { chosen, measured, line: authoring._clip ? '' : signatureLine(chosen, measured) };
  return { red: [...(table ? table.rows.filter((r) => r.status === 'advice').map(redLine) : []), ...loose, ...firedLines(fired)], signature, fired, notes: { advice, taste, signature: signature.line, fired: firedLines(fired, fired.length), rows: table?.rows ?? [] }, rows: table?.rows ?? null, was: table?.was ?? null, sync: table?.sync ?? null };
}

function writeDevNotes(mp4, { timing, advice, taste, signature, fired, rows }) {
  const file = path.resolve('out', `${nameOfFilm(mp4)}.dev.md`);
  const body = [`# ${nameOfFilm(mp4)} draft`, '', timing, '', '## Draft check', '', ...draftCheckLines(advice), '', '## Signature', '', signature, '', '## Rules behind the red rows', '', ...(fired.length ? fired : ['none']), '', '## Acceptance', '', ...(rows.length ? fullTable(rows) : ['not measured in this draft']), '', '## Taste', '', ...taste, ''];
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, body.join('\n'));
  return path.relative(process.cwd(), file);
}

const nameOfFilm = (mp4) => path.basename(mp4, '.mp4').replace(/-draft.*$/, '');

/** The ground-hue advice of a draft: [] when the ground turns, the page waives it or the brief names no reference with a spec to point at. */
function groundHueAdvice(pagePath, shape) {
  if (isWaived(pageAuthoring(pagePath), GROUND_HUE, shape.perShot.find((p) => p.start)?.t0 ?? 0)) return [];
  const named = namedRef({ dir: refsDir(), briefText: readBrief(pagePath) ?? '' });
  const ground = named && refGround(refsDir(), named.id);
  const lines = groundHueLines(shape.perShot, shape.seconds, ground ? { id: named.id, ground } : null);
  return lines.length ? [...lines, waiverHint(GROUND_HUE)] : [];
}

/** The reference-range lines of a whole draft; only the overshoot line when the page has under two worlds; [] when the measure fails (advice must never stop a draft). */
async function rangeBlock(mp4, pagePath, r, fps, checks) {
  try {
    return await checks.time('range', async () => {
      const shape = measureDraftShape(mp4, r.probe?.worlds, fps);
      const overshoot = overshootPct(motionRecords(r.motion), r.probe?.speed?.arrivals);
      return shape ? [...rangeLines({ ...shape.values, overshoot_pct: overshoot }), ...groundHueAdvice(pagePath, shape)] : overshootLine(overshoot);
    });
  } catch (e) { console.error(`  no reference range: ${e.message}`); return []; }
}

async function printDraft(mp4, pagePath, r, { checks, taste, next, opts, from }) {
  let look = '';
  try { await checks.time('sheet', async () => { const { out, frames, fastest } = writeDraftSheet({ video: mp4, out: draftSheetPath(mp4), fps: opts.fps, from }); look = `  look: ${out} (frames at ${frames.join(', ')} s; fastest motion at ${fastest} s)`; }); } catch (e) { console.error(`  no key-frame sheet: ${e.message}`); }
  const whole = from === 0 && opts.durArg == null;
  const report = await draftReport(mp4, pagePath, { ...r, whole, checks });
  const range = whole ? await rangeBlock(mp4, pagePath, r, opts.fps, checks) : [];
  checks.save();
  const timing = timeLine({ captureMs: r.captureMs, encodeMs: r.encodeMs, checks: checks.seconds(), capture: frameFormat(false).label });
  const notes = writeDevNotes(mp4, { timing, ...report.notes });
  const checkSeconds = checks.seconds().reduce((a, [, s]) => a + s, 0).toFixed(1);
  appendRun(pagePath, devEvent({ file: path.resolve(mp4), tier: checks.mode, wallS: process.uptime(), phases: r.phases, shape: r.shape, checks: checks.seconds(), cache: checks.cache(), rows: report.rows, signature: report.signature.chosen, measured: report.signature.measured, fired: report.fired, worlds: r.probe?.worlds }));
  const head = report.rows ? summaryLine(report.rows, report.was) : `checks on this window: ${report.red.length} red`;
  console.log([timing, look, ...lensLines(r.probe?.lens, r.probe?.worlds), report.signature.line, soundSummary(r.level), ...report.red, ...range, ...(taste ? ['', ...report.notes.taste] : []), report.sync, `${head} · checks ${checkSeconds} s · details ${notes}${next ? ` · next: ${next}` : ''}`].filter((l) => l !== null && l !== '').join('\n'));
}

// Test hook for the CLI: VAWE_TEST_SLICE_FAULT=<lo>:<n> makes the slice starting at frame <lo> lose its page on its first n attempts.
function faultFromEnv(value) {
  const m = String(value || '').match(/^(\d+):(\d+)$/);
  if (!m) return undefined;
  return ([lo], attempt) => { if (lo === Number(m[1]) && attempt <= Number(m[2])) throw new Error('Target closed (VAWE_TEST_SLICE_FAULT)'); };
}

export const resumeLine = (framesDir, page) => `frames kept in ${framesDir}; bin/vawe ship ${page}${paramsFlags()} resumes it`;

// The ship job reads the failed line back from this render's log and logs the ship event itself (--job).
function reportFailedFinal(pagePath, e, byJob) {
  const page = path.relative(process.cwd(), path.resolve(pagePath));
  const failure = { pct: Math.floor(100 * (e.progress ?? 0)), reason: `${e.stage ? `${e.stage}: ` : ''}${String((e.problems || [e.message])[0]).split('\n')[0]}`, page };
  if (e.framesDir) console.error(resumeLine(e.framesDir, page));
  console.error(finalFailedLine(failure.pct, failure.reason));
  if (!byJob) appendRun(pagePath, shipEvent({ verdict: 'failed', renderS: process.uptime(), failure }));
}

async function main() {
  const argv = process.argv.slice(2);
  const flag = (name, d) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : d; };
  const valueFlags = new Set(['--aspect', '--fps', '--from', '--dur', '--to', '--blur', '--w', '--h', '--workers', '--next']);
  const positional = argv.filter((a, i) => !a.startsWith('--') && !valueFlags.has(argv[i - 1]));
  const [pagePath, outArg] = positional;
  if (!pagePath) {
    die('usage: node harness/media/render-page.mjs <page.html> [out.mp4] [--aspect W:H|all] [--fps N] '
      + '[--from s] [--dur s | --to s] [--blur N] [--w px] [--h px] [--workers N] [--final] [--silent] [--small] [--profile] [--fast | --full] [--taste] [--next cmd]', 2);
  }
  if (!fs.existsSync(pagePath)) die(`no such file: ${pagePath}`);
  ensurePageFonts(pagePath);
  const drift = briefProblems(pagePath);
  if (drift.length) console.error(adviceBlock(drift.map((p) => `${p}; the render uses the page: update the brief's length and aspect lines to match`)).join('\n'));
  const final = argv.includes('--final');
  if (final) assertFinalReady(pagePath);
  const failedShip = final ? null : lastFailedShip(readRuns(pagePath));
  if (failedShip) console.error(failedShipLine(filmKeyOf(pagePath), failedShip));
  const from = final ? 0 : Number(flag('--from', 0));
  const toFlag = flag('--to', null);
  const durFlag = flag('--dur', null);
  const durArg = final ? null : (toFlag != null ? Number(toFlag) - from : (durFlag != null ? Number(durFlag) : null));
  const logDevFailure = (reason) => appendRun(pagePath, devFailedEvent({ reason, wallS: process.uptime() }));
  if (!final) for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => { logDevFailure(`killed by ${signal}`); process.exit(130); });
  const aspectFlag = flag('--aspect', null);
  const all = aspectFlag === 'all';
  const aspects = all ? Object.keys(ASPECTS) : [aspectFlag || aspectOverride() || readPageMeta(pagePath, 'aspect') || '16:9'];
  if (all && outArg) die('--aspect all writes one file per aspect: leave out the output path', 2);
  for (const aspect of aspects) {
    const opts = {
      aspect, final,
      fps: Number(flag('--fps', final ? 60 : 30)),
      w: flag('--w', null) && Number(flag('--w', null)), h: flag('--h', null) && Number(flag('--h', null)),
      blur: Number(flag('--blur', final ? 32 : 1)), from, durArg, progress: argv.includes('--progress') || (final && Boolean(process.stdout.isTTY)),
      workers: flag('--workers', null) && Number(flag('--workers', null)),
      audio: argv.includes('--silent') ? false : argv.includes('--audio') ? true : undefined,
      small: argv.includes('--small'),
      sliceFault: faultFromEnv(process.env.VAWE_TEST_SLICE_FAULT),
      muxFault: process.env.VAWE_TEST_MUX_FAULT ? () => { throw new Error('mux failed (VAWE_TEST_MUX_FAULT)'); } : undefined,
      checks: final ? undefined : createChecks({ pagePath, mode: argv.includes('--full') ? 'full' : argv.includes('--fast') ? 'fast' : 'draft' }),
    };
    const frame = resolveFrame(pagePath, opts);
    const outPath = outArg || defaultOut(pagePath, { aspect, suffixAspect: all, final, from, to: durArg != null ? from + durArg : null });
    fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
    const masterLine = (r) => `✓ ${outPath}: ${r.frames} frame(s) at ${opts.fps}fps, ${frame.outWidth}x${frame.outHeight} (${aspect}), ${from}s-${(from + r.dur).toFixed(2)}s`
      + `${opts.blur > 1 ? `, blur=${opts.blur} (${r.subframes} subframe(s))` : ''}${r.audio ? ', audio mixed' : ''}${r.restarted.length ? `, retried slice(s) ${r.restarted.join(' ')}` : ''}${r.resumed ? `, ${r.resumed} slice(s) resumed from an earlier run` : ''}`
      + `${final ? `, prepass ${(r.prepassMs / 1000).toFixed(1)}s, capture ${(r.captureMs / 1000).toFixed(1)}s, encode ${(r.encodeMs / 1000).toFixed(1)}s` : ''}`;
    if (final) opts.onMaster = (r) => console.log(masterLine(r));
    const r = await renderPage(pagePath, outPath, opts).catch((e) => {
      if (!final) logDevFailure(String((e.problems || [e.message])[0]).split('\n')[0]);
      if (e instanceof RenderError) {
        if (final) reportFailedFinal(pagePath, e, argv.includes('--job'));
        die(e.message);
      }
      if (!(e instanceof InvariantError) && !final) throw e;
      for (const p of e.problems || [e.stack || String(e)]) console.error(errorLine(p));
      if (final) reportFailedFinal(pagePath, e, argv.includes('--job'));
      process.exit(2);
    });
    if (!final) console.log([...lengthLines(r.length, pagePath), masterLine(r)].join('\n'));
    if (argv.includes('--lock-length')) console.log(lockPageLength(pagePath, r.length));
    if (r.web) console.log(`  web copy: ${r.web} (${(fs.statSync(r.web).size / 1e6).toFixed(1)} MB; master ${(fs.statSync(outPath).size / 1e6).toFixed(1)} MB)`);
    if (!final) await printDraft(outPath, pagePath, r, { checks: opts.checks, taste: argv.includes('--taste'), next: flag('--next', null), opts, from });
    else {
      if (!argv.includes('--job')) appendRun(pagePath, shipEvent({ verdict: null, renderS: (r.prepassMs + r.captureMs + r.encodeMs) / 1000 }));
      if (r.advice.length) console.log(adviceBlock(r.advice).join('\n'));
    }
    if (argv.includes('--profile')) console.log(r.profile.join('\n'));
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((e) => die(e instanceof RenderError ? e.message : e.stack || String(e)));
