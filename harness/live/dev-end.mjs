#!/usr/bin/env node
// Runs after `vawe dev` renders: the top advice of the draft (slideshow score and attractors first) and, while a render of the film
// still runs, the exact wait command, and the path of one full-size still (`vawe frame`) to read. Advice only: the exit code is always 0.
//   node harness/live/dev-end.mjs <page.html>
import fs from 'node:fs';
import path from 'node:path';
import { filmKeyOf, readRuns } from '../lib/runlog.mjs';
import { spectacleOf } from '../lib/board.mjs';
import { reviewStillSecond } from '../lib/worlds.mjs';
import { slotsInUse } from '../lib/render-slots.mjs';
import { waitCommand } from '../lib/render-wait.mjs';
import { adviceOfDevNotes, topAdviceLines } from './plan-status.mjs';
import { pageStill } from '../media/still.mjs';
import { paramsFilm } from '../lib/page-params.mjs';

// The draft's own browser takes the still: the final browser would start a second Chrome.
async function fullSizeStill(page, film) {
  const worlds = readRuns(film).filter((r) => r.cmd === 'dev' && !r.failed).at(-1)?.worlds;
  const at = reviewStillSecond(worlds, spectacleOf(fs.readFileSync(page, 'utf8')));
  if (at == null) return [];
  const out = path.resolve('out', `${paramsFilm(film)}-draft-full.png`);
  try {
    const got = await pageStill(page, at, out, { final: false });
    return [`full-size still: ${out}: ${got.size}, the frame at ${got.t}s`];
  } catch { return []; }
}

const [page] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
if (page) {
  const film = filmKeyOf(page);
  const notesFile = path.resolve('out', `${paramsFilm(film)}.dev.md`);
  const notes = fs.existsSync(notesFile) ? fs.readFileSync(notesFile, 'utf8') : '';
  const wait = waitCommand(page, slotsInUse());
  const lines = [...topAdviceLines(adviceOfDevNotes(notes), paramsFilm(film)), ...await fullSizeStill(page, film), ...(wait ? [`a render is still running: ${wait}`] : [])];
  if (lines.length) console.log(`\n${lines.join('\n')}`);
}
