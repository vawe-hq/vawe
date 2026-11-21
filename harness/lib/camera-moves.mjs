// The whole-frame moves of a film (a camera push, pull or drift, a transform on a world or stage root, parallax on the whole ground),
// read from the motion records (harness/lib/motion-lint.mjs). A slow move (under slow_px_per_s) keeps a hold alive, as one slow ease per shot is
// the house default; a fast whole-frame move is not element motion, so the seconds where only it runs still count as still.
import LIMITS from '../../taste/build/limits.json' with { type: 'json' };
import { CUT, moveProps, translateXY, expandTransform } from './motion-records.mjs';

const CAM = LIMITS['constant-camera'];
const FRAME = /^(transform|translate|scale|rotate)$/;

/** A whole-frame transform: the camera() preset, or a scale/translate/rotate on an element that covers most of the frame, for at least move_min_s. */
export const isCameraMove = (r) => r.duration >= CAM.move_min_s && (r.id === 'camera' || r.fullFrame) && moveProps(r).some((p) => FRAME.test(p));

const FRAME_PX = 1080;
const LENGTH = /calc\((?:[^()]|\([^()]*\))*\)|\S+/g;
const px = (len) => translateXY(len)[0] * (/calc|%|v[wh]/.test(len) ? FRAME_PX / 100 : 1);
const xy = (v) => { const [x = '0', y = '0'] = String(v).match(LENGTH) ?? []; return [px(x), px(y)]; };
const change = (pair, read) => (pair ? Math.abs(read(pair[1]) - read(pair[0])) || 0 : 0);

/** The travel of a camera move in px per second, on a 1080 px frame: its largest translate, scale or rotate change over its duration (a transform string is read as its translate and scale). A record with no readable values counts as 0, a slow move. */
export function cameraSpeed(r) {
  const kf = expandTransform(r.kf ?? {});
  const [a, b] = (kf.translate ?? []).map(xy);
  const travel = a && b ? Math.hypot(b[0] - a[0], b[1] - a[1]) : 0;
  const zoom = change(kf.scale, parseFloat) * FRAME_PX;
  const turn = change(kf.rotate, parseFloat) * (Math.PI / 180) * (FRAME_PX / 2);
  return Math.max(travel, zoom, turn) / r.duration;
}

export const isSlowCamera = (r) => cameraSpeed(r) < CAM.slow_px_per_s;

/** The seconds [a, b] covered by `spans`, overlapping spans merged. */
function unionOf(spans) {
  const out = [];
  for (const [a, b] of [...spans].sort((x, y) => x[0] - y[0])) {
    const last = out.at(-1);
    if (last && a <= last[1]) last[1] = Math.max(last[1], b); else out.push([a, b]);
  }
  return out;
}

const spanOf = (r) => [r.delay, r.delay + r.duration];

const minus = (spans, cut) => spans.flatMap(([a, b]) => {
  const parts = [[a, b]];
  for (const [c, d] of cut) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const [p, q] = parts[i];
      if (d <= p || c >= q) continue;
      parts.splice(i, 1, ...[[p, Math.min(q, c)], [Math.max(p, d), q]].filter(([x, y]) => y > x));
    }
  }
  return parts;
});

export const cameraSpans = (records) => unionOf(records.filter(isCameraMove).map(spanOf));

/**
 * The seconds where a fast camera move runs and no part of the frame moves by itself: [a, b] pairs. An element move is any other record on a part
 * that does not cover the frame, and a slow camera move (cameraSpeed) is one too.
 */
export function cameraOnlySpans(records) {
  const alive = records.filter((r) => (!isCameraMove(r) && !r.fullFrame && r.duration > CUT && r.props.length) || (isCameraMove(r) && isSlowCamera(r)));
  return minus(unionOf(records.filter((r) => isCameraMove(r) && !isSlowCamera(r)).map(spanOf)), unionOf(alive.map(spanOf)));
}

const round2 = (x) => +x.toFixed(2);

/** The still runs of scene-stats with the camera-only spans added: pixels change under a camera move, so the page's records name those seconds. A run built from them carries `camera: true`. */
export function withCameraStills(runs, cameraOnly) {
  const parts = [...runs.map((r) => ({ a: r.a, b: r.b, camera: false })), ...cameraOnly.map(([a, b]) => ({ a, b, camera: true }))].sort((x, y) => x.a - y.a);
  const out = [];
  for (const p of parts) {
    const last = out.at(-1);
    if (last && p.a <= last.b) { last.b = Math.max(last.b, p.b); last.camera ||= p.camera; } else out.push({ ...p });
  }
  return out.filter((r) => r.b - r.a >= CAM.still_min_s).map((r) => ({ a: round2(r.a), b: round2(r.b), len: round2(r.b - r.a), ...(r.camera ? { camera: true } : {}) }));
}

const covered = (spans, [a, b]) => spans.reduce((s, [c, d]) => s + Math.max(0, Math.min(b, d) - Math.max(a, c)), 0);

/**
 * How much of the film the camera moves: { share (of the duration), worlds (the longest run of consecutive worlds with a camera move),
 * first (second the first move starts) }. A move that holds the `spectacle` second is the one deliberate move and is left out. A world has a
 * move when the camera covers half of it. `worlds` is [{ start, end }] or null.
 */
export function cameraLoad(records, { dur, worlds = null, spectacle = null }) {
  const moves = records.filter(isCameraMove).map(spanOf).filter(([a, b]) => spectacle == null || !(a <= spectacle && spectacle <= b));
  const spans = unionOf(moves);
  let run = 0, longest = 0;
  for (const w of worlds ?? []) {
    run = covered(spans, [w.start, w.end]) >= 0.5 * (w.end - w.start) ? run + 1 : 0;
    longest = Math.max(longest, run);
  }
  return { share: dur > 0 ? covered(spans, [0, dur]) / dur : 0, worlds: longest, first: spans[0]?.[0] ?? null };
}
