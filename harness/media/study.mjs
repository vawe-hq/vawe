import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { drawtext, ffmpegOrDie } from '../lib/scratch.mjs';
import { measureSpan } from './content.mjs';
import { clusterCuts, detectCuts, detectSeams, detectPans, detectCrossfades, frameSeries, mergeJoints, motionDeltaSeries } from './shot-detect.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const positional = argv.filter((a, i) => !a.startsWith('--') && !(argv[i - 1] || '').startsWith('--'));
const VIDEO = positional[0];
const THRESHOLD = Number(flag('--threshold', 0.3));
const MIN_SHOT = Number(flag('--min-shot', 0.4));   // two detections closer than this are one cut
const STRIPS = Number(flag('--strips', 0));         // how many of the busiest shots get a dense strip
const STRIP_FPS = Number(flag('--strip-fps', 8));   // samples per second inside a strip

const SEAM_THRESHOLD = Number(flag('--seam-threshold', 0.3));
const EDGE_LOW = Number(flag('--edge-low', 0.08));
const EDGE_HIGH = Number(flag('--edge-high', 0.2));
const SEAM_WINDOW = Number(flag('--seam-window', 0.25));  // seconds sampled each side of a seam, for flow direction

const PAN_FLOOR = Number(flag('--pan-floor', 6));         // delta this high, sustained, is not ordinary motion
const PAN_MIN_RUN = Number(flag('--pan-min-run', 0.4));   // seconds a run must hold to count
const CROSSFADE_LO = Number(flag('--crossfade-lo', 0.5)); // above STILL_FLOOR: something is actually changing
const CROSSFADE_HI = Number(flag('--crossfade-hi', 5));   // below PAN_FLOOR: not a whip
const CROSSFADE_MIN_RUN = Number(flag('--crossfade-min-run', 0.4));
const FLAT_RATIO = Number(flag('--flat-ratio', 1.6));     // run's peak/mean must sit under this to count as "flat", not a burst

const DUP_FLOOR = Number(flag('--dup-floor', 0.15));
const PAGE_COLS = Number(flag('--page-cols', 4));
const PAGE_ROWS = Number(flag('--page-rows', 5));
const FRAME_TOLERANCE = Number(flag('--frame-tolerance', 3));  // decoded-frame-count vs container, in frames

const die = (msg, code = 2) => { console.error(`✗ ${msg}`); process.exit(code); };

if (argv.includes('--selftest')) {
  const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) { console.error(`✗ ${m}: ${JSON.stringify(a)}`); process.exit(1); } };
  const run = [{ t: 3.0, score: 0.4 }, { t: 3.1, score: 0.9 }, { t: 3.2, score: 0.5 }, { t: 6.0, score: 0.7 }];
  eq(clusterCuts(run, 0.3, 0.4), [{ t: 3.1, score: 0.9 }, { t: 6.0, score: 0.7 }], 'a run collapses to its peak');
  eq(clusterCuts(run, 0.95, 0.4), [], 'nothing above the threshold is no cuts, not a guess');
  eq(clusterCuts([{ t: 0.1, score: 0.9 }], 0.3, 0.4), [], 'the first frames are never a cut');
  console.log('✓ study selftest: clusterCuts');

  const edge = [
    { t: 0.10, v: 5.0 }, { t: 0.12, v: 4.5 }, { t: 0.14, v: 3.0 },
    { t: 0.16, v: 0.00 }, { t: 0.18, v: 0.00 }, { t: 0.20, v: 0.10 },
    { t: 0.22, v: 2.0 }, { t: 0.24, v: 4.0 }, { t: 0.26, v: 5.0 },
  ];
  const seams = detectSeams(edge, 0.3, 1.0);
  eq(seams.length, 1, 'one gap in the middle is one seam');
  eq(seams[0].t0, 0.16, 'the outer run starts at the first below-threshold frame');
  eq(seams[0].t1, 0.20, 'the outer run ends at the last below-threshold frame');
  eq(seams[0].core0, 0.16, 'the core starts at the first truly-empty frame');
  eq(seams[0].core1, 0.18, 'the core ends at the last truly-empty frame, dropping the 0.10 tail');
  eq(Number(seams[0].t.toFixed(3)), 0.17, 'the reported joint is the core midpoint');
  eq(seams[0].frames.length, 2, 'the core carries only the frames at the run\'s own minimum');
  eq(detectSeams(edge, -1, 1.0), [], 'nothing under an impossible threshold is no seams, not a guess');
  eq(detectSeams([{ t: 0.02, v: 0 }, { t: 0.98, v: 0 }], 0.3, 1.0), [],
    'a run touching the film\'s own start or end is framing, not a joint');
  console.log('✓ study selftest: detectSeams');

  const panRun = [
    { t: 0.9, v: 1.0 }, { t: 1.00, v: 8.0 }, { t: 1.05, v: 8.3 }, { t: 1.10, v: 7.8 },
    { t: 1.15, v: 8.1 }, { t: 1.20, v: 8.0 }, { t: 1.25, v: 7.9 }, { t: 1.35, v: 8.1 }, { t: 1.55, v: 1.0 },
  ];
  eq(detectPans(panRun, 6, 0.3, 1.6).length, 1, 'a sustained flat run above the floor is one pan');
  eq(detectPans(panRun, 6, 0.9, 1.6).length, 0, 'a run shorter than the minimum is not a pan');
  eq(detectPans(panRun, 6, 0.3, 1.02).length, 0, 'a run whose peak beats its mean by more than flat-ratio is not flat, so not a pan');
  console.log('✓ study selftest: detectPans');

  const cfRun = [
    { t: 0.9, v: 0.1 }, { t: 1.0, v: 1.2 }, { t: 1.1, v: 1.3 }, { t: 1.2, v: 1.25 },
    { t: 1.3, v: 1.28 }, { t: 1.4, v: 1.22 }, { t: 1.5, v: 1.24 }, { t: 1.6, v: 0.1 },
  ];
  eq(detectCrossfades(cfRun, 0.5, 5, 0.3, 1.6).length, 1, 'a held mid-band flat run is one crossfade');
  eq(detectCrossfades(cfRun, 0.5, 5, 0.8, 1.6).length, 0, 'shorter than the minimum is not a crossfade');
  eq(detectCrossfades(panRun, 0.5, 5, 0.3, 1.6).length, 0, 'a run above the crossfade ceiling is not a crossfade (it is a pan)');
  console.log('✓ study selftest: detectCrossfades');
  process.exit(0);
}

if (!VIDEO) die('usage: node harness/media/study.mjs <video> [name] [--threshold 0.3]');
if (!fs.existsSync(VIDEO)) die(`no such file: ${VIDEO}`);
// A missing tool is not a clean result. seam-snap reported one for months, so this
// refuses at the entry point and names the binary rather than producing an empty study.
for (const bin of ['ffprobe', 'ffmpeg']) {
  if (spawnSync(bin, ['-version'], { encoding: 'utf8' }).error) {
    die(`${bin} is not on PATH. \`make study\` reads the file with ffmpeg; install it (brew install ffmpeg) and re-run.`);
  }
}

if (argv.includes('--content-only')) {
  const name = positional[1] || path.basename(VIDEO).replace(/\.[^.]+$/, '');
  const grammarFile = path.join(ROOT, 'grammar', `${name}.json`);
  if (!fs.existsSync(grammarFile)) die(`no grammar/${name}.json to add content to. Run a full \`make study\` first.`);
  const grammar = JSON.parse(fs.readFileSync(grammarFile, 'utf8'));
  for (const s of grammar.shots || []) s.content = measureSpan(VIDEO, s.t0, s.t0 + s.len);
  fs.writeFileSync(grammarFile, JSON.stringify(grammar, null, 1) + '\n');
  console.log(`✓ content added to ${(grammar.shots || []).length} shot(s) in grammar/${name}.json`);
  process.exit(0);
}

const probe = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries',
  'stream=width,height,r_frame_rate,avg_frame_rate,nb_frames', '-show_entries', 'format=duration',
  '-of', 'default=noprint_wrappers=1', VIDEO], { encoding: 'utf8' });
const fields = Object.fromEntries(String(probe.stdout).trim().split('\n').filter(Boolean)
  .map((l) => l.split('=')).map(([k, v]) => [k, v]));
const width = +fields.width, height = +fields.height;
const duration = +fields.duration;
const rate = (v) => { const m = /^(\d+)(?:\/(\d+))?$/.exec(String(v || '')); return m ? +m[1] / (m[2] ? +m[2] : 1) : 0; };
const rFps = rate(fields.r_frame_rate), aFps = rate(fields.avg_frame_rate);
const fps = aFps > 0 ? aFps : rFps;
// Entry-point validation: anything without a real video stream stops here, named. A text file handed
// to the sampler further down produces a stack trace from ffmpeg, which reads as a tool bug.
if (!width || !height || !(duration > 0)) {
  die(`${VIDEO} has no readable video stream (ffprobe found width=${fields.width ?? '?'} height=${fields.height ?? '?'} duration=${fields.duration ?? '?'}). Is it a video?`);
}
const hasAudio = !!String(spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'a:0',
  '-show_entries', 'stream=codec_name', '-of', 'default=nw=1:nk=1', VIDEO], { encoding: 'utf8' }).stdout).trim();

const nbFrames = Number(fields.nb_frames) || 0;
const byDuration = nbFrames > 2 ? duration * ((nbFrames - 2) / nbFrames) : Infinity;
const byRate = nbFrames > 2 && fps > 0 ? (nbFrames - 2) / fps : Infinity;
const LAST_FRAME = Number.isFinite(Math.min(byDuration, byRate))
  ? Math.min(byDuration, byRate)
  : duration - 3 / (fps || 30);
const seekable = (t) => Math.max(0, Math.min(t, LAST_FRAME));

const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex').slice(0, 16);
const VIDEO_HASH = sha(path.resolve(VIDEO));

const NAME = positional[1] || path.basename(VIDEO).replace(/\.[^.]+$/, '');
const dir = path.join(ROOT, 'refs', NAME);
const videoAbs = path.resolve(VIDEO);
if (videoAbs.startsWith(dir + path.sep)) {
  die(`the video lives inside refs/${NAME}/, which is exactly where this study WRITES, and the write
`
    + `  clears that directory first. Studying it would delete the source.
`
    + `  Move the clip out (refs/_clips/ is a good home) or study it under a different NAME.`);
}
const pagesFile = path.join(dir, 'pages.md');
if (!argv.includes('--force') && fs.existsSync(pagesFile) && !fs.readFileSync(pagesFile, 'utf8').includes('<fill')) {
  die(`refs/${NAME}/pages.md is filled in, and this study clears refs/${NAME}/ first. Add --force to replace it, or study under a different NAME.`);
}

const LUMA = frameSeries(VIDEO, 'scale=160:90,signalstats');
const DELTA = motionDeltaSeries(VIDEO);
const EDGE = frameSeries(VIDEO, `scale=410:270,edgedetect=low=${EDGE_LOW}:high=${EDGE_HIGH},signalstats`);

function borderSeries() {
  const CROPS = {
    top: 'crop=iw:ih*0.12:0:0', bottom: 'crop=iw:ih*0.12:0:ih-ih*0.12',
    left: 'crop=iw*0.12:ih:0:0', right: 'crop=iw*0.12:ih:iw-iw*0.12:0',
  };
  const series = Object.fromEntries(Object.entries(CROPS).map(([k, c]) => [k, frameSeries(VIDEO, `${c},scale=80:80,signalstats`)]));
  return LUMA.map((f, i) => {
    const vs = Object.values(series).map((s) => s[i]?.v).filter((v) => typeof v === 'number');
    return { t: f.t, v: vs.length ? vs.reduce((a, b) => a + b, 0) / vs.length : f.v };
  });
}
const GROUND = borderSeries();

const DECODED_FRAMES = LUMA.length;
const EXPECTED_FRAMES = nbFrames > 0 ? nbFrames : Math.round(duration * fps);
if (Math.abs(DECODED_FRAMES - EXPECTED_FRAMES) > FRAME_TOLERANCE) {
  die(`decoded ${DECODED_FRAMES} frames but the container states ${EXPECTED_FRAMES} `
    + `(nb_frames=${nbFrames || 'unset'}, duration*fps=${(duration * fps).toFixed(1)}). `
    + `That is more than the ${FRAME_TOLERANCE}-frame margin already known for audio-padding and `
    + `VFR containers (see LAST_FRAME above), so this refuses rather than measure a film it cannot `
    + `account for. Check with: ffprobe -select_streams v:0 -show_frames ${VIDEO} | grep -c pts_time`);
}

const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const between = (series, t0, t1) => series.filter((x) => x.t >= t0 && x.t < t1).map((x) => x.v);

const CUT_GUARD = 2;   // difference frames to drop at a shot's head. Two, because a cut can smear one.
const insideShot = (t0, t1, isFirst) => {
  const xs = DELTA.filter((x) => x.t >= t0 && x.t < t1);
  return (isFirst ? xs : xs.slice(CUT_GUARD)).map((x) => x.v);
};
const jointSize = (t0, isFirst) => {
  if (isFirst) return null;
  const head = DELTA.filter((x) => x.t >= t0).slice(0, CUT_GUARD).map((x) => x.v);
  return head.length ? Number(Math.max(...head).toFixed(1)) : null;
};

const SAMPLE_FPS = 3;             // enough for a shot's mean LUMA: a shot is a held idea.
const STILL_FLOOR = 0.5;          // the same floor internal/scene/scene.go uses. One owner, two readers.


const statOf = (t0, len, chain) => {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-ss', t0.toFixed(3), '-t', Math.max(0.2, len).toFixed(3),
    '-i', VIDEO, '-vf', `${chain},metadata=mode=print:key=lavfi.signalstats.YAVG`, '-f', 'null', '-'],
    { encoding: 'utf8', maxBuffer: 1 << 24 });
  const vals = [...String(r.stderr).matchAll(/lavfi\.signalstats\.YAVG=([\d.]+)/g)].map((m) => Number(m[1]));
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
};

const toneOf = (t0, len) => {
  const r = spawnSync('ffmpeg', ['-v', 'error', '-ss', t0.toFixed(3), '-t', Math.max(0.2, len).toFixed(3),
    '-i', VIDEO, '-vf', `fps=1,scale=8:8`, '-pix_fmt', 'rgb24', '-f', 'rawvideo', '-'],
    { encoding: 'buffer', maxBuffer: 1 << 24 });
  const buf = r.stdout;
  if (!buf || buf.length < 3) return null;
  let best = null;
  for (let i = 0; i + 2 < buf.length; i += 3) {
    const [R, G, B] = [buf[i], buf[i + 1], buf[i + 2]];
    const mx = Math.max(R, G, B), mn = Math.min(R, G, B);
    const sat = mx === 0 ? 0 : ((mx - mn) / mx) * (mx / 255);
    if (!best || sat > best.sat) best = { sat, hex: `#${[R, G, B].map((c) => c.toString(16).padStart(2, '0')).join('')}` };
  }
  return best;
};

function edgeCentroid(t0, len) {
  const W = 160, H = 90;
  const r = spawnSync('ffmpeg', ['-v', 'error', '-ss', Math.max(0, t0).toFixed(3), '-t', Math.max(0.02, len).toFixed(3),
    '-i', VIDEO, '-vf', `edgedetect=low=${EDGE_LOW}:high=${EDGE_HIGH},scale=${W}:${H},format=gray`,
    '-pix_fmt', 'gray', '-f', 'rawvideo', '-'], { encoding: 'buffer', maxBuffer: 1 << 26 });
  const buf = r.stdout;
  const frame = W * H;
  if (!buf || buf.length < frame) return null;
  const n = Math.floor(buf.length / frame);
  let sumW = 0, sumX = 0, sumY = 0;
  for (let f = 0; f < n; f++) {
    const base = f * frame;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const v = buf[base + y * W + x];
      if (v > 32) { sumW += v; sumX += v * x; sumY += v * y; }
    }
  }
  if (!sumW) return null;
  return { cx: sumX / sumW / W, cy: sumY / sumW / H };
}

function meanColorOf(t0, len) {
  const r = spawnSync('ffmpeg', ['-v', 'error', '-ss', Math.max(0, t0).toFixed(3), '-t', Math.max(0.02, len).toFixed(3),
    '-i', VIDEO, '-vf', 'scale=8:8', '-pix_fmt', 'rgb24', '-f', 'rawvideo', '-'],
    { encoding: 'buffer', maxBuffer: 1 << 24 });
  const buf = r.stdout;
  if (!buf || buf.length < 3) return null;
  let R = 0, G = 0, B = 0, n = 0;
  for (let i = 0; i + 2 < buf.length; i += 3) { R += buf[i]; G += buf[i + 1]; B += buf[i + 2]; n++; }
  if (!n) return null;
  const hex = (v) => Math.round(v / n).toString(16).padStart(2, '0');
  return `#${hex(R)}${hex(G)}${hex(B)}`;
}

function groundColorOf(t0, len) {
  const CROPS = ['crop=iw:ih*0.12:0:0', 'crop=iw:ih*0.12:0:ih-ih*0.12', 'crop=iw*0.12:ih:0:0', 'crop=iw*0.12:ih:iw-iw*0.12:0'];
  let R = 0, G = 0, B = 0, n = 0;
  for (const crop of CROPS) {
    const r = spawnSync('ffmpeg', ['-v', 'error', '-ss', Math.max(0, t0).toFixed(3), '-t', Math.max(0.2, len).toFixed(3),
      '-i', VIDEO, '-vf', `${crop},scale=8:8`, '-pix_fmt', 'rgb24', '-f', 'rawvideo', '-'],
      { encoding: 'buffer', maxBuffer: 1 << 24 });
    const buf = r.stdout;
    if (!buf || buf.length < 3) continue;
    for (let i = 0; i + 2 < buf.length; i += 3) { R += buf[i]; G += buf[i + 1]; B += buf[i + 2]; n++; }
  }
  if (!n) return null;
  const hex = (v) => Math.round(v / n).toString(16).padStart(2, '0');
  return `#${hex(R)}${hex(G)}${hex(B)}`;
}

function measureSeam(run) {
  // The CORE (run.core0..run.core1), not the outer threshold run: that is the actual empty-ground span,
  // see detectSeams above. Windows for flow/colour are measured off it, not off the wider penumbra.
  const gap = Number((run.core1 - run.core0 + 1 / fps).toFixed(3));
  const preT = Math.max(0, run.core0 - SEAM_WINDOW);
  const postT = run.core1 + 1 / fps;
  const pre = edgeCentroid(preT, run.core0 - preT);
  const postLen = Math.min(SEAM_WINDOW, Math.max(0.02, LAST_FRAME - postT));
  const post = edgeCentroid(postT, postLen);
  let axis = null, direction = null;
  if (pre && post) {
    const dx = post.cx - pre.cx, dy = post.cy - pre.cy;
    axis = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y';
    direction = axis === 'x' ? (dx >= 0 ? 'right-to-left' : 'left-to-right') : (dy >= 0 ? 'bottom-to-top' : 'top-to-bottom');
  }
  return {
    t: Number(run.t.toFixed(2)), gap, frames: run.frames.length,
    axis, direction,
    groundBefore: meanColorOf(preT, run.core0 - preT),
    groundAfter: meanColorOf(postT, postLen),
  };
}

const GROUND_EDGES = [[60, 'dark', 'mid'], [128, 'mid', 'light']];
const GROUND_DOUBT = 4;
const bucket = (luma) => {
  const name = luma > 128 ? 'light' : luma > 60 ? 'mid' : 'dark';
  return GROUND_EDGES.some(([e]) => Math.abs(luma - e) < GROUND_DOUBT) ? `${name}?` : name;
};

const measureShot = (s) => {
  const luma = mean(between(LUMA, s.t0, s.t1));
  const groundLuma = mean(between(GROUND, s.t0, s.t1));
  const deltas = insideShot(s.t0, s.t1, s.i === 1);
  const delta = mean(deltas);
  const joint = jointSize(s.t0, s.i === 1);
  const tone = toneOf(s.t0, s.len);
  const groundHex = groundColorOf(s.t0, s.len);
  const peak = deltas.length ? Math.max(...deltas) : null;
  const held = deltas.length ? deltas.filter((d) => d < STILL_FLOOR).length / deltas.length : null;
  const BUCKETS = Math.max(1, Math.round(s.len * 4));
  const guarded = DELTA.filter((x) => x.t >= s.t0 && x.t < s.t1);
  const body = s.i === 1 ? guarded : guarded.slice(CUT_GUARD);
  const curve = Array.from({ length: BUCKETS }, (_, b) => {
    const lo = s.t0 + (b / BUCKETS) * s.len, hi = s.t0 + ((b + 1) / BUCKETS) * s.len;
    const win = body.filter((x) => x.t >= lo && x.t < hi).map((x) => x.v);
    return win.length ? Number(Math.max(...win).toFixed(1)) : 0;
  });
  return {
    luma: luma == null ? null : Number(luma.toFixed(1)),
    groundLuma: groundLuma == null ? null : Number(groundLuma.toFixed(1)),
    ground: groundLuma == null ? null : bucket(groundLuma),
    groundHex,
    motion: delta == null ? null : Number(delta.toFixed(2)),
    peak: peak == null ? null : Number(peak.toFixed(2)),
    joint,
    held: held == null ? null : Number(held.toFixed(2)),
    frames: deltas.length,
    curve,
    alive: delta == null ? null : delta >= STILL_FLOOR,
    accent: tone && tone.sat > 0.12 ? tone.hex : null,
    saturation: tone ? Number(tone.sat.toFixed(3)) : null,
  };
};

fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(dir, { recursive: true });
const { peak, near, cuts } = detectCuts(VIDEO, dir, THRESHOLD, MIN_SHOT);
const cutsDetected = cuts.length > 0;
const seams = detectSeams(EDGE, SEAM_THRESHOLD, duration).map(measureSeam);
const pans = detectPans(DELTA, PAN_FLOOR, PAN_MIN_RUN, FLAT_RATIO);
const crossfades = detectCrossfades(DELTA, CROSSFADE_LO, CROSSFADE_HI, CROSSFADE_MIN_RUN, FLAT_RATIO);

const { joints, conflicts } = mergeJoints([
  { kind: 'cut', items: cuts },
  { kind: 'seam', items: seams },
  { kind: 'pan', items: pans },
  { kind: 'crossfade', items: crossfades },
], MIN_SHOT);
const detected = joints.length > 0;
// NO SILENT FALLBACK. A film with no detected joint is ONE SHOT, stated as such, never an invented
// equal-slice sample dressed up as a cut list (the deleted behaviour, removed by an OWNER note). The reason is printed in `note` below and in study.md/the console report.
const bounds = detected ? [0, ...joints.map((j) => j.t)] : [0];
const shots = bounds.map((t0, i) => {
  const j = i === 0 ? null : joints[i - 1];
  return {
    i: i + 1, t0, t1: i + 1 < bounds.length ? bounds[i + 1] : duration,
    score: j && j.kind === 'cut' ? j.evidence.score : null,
    jointKind: j ? j.kind : null,
  };
}).filter((s) => s.t1 - s.t0 > 0.05).map((s) => ({ ...s, len: s.t1 - s.t0 }));

// Measured once, here, so study.json, the sheet and the table all read the same numbers rather than
// each asking ffmpeg its own question. One fact, one owner: the failure this repo logs most often.
for (const s of shots) Object.assign(s, measureShot(s));

const lens = shots.map((s) => s.len).sort((a, b) => a - b);
const median = lens.length % 2 ? lens[(lens.length - 1) / 2] : (lens[lens.length / 2 - 1] + lens[lens.length / 2]) / 2;

const CELLS = Number(flag('--cells', 4));       // frames per shot row, including the in and out frames

function eventFrames(s, n) {
  const inT = Math.min(s.t0 + 0.08, s.t1 - 0.01);
  const outT = Math.max(Math.min(s.t1 - 0.08, LAST_FRAME), s.t0);
  const want = Math.max(0, n - 2);
  if (want === 0) return [inT, outT];
  const sep = Math.max(0.25, s.len / (n + 1));
  const inner = DELTA.filter((x) => x.t > inT + sep * 0.5 && x.t < outT - sep * 0.5)
    .sort((a, b) => b.v - a.v);
  const picked = [];
  for (const cand of inner) {
    if (picked.length >= want) break;
    if (picked.every((p) => Math.abs(p - cand.t) >= sep)) picked.push(cand.t);
  }
  return [inT, ...picked.sort((a, b) => a - b), outT];
}

function stackImages(files, out, axis, padW, padH, what) {
  if (files.length === 1) {
    const pad = padW && padH ? `,pad=${padW}:${padH}:0:0:black` : '';
    ffmpegOrDie(['-v', 'error', '-y', '-i', files[0], '-vf', `null${pad}`, '-frames:v', '1', out], out, what);
    return;
  }
  const stack = axis === 'h' ? `hstack=inputs=${files.length}` : `vstack=inputs=${files.length}`;
  const pad = padW && padH ? `,pad=${padW}:${padH}:0:0:black` : '';
  ffmpegOrDie(['-v', 'error', '-y', ...files.flatMap((c) => ['-i', c]),
    '-filter_complex', `${stack}${pad}`, '-frames:v', '1', out], out, what);
}

// ── contact sheet: one row per shot, frames chosen by EVENT (see above), not by position ─────────
// Same shape as make dev-tool X=beats, and for the same reason: the middle of a shot is the frame that hides the
// entrance, which is exactly what a study is looking for (guides/REFERENCE-STUDY.md).
const frames = path.join(dir, 'frames');
fs.mkdirSync(frames, { recursive: true });
const tileW = 300, tileH = Math.round((tileW * height) / width);
const rows = [];
for (const s of shots) {
  const ts = eventFrames(s, CELLS).map((t) => seekable(Math.max(s.t0, Math.min(s.t1 - 0.01, t))));
  const cells = ts.map((t, k) => {
    const d = DELTA.reduce((best, x) => (Math.abs(x.t - t) < Math.abs(best.t - t) ? x : best), DELTA[0] || { t: 0, v: 0 });
    const tag = k === 0 ? 'in' : k === ts.length - 1 ? 'out' : `peak ${d.v.toFixed(1)}`;
    const out = path.join(frames, `s${String(s.i).padStart(2, '0')}_${tag}.png`);
    ffmpegOrDie(['-v', 'error', '-y', '-ss', t.toFixed(3), '-i', VIDEO, '-frames:v', '1', '-vf',
      `scale=${tileW}:${tileH},drawtext=text='${drawtext(`${s.i}.${tag} ${t.toFixed(2)}s`)}':x=8:y=8:fontsize=20:fontcolor=white:box=1:boxcolor=black@0.65`,
      out], out, `shot ${s.i} ${tag}`);
    return out;
  });
  const row = path.join(frames, `row_${String(s.i).padStart(2, '0')}.png`);
  stackImages(cells, row, 'h', tileW * CELLS, tileH, `row ${s.i}`);
  rows.push(row);
}
const sheet = path.join(dir, 'sheet.png');
stackImages(rows, sheet, 'v', null, null, 'contact sheet');

if (STRIPS > 0) {
  const busiest = [...shots].sort((a, b) => (b.motion || 0) - (a.motion || 0)).slice(0, STRIPS);
  for (const s2 of busiest) {
    const n = Math.max(2, Math.min(48, Math.round(s2.len * STRIP_FPS)));
    const cols = Math.min(8, n);
    const cellW = 240, cellH = Math.round((cellW * height) / width);
    const out = path.join(dir, `strip${String(s2.i).padStart(2, '0')}.png`);
    ffmpegOrDie(['-v', 'error', '-y', '-ss', s2.t0.toFixed(3), '-t', Math.max(0.05, s2.len).toFixed(3),
      '-i', VIDEO, '-vf', `fps=${STRIP_FPS},scale=${cellW}:${cellH},tile=${cols}x${Math.ceil(n / cols)}`,
      '-frames:v', '1', out], out, `strip ${s2.i}`);
    console.log(`  strip ${s2.i}: ${s2.len.toFixed(2)}s at ${STRIP_FPS}fps -> ${n} frames -> ${path.relative(ROOT, out)}`);
  }
}

const fx = (n, d = 2) => Number(n.toFixed(d));
const isUniqueFrame = (i) => i === 0 || !DELTA[i - 1] || DELTA[i - 1].v > DUP_FLOOR;
const uniqueFrames = LUMA.map((f, i) => ({ i, t: f.t })).filter((f) => isUniqueFrame(f.i));

const PAGE_CELLS = PAGE_COLS * PAGE_ROWS;
const pagesDir = path.join(dir, 'pages');
fs.mkdirSync(pagesDir, { recursive: true });
const pageCellW = 480, pageCellH = Math.round((pageCellW * height) / width);
const pagesMeta = [];
for (let p = 0; p * PAGE_CELLS < uniqueFrames.length; p++) {
  const chunk = uniqueFrames.slice(p * PAGE_CELLS, (p + 1) * PAGE_CELLS);
  const cellFiles = chunk.map((fr, k) => {
    const t = seekable(fr.t);
    const out = path.join(pagesDir, `.cell_${p}_${k}.png`);
    ffmpegOrDie(['-v', 'error', '-y', '-ss', t.toFixed(3), '-i', VIDEO, '-frames:v', '1', '-vf',
      `scale=${pageCellW}:${pageCellH},drawtext=text='${drawtext(`f${fr.i} ${t.toFixed(2)}s`)}':x=8:y=8:fontsize=22:fontcolor=white:box=1:boxcolor=black@0.65`,
      out], out, `page ${p + 1} cell ${k}`);
    return out;
  });
  const rowFiles = [];
  for (let r = 0; r * PAGE_COLS < cellFiles.length; r++) {
    const rowCells = cellFiles.slice(r * PAGE_COLS, (r + 1) * PAGE_COLS);
    const rowOut = path.join(pagesDir, `.row_${p}_${r}.png`);
    stackImages(rowCells, rowOut, 'h', pageCellW * PAGE_COLS, pageCellH, `page ${p + 1} row ${r}`);
    rowFiles.push(rowOut);
  }
  const pageOut = path.join(pagesDir, `page-${String(p + 1).padStart(3, '0')}.png`);
  stackImages(rowFiles, pageOut, 'v', null, null, `page ${p + 1}`);
  for (const f of [...cellFiles, ...rowFiles]) fs.rmSync(f, { force: true });
  pagesMeta.push({
    page: p + 1, file: path.relative(ROOT, pageOut), t0: fx(chunk[0].t), t1: fx(chunk[chunk.length - 1].t),
    cells: chunk.map((fr, k) => ({ cell: k, frame: fr.i, t: fx(fr.t) })),
  });
}

const uniqueLoc = {};
for (const pg of pagesMeta) for (const c of pg.cells) uniqueLoc[c.frame] = { page: pg.page, cell: c.cell };
const heldFrames = [];
let lastUnique = 0;
for (let i = 0; i < LUMA.length; i++) {
  if (isUniqueFrame(i)) { lastUnique = i; continue; }
  heldFrames.push({ frame: i, t: fx(LUMA[i].t), representative: lastUnique, ...uniqueLoc[lastUnique] });
}
fs.writeFileSync(path.join(dir, 'pages.json'), JSON.stringify({
  name: NAME, totalFrames: DECODED_FRAMES, uniqueFrames: uniqueFrames.length,
  pages: pagesMeta, held: heldFrames,
}, null, 1) + '\n');

fs.writeFileSync(path.join(dir, 'pages.md'),
  `# Pages · ${NAME}\n\n`
  + `One line per page. The study is INCOMPLETE until every line says what happens on that page, not\n`
  + `\`<fill\`. \`vawe check study-check NAME=${NAME}\` names exactly which pages are still unfilled.\n\n`
  + pagesMeta.map((pg) => `page ${String(pg.page).padStart(3, '0')} (${pg.t0}-${pg.t1}s): <fill: what happens on this page>`).join('\n')
  + '\n');

const deltaValues = DELTA.map((f) => f.v);
const sortedDeltaValues = [...deltaValues].sort((a, b) => a - b);
const medianFrameDelta = sortedDeltaValues.length
  ? fx(sortedDeltaValues.length % 2 ? sortedDeltaValues[(sortedDeltaValues.length - 1) / 2]
      : (sortedDeltaValues[sortedDeltaValues.length / 2 - 1] + sortedDeltaValues[sortedDeltaValues.length / 2]) / 2, 3)
  : null;
let longestHoldFrames = 0, runFrames = 0;
for (const f of DELTA) {
  if (f.v < STILL_FLOOR) { runFrames++; if (runFrames > longestHoldFrames) longestHoldFrames = runFrames; }
  else runFrames = 0;
}
const longestHoldS = DELTA.length ? fx(longestHoldFrames / fps, 2) : null;

// ── the study ─────────────────────────────────────────────────────────────────────────────────────
const study = {
  source: (() => { const r = path.relative(ROOT, path.resolve(VIDEO)); return r.startsWith('..') ? path.resolve(VIDEO) : r; })(),
  name: NAME,
  measured: {
    duration: fx(duration), width, height, fps: fx(fps, 3),
    aspect: `${width}:${height}`, hasAudio,
    shotDetection: [...new Set(joints.map((j) => j.kind))].join('+') || 'none',
    threshold: THRESHOLD, peakSceneScore: fx(peak, 3), nearMisses: near,
    seamThreshold: SEAM_THRESHOLD, seamsFound: seams.length,
    panFloor: PAN_FLOOR, pansFound: pans.length,
    crossfadeBand: [CROSSFADE_LO, CROSSFADE_HI], crossfadesFound: crossfades.length,
    shots: shots.length, medianShot: fx(median), cutsPerMinute: fx((shots.length / duration) * 60, 1),
    medianFrameDelta, longestHoldS,
  },
  coverage: { frames: DECODED_FRAMES, unique: uniqueFrames.length, pages: pagesMeta.length, ledger: 'incomplete' },
  shots: shots.map((s) => ({ i: s.i, t0: fx(s.t0), t1: fx(s.t1), len: fx(s.len),
    score: s.score == null ? null : fx(s.score, 3), jointKind: s.jointKind,
    luma: s.luma, ground: s.ground, groundLuma: s.groundLuma, groundHex: s.groundHex,
    motion: s.motion, alive: s.alive, accent: s.accent, saturation: s.saturation })),
  seams, pans, crossfades, conflicts,
};
fs.writeFileSync(path.join(dir, 'study.json'), JSON.stringify(study, null, 2) + '\n');

const GRAMMAR_DIR = path.join(ROOT, 'grammar');

function writeGrammar(study, shots) {
  fs.mkdirSync(GRAMMAR_DIR, { recursive: true });
  for (const f of fs.readdirSync(GRAMMAR_DIR).filter((x) => x.endsWith('.json') && x !== `${NAME}.json`)) {
    let other = null; try { other = JSON.parse(fs.readFileSync(path.join(GRAMMAR_DIR, f), 'utf8')); } catch { continue; }
    if (other && other.hash === VIDEO_HASH)
      console.log(`  ⚠ THE SAME FILM is already in the store as "${other.name}" (identical bytes).\n`
        + `    Two rows for one film double it in every comparison. Keep the better NAME and delete the other.`);
  }
  const file = path.join(GRAMMAR_DIR, `${NAME}.json`);
  let prior = null;
  try { prior = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { /* first study of this film */ }
  const priorShot = (i) => (prior && prior.shots || []).find((x) => x.i === i) || {};

  const out = {
    name: NAME,
    source: path.basename(study.source),
    hash: VIDEO_HASH,
    measured: study.measured,
    coverage: study.coverage,
    shots: shots.map((s) => ({
      i: s.i, t0: Number(s.t0.toFixed(2)), len: Number(s.len.toFixed(2)),
      ground: s.ground, groundLuma: s.groundLuma, groundHex: s.groundHex, luma: s.luma, accent: s.accent,
      motion: s.motion, peak: s.peak, held: s.held, frames: s.frames, joint: s.joint,
      jointKind: s.jointKind, curve: s.curve,
      onScreen: priorShot(s.i).onScreen ?? null,
      moves: priorShot(s.i).moves ?? null,
      trigger: priorShot(s.i).trigger ?? null,
    })),
    pace: { medianShot: study.measured.medianShot, perMinute: study.measured.cutsPerMinute },
    groundPattern: shots.map((s) => s.ground || '?').join(' → '),
    motionBand: (() => {
      const ms = shots.map((s) => s.motion).filter((m) => typeof m === 'number');
      return ms.length ? { lo: Math.min(...ms), hi: Math.max(...ms) } : null;
    })(),
    seams: study.seams,
    pans: study.pans, crossfades: study.crossfades, conflicts: study.conflicts,
    threads: (prior && prior.threads) ?? null,
    spectacle: (prior && prior.spectacle) ?? null,
    takeaway: (prior && prior.takeaway) ?? null,
  };
  fs.writeFileSync(file, JSON.stringify(out, null, 1) + '\n');
  return { file, filled: out.shots.filter((x) => x.onScreen).length, total: out.shots.length };
}

const rel = (p) => path.relative(ROOT, p);
const note = detected
  ? `Shot boundaries are MEASURED: ${cuts.length} hard cut(s) (scene score > ${THRESHOLD}, peak ${fx(peak, 3)}), `
    + `${seams.length} empty-ground seam(s) (edge content <= ${SEAM_THRESHOLD}), ${pans.length} sustained pan(s) `
    + `(delta >= ${PAN_FLOOR}, flat, held >= ${PAN_MIN_RUN}s) and ${crossfades.length} crossfade(s) `
    + `(delta ${CROSSFADE_LO}-${CROSSFADE_HI}, flat, held >= ${CROSSFADE_MIN_RUN}s). Check them against the sheet and the pages.`
  : `no joints found: cuts peaked at ${fx(peak, 3)} (below ${THRESHOLD}), edge content never fell below `
    + `${SEAM_THRESHOLD}, no sustained pan or crossfade held long enough. The film is one shot, or its `
    + `joints are of a kind this study does not measure: read the pages.`;

const md = `# Study · ${NAME}

Source: \`${study.source}\` · ${study.measured.duration}s · ${width}x${height} · ${study.measured.fps}fps · ${hasAudio ? 'has audio' : 'no audio track'}
Sheet: \`${rel(sheet)}\`

${note}
${shots.length} ${detected ? 'shots' : 'shot'} · median ${study.measured.medianShot}s · ${study.measured.cutsPerMinute} per minute.
Coverage: ${study.coverage.frames} frames decoded, ${study.coverage.unique} unique, ${study.coverage.pages} page(s) → \`${rel(pagesDir)}/\`.
Fill \`${rel(path.join(dir, 'pages.md'))}\` (one line per page) before this study counts as complete: \`vawe check study-check NAME=${NAME}\`.

> You are not copying this film's look. You are extracting its GRAMMAR: how long a shot holds, what
> makes the next one arrive, what carries across. Throw away its UI, its copy and its colours. Never
> put its frames or its marks in a film we publish.

## The table

Everything left of \`on screen\` is MEASURED. \`ground\` is the shot's mean luma, \`motion\` is the mean
frame-to-frame luma delta on the same scale \`./bin/vawe\` prints beside a render (still below ${STILL_FLOOR}), and
\`tone\` is the most saturated colour in the shot, or blank when the shot carries no accent at all.

The three right-hand columns are yours, and they are judgements no measurement reaches: WHICH object
moves and where it goes, what makes the next shot arrive, and what sits under it.

| # | time | length | ground | motion | peak | held | tone | on screen | what moves where | what triggers the next |
|---|------|--------|--------|--------|------|------|------|-----------|------------------|------------------------|
${shots.map((s) => `| ${s.i} | ${fx(s.t0)}s | ${fx(s.len)}s | ${s.ground ?? '?'} ${s.luma ?? ''} | ${s.motion ?? '?'} | ${s.peak ?? '?'} | ${s.held == null ? '?' : Math.round(s.held * 100) + '%'} | ${s.accent || '·'} | <…> | <…> | <…> |`).join('\n')}

\`peak\` is the loudest single frame and \`held\` is the share of frames below the still floor. Two shots
with the same \`motion\` are different shots when one of them holds for three seconds and then explodes,
and the contact sheet is now cut AT those peaks rather than at each shot's midpoint.

**The film's own motion, for comparison with ours.** The studied reference corpus measures 1.06 to
5.01 motion (median 2.84) and 11% to 77% still (median 29%), not the 1.7-2.0 / 13-24% this doc quoted
before checking it against the corpus (measured by \`bin/vawe see --spec\` over the corpus). \`./bin/vawe
<scene>\` prints the same still-share for our attempt, but on JPEG-captured frames against this figure's
H.264-decoded ones: read the codec it prints beside the number before comparing the two directly.

${seams.length ? `## Seams (empty-ground joints)

Neither shot's own delta curve carries these: they are frames of empty ground between two acts, found
by edge content falling to <= ${SEAM_THRESHOLD} for one or more frames, not by a luma-delta cut. \`axis\`/
\`direction\` compare the edge centroid ${SEAM_WINDOW}s before the gap opens against ${SEAM_WINDOW}s after
it closes: which way the content was leaving, and which way it arrives.

| t | gap | frames | axis | direction | ground before | ground after |
|---|-----|--------|------|-----------|----------------|----------------|
${seams.map((s) => `| ${s.t}s | ${s.gap}s | ${s.frames} | ${s.axis ?? '?'} | ${s.direction ?? '?'} | ${s.groundBefore ?? '?'} | ${s.groundAfter ?? '?'} |`).join('\n')}

` : ''}${pans.length ? `## Pans / pushes

Sustained, flat, elevated delta (>= ${PAN_FLOOR}, held >= ${PAN_MIN_RUN}s): the whole frame moving at close
to constant speed, a whip or a push, not a cut and not ordinary shot motion.

| t | mean | peak | flatness | frames |
|---|------|------|----------|--------|
${pans.map((p) => `| ${p.t}s | ${p.mean} | ${p.peak} | ${p.flatness} | ${p.frames} |`).join('\n')}

` : ''}${crossfades.length ? `## Crossfades

Sustained, flat, moderate delta (${CROSSFADE_LO}-${CROSSFADE_HI}, held >= ${CROSSFADE_MIN_RUN}s): a slow dissolve, not a cut.

| t | mean | peak | flatness | frames |
|---|------|------|----------|--------|
${crossfades.map((c) => `| ${c.t}s | ${c.mean} | ${c.peak} | ${c.flatness} | ${c.frames} |`).join('\n')}

` : ''}${conflicts.length ? `## Disagreements

Two detectors both found a joint within ${MIN_SHOT}s of each other and named it differently. Reported,
never silently resolved: read the pages around each one and decide which reading is right.

${conflicts.map((c) => `- ${c.detail}`).join('\n')}

` : ''}## Pages: every unique frame, in order

\`${rel(pagesDir)}/page-NNN.png\`, ${study.coverage.pages} page(s) covering all ${study.coverage.unique} unique
frames (of ${study.coverage.frames} decoded; the rest are held/duplicate and stand in for by the frame
before them, see \`${rel(path.join(dir, 'pages.json'))}\`). Fill \`${rel(path.join(dir, 'pages.md'))}\`, one
line per page, before writing the four judgement columns below: they should come FROM those lines, not
from the peaks-only sheet above.

## Then cut it

The method that produced this table cut a 31s film to 15s by REMOVING shots, never by speeding them
up. One event per screen. Mark each row above KEEP or CUT before you write a storyboard.

## Carry forward

Open \`${rel(sheet)}\` and \`${rel(frames)}/\` before answering below. Answer these four, then run
\`make dev-tool X=storyboard-draft\` (or write the storyboard by hand) and paste the answers in. The storyboard is
where they turn into our film.

- **pace:** median shot ${study.measured.medianShot}s. Our library runs 2.5-4s beats. Do we match this reference, and can we?
- **threads:** what survives a cut here? Name it, then name OUR version of it in our own subject.
- **spectacle:** which single shot is the loud one, and what makes it loud?
- **field:** look at the ground in the sheet, not a colour you'd eyedrop from it. Is it flat, textured,
  or generative (light, particles, a shader)? Name the specific look, not a hex.

Storyboard fields these feed: \`pace:\`, \`threads:\`/\`object:\`, \`spectacle:\`, \`color:\` (the field line,
not a swatch).
See \`guides/REFERENCE-STUDY.md\`.

## Write recipe candidates

A study is not finished at the table above. If a seam, spine, enter, exit, camera move or ground change
here is a pattern worth reusing, write it to \`grammar/_${NAME}.recipes.json\` in the \`recipes.json\` entry
shape (\`kind\`, \`blurb\`, \`sources\`, \`slots\`, \`params\` with measured defaults, see \`recipes/README.md\`).
It is a CANDIDATE, not a promotion: a person still moves it into \`recipes/recipes.json\`.
`;
fs.writeFileSync(path.join(dir, 'study.md'), md);

// ── report ────────────────────────────────────────────────────────────────────────────────────────
console.log(`✓ ${shots.length} ${detected ? 'shots' : 'shot'} · ${study.measured.duration}s · ${width}x${height} · ${study.measured.fps}fps → ${rel(dir)}/`);
console.log(`  ${DECODED_FRAMES} frames decoded (container states ${EXPECTED_FRAMES}), ${uniqueFrames.length} unique, ${pagesMeta.length} page(s).`);
if (!cutsDetected) {
  console.log(`  ⚠ no hard cuts: peak scene score ${fx(peak, 3)} < ${THRESHOLD}. Dissolves, a no-cut film of empty-ground seams, or a single shot.`);
  console.log(`    Lower it with --threshold 0.15 if you believe there are cuts, then READ the sheet before trusting the list.`);
}
if (cutsDetected && near) {
  console.log(`  ⚠ ${near} frame(s) scored between ${THRESHOLD / 2} and ${THRESHOLD}: probably dissolves this list MISSES. Re-run with --threshold ${THRESHOLD / 2} and compare the sheets.`);
}
if (seams.length) {
  console.log(`  ${seams.length} empty-ground seam(s) (edge content <= ${SEAM_THRESHOLD}):`);
  for (const s of seams) console.log(`    ${s.t}s  gap ${s.gap}s (${s.frames}f)  axis ${s.axis ?? '?'} ${s.direction ?? '?'}  ${s.groundBefore ?? '?'} -> ${s.groundAfter ?? '?'}`);
}
if (pans.length) {
  console.log(`  ${pans.length} sustained pan(s) (delta >= ${PAN_FLOOR}, flat, held >= ${PAN_MIN_RUN}s):`);
  for (const p of pans) console.log(`    ${p.t}s  mean ${p.mean} peak ${p.peak} flatness ${p.flatness} (${p.frames}f)`);
}
if (crossfades.length) {
  console.log(`  ${crossfades.length} crossfade(s) (delta ${CROSSFADE_LO}-${CROSSFADE_HI}, flat, held >= ${CROSSFADE_MIN_RUN}s):`);
  for (const c of crossfades) console.log(`    ${c.t}s  mean ${c.mean} peak ${c.peak} flatness ${c.flatness} (${c.frames}f)`);
}
if (conflicts.length) {
  console.log(`  ⚠ ${conflicts.length} disagreement(s) between detectors, not silently resolved:`);
  for (const c of conflicts) console.log(`    ${c.detail}`);
}
for (const s of shots) {
  console.log(`  ${String(s.i).padStart(2, ' ')}. ${fx(s.t0).toFixed(2)}s  ${fx(s.len).toFixed(2)}s${s.score == null ? '' : `  (score ${fx(s.score, 3)})`}${s.jointKind ? `  [${s.jointKind}]` : ''}`);
}
console.log(`\n  median shot ${study.measured.medianShot}s · ${study.measured.cutsPerMinute}/min${hasAudio ? '' : ' · NO audio track: the sound column is empty by fact, not by omission'}`);
const g = writeGrammar(study, shots);
console.log(`  grammar → ${rel(g.file)}  (${g.filled}/${g.total} shots carry an authored reading; it is COMMITTED and outlives refs/)`);
console.log(`  pages → ${rel(pagesDir)}/  (fill ${rel(path.join(dir, 'pages.md'))}, then \`vawe check study-check NAME=${NAME}\`)`);
console.log(`  Read ${rel(sheet)}, fill the four authored columns in ${rel(dir)}/study.md, then storyboard and write recipe candidates.`);
