#!/usr/bin/env node
// harness/media/ref-spec.mjs: reference video -> SPEC.md + spec.json, the measured numbers an agent
// rebuilds a film from. `bin/vawe see <mp4> --spec`. ffmpeg only (tesseract only with --ocr).
//
//   node harness/media/ref-spec.mjs <ref.mp4> [--out dir] [--fps 29.97] [--elements 6] [--ocr] [--no-audio]
//
// Reuses: ref-measure/transition.mjs (cuts and how each one changes the picture), lib/sound-read.mjs (audio onsets, tempo, beat grid),
// core/motion/springs.js approach()/spring() (the curves an arrival is fitted to), see.mjs ocrWords.
// Every frame is decoded at 320px wide; positions and sizes are reported in reference pixels.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { probeSize } from '../lib/frame-forensics.mjs';
import { scratch, ffmpegOrDie } from '../lib/scratch.mjs';
import { readWav } from './wav-read.mjs';
import { analyseMono } from '../lib/sound-read.mjs';
import { r1, r3, median, mode, summariseMove } from '../lib/move-fit.mjs';
import { refineTrack } from '../lib/ref-measure/subpixel.mjs';
import { findTransitions, shotSpans } from '../lib/ref-measure/transition.mjs';
import { measureLayout } from '../lib/ref-measure/layout.mjs';
import { transitionRow, easingLines, layoutLines, audioRow, errorLines, colourLines, motionRegionLines } from '../lib/ref-measure/spec-lines.mjs';
import { measureColour } from '../lib/ref-measure/colour.mjs';
import { DEG, estimateCamera, halfRes, slowCamera } from '../lib/ref-measure/camera.mjs';
import { worldTurns } from '../lib/ref-measure/world-turns.mjs';
import { measureMotionRegions } from '../lib/ref-measure/motion-regions.mjs';
import { measureEye } from '../lib/ref-measure/eye-path.mjs';
import { measureGround } from '../lib/ref-measure/ground.mjs';
import { detectMoves } from '../lib/ref-measure/blob-pool.mjs';
import { decode as decodeFrames } from '../lib/ref-measure/decode.mjs';
import { estimateShutter } from '../lib/ref-measure/shutter.mjs';
import { trackWords, refineWordTimes, buildLines, restBox, fontPxOf, inkColor } from '../lib/ref-measure/words.mjs';
import { loadErrors } from '../lib/ref-measure/error-table.mjs';
import { isMain } from '../lib/is-main.mjs';

const GRID_W = 320;
const MAX_FRAMES = 2400;
const MAX_TRACK_GAP = 4;
const die = (m) => { console.error(`✗ ${m}`); process.exit(2); };
const hex = (rgb) => `#${[rgb >> 16, (rgb >> 8) & 255, rgb & 255].map((c) => c.toString(16).padStart(2, '0')).join('')}`;

function probeRate(video) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=avg_frame_rate',
    '-of', 'default=noprint_wrappers=1:nokey=1', video], { encoding: 'utf8' });
  const m = /^(\d+)(?:\/(\d+))?/.exec(String(r.stdout).trim());
  return m ? +m[1] / (m[2] ? +m[2] : 1) : 30;
}

// The highest rate that keeps the film inside MAX_FRAMES; the two spare frames cover the decoder's rounding up.
function fitFps(fps, duration) {
  if (!duration || duration * fps <= MAX_FRAMES - 2) return fps;
  return Math.floor(((MAX_FRAMES - 2) / duration) * 100) / 100;
}

const FAST_GRID_W = 160;

function decode(video, fps, dir, W, H, gridW = GRID_W) {
  try { return decodeFrames(video, fps, dir, W, H, gridW, MAX_FRAMES); } catch (e) { return die(e.message); }
}

// ── cuts: every shot change, classified, in ref-measure/transition.mjs ─────────────────────────────
function findCuts(V, fps) {
  return findTransitions(V).map((t) => ({ frame: t.endFrame, t: r3(t.endFrame / fps), spike: t.spike, transition: { ...t, startT: r3(t.startFrame / fps) } }));
}

// ── moving elements: connected components of the camera-compensated difference ───────────────────

function edgeEnergy(g, w, h, cx, cy, bw, bh) {
  const x0 = Math.max(1, Math.round(cx - bw / 2 - 2)), x1 = Math.min(w - 2, Math.round(cx + bw / 2 + 2));
  const y0 = Math.max(1, Math.round(cy - bh / 2 - 2)), y1 = Math.min(h - 2, Math.round(cy + bh / 2 + 2));
  let ex = 0, ey = 0, n = 0;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    ex += Math.abs(g[y * w + x + 1] - g[y * w + x - 1]);
    ey += Math.abs(g[(y + 1) * w + x] - g[(y - 1) * w + x]);
    n++;
  }
  return n ? { ex: ex / n, ey: ey / n } : { ex: 0, ey: 0 };
}

function trackShot(V, f0, f1, cams, maxTracks, moves) {
  const tracks = [];
  for (let f = f0 + 1; f < f1; f++) {
    const pairs = [], cands = [];
    for (const b of moves.get(f)) {
      const { vx, vy } = b;
      const bw = b.x1 - b.x0 + 1, bh = b.y1 - b.y0 + 1;
      const mx = (b.x0 + b.x1) / 2, my = (b.y0 + b.y1) / 2;
      // Overlapping old and new boxes make one blob (union of both); a jump longer than the box makes two blobs, the new one at its own centre.
      const union = { f, x: mx + vx / 2, y: my + vy / 2, vx, vy, w: Math.max(2, bw - Math.abs(vx)), h: Math.max(2, bh - Math.abs(vy)), area: b.area };
      const whole = { f, x: mx, y: my, vx, vy, w: bw, h: bh, area: b.area };
      const ci = cands.push(union.w >= 3 && union.h >= 3 ? union : whole) - 1;
      for (const t of tracks) {
        const last = t.pts[t.pts.length - 1];
        if (f - last.f > MAX_TRACK_GAP) continue;
        const coast = f - last.f === 1 ? 1 : 0;
        for (const pt of [union, whole]) {
          const d = Math.hypot(pt.x - (last.x + coast * last.vx), pt.y - (last.y + coast * last.vy));
          const dw = Math.abs(pt.w - last.w) + Math.abs(pt.h - last.h);
          if (d < Math.max(12, 1.2 * Math.max(bw, bh)) && dw <= 0.35 * (last.w + last.h)) pairs.push({ t, ci, pt, score: d + 1.5 * dw });
        }
      }
    }
    const usedTrack = new Set(), usedBlob = new Set();
    for (const p of pairs.sort((a, b) => a.score - b.score)) {
      if (usedTrack.has(p.t) || usedBlob.has(p.ci)) continue;
      const last = p.t.pts[p.t.pts.length - 1];
      for (let g = last.f + 1; g < f; g++) p.t.pts.push({ ...last, f: g, vx: 0, vy: 0 });
      p.t.pts.push(p.pt);
      usedTrack.add(p.t); usedBlob.add(p.ci);
    }
    cands.forEach((pt, ci) => { if (!usedBlob.has(ci)) tracks.push({ pts: [pt] }); });
  }
  const scored = tracks.filter((t) => t.pts.length >= 3).map((t) => {
    const travel = t.pts.reduce((s, p) => s + Math.hypot(p.vx, p.vy), 0);
    const area = t.pts.reduce((s, p) => s + p.area, 0) / t.pts.length;
    return { t, score: travel + 0.05 * area * t.pts.length };
  }).sort((a, b) => b.score - a.score).slice(0, maxTracks);
  return scored.map((s) => s.t).sort((a, b) => a.pts[0].f - b.pts[0].f);
}

// ── one element's move: overshoot, arrival curve, blur ───────────────────────────────────────────
// The colour most pixels in the middle of the element's box share: its fill, not its edges or text.
function modalColor(V, f, cx, cy, bw, bh) {
  const x0 = Math.max(0, Math.round(cx - bw * 0.3)), x1 = Math.min(V.w - 1, Math.round(cx + bw * 0.3));
  const y0 = Math.max(0, Math.round(cy - bh * 0.3)), y1 = Math.min(V.h - 1, Math.round(cy + bh * 0.3));
  const count = new Map();
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const o = (f * V.w * V.h + y * V.w + x) * 3;
    const key = (V.rgb[o] << 16) | (V.rgb[o + 1] << 8) | V.rgb[o + 2];
    count.set(key, (count.get(key) || 0) + 1);
  }
  const top = [...count.entries()].sort((a, b) => b[1] - a[1])[0];
  return top ? hex(top[0]) : null;
}

// The box of the flat colour region around (cx, cy) in frame f: an element's true size at rest, free of the
// blur and edge smear a change region carries. Null when the colour is not a solid fill (text, a photo).
const FILL_DIST = 20;
const SOLID_SHARE = 0.85;
function restRegion(V, f, cx, cy, colour) {
  if (!colour) return null;
  const want = [parseInt(colour.slice(1, 3), 16), parseInt(colour.slice(3, 5), 16), parseInt(colour.slice(5, 7), 16)];
  const base = f * V.w * V.h * 3, near = (i) => Math.abs(V.rgb[base + i * 3] - want[0]) + Math.abs(V.rgb[base + i * 3 + 1] - want[1]) + Math.abs(V.rgb[base + i * 3 + 2] - want[2]) <= FILL_DIST;
  const sx = Math.round(cx), sy = Math.round(cy);
  if (sx < 0 || sy < 0 || sx >= V.w || sy >= V.h || !near(sy * V.w + sx)) return null;
  const seen = new Uint8Array(V.w * V.h), stack = [sy * V.w + sx];
  let x0 = sx, x1 = sx, y0 = sy, y1 = sy, area = 0;
  seen[stack[0]] = 1;
  while (stack.length) {
    const i = stack.pop(), x = i % V.w, y = (i / V.w) | 0;
    area++; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    if (area > 0.6 * V.w * V.h) return null;
    for (const j of [x > 0 ? i - 1 : -1, x < V.w - 1 ? i + 1 : -1, y > 0 ? i - V.w : -1, y < V.h - 1 ? i + V.w : -1]) if (j >= 0 && !seen[j] && near(j)) { seen[j] = 1; stack.push(j); }
  }
  return { w: x1 - x0 + 3, h: y1 - y0 + 3, area };
}

// One coordinate per frame from where the element sat still before the move to where it rests after it.
function positionSeries(refined, pts, axis) {
  const lead = refined ? refined.lead : [], tail = refined ? refined.tail : [];
  if (!lead.length) {
    const pos = [...pts, ...tail].map((p) => p[axis]);
    return { pos, p0: pos[0] - (axis === 'x' ? pts[0].vx : pts[0].vy), f0: pts[0].f };
  }
  const seq = [...lead, ...pts, ...tail];
  return { pos: seq.slice(1).map((p) => p[axis]), p0: seq[0][axis], f0: seq[1].f };
}

function analyseTrack(track, V, fps, sc, span) {
  const refined = span.still ? refineTrack(V, track.pts, span) : null;
  const pts = refined ? refined.pts : track.pts;
  const dx = pts[pts.length - 1].x - (pts[0].x - pts[0].vx), dy = pts[pts.length - 1].y - (pts[0].y - pts[0].vy);
  const axis = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y';
  const { pos, p0, f0 } = positionSeries(refined, pts, axis), p1 = pos[pos.length - 1], D = p1 - p0;
  const speeds = pts.map((p) => Math.hypot(p.vx, p.vy) * sc);
  const peak = Math.max(...speeds);
  const moving = speeds.filter((s) => s >= 0.05 * peak).length;
  const out = { f0: pts[0].f, f1: pts[pts.length - 1].f, axis, frames: pts.length, movingFrames: moving,
    from: [r1(pts[0].x * sc), r1(pts[0].y * sc)], to: [r1(pts[pts.length - 1].x * sc), r1(pts[pts.length - 1].y * sc)],
    size: [r1(median(pts.map((p) => p.w)) * sc), r1(median(pts.map((p) => p.h)) * sc)], peakSpeed: r1(peak), overshoot: null, fit: null };
  Object.assign(out, summariseMove(pos, p0, p1, fps, sc, { f0 }));
  out.shutter = refined ? estimateShutter(V, pts, axis) : null;
  const last = pts[pts.length - 1];
  out.color = modalColor(V, last.f, last.x, last.y, last.w, last.h);
  const rest = restRegion(V, Math.min(V.n - 1, last.f + 1), last.x, last.y, out.color);
  out.solid = Boolean(rest) && rest.area > 0.4 * last.w * last.h && rest.area < 2.5 * last.w * last.h
    && fillShare(V, Math.min(V.n - 1, last.f + 1), { x: (last.x - rest.w / 2) / V.w, y: (last.y - rest.h / 2) / V.h, w: rest.w / V.w, h: rest.h / V.h }, out.color) >= SOLID_SHARE;
  if (out.solid) out.size = [r1(rest.w * sc), r1(rest.h * sc)];
  const travel = Math.abs(D) * sc;
  out.confidence = pts.length >= 5 && (!out.fit || out.fit.rmsePx <= 0.08 * travel) ? 'high' : 'low';
  const energies = pts.map((p) => edgeEnergy(V.frame(p.f), V.w, V.h, p.x, p.y, p.w, p.h));
  const mx = Math.max(...energies.map((e) => e.ex), 1e-6), my = Math.max(...energies.map((e) => e.ey), 1e-6);
  out.rows = pts.map((p, i) => {
    const rx = energies[i].ex / mx, ry = energies[i].ey / my, sharp = (rx + ry) / 2;
    const dir = rx < ry - 0.12 ? 'h' : ry < rx - 0.12 ? 'v' : '';
    return { f: p.f, x: r1(p.x * sc), y: r1(p.y * sc), w: r1(p.w * sc), h: r1(p.h * sc), vx: r1(p.vx * sc), vy: r1(p.vy * sc),
      sharp: r3(sharp), blurDir: sharp < 0.75 ? dir || 'radial' : '' };
  });
  const blurred = out.rows.filter((r) => r.blurDir);
  out.blur = blurred.length ? { f0: blurred[0].f, f1: blurred[blurred.length - 1].f, frames: blurred.length,
    minSharp: Math.min(...blurred.map((r) => r.sharp)), dir: mode(blurred.map((r) => r.blurDir)) } : null;
  return out;
}

// The resting layout of frame f, each box with the colour most of its middle shares (its fill).
function shotLayout(V, f) {
  const layout = measureLayout({ w: V.w, h: V.h, rgb: V.rgb.subarray(f * V.w * V.h * 3, (f + 1) * V.w * V.h * 3) });
  const boxes = layout.boxes.map((b) => {
    const color = modalColor(V, f, (b.x + b.w / 2) * V.w, (b.y + b.h / 2) * V.h, b.w * V.w, b.h * V.h);
    return { ...b, color, fill: r3(fillShare(V, f, b, color)) };
  });
  return { frame: f, ...layout, boxes };
}

// The share of a box (fractions of the frame) that is one flat colour: near 1 for a card or a bar, low for a line of text, a glow or a photo.
function fillShare(V, f, b, colour) {
  if (!colour) return 0;
  const want = [1, 3, 5].map((i) => parseInt(colour.slice(i, i + 2), 16));
  const x0 = Math.floor(b.x * V.w), x1 = Math.min(V.w, Math.ceil((b.x + b.w) * V.w)), y0 = Math.floor(b.y * V.h), y1 = Math.min(V.h, Math.ceil((b.y + b.h) * V.h));
  let hit = 0, n = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const o = (f * V.w * V.h + y * V.w + x) * 3;
    if (Math.abs(V.rgb[o] - want[0]) + Math.abs(V.rgb[o + 1] - want[1]) + Math.abs(V.rgb[o + 2] - want[2]) <= FILL_DIST) hit++;
    n++;
  }
  return n ? hit / n : 0;
}

// ── palette: k-means, deterministic (farthest-point start), reported as the exact modal pixel per cluster ──
function palette(V, f0, f1, k = 5) {
  const pick = Math.min(10, f1 - f0), pts = [];
  for (let j = 0; j < pick; j++) {
    const f = f0 + Math.floor(((j + 0.5) * (f1 - f0)) / pick), base = f * V.w * V.h * 3;
    for (let y = 0; y < V.h; y += 2) for (let x = 0; x < V.w; x += 2) {
      const o = base + (y * V.w + x) * 3;
      pts.push([V.rgb[o], V.rgb[o + 1], V.rgb[o + 2]]);
    }
  }
  const cent = [pts[Math.floor(pts.length / 2)]];
  while (cent.length < k) {
    let far = pts[0], farD = -1;
    for (const p of pts) {
      const d = Math.min(...cent.map((c) => (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2));
      if (d > farD) { farD = d; far = p; }
    }
    if (farD < 60) break;
    cent.push(far);
  }
  const assign = new Int32Array(pts.length);
  for (let it = 0; it < 8; it++) {
    const sum = cent.map(() => [0, 0, 0, 0]);
    pts.forEach((p, i) => {
      let b = 0, bd = Infinity;
      cent.forEach((c, j) => { const d = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2; if (d < bd) { bd = d; b = j; } });
      assign[i] = b; sum[b][0] += p[0]; sum[b][1] += p[1]; sum[b][2] += p[2]; sum[b][3]++;
    });
    sum.forEach((s, j) => { if (s[3]) cent[j] = [s[0] / s[3], s[1] / s[3], s[2] / s[3]]; });
  }
  return cent.map((_, j) => {
    const count = new Map();
    let n = 0;
    pts.forEach((p, i) => { if (assign[i] === j) { const key = (p[0] << 16) | (p[1] << 8) | p[2]; count.set(key, (count.get(key) || 0) + 1); n++; } });
    const top = [...count.entries()].sort((a, b) => b[1] - a[1])[0];
    return top ? { hex: hex(top[0]), share: r3(n / pts.length) } : null;
  }).filter(Boolean).sort((a, b) => b.share - a.share);
}

// ── audio ────────────────────────────────────────────────────────────────────────────────────────
function analyseAudio(video, dir, fps, dur) {
  const wav = path.join(dir, 'audio.wav');
  try { ffmpegOrDie(['-v', 'error', '-y', '-i', video, '-vn', '-ac', '1', '-ar', '22050', '-c:a', 'pcm_s16le', wav], wav, 'audio extract'); }
  catch { return null; }
  const { mono, sampleRate } = readWav(wav);
  fs.rmSync(wav, { force: true });
  const a = analyseMono(mono, sampleRate, { fps, duration: dur });
  if (!a) return null;
  return { hits: a.hits, bpm: r1(a.bpm), confidence: r1(a.confidence), framesPerBeat: a.bpm ? r1((60 / a.bpm) * fps) : 0, beats: a.beats,
    beatFrames: a.beats.map((b) => Math.round(b * fps)) };
}

function cutLeads(cuts, audio, fps) {
  return cuts.map((c) => {
    const near = (arr, get) => arr.reduce((b, x) => (b == null || Math.abs(get(x) - c.t) < Math.abs(get(b) - c.t) ? x : b), null);
    const hit = audio && near(audio.hits.filter((h) => h.strength >= 0.25), (h) => h.t);
    const beat = audio && near(audio.beats, (b) => b);
    const frames = (t) => Math.round((c.t - t) * fps);
    return { hitLead: hit && Math.abs(hit.t - c.t) <= 0.3 ? frames(hit.t) : null, beatLead: beat != null && Math.abs(beat - c.t) <= 0.3 ? frames(beat) : null };
  });
}

// ── text (optional): one tesseract pass, read as runs, word appearances and lines ─────────────────
const TEXT_FPS = 8;
const FAST_TEXT_FPS = 4;
async function analyseText(video, dir, V, W, H, fps, textFps = TEXT_FPS) {
  const { sampleText, textRuns } = await import('./see/text-timeline.mjs');
  const samples = await sampleText(video, dir, { sampleFps: textFps, width: W, height: H });
  const apps = refineWordTimes(V, trackWords(samples, textFps), W, fps).map((a) => ({ ...a, color: inkColor(V, a, W, fps) }));
  const lines = buildLines(apps, fps);
  const words = apps.map((a) => {
    const b = restBox(a);
    return { text: a.text, f0: Math.round(a.t0 * fps), f1: Math.round(a.t1 * fps), boxHeightPx: r1(b.h), boxWidthPx: r1(b.w),
      fontPxApprox: r1(fontPxOf(a.text, b.h)), cxPx: r1(b.x), cyPx: r1(b.y) };
  });
  return { runs: textRuns(samples), lines, words };
}

// ── SPEC.md ──────────────────────────────────────────────────────────────────────────────────────
const KEEP_CHANGE = `## KEEP / CHANGE (edit this before rebuilding)

KEEP (copy from the numbers below, frame for frame): timing, cuts, camera, easing, positions, blur, transitions.
CHANGE (make your own): brand, logo, colours, fonts, copy, product screens, faces, platform UI.

Add or remove items per film. A KEEP item is checked with \`bin/vawe critique <page.html> --ref <ref.mp4>\`.
`;

const tableRows = (rows, cols, cap = 30) => {
  const head = `| ${cols.map((c) => c[0]).join(' | ')} |\n|${cols.map(() => '---').join('|')}|`;
  const body = rows.slice(0, cap).map((r) => `| ${cols.map((c) => r[c[1]] ?? '').join(' | ')} |`).join('\n');
  return `${head}\n${body}${rows.length > cap ? `\n| ... ${rows.length - cap} more rows in spec.json |` : ''}`;
};

function shotSection(s, fps, err) {
  const L = [`## Shot ${s.index}: frames ${s.f0}-${s.f1 - 1} (${s.frames} f, ${r1(s.frames / fps * 100) / 100} s)`, ''];
  L.push(`palette: ${s.palette.map((p) => `${p.hex} ${Math.round(p.share * 100)}%`).join(', ')}`);
  const c = s.camera;
  L.push(`camera: zoom x${c.zoomTotal} (peak ${c.peakZoomPerFrame}/f), pan ${c.panTotalPx[0]},${c.panTotalPx[1]} px (peak ${c.peakPanPxPerFrame} px/f), turn ${c.rotation.total} deg (peak ${c.rotation.peakPerFrame} deg/f)${c.big ? '' : ' (static, no table)'}`);
  if (c.big) L.push('', tableRows(c.rows, [['f', 'f'], ['zoom cum', 'zoomCum'], ['dzoom', 'dz'], ['pan x px', 'panX'], ['pan y px', 'panY'], ['dx', 'dx'], ['dy', 'dy'], ['turn deg', 'dr'], ['turn cum', 'rotCum']], 40));
  if (!s.elements.length) L.push('elements: none tracked');
  for (const e of s.elements) {
    const over = e.overshoot != null ? `; overshoot x${e.overshoot}` : '';
    const blur = e.blur ? `; blur f${e.blur.f0}-${e.blur.f1} dir ${e.blur.dir} min sharp ${e.blur.minSharp}` : '';
    L.push('', `### E${e.id}: f${e.f0}-${e.f1}, (${e.from}) -> (${e.to}) px, size ${e.size[0]}x${e.size[1]}, ${e.movingFrames} moving f, peak ${e.peakSpeed} px/f${over}${blur}`);
    L.push(...easingLines(e, fps, err).map((x) => `- ${x}`));
    if (e.big) L.push('', tableRows(e.rows, [['f', 'f'], ['x', 'x'], ['y', 'y'], ['w', 'w'], ['h', 'h'], ['vx', 'vx'], ['vy', 'vy'], ['sharp', 'sharp'], ['blur', 'blurDir']]));
  }
  L.push(...layoutLines(s, err).map((x, i) => (i ? x : `\n${x}`)));
  if (s.text.length) L.push('', 'text: ' + s.text.map((t) => `"${t.text}" f${t.f0}-${t.f1} box ${t.boxHeightPx} px (font ~${t.fontPxApprox} px)`).join('; '));
  if (s.hits.length) L.push('', `audio hits (frame:strength): ${s.hits.map((h) => `${h.frame}:${h.strength}`).join(' ')}`);
  return L.join('\n');
}

function wordLines(lines, fps) {
  const L = ['## Words by line (reveal order)', '',
    'One row per appearance of a word, so a repeated word keeps every appearance. t0 is the first frame the word shows (pixels, plus or minus 1 frame); x, y are the box centre and h the box height AT REST, in reference px.', ''];
  for (const l of lines.slice(0, 60)) {
    const step = l.stagger === 'single' || l.stagger === 'all-at-once' ? '' : `, ${Math.round(l.stepS * 1000)} ms between words`;
    L.push(`### Line ${l.index}: "${l.text}" (y ${l.y} px, ${l.t0}-${l.t1} s), stagger ${l.stagger}${step}`, '',
      tableRows(l.words.map((w, i) => ({ n: i + 1, word: w.word, t0: w.t0, f0: Math.round(w.t0 * fps), t1: w.t1, x: w.x, y: w.y, h: w.h })),
        [['#', 'n'], ['word', 'word'], ['t0 s', 't0'], ['t0 f', 'f0'], ['t1 s', 't1'], ['x', 'x'], ['y', 'y'], ['h', 'h']], 40), '');
  }
  if (lines.length > 60) L.push(`${lines.length - 60} more lines in spec.json`, '');
  return L;
}

function renderSpec(spec) {
  const m = spec.media;
  const L = [`# SPEC: ${path.basename(m.file)}`, '',
    ...(spec.fast ? ['**Fast mode**: measured at half the analysis width and half the OCR samples. Use it to iterate; run without --fast for final numbers.', ''] : []),
    `${m.width}x${m.height} · ${m.nativeFps} fps native, analysed at ${spec.fps} fps · ${spec.frames} frames · ${r1(spec.duration * 100) / 100} s · ${spec.shots.length} shots`,
    'Measured by harness/media/ref-spec.mjs. Frames are 0-based. Positions are element centres in reference px. `x`/`y` and sizes are measured, never eyeballed;',
    'camera pan is how far the content moves (positive = right/down), zoom above 1 = push in. Element numbers are the change region between frames, tracked after camera compensation.', '',
    KEEP_CHANGE, '## Cuts', '',
    tableRows(spec.cuts.map((c, i) => transitionRow(c, i + 1)),
      [['#', 'n'], ['type', 'type'], ['dir', 'dir'], ['frames', 'frames'], ['at frames', 'span'], ['conf', 'conf'], ['evidence', 'evidence'], ['audio hit lead f', 'hit'], ['beat lead f', 'beat']], 80), '',
    'frames = steps the change takes (a hard cut is 1; a 6-frame crossfade is 6). at frames = first changed frame to first fully new frame. The shot cut point in spec.json is the last of them.',
    'lead = frames the sound comes before the cut (positive), within 0.3 s.', ''];
  if (spec.audio) {
    const a = spec.audio;
    L.push('## Audio', '', `${a.bpm} BPM (confidence ${a.confidence}; below 1.6 is weak), ${a.framesPerBeat} frames per beat, ${a.hits.length} hits.`,
      'Place a cue on `attack` (where the sound starts), not on `peak` (the loudest change, later, on the body of the hit).', '',
      `beat frames: ${a.beatFrames.slice(0, 48).join(' ')}${a.beatFrames.length > 48 ? ' ...' : ''}`, '',
      tableRows(a.hits.map(audioRow), [['attack s', 'attack'], ['attack f', 'attackFrame'], ['err ms', 'errMs'], ['peak s', 't'], ['peak f', 'frame'], ['strength', 'strength'], ['note', 'note']], 60), '');
  } else L.push('## Audio', '', 'no audio stream.', '');
  L.push(...colourLines(spec.colour, spec.worldTurns), ...motionRegionLines(spec.motionRegions));
  if (spec.textLines && spec.textLines.length) L.push(...wordLines(spec.textLines, spec.fps));
  if (spec.textRuns) L.push('## On-screen text (every 0.25 s, whole film)', '', 'Every row must exist in the rebuild at its time. OCR spelling can be off; the timing and the line breaks are right.', '', tableRows(spec.textRuns.map((r) => ({ from: r.t0.toFixed(2), to: r.t1.toFixed(2), text: r.text || '(no text)' })), [['from s', 'from'], ['to s', 'to'], ['text (lines split by /)', 'text']], 400), '');
  for (const s of spec.shots) L.push(shotSection(s, spec.fps, spec.err), '');
  L.push(...errorLines(spec.err, spec.errCalibrated));
  return L.join('\n');
}

// ── main ─────────────────────────────────────────────────────────────────────────────────────────
const MEASURING_CODE = ['harness/media/ref-spec.mjs', 'harness/lib/move-fit.mjs', 'harness/media/see/text-timeline.mjs'];
const CODE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function measuringCodeHash() {
  const files = [...MEASURING_CODE, ...fs.readdirSync(path.join(CODE_ROOT, 'harness/lib/ref-measure')).sort().map((f) => `harness/lib/ref-measure/${f}`)];
  const h = crypto.createHash('sha1');
  for (const f of files) h.update(f).update(fs.readFileSync(path.join(CODE_ROOT, f)));
  return h.digest('hex');
}

function cacheDir(video, opts) {
  const st = fs.statSync(video);
  const key = crypto.createHash('sha1').update(JSON.stringify([path.resolve(video), st.size, st.mtimeMs, opts, measuringCodeHash()])).digest('hex');
  return scratch('ref-spec-cache', key);
}

export async function refSpec({ video, outDir, fps, maxElements = 6, ocr = false, audio = true, calibrating = false, fast = false, cache = true }) {
  const cached = path.join(cacheDir(video, { fps, maxElements, ocr, audio, calibrating, fast }));
  if (cache && fs.existsSync(path.join(cached, 'spec.json'))) {
    fs.mkdirSync(outDir, { recursive: true });
    for (const f of ['spec.json', 'SPEC.md']) fs.copyFileSync(path.join(cached, f), path.join(outDir, f));
    console.error('ref-spec: (cached)');
    return JSON.parse(fs.readFileSync(path.join(cached, 'spec.json'), 'utf8'));
  }
  const spec = await measureRef({ video, outDir, fps, maxElements, ocr, audio, calibrating, fast });
  if (cache) {
    fs.mkdirSync(cached, { recursive: true });
    for (const f of ['spec.json', 'SPEC.md']) fs.copyFileSync(path.join(outDir, f), path.join(cached, f));
  }
  return spec;
}

async function measureRef({ video, outDir, fps, maxElements, ocr, audio, calibrating, fast }) {
  const { width: W, height: H, duration } = probeSize(video);
  if (!W || !H) die(`${video} has no readable video stream`);
  const nativeFps = probeRate(video);
  fps = fps || Math.round(nativeFps * 100) / 100;
  const fitted = fitFps(fps, duration);
  if (fitted !== fps) console.error(`ref-spec: ${duration} s at ${fps} fps is over ${MAX_FRAMES} frames, analysing at ${fitted} fps`);
  fps = fitted;
  const dir = scratch('ref-spec', path.basename(video, path.extname(video)));
  fs.mkdirSync(dir, { recursive: true });
  console.error(`ref-spec: decoding ${path.basename(video)} at ${fps} fps`);
  const V = decode(video, fps, dir, W, H, fast ? FAST_GRID_W : GRID_W);
  const sc = W / V.w;
  const cuts = findCuts(V, fps);
  const spans = shotSpans(cuts.map((c) => c.transition), V.n);

  const cams = [{ s: 1, dx: 0, dy: 0, r: 0 }];
  let prev = halfRes(V.frame(0), V.w, V.h);
  const inCut = (f) => cuts.some((c) => f >= c.transition.startFrame && f <= c.frame);
  for (let f = 1; f < V.n; f++) {
    const cur = halfRes(V.frame(f), V.w, V.h);
    cams.push(inCut(f) ? { s: 1, dx: 0, dy: 0, r: 0 } : estimateCamera(prev, cur, V.w >> 1, V.h >> 1));
    prev = cur;
    if (f % 200 === 0) console.error(`  camera ${f}/${V.n}`);
  }

  slowCamera(V, cams, spans, Math.max(2, Math.round(fps / 6)));

  const aud = audio ? analyseAudio(video, dir, fps, V.n / fps) : null;
  const leads = cutLeads(cuts, aud, fps);
  cuts.forEach((c, i) => Object.assign(c, leads[i]));
  const read = ocr ? await analyseText(video, dir, V, W, H, fps, fast ? FAST_TEXT_FPS : TEXT_FPS) : { runs: null, lines: [], words: [] };
  const text = read.words, textRuns = read.runs;

  const moves = await detectMoves(V, spans.flatMap(({ f0, f1 }) => Array.from({ length: Math.max(0, f1 - f0 - 1) }, (_, k) => ({ f: f0 + 1 + k, cam: cams[f0 + 1 + k] }))));
  const shots = [];
  for (let i = 0; i < spans.length; i++) {
    const { f0, f1 } = spans[i];
    if (f1 - f0 < 1) continue;
    console.error(`  shot ${i + 1}: frames ${f0}-${f1 - 1}`);
    const tracks = trackShot(V, f0, f1, cams, maxElements, moves);
    const elements = tracks.map((t, j) => {
      const e = analyseTrack(t, V, fps, sc, { f0, f1, still: cams.slice(f0 + 1, f1).every((c) => c.s === 1 && c.dx === 0 && c.dy === 0 && !c.r) });
      const travel = Math.hypot(e.to[0] - e.from[0], e.to[1] - e.from[1]);
      if (e.frames <= 4 && travel < 3 && !e.blur) return null;
      return { id: `${i + 1}.${j + 1}`, ...e, big: travel >= 0.03 * W || e.blur != null };
    }).filter(Boolean);
    let zc = 1, px = 0, py = 0, rot = 0;
    const camRows = [];
    for (let f = f0 + 1; f < f1; f++) {
      const c = cams[f];
      zc *= c.s; px += c.dx * 2 * sc; py += c.dy * 2 * sc; rot += (c.r ?? 0) / DEG;
      camRows.push({ f, zoomCum: r3(zc), dz: r3(c.s - 1), panX: r1(px), panY: r1(py), dx: r1(c.dx * 2 * sc), dy: r1(c.dy * 2 * sc), dr: r3((c.r ?? 0) / DEG), rotCum: r3(rot) });
    }
    const peakZ = Math.max(0, ...camRows.map((r) => Math.abs(r.dz))), peakP = Math.max(0, ...camRows.map((r) => Math.hypot(r.dx, r.dy))), peakR = Math.max(0, ...camRows.map((r) => Math.abs(r.dr)));
    const big = Math.abs(zc - 1) > 0.02 || Math.hypot(px, py) > 0.02 * W || Math.abs(rot) > 1;
    shots.push({ index: i + 1, f0, f1, frames: f1 - f0, t0: r3(f0 / fps), t1: r3(f1 / fps),
      palette: palette(V, f0, f1),
      camera: { zoomTotal: r3(zc), panTotalPx: [r1(px), r1(py)], peakZoomPerFrame: r3(peakZ), peakPanPxPerFrame: r1(peakP), rotation: { total: r1(rot), peakPerFrame: r3(peakR) }, big,
        rows: camRows.filter((r) => Math.abs(r.dz) > 0.0015 || Math.hypot(r.dx, r.dy) > 0.5 || Math.abs(r.dr) > 0.05) },
      elements, layout: shotLayout(V, f1 - 1),
      text: text.filter((t) => t.f0 >= f0 && t.f0 < f1),
      hits: aud ? aud.hits.filter((h) => h.frame >= f0 && h.frame < f1) : [] });
  }
  const colour = measureColour(V, spans, fps);
  const turns = worldTurns(colour.perShot, V.n / fps);
  const motionRegions = measureMotionRegions(V, cuts.map((c) => c.transition), fps);
  const eye = measureEye(V, spans, fps);
  const ground = measureGround(V, spans, fps);
  const errors = calibrating ? loadErrors('/nonexistent') : loadErrors();
  const spec = { media: { file: video, width: W, height: H, nativeFps: r1(nativeFps) }, fps, frames: V.n, duration: duration || V.n / fps,
    fast, cuts, audio: aud, shots, colour, worldTurns: turns, motionRegions, eye, ground, ocr, textRuns, textLines: read.lines, err: errors.measures, errCalibrated: errors.generated };
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'spec.json'), `${JSON.stringify(spec, null, 1)}\n`);
  fs.writeFileSync(path.join(outDir, 'SPEC.md'), `${renderSpec(spec)}\n`);
  fs.rmSync(dir, { recursive: true, force: true });
  return spec;
}

async function main() {
  const argv = process.argv.slice(2);
  const flag = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
  const video = argv.find((a, i) => !a.startsWith('--') && !(argv[i - 1] || '').match(/^--(out|fps|elements)$/));
  if (!video) die('usage: node harness/media/ref-spec.mjs <ref.mp4> [--out dir] [--fps 29.97] [--elements 6] [--ocr] [--no-audio] [--fast] [--no-cache]');
  if (!fs.existsSync(video)) die(`no such file: ${video}`);
  const outDir = path.resolve(flag('--out', path.dirname(path.resolve(video))));
  const spec = await refSpec({ video: path.resolve(video), outDir, fps: Number(flag('--fps', 0)) || 0, maxElements: Number(flag('--elements', 6)),
    ocr: argv.includes('--ocr'), audio: !argv.includes('--no-audio'),
    fast: argv.includes('--fast'), cache: !argv.includes('--no-cache') });
  console.log(`✓ ref-spec: ${spec.shots.length} shot(s), ${spec.cuts.length} cut(s) -> ${path.join(outDir, 'SPEC.md')}`);
}

if (isMain(import.meta.url)) main();
