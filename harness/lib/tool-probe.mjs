// The tool probe `vawe new` runs for a new film: the doctor, once, when .vawe/doctor.json is missing or old.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const DAY_MS = 24 * 60 * 60 * 1000;
export const PROBE_MAX_AGE_MS = 7 * DAY_MS;

const resultFile = (root) => path.join(root, '.vawe', 'doctor.json');

/** The checks the doctor last wrote, or null when the file is missing or older than PROBE_MAX_AGE_MS. */
export function freshChecks(root, now) {
  try {
    if (now - fs.statSync(resultFile(root)).mtimeMs > PROBE_MAX_AGE_MS) return null;
    return JSON.parse(fs.readFileSync(resultFile(root), 'utf8'));
  } catch { return null; }
}

/** The one line for the required tools a render lacks, or null when none is missing. Pure. */
export function missingLine(checks) {
  const lacking = checks.filter((c) => c.required && !c.ok);
  return lacking.length ? `install the missing tool before dev: ${lacking.map((c) => `${c.tool}: ${c.fix}`).join('; ')}` : null;
}

const runDoctor = (root) => spawnSync(process.execPath, [path.join(root, 'harness/dev/doctor.mjs'), '--quiet'], { cwd: root, stdio: 'ignore' });

/** The line to print for a new film: null when the tools are there, or when the probe is fresh and clean. `run` is the doctor call (a test passes a fake). */
export function toolProbeLine(root, { now = Date.now(), run = runDoctor } = {}) {
  const known = freshChecks(root, now);
  if (known) return missingLine(known);
  run(root);
  return missingLine(freshChecks(root, Date.now()) ?? []);
}
