// Pure parts of `vawe-dev land` (harness/dev/land.mjs): conflict detection, the big-file scan and the e2e result line.

export const BIG_FILE_BYTES = 5 * 1024 * 1024;

const CONFLICT = /^(UU|AA|DD|AU|UA|DU|UD) /;

/** The paths git status --porcelain marks as unmerged. */
export const conflictedFiles = (porcelain) => porcelain.split('\n').filter((l) => CONFLICT.test(l)).map((l) => l.slice(3).trim());

/** True when the porcelain status shows an edit to a tracked file (untracked lines are ignored). */
export const hasTrackedEdits = (porcelain) => porcelain.split('\n').some((l) => l.trim() && !l.startsWith('??'));

/** The blobs over `limit` bytes in the output of `git cat-file --batch-check='%(objecttype) %(objectname) %(objectsize) %(rest)'`, each once: [{ path, bytes }]. */
export function bigBlobs(batchCheck, limit = BIG_FILE_BYTES) {
  const seen = new Set();
  const found = [];
  for (const line of batchCheck.split('\n')) {
    const [type, sha, size, ...rest] = line.split(' ');
    if (type !== 'blob' || seen.has(sha) || Number(size) <= limit) continue;
    seen.add(sha);
    found.push({ path: rest.join(' ') || sha, bytes: Number(size) });
  }
  return found;
}

export const megabytes = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

const E2E_LINE = /^[✓✗] e2e (passed|FAILED) in [\d.]+s\s*$/m;

/** The `✓ e2e passed in 4.2s` line of the pre-push output, or null. */
export const e2eLine = (pushOutput) => pushOutput.match(E2E_LINE)?.[0].trim() ?? null;

/** The same line from quality/runs/e2e/latest.json, only when that run was for `sha`; null otherwise. */
export function e2eLineFromReport(report, sha) {
  if (!report || report.sha !== sha) return null;
  return `${report.pass ? '✓' : '✗'} e2e ${report.pass ? 'passed' : 'FAILED'} in ${report.seconds}s`;
}

const KEEP_ALIVE = /ServerAliveInterval/i;

/** The ssh command for the push: the user's own (GIT_SSH_COMMAND, else core.sshCommand), plus a keep-alive unless it already sets one, so the long pre-push does not drop an idle connection. */
export function keepAliveSsh(current, configured = '') {
  const base = current || configured || 'ssh';
  return KEEP_ALIVE.test(base) ? base : `${base} -o ServerAliveInterval=20 -o ServerAliveCountMax=60`;
}

/** What land does with the branch: 'merged' when origin/main already has every commit, 'skip' when the branch already contains origin/main (a rebase would flatten its merges), else 'rebase'. */
export function rebaseDecision({ headInMain, containsMain }) {
  if (headInMain) return 'merged';
  return containsMain ? 'skip' : 'rebase';
}

const GIT_ERROR = /^(error:|fatal:|ssh:|client_loop|packet_write|Connection |Broken pipe|kex_exchange|Permission denied|remote:|hint:| ! \[|pre-push blocked)/i;

/** The last four git and ssh error lines of a failed push, else the last three output lines. The final line alone is the CI status the pre-push hook prints last. */
export function pushErrorText(pushOutput) {
  const lines = pushOutput.split(/\r?\n/).map((l) => l.trimEnd()).filter(Boolean);
  const errors = lines.filter((l) => GIT_ERROR.test(l));
  return (errors.length ? errors.slice(-4) : lines.slice(-3)).join('\n');
}
