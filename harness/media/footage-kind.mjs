// Tells a screen recording (UI, text, flat colour) from camera footage, so its proxy can keep sharp colour edges.
import { spawnSync } from 'node:child_process';

const SAMPLES = 6;
const WIDTH = 640;
// Measured on synthetic clips (testsrc, perlin plus noise): a UI recording scores flat 0.97, still 0.99, edge 0.007+;
// noisy camera-like footage scores still 0.51 to 0.78.
export const SCREEN_LIMITS = { flat: 0.6, still: 0.85, edge: 0.001 };
const FLAT_STEP = 2;
const EDGE_STEP = 40;

/** Shares of one gray frame pair: flat (a pixel equals its right and lower neighbour), edge (a strong step to a neighbour), still (the pixel did not change in the next frame). Pure. */
export function pairMetrics(a, b, width, height) {
  let flat = 0, edge = 0, still = 0, n = 0;
  for (let y = 0; y < height - 1; y++) {
    for (let x = 0; x < width - 1; x++) {
      const i = y * width + x;
      const dx = Math.abs(a[i] - a[i + 1]);
      const dy = Math.abs(a[i] - a[i + width]);
      if (dx <= FLAT_STEP && dy <= FLAT_STEP) flat++;
      if (dx >= EDGE_STEP || dy >= EDGE_STEP) edge++;
      if (Math.abs(a[i] - b[i]) <= FLAT_STEP) still++;
      n++;
    }
  }
  return { flat: flat / n, edge: edge / n, still: still / n };
}

const median = (xs) => [...xs].sort((p, q) => p - q)[Math.floor(xs.length / 2)];

/** The median metrics over the sampled pairs, and whether they say a screen recording. Pure. */
export function classify(pairs) {
  const m = Object.fromEntries(['flat', 'edge', 'still'].map((k) => [k, median(pairs.map((p) => p[k]))]));
  return { ...m, screen: m.flat >= SCREEN_LIMITS.flat && m.still >= SCREEN_LIMITS.still && m.edge >= SCREEN_LIMITS.edge };
}

// A seek decodes from the keyframe before it (0.87 s against 0.34 s on a 1080p clip with 8 s between keyframes), so a sample starts on that keyframe when it is within one gap and no other sample took it.
function sampleTime(file, at, gap, taken) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-read_intervals', `${at.toFixed(3)}%+#1`, '-show_entries', 'packet=pts_time:stream=start_time', '-of', 'json', file], { encoding: 'utf8' });
  let key;
  try { const j = JSON.parse(r.stdout); key = Number(j.packets[0].pts_time) - (Number(j.streams[0].start_time) || 0); } catch { return at; }
  if (!(key <= at && at - key < gap) || taken.has(key)) return at;
  taken.add(key);
  return key;
}

function grayPair(file, at, width, height) {
  const r = spawnSync('ffmpeg', ['-v', 'error', '-ss', at.toFixed(6), '-i', file, '-an', '-frames:v', '2', '-vf', `scale=${width}:${height}:flags=bilinear,format=gray`, '-f', 'rawvideo', '-'], { maxBuffer: 1 << 26 });
  const size = width * height;
  if (r.status === 0 && r.stdout.length >= size * 2) return { pair: [r.stdout.subarray(0, size), r.stdout.subarray(size, size * 2)] };
  return { error: r.error?.message || String(r.stderr).trim() || `ffmpeg gave ${r.stdout.length} bytes at ${at.toFixed(3)} s` };
}

/** Samples the clip and returns { flat, edge, still, screen }. `info` is the probe of the file: { width, height, seconds }. */
export function measureKind(file, info) {
  const height = Math.max(2, Math.round((info.height * WIDTH) / info.width / 2) * 2);
  const gap = info.seconds / SAMPLES;
  const pairs = [], errors = [], taken = new Set();
  for (let i = 0; i < SAMPLES; i++) {
    const got = grayPair(file, sampleTime(file, gap * (i + 0.5), gap, taken), WIDTH, height);
    if (got.pair) pairs.push(pairMetrics(got.pair[0], got.pair[1], WIDTH, height));
    else errors.push(got.error);
  }
  if (errors.length) console.warn(`footage: ${file}: ${errors.length} of ${SAMPLES} samples failed (${errors[0]}); ${pairs.length ? 'judged on the rest' : 'kept as camera footage, 4:2:0'}`);
  return pairs.length ? classify(pairs) : { flat: 0, edge: 0, still: 0, screen: false };
}
