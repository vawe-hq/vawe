// The tool probe `vawe new` runs for a new film: the doctor, once, when .vawe/doctor.json is missing or old.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const DAY_MS = 24 * 60 * 60 * 1000;
export const PROBE_MAX_AGE_MS = 7 * DAY_MS;

const resultFile = (root) => path.join(root, '.vawe', 'doctor.json');

const DOCTOR_TIMEOUT_MS = 60_000;

/** The checks the doctor last wrote, or null when the file is missing, not a list, or older than PROBE_MAX_AGE_MS. */
export function freshChecks(root, now) {
  try {
    if (now - fs.statSync(resultFile(root)).mtimeMs > PROBE_MAX_AGE_MS) return null;
    const checks = JSON.parse(fs.readFileSync(resultFile(root), 'utf8'));
    return Array.isArray(checks) ? checks : null;
  } catch { return null; }
}

/** The one line for the required tools a render lacks, or null when none is missing. Pure. */
export function missingLine(checks) {
  const lacking = checks.filter((c) => c.required && !c.ok);
  return lacking.length ? `install the missing tool before dev: ${lacking.map((c) => `${c.tool}: ${c.fix}`).join('; ')}` : null;
}

const runDoctor = (root) => spawnSync(process.execPath, [path.join(root, 'harness/dev/doctor.mjs'), '--quiet'], { cwd: root, stdio: 'ignore', timeout: DOCTOR_TIMEOUT_MS });

/**
 * The line to print for a new film, or null when the required tools are there.
 * A clean result is trusted for PROBE_MAX_AGE_MS; a result with a missing tool is probed again. `run` is the doctor call (a test passes a fake).
 * The doctor exits 0 or 1 (1: a required tool is missing); any other exit, or no list in doctor.json, is a probe that did not run.
 */
export function toolProbeLine(root, { now = Date.now(), run = runDoctor } = {}) {
  const known = freshChecks(root, now);
  if (known && !missingLine(known)) return null;
  const result = run(root);
  const checks = freshChecks(root, Date.now());
  if (![0, 1].includes(result?.status) || !checks) return `tool probe could not run (doctor exit ${result?.status ?? result?.signal ?? 'none'}): run bin/vawe-dev doctor`;
  return missingLine(checks);
}
