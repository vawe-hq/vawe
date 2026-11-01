import { readRuns, appendRun } from './runlog.mjs';

export const NEXT_UNCHANGED = 'next: unchanged, see above';

/** `line` the first time this session sees it for the film, else NEXT_UNCHANGED, so a changed line stands out. `sessionId` null counts all sessions as one. */
export function nextOnce(film, line, root, sessionId = null) {
  const last = readRuns(film, root).findLast((r) => r.cmd === 'next-shown' && r.shownTo === sessionId);
  if (last?.line === line) return NEXT_UNCHANGED;
  appendRun(film, { cmd: 'next-shown', line, shownTo: sessionId }, { root });
  return line;
}
