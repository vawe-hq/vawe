// The ship gate on a fresh review: a final render needs, for the page as it is now, a `vawe critique --fresh` (it starts its own headless session,
// so it cannot be the author), or a `vawe critique` run in a session other than the one that rendered the draft. A `vawe-dev judge --fresh` verdict counts too.
// All log the page digest (judgeEvent and verbEvent pageHash); loop-state.mjs critiqueAt reads it back.
// Why a gate: traces of 44 film agents showed 21 of 23 shipped past the warnings and 2 of 23 ran a critique first.
import { readRuns } from './runlog.mjs';
import { pageDigest } from './approval.mjs';
import { critiqueAt } from './loop-state.mjs';
import { sameSession, lastAuthorRun } from './judge-self-record.mjs';

/** The command that records a critique the ship gate accepts: run it in a separate terminal or agent session. */
export const critiqueCommand = (pagePath) => `VAWE_AGENT=critic bin/vawe critique ${pagePath}`;

/** The command that records a fresh critique from the author's own terminal: it starts the critic session. It exits 2 when the claude CLI is missing. */
export const critiqueFreshCommand = (pagePath) => `bin/vawe critique ${pagePath} --fresh`;

const WAYS = (page) => `run ${critiqueFreshCommand(page)} (it starts its own session; exit 2 means the claude CLI is missing), or in a separate terminal ${critiqueCommand(page)}`;

/** The reason a final render may not start for want of a fresh review, or null. VAWE_UNATTENDED=1 needs none. Every reason ends with the command to run. */
export function critiqueProblem(pagePath, { root = '.', env = process.env, runs = readRuns(pagePath, root), digest = pageDigest(pagePath) } = {}) {
  if (env.VAWE_UNATTENDED === '1') return null;
  const review = critiqueAt(runs, digest);
  if (review?.judged) return null;
  if (!review) return `no fresh review of the current page (none ran, or the page changed after it): ${WAYS(pagePath)}`;
  if (review.fresh) return null;
  const author = lastAuthorRun(runs);
  if (author && review.records.every((c) => sameSession(c, author))) return `the critique of the current page ran in the session that rendered the draft (a VAWE_AGENT label does not make a new session): ${WAYS(pagePath)}`;
  return null;
}
