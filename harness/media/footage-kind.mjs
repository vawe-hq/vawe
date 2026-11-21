// Tells a screen recording (UI, text, flat colour) from camera footage, so its proxy can keep sharp colour edges.
import { spawnSync } from 'node:child_process';

const SAMPLES = 6;
const WIDTH = 640;
// Measured on synthetic clips (see tests/media/footage.test.mjs): a UI recording scores flat 0.97, still 0.99, edge 0.007+;
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
  const m = { flat: median(pairs.map((p) => p.flat)), edge: median(pairs.map((p) => p.edge)), still: median(pairs.map((p) => p.still)) };
  return { ...m, screen: m.flat >= SCREEN_LIMITS.flat && m.still >= SCREEN_LIMITS.still && m.edge >= SCREEN_LIMITS.edge };
}

function grayPair(file, at, width, height) {
  const r = spawnSync('ffmpeg', ['-v', 'error', '-ss', at.toFixed(3), '-i', file, '-frames:v', '2', '-vf', `scale=${width}:${height}:flags=bilinear,format=gray`, '-f', 'rawvideo', '-'], { maxBuffer: 1 << 26 });
  const size = width * height;
  return r.status === 0 && r.stdout.length >= size * 2 ? [r.stdout.subarray(0, size), r.stdout.subarray(size, size * 2)] : null;
}

/** Samples the clip and returns { flat, edge, still, screen }. `info` is the probe of the file: { width, height, seconds }. */
export function measureKind(file, info) {
  const width = WIDTH;
  const height = Math.max(2, Math.round((info.height * WIDTH) / info.width / 2) * 2);
  const pairs = [];
  for (let i = 0; i < SAMPLES; i++) {
    const pair = grayPair(file, (info.seconds * (i + 0.5)) / SAMPLES, width, height);
    if (pair) pairs.push(pairMetrics(pair[0], pair[1], width, height));
  }
  return pairs.length ? classify(pairs) : { flat: 0, edge: 0, still: 0, screen: false };
}
