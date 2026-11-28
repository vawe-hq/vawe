#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { isMain } from '../lib/is-main.mjs';

export const W = 480, H = 270;

const BANDS = [[15, 'not'], [33, 'slightly'], [45, 'moderately'], [59, 'averagely'], [82, 'quite'], [109, 'highly']];
export const bandOf = (m) => (BANDS.find(([lim]) => m < lim) || [0, 'extremely'])[1];

const EDGE_SPAN = 3;     // pixels either side of the test point; wide enough for a softened edge, no wider
const EDGE_TOL = 15;     // window jump this high is a wall; below the #fafafa/#eef2fa case's 20-plus
function wallMap(px, w, h) {
  const wall = new Uint8Array(w * h);
  const clamp = (v, hi) => v < 0 ? 0 : v >= hi ? hi - 1 : v;
  const box = (cx, cy) => {
    let r = 0, g = 0, b = 0, c = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const k = (clamp(cy + dy, h) * w + clamp(cx + dx, w)) * 3;
      r += px[k]; g += px[k + 1]; b += px[k + 2]; c++;
    }
    return [r / c, g / c, b / c];
  };
  const diff = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const left = box(clamp(x - EDGE_SPAN, w), y), right = box(clamp(x + EDGE_SPAN, w), y);
    const top = box(x, clamp(y - EDGE_SPAN, h)), bot = box(x, clamp(y + EDGE_SPAN, h));
    if (Math.max(diff(left, right), diff(top, bot)) > EDGE_TOL) wall[y * w + x] = 1;
  }
  return wall;
}
const NEIGHBORS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const GROUND_TOL = 16;   // tight, and BELOW the #fafafa/#eef2fa case's diff of 20: that case is exactly
function dominantGroundColor(px, w, h, ring) {
  const buckets = new Map();
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!(x < ring || x >= w - ring || y < ring || y >= h - ring)) continue;
    const k = (y * w + x) * 3;
    const r = px[k], g = px[k + 1], b = px[k + 2];
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);   // 16 levels/channel
    const e = buckets.get(key) || { count: 0, r: 0, g: 0, b: 0 };
    e.count++; e.r += r; e.g += g; e.b += b;
    buckets.set(key, e);
  }
  let best = null;
  for (const e of buckets.values()) if (!best || e.count > best.count) best = e;
  return best ? [best.r / best.count, best.g / best.count, best.b / best.count] : [128, 128, 128];
}
function floodFill(px, w, h, ring) {
  const n = w * h;
  const wall = wallMap(px, w, h);
  const ground = dominantGroundColor(px, w, h, ring);
  const isGround = new Uint8Array(n);
  const qx = new Int32Array(n), qy = new Int32Array(n);
  let qt = 0;
  const seed = (x, y) => { const i = y * w + x; if (!isGround[i]) { isGround[i] = 1; qx[qt] = x; qy[qt] = y; qt++; } };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!(x < ring || x >= w - ring || y < ring || y >= h - ring)) continue;
    const k = (y * w + x) * 3;
    const d = Math.abs(px[k] - ground[0]) + Math.abs(px[k + 1] - ground[1]) + Math.abs(px[k + 2] - ground[2]);
    if (d <= GROUND_TOL) seed(x, y);
  }
  for (let qh = 0; qh < qt; qh++) {
    const x = qx[qh], y = qy[qh];
    for (const [dx, dy] of NEIGHBORS) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
      const ni = ny * w + nx;
      if (isGround[ni] || wall[ni]) continue;
      seed(nx, ny);
    }
  }
  return isGround;
}

/** measureFrame(rgb, w, h): rgb is a packed 8-bit RGB buffer of w*h pixels. */
export function measureFrame(px, w = W, h = H) {
  const n = w * h;
  if (!px || px.length < n * 3) throw new Error(`content: expected ${n * 3} bytes of rgb for ${w}x${h}, got ${px ? px.length : 0}`);
  const ring = Math.max(2, Math.round(Math.min(w, h) * 0.04));

  const isGround = floodFill(px, w, h, ring);
  let subject = 0;
  for (let k = 0; k < n; k++) if (!isGround[k]) subject++;

  let sRg = 0, sYb = 0, sRg2 = 0, sYb2 = 0;
  const lum = new Float32Array(n);
  for (let k = 0; k < n; k++) {
    const r = px[k * 3], g = px[k * 3 + 1], b = px[k * 3 + 2];
    const rg = r - g, yb = 0.5 * (r + g) - b;
    sRg += rg; sYb += yb; sRg2 += rg * rg; sYb2 += yb * yb;
    lum[k] = 0.299 * r + 0.587 * g + 0.114 * b;
  }
  const mRg = sRg / n, mYb = sYb / n;
  const sdRg = Math.sqrt(Math.max(0, sRg2 / n - mRg * mRg)), sdYb = Math.sqrt(Math.max(0, sYb2 / n - mYb * mYb));
  const colorfulness = Math.hypot(sdRg, sdYb) + 0.3 * Math.hypot(mRg, mYb);

  let grad = 0;
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const k = y * w + x; grad += Math.abs(lum[k + 1] - lum[k - 1]) + Math.abs(lum[k + w] - lum[k - w]);
  }
  const C = 16; let cells = 0, photo = 0;
  for (let cy = 0; cy + C <= h; cy += C) for (let cx = 0; cx + C <= w; cx += C) {
    cells++;
    const seen = new Set(); let s = 0, s2 = 0;
    for (let y = cy; y < cy + C; y++) for (let x = cx; x < cx + C; x++) {
      const k = y * w + x;
      seen.add((px[k * 3] >> 3) << 10 | (px[k * 3 + 1] >> 3) << 5 | (px[k * 3 + 2] >> 3));
      s += lum[k]; s2 += lum[k] * lum[k];
    }
    const sd = Math.sqrt(Math.max(0, s2 / (C * C) - (s / (C * C)) ** 2));
    if (seen.size > 24 && sd > 12) photo++;
  }
  const r1 = (v) => Math.round(v * 10) / 10, r2 = (v) => Math.round(v * 100) / 100;
  return { colorfulness: r1(colorfulness), band: bandOf(colorfulness), fill: r2(subject / n),
    detail: r1(grad / ((w - 2) * (h - 2))), photo: r2(photo / cells) };
}

/** measureVideo(file, times): one measurement per second in `times`, each from a single decoded frame. */
export function measureVideo(file, times) {
  return times.map((t) => {
    const r = spawnSync('ffmpeg', ['-v', 'error', '-ss', String(t), '-i', file, '-frames:v', '1',
      '-vf', `scale=${W}:${H}:flags=area`, '-pix_fmt', 'rgb24', '-f', 'rawvideo', '-'], { maxBuffer: W * H * 3 + 1024 });
    if (r.status !== 0 || !r.stdout || r.stdout.length < W * H * 3)
      throw new Error(`content: could not decode ${file} at ${t}s: ${String(r.stderr || '').trim() || 'no frame'}`);
    return { t, ...measureFrame(r.stdout) };
  });
}

/** measureSpan(file, t0, t1, n): the one way an ACT (a shot, a beat) gets ONE content reading. Samples n
 * frames evenly spaced strictly INSIDE (t0, t1), never at the edges (a beat's own boundary is a joint,
 * likely mid-cut or mid-crossfade, and neither reads as the act's content), and takes the median of each
 * field. study.mjs's `--content-only` and quality/gates/content-check.mjs both call this so a reference's
 * shots and a film's acts are measured exactly the same way. */
export function measureSpan(file, t0, t1, n = 4) {
  const len = t1 - t0;
  const times = Array.from({ length: n }, (_, k) => t0 + ((k + 1) / (n + 1)) * len);
  const measured = measureVideo(file, times);
  const median = (a) => [...a].sort((x, y) => x - y)[a.length >> 1];
  const pick = (k) => median(measured.map((m) => m[k]));
  const colorfulness = pick('colorfulness');
  return { colorfulness, band: bandOf(colorfulness), fill: pick('fill'), detail: pick('detail'), photo: pick('photo') };
}

function selftest() {
  const frame = (fn) => { const b = Buffer.alloc(W * H * 3); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) b.set(fn(x, y), (y * W + x) * 3); return b; };
  const grey = measureFrame(frame(() => [128, 128, 128]));
  if (grey.colorfulness !== 0 || grey.fill !== 0 || grey.photo !== 0) throw new Error(`flat grey should score 0, got ${JSON.stringify(grey)}`);
  const card = measureFrame(frame((x, y) => (x > 60 && x < 420 && y > 30 && y < 240 ? [220, 40, 60] : [236, 238, 240])));
  if (card.fill < 0.45 || card.colorfulness < 45) throw new Error(`an inset red block should fill about half and be colourful, got ${JSON.stringify(card)}`);
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const noise = measureFrame(frame(() => [rnd() * 255, rnd() * 255, rnd() * 255]));
  if (noise.photo < 0.9) throw new Error(`textured noise should read as photo cells, got ${JSON.stringify(noise)}`);
  const mock = measureFrame(frame((x, y) => (x > 60 && x < 420 && y > 40 && y < 230 ? [250, 250, 252] : [238, 242, 250])));
  if (mock.photo !== 0 || mock.colorfulness > 15) throw new Error(`a pale flat mock should be photo-free and not colourful, got ${JSON.stringify(mock)}`);
  const whiteRect = { x0: 60, x1: 420, y0: 30, y1: 240 };
  const trueArea = ((whiteRect.x1 - whiteRect.x0) * (whiteRect.y1 - whiteRect.y0)) / (W * H);
  const whiteCard = measureFrame(frame((x, y) => (x > whiteRect.x0 && x < whiteRect.x1 && y > whiteRect.y0 && y < whiteRect.y1 ? [250, 250, 250] : [238, 242, 250])));
  if (Math.abs(whiteCard.fill - trueArea) > 0.03)
    throw new Error(`a white card on a pale blue ground should fill near its true area ${trueArea.toFixed(2)}, got ${JSON.stringify(whiteCard)}`);

  const edgeRect = { x0: 280, x1: W, y0: 60, y1: 210 };
  const edgeArea = ((edgeRect.x1 - edgeRect.x0) * (edgeRect.y1 - edgeRect.y0)) / (W * H);
  const edgeCard = measureFrame(frame((x, y) => (x >= edgeRect.x0 && y > edgeRect.y0 && y < edgeRect.y1 ? [250, 250, 250] : [238, 242, 250])));
  if (Math.abs(edgeCard.fill - edgeArea) > 0.05)
    throw new Error(`a card running off the right edge should still fill near its true area ${edgeArea.toFixed(2)}, got ${JSON.stringify(edgeCard)}`);

  let fbSeed = 11; const fbRnd = () => (fbSeed = (fbSeed * 16807) % 2147483647) / 2147483647;
  const fullBleed = measureFrame(frame(() => [fbRnd() * 255, fbRnd() * 255, fbRnd() * 255]));
  if (fullBleed.fill < 0.9) throw new Error(`a full-bleed photo should fill near 1.0, got ${JSON.stringify(fullBleed)}`);

  const wash = measureFrame(frame((x) => { const t = x / W; return [230 - 30 * t, 235 - 30 * t, 245 - 30 * t]; }));
  if (wash.fill > 0.05) throw new Error(`a gentle wash with no subject should fill near 0, got ${JSON.stringify(wash)}`);

  console.log('ok - content: grey scores 0, an inset red block fills and is colourful, noise reads as photo, a pale mock is flat,');
  console.log('  a white-on-blue card fills its true area, a card running off the edge still does, a full-bleed photo fills ~1.0,');
  console.log('  a gentle wash fills ~0');
}

if (isMain(import.meta.url)) {
  const [a, ...rest] = process.argv.slice(2);
  if (a === '--selftest') selftest();
  else if (a) console.log(JSON.stringify(measureVideo(a, rest.length ? rest.map(Number) : [1]), null, 1));
  else { console.error('usage: node harness/media/content.mjs <video.mp4> [seconds...] | --selftest'); process.exit(2); }
}
