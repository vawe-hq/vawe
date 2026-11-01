import { readRuns, readAllRuns, appendRun } from './runlog.mjs';
import path from 'node:path';

export const NEXT_UNCHANGED = 'next: unchanged, see above';

/** The records of `runs` this session wrote since its last reset (a compaction wipes what the agent remembers of them). */
export function sinceReset(runs, sessionId) {
  const reset = runs.findLastIndex((r) => r.cmd === 'shown-reset' && r.shownTo === sessionId);
  return runs.slice(reset + 1);
}

/** Writes a reset for `sessionId` into every film log that holds a next-shown or taste-shown record of it. */
export function resetShown(root, sessionId) {
  if (!sessionId) return;
  for (const f of readAllRuns(path.join(root, 'out'))) {
    if (f.runs.some((r) => (r.cmd === 'next-shown' || r.cmd === 'taste-shown') && r.shownTo === sessionId)) {
      try { appendRun(f.film, { cmd: 'shown-reset', shownTo: sessionId }, { root }); } catch { /* a hint log never fails the hook */ }
    }
  }
}

/**
 * True when this session and agent already saw `next` (with the same `why`) as the film's last next line; the call records it otherwise.
 * No session id means no memory, so the line is always shown.
 */
export function nextSeen(film, { next, why = '' }, { root, sessionId = null, agent = process.env.VAWE_AGENT ?? null }) {
  if (!sessionId) return false;
  const mine = sinceReset(readRuns(film, root), sessionId).filter((r) => r.cmd === 'next-shown' && r.shownTo === sessionId && r.shownAgent === agent);
  const last = mine.at(-1);
  if (last?.next === next && last?.why === why) return true;
  try { appendRun(film, { cmd: 'next-shown', next, why, shownTo: sessionId, shownAgent: agent }, { root }); } catch { /* a hint log never fails a verb */ }
  return false;
}
