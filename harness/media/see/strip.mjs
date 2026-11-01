// `vawe frame`: the frames through one moment of a film, as ONE grid, with the motion numbers of that window.
// The frames come from runShot (--shot), the one extractor; this file picks the windows and reads the energy.
import path from 'node:path';
import { computeEnergy, die, HOLD_FLOOR, probeVideo } from './core.mjs';
import { runShot } from './compare.mjs';
import { cutHolds, energyLines, holdLine, holdsSummary, motionLines, motionRead, stripFpsProblem, stripWindow, transitionLine } from './strip-math.mjs';
import { resolveInput } from './input.mjs';

/** The seconds of the cuts of a page or mp4, for `vawe frame --vs --at cuts`. */
export async function cutSeconds(input) {
  const { cuts } = await resolveInput(input);
  return (await cuts()).map((c) => +c.at.toFixed(2));
}

function stripOne(video, outRoot, energy, { at, span, fps }, dur) {
  const { from, to } = stripWindow(at, span, dur);
  const { gridPaths } = runShot(video, outRoot, from, to, fps, { energy, quiet: true });
  return { from, to, gridPaths, read: motionRead(energy, from, to, HOLD_FLOOR) };
}

function printStrip(title, r, fps, { compact, energy }) {
  console.log(`\n${title}`);
  for (const p of r.gridPaths) console.log(`  ${p}`);
  console.log(`  window ${r.from.toFixed(2)}-${r.to.toFixed(2)} s, frames every ${(1 / fps).toFixed(3)} s, left to right, top to bottom`);
  for (const l of energyLines(energy, r.from, r.to, { compact })) console.log(`  ${l}`);
  for (const l of motionLines(r.read, HOLD_FLOOR)) console.log(`  ${l}`);
}

/** Runs `vawe frame`: one grid at `opts.at`, or one per cut with `opts.cuts`. Prints the absolute path of each grid and the motion numbers. */
export async function runStrip(input, opts) {
  const found = await resolveInput(input);
  if (found.draftMissing) die(`no draft of ${input} yet: run bin/vawe dev ${found.page} first (it writes ${found.video}), then repeat`);
  if (found.draftOld) console.log(`note: ${found.video} is older than ${found.page}; run bin/vawe dev ${found.page} for the current page`);
  const { dur, fps: sourceFps } = probeVideo(found.video);
  const fpsProblem = stripFpsProblem(opts.fps, sourceFps);
  if (fpsProblem) die(fpsProblem);
  const energy = computeEnergy(found.video);
  const outRoot = path.resolve(opts.out ?? path.join('out', 'strip', found.name));
  const common = { span: opts.span, fps: opts.fps };
  if (!opts.cuts) {
    printStrip(`strip of ${found.video} at ${opts.at.toFixed(2)} s`, stripOne(found.video, outRoot, energy, { at: opts.at, ...common }, dur), opts.fps, { compact: false, energy });
    return;
  }
  const cuts = await found.holdCuts();
  console.log(`${cuts.length} cut${cuts.length === 1 ? '' : 's'} in ${found.video}, one strip each (${opts.span} s centred on the cut)`);
  const holds = cutHolds(energy, cuts, HOLD_FLOOR);
  for (const [i, c] of cuts.entries()) {
    printStrip(`${i + 1}. ${c.from} to ${c.to}, cut at ${c.at.toFixed(2)} s`, stripOne(found.video, outRoot, energy, { at: c.at, ...common }, dur), opts.fps, { compact: true, energy });
    console.log(`  ${holdLine(holds[i])}`);
    const change = transitionLine(c);
    if (change) console.log(`  ${change}`);
  }
  console.log(`\n${holdsSummary(holds).join('\n')}`);
}
