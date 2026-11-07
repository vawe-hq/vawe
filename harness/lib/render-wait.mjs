// `vawe wait`: block until the render slot of a film is free, then read the result of its verb. A ship job is waited on by ship-job.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { slotsInUse } from './render-slots.mjs';
import { readRuns, filmKeyOf } from './runlog.mjs';
import { footerLine } from './verb-log.mjs';

export const WAIT_CAP_DEFAULT_MS = 210_000;
const POLL_MS = 1000;
const SETTLE_MS = 60_000;

const MARKER_MAX_AGE_MS = 30 * 60 * 1000;
const markerPrefix = (film) => `${filmKeyOf(film)}.running-`;
const pidAlive = (pid) => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };

/** Records that `verb` runs for `film` (a critique holds no render slot for minutes); returns the function that clears this run's marker. The file also goes when the process exits. */
export function markRunning(film, verb, root = '.') {
  const file = path.join(root, 'out', `${markerPrefix(film)}${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ pid: process.pid, kind: verb, who: filmKeyOf(film), start: new Date().toISOString() }));
  const clear = () => fs.rmSync(file, { force: true });
  process.on('exit', clear);
  return () => { process.off('exit', clear); clear(); };
}

/** The verbs marked as running for `film` whose process is alive and whose marker is under 30 minutes old (a reused pid cannot hold a wait for ever), as slot-shaped rows. */
export function runningVerbs(film, root = '.', now = Date.now()) {
  const dir = path.join(root, 'out');
  if (!fs.existsSync(dir)) return [];
  const rows = [];
  for (const name of fs.readdirSync(dir).filter((n) => n.startsWith(markerPrefix(film)) && n.endsWith('.json'))) {
    try {
      const m = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
      if (!pidAlive(m.pid)) fs.rmSync(path.join(dir, name), { force: true });
      else if (now - Date.parse(m.start) < MARKER_MAX_AGE_MS) rows.push(m);
    } catch { /* a marker being written or removed */ }
  }
  return rows;
}

/** The slots held for `film` (a page path, an mp4 path or a film name). */
export const slotsOfFilm = (film, slots) => slots.filter((s) => s.who === filmKeyOf(film));

/** One progress line for the slots a film holds. */
export const waitingLine = (film, held, now) => {
  const age = Math.max(0, Math.round((now - Math.min(...held.map((s) => Date.parse(s.start)))) / 1000));
  return `vawe wait: ${filmKeyOf(film)} has ${held.map((s) => (/^(draft|final|clip)$/.test(s.kind) ? `a ${s.kind} render` : `a ${s.kind}`)).join(' and ')} running, ${age}s in`;
};

/** The one command that waits for a render of `page`: named while a render of its film holds a slot, else null. */
export const waitCommand = (page, slots) => (slotsOfFilm(page, slots).length ? `bin/vawe wait ${page}` : null);

const isResult = (r) => r.cmd === 'verb' && r.verb !== 'wait';

/** The footer line of the newest verb run recorded after `sinceAt`, or null. */
export function resultAfter(runs, sinceAt) {
  const last = runs.filter(isResult).pop();
  if (!last || last.at <= sinceAt) return null;
  return footerLine({ verb: last.verb, code: last.exitCode, reason: last.error, seconds: last.durationS });
}

const newestAt = (runs) => runs.filter(isResult).pop()?.at ?? '';

/**
 * Waits up to `capMs` for the film's render slots to free, one progress line per `progressMs`, then up to SETTLE_MS for the verb that
 * held them to log its result (dev runs a directions check after the render). Resolves { running, result }.
 */
export async function waitForFilm(film, { capMs, progressMs, slots = () => [...slotsInUse(), ...runningVerbs(film)], runs = () => readRuns(film), now = Date.now, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), log = console.log } = {}) {
  const since = newestAt(runs());
  const until = now() + capMs;
  let nextProgress = now() + progressMs;
  let held = slotsOfFilm(film, slots());
  if (!held.length) return { running: false, result: resultAfter(runs(), '') };
  log(`${waitingLine(film, held, now())} (waiting up to ${Math.round(capMs / 1000)}s in this call)`);
  while (held.length && now() < until) {
    await sleep(POLL_MS);
    held = slotsOfFilm(film, slots());
    if (held.length && now() >= nextProgress) { nextProgress += progressMs; log(waitingLine(film, held, now())); }
  }
  if (held.length) return { running: true, result: null };
  const settleUntil = now() + SETTLE_MS;
  let result = resultAfter(runs(), since);
  while (!result && now() < settleUntil) {
    await sleep(POLL_MS);
    result = resultAfter(runs(), since);
  }
  return { running: false, result };
}

/** The last line of a wait call that hit its cap: tells the agent the render goes on and which command to call again. */
export const stillRunningLine = (command, capMs) => `vawe wait: STILL RUNNING after ${Math.round(capMs / 1000)}s, the render goes on and nothing is lost. Call again: ${command}`;

/** 1 when the awaited verb failed, 0 otherwise. A call that is still running also exits 0: its last printed line is STILL RUNNING. */
export const waitExitCode = ({ running, result }) => (!running && /\bFAILED\b/.test(result ?? '') ? 1 : 0);
