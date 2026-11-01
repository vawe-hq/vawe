// `vawe frame --moment <s> --onion`: several frames of one move blended into ONE image, the newest strongest, so the spacing, path and overshoot of the move show.
// The input resolves as `vawe frame` resolves it (a page's last draft, an mp4, a reference id).
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ffmpegOrDie } from '../../lib/scratch.mjs';
import { die, probeVideo } from './core.mjs';
import { ONION_FRAMES, ONION_SPAN, isLightGround, onionGraph, onionProblem, onionTimes } from './onion-math.mjs';
import { resolveInput } from './input.mjs';
import { stripWindow } from './strip-math.mjs';

const FRAME_GAP_S = 0.03;

function meanGrey(video, t) {
  const r = spawnSync('ffmpeg', ['-v', 'error', '-ss', t.toFixed(3), '-i', video, '-frames:v', '1', '-vf', 'scale=1:1:flags=area,format=gray', '-f', 'rawvideo', '-']);
  return r.status === 0 && r.stdout.length ? r.stdout[0] : 0;
}

/** Writes the onion PNG of `opts.n` frames across `opts.span` seconds around `opts.at` (into `opts.out`, default out/onion/<name>) and returns { out, times }. */
export function makeOnion(found, opts) {
  const { width, height, dur, fps } = probeVideo(found.video);
  const { from, to } = stripWindow(opts.at, opts.span, dur);
  const times = onionTimes(from, Math.min(to, dur - Math.max(FRAME_GAP_S, 1.5 / fps)), opts.n);
  const outDir = path.resolve(opts.out ?? path.join('out', 'onion', found.name));
  fs.mkdirSync(outDir, { recursive: true });
  const out = path.join(outDir, `onion-${opts.at.toFixed(2)}-n${opts.n}.png`);
  const inputs = times.flatMap((t) => ['-ss', t.toFixed(3), '-i', found.video]);
  ffmpegOrDie(['-v', 'error', '-y', ...inputs, '-filter_complex', onionGraph(times, width, height, isLightGround(meanGrey(found.video, times.at(-1)))), '-map', '[out]', '-frames:v', '1', out], out, 'onion');
  return { out, times };
}

/** Runs `vawe frame --moment <s> --onion`: writes one PNG of `opts.n` frames across `opts.span` seconds around `opts.at`, prints its absolute path. */
function runOnion(found, opts) {
  if (found.draftMissing) die(`no draft of ${found.page} yet: run bin/vawe dev ${found.page} first (it writes ${found.video}), then repeat`);
  if (found.draftOld) console.log(`note: ${found.video} is older than ${found.page}; run bin/vawe dev ${found.page} for the current page`);
  const { out, times } = makeOnion(found, opts);
  console.log(`onion of ${found.video}: ${opts.n} frames, ${times[0].toFixed(2)} to ${times.at(-1).toFixed(2)} s, oldest cool and faint, newest strong`);
  console.log(out);
}

export async function dispatchOnion(input, flag) {
  const opts = { at: flag('--onion', undefined), span: Number(flag('--span', ONION_SPAN)), n: Number(flag('--n', ONION_FRAMES)), out: flag('--out', undefined) };
  const problem = onionProblem(opts);
  if (problem) die(problem);
  return runOnion(await resolveInput(input), { ...opts, at: Number(opts.at) });
}
