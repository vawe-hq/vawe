#!/usr/bin/env node
// How often the reference films pause before a shot cut: the numbers in REF_PAUSES (harness/media/see/strip-math.mjs).
//   node harness/dev/pause-bar.mjs <measures.json>
// Reads the same film list as bar-from-refs.mjs and measures each with holdBefore on the energy series `vawe frame` reads.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { quantile, referenceFilms } from './bar-from-refs.mjs';
import { computeEnergy, HOLD_FLOOR } from '../media/see/core.mjs';
import { resolveInput } from '../media/see/input.mjs';
import { cutHolds, PAUSE_S } from '../media/see/strip-math.mjs';

/** The share of measured cuts that pause PAUSE_S or more, per film. Pure. */
export const pauseShare = (holds) => {
  const measured = holds.filter(Boolean);
  return measured.length ? measured.filter((h) => h.holdS >= PAUSE_S).length / measured.length : null;
};

async function main() {
  const file = process.argv[2];
  if (!file || !fs.existsSync(file)) { console.error('usage: node harness/dev/pause-bar.mjs <measures.json>'); process.exit(2); }
  const ids = Object.entries(JSON.parse(fs.readFileSync(file, 'utf8'))).filter(([, f]) => referenceFilms({ x: f }).length).map(([id]) => id);
  const shares = [];
  let measured = 0;
  for (const id of ids) {
    const found = await resolveInput(id);
    const cuts = await found.holdCuts();
    const energy = computeEnergy(found.video);
    const holds = cutHolds(energy, cuts, HOLD_FLOOR);
    measured += holds.filter(Boolean).length;
    shares.push(pauseShare(holds));
    console.log(`${id}: ${holds.filter(Boolean).length} measured cuts, ${Math.round((shares.at(-1) ?? 0) * 100)}% pause`);
  }
  const known = shares.filter((s) => s !== null);
  console.log(`${known.length} films, ${measured} measured cuts: ${known.filter((s) => s === 0).length} films never pause, the median film pauses before ${Math.round(quantile(known, 0.5) * 10)} cuts in 10`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
