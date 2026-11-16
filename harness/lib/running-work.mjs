// Is anything running for a film: a render slot, a marked verb (critique, draft) or a ship job? `vawe wait` waits on these.
import fs from 'node:fs';
import path from 'node:path';
import { slotsInUse } from './render-slots.mjs';
import { runningVerbs, slotsOfFilm } from './render-wait.mjs';
import { filmKeyOf } from './runlog.mjs';
import { SHIP_JOBS_DIR } from './ship-status.mjs';
import { isTerminal } from './job-state.mjs';

function shipJobs(work) {
  const dir = path.join(work, SHIP_JOBS_DIR);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith('.json')).flatMap((f) => {
    try { return [JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))]; } catch { return []; }
  });
}

/** True when a render, a marked verb or a ship job of the film (a page path or a name) is running in the workspace `work`. */
export function isRunning(film, work) {
  const slots = [...slotsInUse(), ...runningVerbs(film, work)];
  if (slotsOfFilm(film, slots).length) return true;
  return shipJobs(work).some((j) => filmKeyOf(j.page) === filmKeyOf(film) && !isTerminal(j.status));
}
