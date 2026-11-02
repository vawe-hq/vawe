import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const RUN_DIR = /^\d{4}-\d{2}-\d{2}T[\d-]+Z$/;

/** The run directory names to delete: every timestamped name but the newest `keep`. Any other name (latest.json) is never returned. Pure. */
export function oldRuns(names, keep) {
  const runs = names.filter((n) => RUN_DIR.test(n)).sort();
  return runs.slice(0, Math.max(0, runs.length - keep));
}

/** Deletes the old run directories directly under `runsDir`. Returns the names deleted. */
export function pruneRuns(runsDir, keep) {
  const dirs = fs.readdirSync(runsDir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
  const old = oldRuns(dirs, keep);
  for (const name of old) fs.rmSync(path.join(runsDir, name), { recursive: true, force: true });
  return old;
}

/** The pages git tracks: e2e checks the framework, so a person's untracked work-in-progress film is not rendered. Pure given `tracked`. */
export const trackedPages = (pages, tracked) => (tracked === null ? pages : pages.filter((p) => tracked.has(p.split(path.sep).join('/'))));

/** The set of files git tracks under `dirs`, relative to `root`; null when git is missing or fails. */
export function trackedFiles(root, dirs) {
  try { return new Set(execFileSync('git', ['ls-files', '-z', '--', ...dirs], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean)); } catch { return null; }
}
