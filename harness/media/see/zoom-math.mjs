// Pure parts of `vawe frame`: the box, the scale and the brightest text edge. No I/O: harness/cli/verbs.mjs loads this file to check the arguments.

export const ZOOM_SCALE = 3;
export const FRAME_W = 1920;
export const FRAME_H = 1080;
export const AUTO_BOX = { w: 240, h: 135 };
const CELL = 48;
const EDGE_STEP = 80;
const BRIGHT = 180;
const MAX_OUT_W = 4000;

/** { x, y, w, h } from "x,y,w,h" in 1920x1080 coordinates, or null when it is not four numbers inside the frame. */
export function parseBox(text) {
  const p = String(text ?? '').split(',').map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isFinite(n))) return null;
  const [x, y, w, h] = p.map(Math.round);
  if (x < 0 || y < 0 || w < 2 || h < 2 || x + w > FRAME_W || y + h > FRAME_H) return null;
  return { x, y, w, h };
}

export function zoomProblem({ at, box, auto, scale, vs, atB }) {
  if (at === undefined) return 'missing --at <s> (the moment to look at)';
  if (!(Number.isFinite(Number(at)) && Number(at) >= 0)) return `--at is not a number of seconds: "${at}"`;
  if (atB !== undefined && !(Number.isFinite(Number(atB)) && Number(atB) >= 0)) return `--at-b is not a number of seconds: "${atB}"`;
  if (atB !== undefined && !vs) return '--at-b needs --vs <b>';
  if (box && auto) return 'give --box or --auto, not both';
  if (!box && !auto) return 'missing --box x,y,w,h (1920x1080 pixels) or --auto';
  const b = box ? parseBox(box) : AUTO_BOX;
  if (!b) return `--box is not x,y,w,h inside 1920x1080: "${box}"`;
  if (!(Number.isInteger(scale) && scale >= 1 && scale <= 16)) return '--scale must be a whole number from 1 to 16';
  if (b.w * scale * (vs ? 2 : 1) > MAX_OUT_W) return `the picture would be wider than ${MAX_OUT_W} px: use a smaller --box or --scale`;
  return null;
}

/** Per-cell counts and coordinate sums of the edges brighter than `bright` in one luma plane. */
function edgeCells(luma, w, h, bright) {
  const cols = Math.ceil(w / CELL), rows = Math.ceil(h / CELL);
  const count = new Float64Array(cols * rows), sx = new Float64Array(cols * rows), sy = new Float64Array(cols * rows);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (luma[i] < bright) continue;
      if (Math.abs(luma[i + 1] - luma[i - 1]) < EDGE_STEP && Math.abs(luma[i + w] - luma[i - w]) < EDGE_STEP) continue;
      const c = Math.floor(y / CELL) * cols + Math.floor(x / CELL);
      count[c]++; sx[c] += x; sy[c] += y;
    }
  }
  return { cols, rows, count, sx, sy };
}

/** The 3x3 cell neighbourhood around cell `c`: { n, x, y } with the edge count and the mean edge position. */
function neighbourhood({ cols, rows, count, sx, sy }, c) {
  const cx = c % cols, cy = Math.floor(c / cols);
  let n = 0, x = 0, y = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      const k = ny * cols + nx;
      n += count[k]; x += sx[k]; y += sy[k];
    }
  }
  return { n, x: n ? x / n : 0, y: n ? y / n : 0 };
}

const boxAround = (p, w, h) => ({
  x: Math.min(w - AUTO_BOX.w, Math.max(0, Math.round(p.x - AUTO_BOX.w / 2))),
  y: Math.min(h - AUTO_BOX.h, Math.max(0, Math.round(p.y - AUTO_BOX.h / 2))),
  w: AUTO_BOX.w, h: AUTO_BOX.h,
});

/** The box (AUTO_BOX size) around the densest cluster of edges brighter than `bright` in a 1920x1080 luma plane, or null when there is none. */
export function autoBox(luma, w = FRAME_W, h = FRAME_H, bright = BRIGHT) {
  const cells = edgeCells(luma, w, h, bright);
  let best = null;
  for (let c = 0; c < cells.count.length; c++) {
    if (!cells.count[c]) continue;
    const s = neighbourhood(cells, c);
    if (!best || s.n > best.n) best = s;
  }
  return best && boxAround(best, w, h);
}

/**
 * One box with bright edges in both luma planes: the neighbourhood whose weaker plane has the most edges, centred on plane a's edges.
 * Null when the two planes share no such neighbourhood; the caller then takes autoBox of each plane.
 */
export function commonBox(lumaA, lumaB, w = FRAME_W, h = FRAME_H, bright = BRIGHT) {
  const a = edgeCells(lumaA, w, h, bright), b = edgeCells(lumaB, w, h, bright);
  let best = null;
  for (let c = 0; c < a.count.length; c++) {
    const sa = neighbourhood(a, c), sb = neighbourhood(b, c);
    const n = Math.min(sa.n, sb.n);
    if (n > 0 && (!best || n > best.n)) best = { n, x: sa.x, y: sa.y };
  }
  return best && boxAround(best, w, h);
}
