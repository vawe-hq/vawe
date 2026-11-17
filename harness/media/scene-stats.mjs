// node harness/media/scene-stats.mjs <film.mp4> [--json] [--series]
// Deterministic film statistics: world turns, static windows, motion events. Pure core, ffmpeg at the edge.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const SAMPLE_FPS = 10;
export const SAMPLE_W = 160;
export const T = {
  turnScore: 0.5,       // whole-frame distance (colour + layout) that makes a hard turn
  turnWindow: 5,        // samples: a jump must land within 0.5 s
  minWorld: 8,          // samples: turns closer than 0.8 s merge into the strongest
  pixelDelta: 10,       // luma steps (0..255) that count as a changed pixel
  staticFrac: 0.02,     // a 0.5 s window under this is static
  blockSize: 8,         // px of the square block a small move is read in
  blockChanged: 16,     // changed px in one block that count as a part moving (a line drawing, a cursor press, a counter) although under staticFrac of the frame
  minStatic: 3,         // samples: shortest static run (0.3 s)
  onsetFrac: 0.03,      // per-sample change that starts an event
  quietFrac: 0.012,     // per-sample change that counts as quiet
  quietSamples: 3,      // quiet stretch before an onset (0.3 s)
};

const clamp01 = (x) => Math.min(1, Math.max(0, x));

/** Feature of one RGB frame: 16-bin colour histogram (12 hue bins for coloured pixels, 4 lightness bins
 *  for grey ones) and an 8x4 grid of mean luma in 0..1. */
export function frameFeatures(rgb, w, h) {
  const hist = new Float64Array(16);
  const grid = new Float64Array(32);
  const cnt = new Float64Array(32);
  const luma = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const gy = Math.min(3, Math.floor((y * 4) / h));
    for (let x = 0; x < w; x++) {
      const p = (y * w + x) * 3;
      const r = rgb[p] / 255, g = rgb[p + 1] / 255, b = rgb[p + 2] / 255;
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
      const l = (mx + mn) / 2;
      const sat = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1) + 1e-9);
      let bin;
      if (sat < 0.2 || l < 0.08 || l > 0.94) {
        bin = Math.min(3, Math.floor(l * 4));
      } else {
        let hue = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
        if (hue < 0) hue += 6;
        bin = 4 + Math.min(11, Math.floor((hue / 6) * 12));
      }
      hist[bin] += 1;
      const yv = 0.299 * rgb[p] + 0.587 * rgb[p + 1] + 0.114 * rgb[p + 2];
      luma[y * w + x] = yv;
      const gi = gy * 8 + Math.min(7, Math.floor((x * 8) / w));
      grid[gi] += yv / 255; cnt[gi] += 1;
    }
  }
  const n = w * h;
  for (let i = 0; i < 16; i++) hist[i] /= n;
  for (let i = 0; i < 32; i++) grid[i] /= cnt[i] || 1;
  return { hist, grid, luma, w };
}

export function histDistance(a, b) {
  let s = 0;
  for (let i = 0; i < 16; i++) s += Math.abs(a.hist[i] - b.hist[i]);
  return s / 2;
}

export function layoutDistance(a, b) {
  let s = 0;
  for (let i = 0; i < 32; i++) s += Math.abs(a.grid[i] - b.grid[i]);
  return s / 32;
}

/** Fraction of pixels whose luma differs by more than `delta` between two frames. */
export function changedFraction(a, b, delta = T.pixelDelta) {
  let c = 0;
  for (let i = 0; i < a.luma.length; i++) if (Math.abs(a.luma[i] - b.luma[i]) > delta) c++;
  return c / a.luma.length;
}

// Colour shifts weigh double a layout shift: a new ground moves the histogram, an entrance only the grid.
export function worldDistance(a, b) {
  return clamp01(histDistance(a, b) * 1.5 + layoutDistance(a, b) * 1.0);
}

/** World turns: sample i is a turn when it differs from a sample up to `turnWindow` earlier by more than
 *  `turnScore`, and the frame before the jump was not already mid-jump. Nearby hits merge to the strongest. */
export function findTurns(feats, t = T) {
  const hits = [];
  for (let i = 1; i < feats.length; i++) {
    let best = 0;
    for (let k = 1; k <= t.turnWindow && i - k >= 0; k++) best = Math.max(best, worldDistance(feats[i - k], feats[i]));
    if (best > t.turnScore) hits.push({ i, score: best });
  }
  const turns = [];
  for (const h of hits) {
    const prev = turns[turns.length - 1];
    if (prev && h.i - prev.i < t.minWorld) { if (h.score > prev.score) { prev.i = h.i; prev.score = h.score; } continue; }
    turns.push({ ...h });
  }
  return turns.map((tr) => ({ t: tr.i / SAMPLE_FPS, score: +tr.score.toFixed(3) }));
}

export function perSampleChange(feats) {
  const out = [0];
  for (let i = 1; i < feats.length; i++) out.push(changedFraction(feats[i - 1], feats[i]));
  return out;
}

/** Change of each sample against the one `span` samples back (0.3 s): a small or slow move that stays under
 *  staticFrac between neighbours still adds up over half a second, and a viewer sees it move. */
export function windowChange(feats, span = STATIC_SPAN) {
  const out = [0];
  for (let i = 1; i < feats.length; i++) out.push(changedFraction(feats[Math.max(0, i - span)], feats[i]));
  return out;
}
const STATIC_SPAN = 3;

/** The most pixels that changed (by more than `delta`) inside one `size` px block between two frames: a small part moving, which few pixels of the whole frame show. */
export function blockChanged(a, b, size = T.blockSize, delta = T.pixelDelta) {
  const w = a.w, h = Math.floor(a.luma.length / w);
  let best = 0;
  for (let by = 0; by + size <= h; by += size) {
    for (let bx = 0; bx + size <= w; bx += size) best = Math.max(best, changedInBlock(a, b, bx, by, size, delta));
  }
  return best;
}

function changedInBlock(a, b, bx, by, size, delta) {
  let c = 0;
  for (let y = by; y < by + size; y++) {
    for (let x = bx; x < bx + size; x++) if (Math.abs(a.luma[y * a.w + x] - b.luma[y * a.w + x]) > delta) c++;
  }
  return c;
}

/** windowChange for one block: the changed pixels of the busiest block of each sample against the one `span` samples back. */
export function windowBlocks(feats, span = STATIC_SPAN) {
  const out = [0];
  for (let i = 1; i < feats.length; i++) out.push(blockChanged(feats[Math.max(0, i - span)], feats[i]));
  return out;
}

/** Static time: a sample interval is quiet when under `staticFrac` of pixels changed and no block (`blocks`, from windowBlocks) holds `blockChanged` changed pixels; a run counts from 0.3 s. */
export function staticRuns(change, t = T, blocks = null) {
  const runs = [];
  let start = null;
  const close = (end) => { if (start !== null && end - start >= t.minStatic) runs.push({ a: start / SAMPLE_FPS, b: end / SAMPLE_FPS, len: (end - start) / SAMPLE_FPS }); start = null; };
  for (let i = 1; i < change.length; i++) {
    if (change[i] < t.staticFrac && !(blocks && blocks[i] >= t.blockChanged)) { if (start === null) start = i - 1; } else close(i - 1);
  }
  close(change.length - 1);
  return runs.map((r) => ({ a: +r.a.toFixed(2), b: +r.b.toFixed(2), len: +r.len.toFixed(2) }));
}

/** Motion onsets: a per-sample change above onsetFrac after `quietSamples` samples below quietFrac. */
export function findEvents(change, t = T) {
  const ev = [];
  let quiet = t.quietSamples;
  for (let i = 1; i < change.length; i++) {
    if (change[i] >= t.onsetFrac && quiet >= t.quietSamples) { ev.push(+(i / SAMPLE_FPS).toFixed(2)); quiet = 0; }
    else if (change[i] < t.quietFrac) quiet++;
    else if (change[i] < t.onsetFrac) quiet = Math.max(0, quiet);
    else quiet = 0;
  }
  return ev;
}

export function summarize(feats, t = T) {
  const dur = feats.length / SAMPLE_FPS;
  const turns = findTurns(feats, t);
  const change = perSampleChange(feats);
  const runs = staticRuns(windowChange(feats), t, windowBlocks(feats));
  const events = findEvents(change, t);
  const worlds = turns.length + 1;
  return {
    duration: +dur.toFixed(2),
    worlds,
    turns,
    meanWorldLength: +(dur / worlds).toFixed(2),
    static: runs,
    staticTotal: +runs.reduce((s, r) => s + r.len, 0).toFixed(2),
    events: events.length,
    eventTimes: events,
    _change: change,
  };
}

export function format(s) {
  const lines = [`${s.worlds} worlds, ${s.events} events, static ${s.staticTotal} s`];
  lines.push(`world turns at ${s.turns.length ? s.turns.map((x) => x.t.toFixed(1)).join(', ') : 'none'} s; mean world ${s.meanWorldLength} s`);
  for (const r of s.static) lines.push(`static ${r.a}-${r.b} s (${r.len} s)`);
  return lines.join('\n');
}

export function probeSize(video) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', video], { encoding: 'utf8' });
  const [w, h] = r.stdout.trim().split(',').map(Number);
  if (!w || !h) throw new Error(`scene-stats: cannot read size of ${video}: ${r.stderr.trim()}`);
  return { w, h };
}

export function readFeatures(video) {
  const src = probeSize(video);
  const w = SAMPLE_W, h = Math.max(2, Math.round((src.h * w) / src.w / 2) * 2);
  const r = spawnSync('ffmpeg', ['-v', 'error', '-i', video, '-vf', `fps=${SAMPLE_FPS},scale=${w}:${h}:flags=area`, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'],
    { maxBuffer: 1 << 30 });
  if (r.status !== 0) throw new Error(`scene-stats: ffmpeg failed on ${video}: ${String(r.stderr).trim()}`);
  const size = w * h * 3, feats = [];
  for (let o = 0; o + size <= r.stdout.length; o += size) feats.push(frameFeatures(r.stdout.subarray(o, o + size), w, h));
  return feats;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const flags = args.filter((a) => a.startsWith('--'));
  const files = args.filter((a) => !a.startsWith('--'));
  const bad = flags.filter((f) => !['--json', '--series'].includes(f));
  if (bad.length || files.length !== 1) {
    console.error(`scene-stats: ${bad.length ? `unknown flag ${bad[0]}; ` : ''}usage: node harness/media/scene-stats.mjs <film.mp4> [--json] [--series]`);
    process.exit(2);
  }
  const feats = readFeatures(files[0]);
  const s = summarize(feats);
  if (flags.includes('--series')) {
    for (let i = 1; i < feats.length; i++)
      console.log(`${(i / SAMPLE_FPS).toFixed(1)} chg=${s._change[i].toFixed(3)} d1=${worldDistance(feats[i - 1], feats[i]).toFixed(3)} d5=${worldDistance(feats[Math.max(0, i - 5)], feats[i]).toFixed(3)}`);
  }
  const { _change, ...out } = s;
  console.log(flags.includes('--json') ? JSON.stringify(out, null, 2) : format(out));
}
