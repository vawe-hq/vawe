import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { defaultOutDir, die, parseRange, probeVideo } from './core.mjs';
import { runCompare, runMeasure, runSheetCheck, runShot } from './compare.mjs';
import { runDom, runRequiredMotionMatch } from './dom.mjs';
import { runFullFlow } from './ocr.mjs';
import { runLayout, runLook, runProbe } from './inspect.mjs';
import { runWordEventCompare } from './words.mjs';
import { STRIP_FPS, STRIP_SPAN, stripProblem } from './strip-math.mjs';


export async function main() {
  const argv = process.argv.slice(2);
  const flag = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
  const positional = argv.filter((a, i) => !a.startsWith('--') && !(argv[i - 1] || '').startsWith('--'));

  // --sheet-check needs no video and no ffmpeg: pure JSON-to-JSON, <1s.
  if (argv.includes('--sheet-check')) {
    const [refFile, filmFile] = positional;
    if (!refFile || !filmFile)
      die('usage: node harness/media/see.mjs --sheet-check <ref-sheet.json> <film-sheet.json>');
    return runSheetCheck(refFile, filmFile);
  }

  const video = positional[0];

  if (!video) die('usage: node harness/media/see.mjs <video> [outDir] [--frames N] '
    + '| --shot <from>-<to> [--fps N] [--page <html>] | --compare <draft.mp4> [--from s --to s] [--words] '
    + '| <page.html> [outDir] --measure [--ref <mp4>] (numeric deltas both sides, or self-checks) '
    + '| --dom [<html>] [--from s --to s] [--dom-fps N] [--ids a,b,c] '
    + '[--ref <mp4> [--final] [--w N --h N] [--blur N] [--words]] '
    + '| --word-events <film.mp4> [--from s --to s] '
    + '| --sheet-check <ref.json> <film.json> '
    + '| --probe --at <s> --sel <css> | --look --times <s,...> [--ref <mp4>] | --layout --times <s,...>');
  if (argv.includes('--moment') || argv.includes('--cuts')) return dispatchStrip(video, flag, argv);
  if (argv.includes('--onion')) return (await import('./onion.mjs')).dispatchOnion(video, flag);
  if (argv.includes('--velocity')) return (await import('./velocity.mjs')).dispatchVelocity(video, flag);
  if (!fs.existsSync(video)) die(`no such file: ${video}`);
  for (const bin of ['ffprobe', 'ffmpeg']) {
    if (spawnSync(bin, ['-version'], { encoding: 'utf8' }).error)
      die(`${bin} is not on PATH. see.mjs needs ffmpeg (and tesseract for the full flow); install and re-run.`);
  }

  if (['--phone', '--strip', '--loop'].some((v) => argv.includes(v))) return dispatchViews(video, positional, flag, argv);
  if (argv.includes('--probe')) return dispatchProbe(video, positional, flag);
  if (argv.includes('--look')) return dispatchLook(video, positional, flag);
  if (argv.includes('--layout')) return dispatchLayout(video, positional, flag);
  if (argv.includes('--measure')) return dispatchMeasure(video, positional, flag);
  if (argv.includes('--dom')) return dispatchDom(video, positional, flag, argv);

  const shotSpec = flag('--shot', null);
  if (shotSpec) return dispatchShot(video, positional, shotSpec, flag);

  const compareArg = flag('--compare', null);
  if (compareArg) return dispatchCompare(video, positional, compareArg, flag, argv);

  const wordEventsArg = flag('--word-events', null);
  if (wordEventsArg) return dispatchWordEvents(video, positional, wordEventsArg, flag);

  return runFullFlow(video, positional, flag);
}

// `see.mjs <ref.mp4> --word-events <film.mp4> [--from s --to s]`: the standalone entry point for the
// per-word entrance/highlight/exit/star check, video vs video, no page render involved (that path is
// `--dom --ref ... --words`, which reuses this same runWordEventCompare on its own two rendered mp4s).
export function dispatchWordEvents(video, positional, filmVideo, flag) {
  if (!fs.existsSync(filmVideo)) die(`no such --word-events file: ${filmVideo}`);
  const refP = probeVideo(video), filmP = probeVideo(filmVideo);
  const from = Number(flag('--from', 0));
  const to = flag('--to', null) != null ? Number(flag('--to', null)) : Math.min(refP.dur, filmP.dur);
  if (!(to > from)) die(`--word-events: bad window ${from}-${to}`);
  const outDir = path.resolve(positional[1] || defaultOutDir(video));
  fs.mkdirSync(outDir, { recursive: true });
  const ok = runWordEventCompare(video, filmVideo, outDir, from, to, `${path.basename(video)} vs ${path.basename(filmVideo)}`);
  if (!ok) process.exitCode = 1;
}

export function dispatchProbe(video, positional, flag) {
  const at = Number(flag('--at', 0));
  const sel = flag('--sel', null);
  if (!sel) die('usage: node harness/media/see.mjs <html> --probe --at <s> --sel <css>');
  const outDir = path.join(path.resolve(positional[1] || defaultOutDir(video)), 'probe');
  return runProbe(video, at, sel, outDir);
}

export function dispatchLook(video, positional, flag) {
  const timesArg = flag('--times', null);
  if (!timesArg) die('usage: node harness/media/see.mjs <html> --look --times <s,s,...> [--ref <mp4>]');
  const times = timesArg.split(',').map(Number);
  const refArg = flag('--ref', null);
  if (refArg && !fs.existsSync(refArg)) die(`no such --ref file: ${refArg}`);
  const outDir = path.join(path.resolve(positional[1] || defaultOutDir(video)), 'look');
  return runLook(video, times, refArg, outDir);
}

export function dispatchLayout(video, positional, flag) {
  const timesArg = flag('--times', null);
  if (!timesArg) die('usage: node harness/media/see.mjs <html> --layout --times <s,s,...>');
  const times = timesArg.split(',').map(Number);
  const outDir = path.join(path.resolve(positional[1] || defaultOutDir(video)), 'layout');
  return runLayout(video, times, outDir);
}

export function dispatchMeasure(video, positional, flag) {
  if (!video.endsWith('.html')) die('--measure reads a page: node harness/media/see.mjs <page.html> [outDir] --measure [--ref <ref.mp4>]');
  return runMeasure(video, flag('--ref', null), path.resolve(positional[1] || defaultOutDir(video)));
}

export async function dispatchDom(video, positional, flag, argv) {
  const fromArg = Number(flag('--from', 0));
  const toArg = flag('--to', null);
  const domFps = Number(flag('--dom-fps', 30));
  const idsArg = flag('--ids', null);
  const outDirRoot = path.resolve(positional[1] || defaultOutDir(video));
  // `--dom --ref <mp4>`: required-motion-match on a bare page, no scene.json, no draft render
  // (`vawe critique <html> --ref <mp4>`, item 2 of this file's own required-motion-match doctrine). This
  // is the one branch that renders the page through render-page.mjs, the real cost measured on this
  // repo (~57s for a 5s window at full size with blur), so it alone defaults to a half-size draft;
  // --final renders the way `vawe ship` does (full size, full length, motion blur), for the one check
  // that must match the actual shipped cut rather than a fast iteration draft.
  const refArg = flag('--ref', null);
  const final = argv.includes('--final');
  const w = Number(flag('--w', refArg && !final ? 960 : 1920));
  const h = Number(flag('--h', refArg && !final ? 540 : 1080));
  const blur = Number(flag('--blur', final ? 3 : 1));
  const opts = {
    from: fromArg, to: toArg != null ? Number(toArg) : null, fps: domFps, w, h, blur, final,
    ids: idsArg ? idsArg.split(',') : null,
  };
  if (refArg) {
    await runRequiredMotionMatch(video, refArg, outDirRoot, { ...opts, words: argv.includes('--words') });
    if (!argv.includes('--no-measure')) await runMeasure(video, refArg, outDirRoot);
    return;
  }
  return runDom(video, outDirRoot, opts);
}

export async function dispatchViews(input, positional, flag, argv) {
  const views = await import('../see-views.mjs');
  const video = await views.videoFor(input);
  const outDir = path.resolve(positional[1] || defaultOutDir(input));
  const rel = (p) => path.relative(process.cwd(), p);
  if (argv.includes('--strip') && fs.existsSync(outDir)) for (const f of fs.readdirSync(outDir).filter((n) => /^strip-.*\.png$/.test(n))) fs.rmSync(path.join(outDir, f));
  if (argv.includes('--phone')) {
    const r = views.phoneSheet(video, outDir);
    console.log(`✓ small sheet, ${r.frames} frame(s) at 360 px wide, 1 fps: LOOK at ${rel(r.sheet)}`);
  }
  let stripAt = flag('--strip', null);
  if (stripAt === 'auto') stripAt = views.autoStripTime(input, video);
  if (stripAt != null) {
    const r = views.stripSheet(video, Number(stripAt), outDir);
    console.log(`✓ strip, 12 frames from f${r.firstFrame} at ${r.fps} fps around ${r.at}s: LOOK at ${rel(r.sheet)}`);
    if (r.clamped) console.log(`  note: ${stripAt}s is past the last frame; the strip is centred on the last frame (${r.at}s)`);
  }
  if (argv.includes('--loop')) {
    const r = views.loopSeam(video, outDir);
    console.log(`✓ loop seam: LOOK at ${rel(r.sheet)}\n  ${views.describeLoop(r)}`);
  }
}

export async function dispatchStrip(input, flag, argv) {
  for (const bin of ['ffprobe', 'ffmpeg']) {
    if (spawnSync(bin, ['-version'], { encoding: 'utf8' }).error) die(`${bin} is not on PATH`);
  }
  const opts = { cuts: argv.includes('--cuts'), at: flag('--moment', undefined), span: Number(flag('--span', STRIP_SPAN)), fps: Number(flag('--fps', STRIP_FPS)), out: flag('--out', undefined), limit: argv.includes('--limit') ? Number(flag('--limit', undefined)) : undefined };
  const problem = stripProblem(opts);
  if (problem) die(problem);
  const { runStrip } = await import('./strip.mjs');
  return runStrip(input, { ...opts, at: opts.cuts ? undefined : Number(opts.at) });
}

export function dispatchShot(video, positional, shotSpec, flag) {
  const { from, to } = parseRange(shotSpec);
  const fps = Number(flag('--fps', 10));
  const outDirRoot = path.resolve(positional[1] || defaultOutDir(video));
  const pageArg = flag('--page', null);
  if (pageArg) console.log(`\n  next: bin/vawe critique ${pageArg} --ref ${video}`);
  return runShot(video, outDirRoot, from, to, fps);
}

export function dispatchCompare(video, positional, compareArg, flag, argv) {
  if (!fs.existsSync(compareArg)) die(`no such draft file: ${compareArg}`);
  const fromArg = flag('--from', null);
  const toArg = flag('--to', null);
  const outDirRoot = path.resolve(positional[1] || defaultOutDir(video));
  return runCompare(video, compareArg, outDirRoot, fromArg != null ? Number(fromArg) : null, toArg != null ? Number(toArg) : null,
    argv.includes('--words'));
}
