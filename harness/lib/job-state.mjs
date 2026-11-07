// harness/lib/job-state.mjs: the one owner of how a ship job may change status (harness/media/ship-job.mjs).
export const TERMINAL = ['done', 'failed', 'cancelled'];

const MOVES = {
  starting: ['running', 'cancelled'],
  running: ['judging', 'done', 'failed', 'cancelled'],
  judging: ['done', 'failed'],
};

export const isTerminal = (status) => TERMINAL.includes(status);

/** The job moved to `to` with `patch` applied, or null when the table does not allow the move from its current status. */
export function transition(job, to, patch = {}) {
  return MOVES[job.status]?.includes(to) ? { ...job, ...patch, status: to } : null;
}

/** A live job whose runner process is gone: nothing will ever write its result. */
export const runnerLost = (job, pidAlive) => !isTerminal(job.status) && Boolean(job.pid) && !pidAlive(job.pid);
