// quality/gates/page-check.mjs: what a rendered PAGE film measures, so the eye only judges what a number cannot.
//
//   node quality/gates/page-check.mjs <page.html|render.mp4> [--ref <ref.mp4>] [--lead <frames>] [--skip text,audio,live,cuts]
//   vawe critique <page.html> [REF=<ref.mp4>]      (vawe critique runs it after the see pass)
//
// Advisory only (owner rule: safeguards adapt, not block): every finding names a time, a frame and the
// fix, and the exit code is always 0. Given a page, it renders a draft (with the page's audio mixed) or
// reuses a fresh one; given an mp4 it finds the page beside it (films/<name>/page.html) for the checks
// that read the source (meta, <audio data-at>, live DOM), and skips them when there is none.
//
//   dead-stop                a fast move that stops within one frame
//   text-unreadable-hold     words that leave before they were still long enough to read (readable-hold.md)
//   quiet-before-spectacle   <meta name="spectacle">: the 0.4 s before it is not quiet in picture and sound
//   cue-not-heard            an <audio data-at> cue with no onset in the rendered audio
//   cue-onset-drift          the cue's onset lands more than 2 frames from its data-at
//   sound-off-hit            a cue's onset is off the cut or spectacle it belongs to
//   cut-off-beat             a detected cut is early or late against the music beat grid
//   cut-off-reference        a cut is early or late against the reference video
//   text-low-contrast        on-screen text under WCAG contrast against its own background
//   text-clipped             glyph ink sticks out of an overflow, clip-path or mask box by more than 2 px once the line is 80% revealed, moving or not
//   font-fallback            text painted in a family with no loaded @font-face
//   loop-seam                <meta name="loop" content="true">: the last frame does not flow into the first
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { gateFindings } from '../../harness/lib/findings.mjs';
import { groupFindingLines } from '../../harness/lib/critique-summary.mjs';
import { scratch } from '../../harness/lib/scratch.mjs';
import { motionDeltaSeries, detectCuts } from '../../harness/media/shot-detect.mjs';
import { HOLD_FLOOR, wordEventTracks } from '../../harness/media/see.mjs';
import { probe, videoFor, loopSeam, describeLoop } from '../../harness/media/see-views.mjs';
import { readPageMeta } from '../../harness/media/render-page.mjs';
import { referenceFor } from '../../harness/lib/motion-stamp.mjs';
import { decodeMono, envelopeOf, onsetsOf, meanDb } from '../../harness/lib/audio-onsets.mjs';
import { pageAudio } from '../../harness/lib/sound-read.mjs';
import { onsetEnvelope, estimateTempo, estimatePhase, beatGrid } from '../../core/beats/detect.js';
import { sampleText, clippedGlyphs } from '../../harness/lib/text-timing.mjs';
import { readHoldProblems } from '../../harness/lib/read-hold.mjs';
import { TEXTURE } from '../../harness/lib/draft-check.mjs';
import { textureCanvases } from '../../harness/lib/canvas-film.mjs';
import { lowContrast, passingColour, hexOf, shownAndHidden } from '../../harness/lib/text-contrast.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

// A frame-to-frame motion of FAST_MOVE (4x the still floor) held for two frames is a real move, not a cut's one-frame spike.
const FAST_MOVE = HOLD_FLOOR * 4;
const STOP_RATIO = 0.25;
const QUIET_WINDOW = 0.4;
const HEARD_TOL = 0.15;
const DRIFT_FRAMES = 2;
const HIT_EARLY_FRAMES = 1.5;   // sound may lead its picture by this much and still read as one event
const HIT_LATE_FRAMES = 3;
const BEAT_MIN_CONFIDENCE = 1.6;
const CUT_TOL_FRAMES = 1.5;

const fmtT = (t, fps) => `${t.toFixed(2)}s (f${Math.round(t * fps)})`;

/** Dead stops: >= 2 frames at fast speed, then a drop under a quarter of it and under the still floor. Pure. */
export function detectDeadStops(series, cutTimes = []) {
  const out = [];
  for (let i = 2; i < series.length; i++) {
    const [a, b, c] = [series[i - 2], series[i - 1], series[i]];
    if (a.v < FAST_MOVE || b.v < FAST_MOVE) continue;
    if (c.v >= b.v * STOP_RATIO || c.v >= HOLD_FLOOR) continue;
    if (cutTimes.some((t) => Math.abs(t - c.t) < 0.1)) continue;
    out.push({ t: c.t, from: b.v, to: c.v });
  }
  return out;
}

/** Quiet before the spectacle: picture motion and audio level in the 0.4 s ahead of `s`, against the hit itself. Pure. */
export function quietBefore(series, envelope, s) {
  const mean = (arr) => (arr.length ? arr.reduce((a, p) => a + p.v, 0) / arr.length : 0);
  const filmMean = mean(series);
  const pre = mean(series.filter((p) => p.t >= s - QUIET_WINDOW && p.t < s));
  const hit = mean(series.filter((p) => p.t >= s && p.t < s + QUIET_WINDOW));
  const motionQuiet = pre <= Math.max(HOLD_FLOOR * 1.5, filmMean * 0.5) && hit >= pre * 2;
  const preDb = envelope ? meanDb(envelope, s - QUIET_WINDOW, s) : null;
  const hitDb = envelope ? meanDb(envelope, s, s + QUIET_WINDOW) : null;
  const audioMeasured = preDb != null && hitDb != null;
  const audioQuiet = !audioMeasured || preDb <= hitDb - 6;
  return { motionQuiet, audioQuiet, audioMeasured, pre, hit, preDb, hitDb };
}

/** Nearest beat to each cut, as signed frames (positive = the cut lands after the beat minus the lead). Pure. */
export function cutsAgainstBeats(cutTimes, beats, fps, lead = 0) {
  if (beats.length < 2) return [];
  const period = beats[1] - beats[0];
  return cutTimes.map((t) => {
    const beat = beats.reduce((best, b) => (Math.abs(b - t) < Math.abs(best - t) ? b : best), beats[0]);
    const target = beat - lead / fps;
    return { t, beat, target, frames: (t - target) * fps, related: Math.abs(t - beat) <= period / 2 };
  }).filter((c) => c.related);
}

const isCue = (a) => !a.loop && a.at != null && !/(^|\/)(vo|voice|narration)/i.test(a.src || '');

function pageFor(input) {
  if (input.endsWith('.html')) return input;
  const name = path.basename(input).replace(/-draft\.mp4$|\.mp4$/, '');
  const guess = path.join(ROOT, 'films', name, 'page.html');
  return fs.existsSync(guess) ? guess : null;
}

async function liveSamples(page, times, frame) {
  const { openPage, seekAll } = await import('../../harness/media/render-page.mjs');
  const opened = await openPage(page, frame);
  const rows = [];
  try {
    await opened.page.goto(opened.url, { waitUntil: 'load' });
    for (const t of times) {
      await seekAll(opened.page, t * 1000);
      const dom = await opened.page.evaluate(collectText);
      const { shown, raw } = await shownAndHidden(opened.page);
      rows.push({ t, ...dom, raw, shown });
    }
  } finally { await opened.close(); }
  return rows;
}

// Runs in the page. Visible text runs with their paint, size and family; families with their FontFace state.
function collectText() {
  const vh = window.innerHeight;
  const settling = (el) => {
    for (let e = el; e; e = e.parentElement) {
      for (const a of e.getAnimations({ subtree: false })) {
        const p = a.effect && a.effect.getComputedTiming().progress;
        if (p != null && p > 0 && p < 1) return true;
      }
    }
    return false;
  };
  const opacityOf = (el) => { let o = 1; for (let e = el; e; e = e.parentElement) o *= Number(getComputedStyle(e).opacity); return o; };
  const items = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    const el = node.parentElement;
    const text = node.textContent.trim();
    if (!text || !el || ['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(el.tagName)) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const range = document.createRange();
    range.selectNodeContents(node);
    const r = range.getBoundingClientRect();
    if (r.width < 2 || r.height < 2 || r.bottom < 0 || r.top > vh || r.right < 0 || r.left > window.innerWidth) continue;
    const op = opacityOf(el);
    if (op < 0.05 || settling(el)) continue;
    items.push({ text: text.slice(0, 40), color: cs.color, opacity: op, size: parseFloat(cs.fontSize),
      family: cs.fontFamily, weight: cs.fontWeight, x: r.left, y: r.top, w: r.width, h: r.height });
  }
  const clean = (f) => f.replace(/^["']|["']$/g, '').trim().toLowerCase();
  const faces = [...document.fonts].map((f) => ({ family: clean(f.family), status: f.status }));
  return { vh, items, faces };
}

const GENERIC = new Set(['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui', 'ui-sans-serif', 'ui-serif', 'ui-monospace', '-apple-system', 'blinkmacsystemfont', 'emoji', 'math']);

function contrastFindings(rows, frame, fps, f) {
  for (const w of lowContrast(rows, frame)) {
    f.warn('text-low-contrast', `"${w.text}" reads ${w.ratio.toFixed(1)}:1 against its background (needs ${w.need}:1), failing in ${w.fails} of ${w.seen} sample(s)`,
      { at: fmtT(w.t, fps), fix: `text colour ${hexOf(w.fg)} on ${hexOf(w.bg)}: use ${passingColour(w)}, or lift the background behind it.` });
  }
}

const primaryFamily = (css) => css.split(',').map((x) => x.replace(/^["'\s]+|["'\s]+$/g, '').toLowerCase()).find((x) => x && !GENERIC.has(x));

function fontFindings(rows, fps, f) {
  const families = new Map();
  for (const row of rows) {
    for (const it of row.items) {
      const fam = primaryFamily(it.family);
      if (fam && !families.has(fam)) families.set(fam, { t: row.t, faces: row.faces.filter((x) => x.family === fam) });
    }
  }
  for (const [fam, v] of families) {
    if (!v.faces.length) {
      f.warn('font-fallback', `text is set in "${fam}", which no @font-face declares: the browser paints a substitute`,
        { at: fmtT(v.t, fps), fix: 'add an @font-face for it (vendored under the film\'s assets), or name a family the page loads.' });
    } else if (!v.faces.some((x) => x.status === 'loaded')) {
      f.warn('font-fallback', `"${fam}" is declared but its face never loaded (status ${v.faces.map((x) => x.status).join(', ')})`,
        { at: fmtT(v.t, fps), fix: 'fix the @font-face src path: the file 404s or is not a font.' });
    }
  }
}

async function checkLive(ctx) {
  const { resolveFrame } = await import('../../harness/media/render-page.mjs');
  // Device scale 1: the screenshot buffers are indexed by the page's CSS coordinates.
  const frame = resolveFrame(ctx.page, { final: true });
  const times = Array.from({ length: 8 }, (_, i) => +(ctx.dur * (i + 0.5) / 8).toFixed(3));
  if (Number.isFinite(ctx.spectacle)) times.push(ctx.spectacle + 0.3);
  const rows = await liveSamples(ctx.page, times, frame);
  contrastFindings(rows, frame, ctx.fps, ctx.f);
  fontFindings(rows, ctx.fps, ctx.f);
}

export function clipMessage(c) {
  return `"${c.text}" sticks out of its ${c.kind} box by ${c.px.toFixed(0)} px at the ${c.side}: the glyphs are cut`;
}

async function checkClipped(ctx) {
  const { openPage, settle, resolveFrame } = await import('../../harness/media/render-page.mjs');
  const opened = await openPage(ctx.page, resolveFrame(ctx.page, {}));
  try {
    await opened.page.goto(opened.url, { waitUntil: 'load' });
    await settle(opened.page);
    for (const c of clippedGlyphs(await sampleText(opened.page, ctx.dur, 0.1))) {
      ctx.f.warn('text-clipped', clipMessage(c), { at: fmtT(c.t, ctx.fps), fix: `grow the ${c.kind} box by ${Math.ceil(c.px)} px on the ${c.side}, or raise the line-height so the glyphs fit.` });
    }
  } finally { await opened.close(); }
}

function checkDeadStops(ctx) {
  for (const d of detectDeadStops(ctx.series, ctx.cutTimes)) {
    ctx.f.warn('dead-stop', `motion drops from ${d.from.toFixed(1)} to ${d.to.toFixed(1)} in one frame: a fast move stops dead`,
      { at: fmtT(d.t, ctx.fps), fix: 'end the move on an ease-out over its last 6 to 10 frames: approach(f, from, to, 0.15) (core/motion/springs.js) or an ease-out keyframe curve.' });
  }
}

function checkSpectacle(ctx) {
  const { f, fps, spectacle } = ctx;
  if (!Number.isFinite(spectacle)) return;
  const q = quietBefore(ctx.series, ctx.envelope, spectacle);
  const at = fmtT(spectacle - QUIET_WINDOW, fps);
  if (!q.motionQuiet) {
    f.warn('quiet-before-spectacle', `in the ${QUIET_WINDOW}s before the spectacle the picture changes ${q.pre.toFixed(2)} luma per frame (the hit itself ${q.hit.toFixed(2)}): it does not go quiet first`,
      { at, fix: `hold the frame still from ${(spectacle - QUIET_WINDOW).toFixed(2)}s to ${spectacle.toFixed(2)}s, then hit.` });
  }
  if (q.audioMeasured && !q.audioQuiet) {
    f.warn('quiet-before-spectacle', `the ${QUIET_WINDOW}s before the spectacle sits at ${q.preDb.toFixed(0)} dB against ${q.hitDb.toFixed(0)} dB on the hit: the sound does not drop first`,
      { at, fix: 'fade the bed out or cut it (data-fade-out on the music, or end it at the spectacle time minus 0.4 s), then land the hit into the gap.' });
  }
  if (!q.audioMeasured) ctx.notes.push('quiet-before-spectacle: no audio in the render, only the picture was checked; ' + (ctx.audioTags.length ? 'for the sound run bin/vawe dev <page> (without --silent), then bin/vawe critique <page> again' : 'the page has no <audio> tag: add the Board\'s sound rows'));
}

const nearestTo = (list, t, key = (x) => x) => list.reduce((best, x) => (best == null || Math.abs(key(x) - t) < Math.abs(key(best) - t) ? x : best), null);

function checkOneCue(ctx, c, onsets) {
  const { f, fps } = ctx;
  const at = Number(c.at);
  const near = nearestTo(onsets, at, (o) => o.t);
  const label = c.synth ? `synth "${c.synth}"` : path.basename(c.src || '?');
  if (!near || Math.abs(near.t - at) > HEARD_TOL) {
    f.warn('cue-not-heard', `${label} cue at data-at=${at} has no onset within ${HEARD_TOL}s in the rendered audio${near ? ` (nearest ${near.t.toFixed(2)}s)` : ''}`,
      { at: fmtT(at, fps), fix: 'check the cue plays: src path, data-gain not too low, and the file is not silent at its start.' });
    return;
  }
  const drift = (near.t - at) * fps;
  if (Math.abs(drift) > DRIFT_FRAMES) {
    f.warn('cue-onset-drift', `${label}: sound starts ${Math.abs(drift).toFixed(1)} frames ${drift > 0 ? 'after' : 'before'} its data-at (${at}s)`,
      { at: fmtT(near.t, fps), fix: `the sample has ${drift > 0 ? 'a silent lead' : 'an early attack'}: set data-at to ${(at - (near.t - at)).toFixed(3)} so the onset lands on ${at}.` });
  }
  const hit = nearestTo([...ctx.cutTimes, ...(Number.isFinite(ctx.spectacle) ? [ctx.spectacle] : [])], near.t);
  if (hit == null || Math.abs(hit - near.t) > 0.25) return;
  const off = (near.t - hit) * fps;
  if (off < -HIT_EARLY_FRAMES || off > HIT_LATE_FRAMES) {
    f.warn('sound-off-hit', `${label} sounds ${Math.abs(off).toFixed(1)} frames ${off > 0 ? 'after' : 'before'} the picture event at ${hit.toFixed(2)}s`,
      { at: fmtT(near.t, fps), fix: `move data-at by ${(-off / fps).toFixed(3)}s (sound may lead the picture by up to ${HIT_EARLY_FRAMES} frames, trail by up to ${HIT_LATE_FRAMES}).` });
  }
}

function checkCues(ctx) {
  const cues = ctx.audioTags.filter(isCue);
  if (!cues.length) return;
  if (!ctx.envelope) {
    ctx.notes.push(`${cues.length} <audio data-at> cue(s) but the render has no audio track: the audio checks are skipped; run bin/vawe dev <page> (without --silent), then bin/vawe critique <page> again`);
    return;
  }
  const onsets = onsetsOf(ctx.envelope);
  for (const c of cues) checkOneCue(ctx, c, onsets);
}

function beatSource(ctx) {
  const bed = ctx.audioTags.find((a) => a.loop && a.src && !a.src.startsWith('http'));
  const bedFile = bed && ctx.page && path.resolve(path.dirname(ctx.page), bed.src);
  return bedFile && fs.existsSync(bedFile) ? { file: bedFile, offset: Number(bed.at || 0) } : { file: ctx.video, offset: 0 };
}

function checkCutsAgainstBeats(ctx) {
  const { f, fps, lead } = ctx;
  const source = beatSource(ctx);
  const audio = decodeMono(source.file, 22050);
  if (!audio.samples) return;
  const { env, hopSeconds } = onsetEnvelope(audio.samples, 22050);
  const { periodFrames, confidence, bpm } = estimateTempo(env, hopSeconds);
  if (confidence < BEAT_MIN_CONFIDENCE) {
    ctx.notes.push(`cut-off-beat: no reliable pulse in the music (confidence ${confidence.toFixed(1)}), skipped`);
    return;
  }
  const grid = beatGrid(periodFrames, estimatePhase(env, periodFrames), hopSeconds, audio.samples.length / 22050);
  const beats = grid.map((b) => b + source.offset);
  for (const c of cutsAgainstBeats(ctx.cutTimes, beats, fps, lead)) {
    if (Math.abs(c.frames) <= CUT_TOL_FRAMES) continue;
    f.warn('cut-off-beat', `cut lands ${Math.abs(c.frames).toFixed(1)} frames ${c.frames > 0 ? 'late' : 'early'} against the ${bpm.toFixed(0)} BPM grid (beat at ${c.beat.toFixed(2)}s${lead ? `, lead ${lead}f` : ''})`,
      { at: fmtT(c.t, fps), fix: `move the cut to ${c.target.toFixed(3)}s${lead ? '' : ', or pass --lead N to land it N frames before the beat'}.` });
  }
}

function checkReference(ctx) {
  const { f, fps, dur } = ctx;
  const refCuts = detectCuts(ctx.ref, ctx.work, 0.3, 0.4).cuts.map((c) => c.t);
  for (const r of refCuts) {
    const mine = nearestTo(ctx.cutTimes, r);
    if (mine == null || Math.abs(mine - r) > 0.5) {
      f.warn('cut-off-reference', `the reference cuts at ${r.toFixed(2)}s and the render has no cut within 0.5s`,
        { at: fmtT(r, fps), fix: 'add the cut at that time, or check the render is not a different length.' });
      continue;
    }
    const frames = (mine - r) * fps;
    if (Math.abs(frames) > CUT_TOL_FRAMES) {
      f.warn('cut-off-reference', `the cut lands ${Math.abs(frames).toFixed(1)} frames ${frames > 0 ? 'late' : 'early'} against the reference (${r.toFixed(2)}s)`,
        { at: fmtT(mine, fps), fix: `move the cut to ${r.toFixed(3)}s.` });
    }
  }
  const refDur = probe(ctx.ref).dur;
  if (Math.abs(refDur - dur) > 1 / fps) ctx.notes.push(`length: reference ${refDur.toFixed(2)}s, render ${dur.toFixed(2)}s`);
}

async function textureRects(ctx) {
  if (!ctx.page) return [];
  try {
    const { openPage, settle, resolveFrame } = await import('../../harness/media/render-page.mjs');
    const opened = await openPage(ctx.page, resolveFrame(ctx.page, {}));
    try {
      await opened.page.goto(opened.url, { waitUntil: 'load' });
      await settle(opened.page);
      return await opened.page.evaluate(textureCanvases, TEXTURE.reasonMin);
    } finally { await opened.close(); }
  } catch (e) {
    ctx.notes.push(`text-unreadable-hold: the page could not be read for texture canvases (${e.message.split('\n')[0]}), so no canvas is treated as texture`);
    return [];
  }
}

async function checkText(ctx) {
  if (spawnSync('tesseract', ['-version']).error) { ctx.notes.push('text-unreadable-hold: tesseract is not on PATH, skipped'); return; }
  const { words } = wordEventTracks(ctx.video, 0, ctx.dur, ctx.work, { skip: await textureRects(ctx) });
  for (const p of readHoldProblems(words)) {
    ctx.f.warn('text-unreadable-hold', `"${p.text.slice(0, 40)}" (${p.n} word${p.n > 1 ? 's' : ''}) is still for ${p.hold.toFixed(2)}s and needs ${p.need.toFixed(2)}s`,
      { at: fmtT(p.tSettled, ctx.fps), fix: `hold ${(p.need - p.hold).toFixed(2)}s longer: delay the exit to ${(p.tSettled + p.need).toFixed(2)}s. Keep the motion quick; the time to read comes from the hold.` });
  }
}

function checkLoop(ctx) {
  const r = loopSeam(ctx.video, ctx.work);
  const line = describeLoop(r);
  if (!/: (doubled|jump)/.test(line)) { ctx.notes.push(`loop-seam: ${line}`); return; }
  ctx.f.warn('loop-seam', line, { at: fmtT(ctx.dur, ctx.fps),
    fix: 'end the film one frame before it repeats the first pose, and drive loop motion with loopT(t, period) (core/motion/springs.js) so the last frame flows into the first.' });
}

function envelopeOfVideo(video) {
  const { samples } = decodeMono(video);
  return samples ? envelopeOf(samples) : null;
}

async function buildContext(argv) {
  const flag = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
  const valueFlags = new Set(['--ref', '--lead', '--skip']);
  const input = argv.find((a, i) => !a.startsWith('--') && !valueFlags.has(argv[i - 1]));
  if (!input || !fs.existsSync(input)) {
    console.error('usage: node quality/gates/page-check.mjs <page.html|render.mp4> [--ref <ref.mp4>] [--lead <frames>] [--skip text,audio,live,cuts]');
    process.exit(2);
  }
  const page = pageFor(input);
  const video = await videoFor(input);
  const { fps, dur, width, height } = probe(video);
  const declared = page && referenceFor(page);
  const skip = new Set((flag('--skip', '') || '').split(',').filter(Boolean));
  const work = scratch('page-check', path.basename(video).replace(/\.[^.]+$/, ''));
  return {
    input, page, video, fps, dur, width, height, skip, work, f: gateFindings(), notes: [],
    ref: flag('--ref', null) || (declared ? path.join(ROOT, declared) : null),
    lead: Number(flag('--lead', 0)),
    audioTags: page ? pageAudio(fs.readFileSync(page, 'utf8')) : [],
    spectacle: page ? Number(readPageMeta(page, 'spectacle')) : NaN,
    series: motionDeltaSeries(video),
    cutTimes: detectCuts(video, work, 0.3, 0.4).cuts.map((c) => c.t),
    envelope: skip.has('audio') ? null : envelopeOfVideo(video),
  };
}

async function main() {
  const ctx = await buildContext(process.argv.slice(2));
  const { skip, page } = ctx;
  checkDeadStops(ctx);
  checkSpectacle(ctx);
  if (!skip.has('audio') && page) checkCues(ctx);
  if (!skip.has('cuts') && ctx.cutTimes.length) checkCutsAgainstBeats(ctx);
  if (!skip.has('cuts') && ctx.ref && fs.existsSync(ctx.ref)) checkReference(ctx);
  if (!skip.has('text')) await checkText(ctx);
  if (!skip.has('live') && page) { await checkLive(ctx); await checkClipped(ctx); }
  else if (!page) ctx.notes.push('contrast, fonts, audio cues and meta checks need the page: pass page.html, or render to out/<film>.mp4 with films/<film>/page.html beside it');
  if (page && readPageMeta(page, 'loop') === 'true') checkLoop(ctx);

  console.log(`\n  page-check · ${path.basename(ctx.input)} · ${ctx.dur.toFixed(2)}s at ${ctx.fps} fps, ${ctx.width}x${ctx.height} · ${ctx.f.count} finding(s), advisory`);
  ctx.f.emit((records) => groupFindingLines(records));
  for (const n of ctx.notes) console.log(`  · ${n}`);
  if (!ctx.f.count) console.log('  ✓ nothing measured is off. The eye still judges what a number cannot.');
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((e) => { console.error(e.stack || String(e)); process.exit(0); });
