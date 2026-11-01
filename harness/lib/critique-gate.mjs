// The ship gate on a fresh review: a final render needs, for the page as it is now, a `vawe judge --fresh` verdict or a `vawe critique --fresh`
// (each starts its own headless session, so it cannot be the author), or a `vawe critique` run in a session other than the one that rendered the draft.
// All log the page digest (judgeEvent and verbEvent pageHash); this reads it back.
// Why a gate: traces of 44 film agents showed 21 of 23 shipped past the warnings and 2 of 23 ran a critique first.
import { readRuns } from './runlog.mjs';
import { pageDigest } from './approval.mjs';
import { sameSession, lastAuthorRun } from './judge-self-record.mjs';

const ranJudge = (r, digest) => r.cmd === 'judge' && r.pageHash === digest;
const ranCritique = (r, digest) => r.cmd === 'verb' && r.verb === 'critique' && r.exitCode === 0 && r.pageHash === digest;

/** The command that records a critique the ship gate accepts: run it in a separate terminal or agent session. */
export const critiqueCommand = (pagePath) => `VAWE_AGENT=critic bin/vawe critique ${pagePath}`;

/** The command that records a fresh critique from the author's own terminal: it starts the critic session. It exits 2 when the claude CLI is missing. */
export const critiqueFreshCommand = (pagePath) => `bin/vawe critique ${pagePath} --fresh`;

/** The command that records a judge verdict the ship gate accepts. It exits 2 when the claude CLI is missing. */
export const judgeCommand = (pagePath) => `bin/vawe judge ${pagePath} --fresh`;

const WAYS = (page) => `run ${judgeCommand(page)} or ${critiqueFreshCommand(page)} (each starts its own session; exit 2 means the claude CLI is missing, then use the critique), or in a separate terminal ${critiqueCommand(page)}`;

/** The reason a final render may not start for want of a fresh review, or null. VAWE_UNATTENDED=1 needs none. Every reason ends with the command to run. */
export function critiqueProblem(pagePath, { root = '.', env = process.env, runs = readRuns(pagePath, root), digest = pageDigest(pagePath) } = {}) {
  if (env.VAWE_UNATTENDED === '1') return null;
  if (runs.some((r) => ranJudge(r, digest))) return null;
  const critiques = runs.filter((r) => ranCritique(r, digest));
  if (!critiques.length) return `no fresh review of the current page (none ran, or the page changed after it): ${WAYS(pagePath)}`;
  if (critiques.some((c) => c.fresh)) return null;
  const author = lastAuthorRun(runs);
  if (author && critiques.every((c) => sameSession(c, author))) return `the critique of the current page ran in the session that rendered the draft (a VAWE_AGENT label does not make a new session): ${WAYS(pagePath)}`;
  return null;
}
