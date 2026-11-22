// `vawe check <name> [args]`: runs one gate. A gate is a script in quality/gates/, named by its
// file name; the args after the name go to the script unchanged (a page path, --json, --stamp).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { closest } from '../cli/parse.mjs';
import { isMain } from './is-main.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const GATE_DIR = 'quality/gates';

// Files in quality/gates/ that other tools import or run under their own verb; they are not gates.
const NOT_GATES = new Set(['compare', 'judge', 'rubric']);

// Names that differ from the file, and the scripts that live outside quality/gates/.
const ALIASES = {
  'no-emdash': 'harness/dev/no-emdash.mjs',
  'provenance': `${GATE_DIR}/threshold-provenance.mjs`,
  'review': 'harness/media/review.mjs',
  'coverage': 'harness/media/coverage.mjs',
  'links': 'harness/media/links.mjs',
};

const discovered = fs.readdirSync(path.join(ROOT, GATE_DIR))
  .filter((f) => f.endsWith('.mjs') && !NOT_GATES.has(f.slice(0, -4)))
  .map((f) => [f.slice(0, -4), `${GATE_DIR}/${f}`]);

export const GATES = Object.fromEntries([...discovered, ...Object.entries(ALIASES)].sort(([a], [b]) => a.localeCompare(b)));

export function run(name, args = []) {
  const script = GATES[name];
  if (!script) {
    const guess = closest(name, Object.keys(GATES));
    console.error(`vawe check: unknown gate ${name}; valid: ${Object.keys(GATES).join(' ')}${guess ? `; did you mean ${guess}?` : ''}`);
    return 2;
  }
  // Node's default 1 MiB capture limit killed gates with long output and hid the cause.
  const r = spawnSync(process.execPath, [path.join(ROOT, script), ...args], { encoding: 'utf8', cwd: ROOT, maxBuffer: 256 * 1024 * 1024 });
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  const status = r.status ?? 1;
  if (!args.includes('--json')) {
    const failing = `${r.stdout || ''}${r.stderr || ''}`.split('\n').filter((l) => l.includes('✗'));
    (status === 0 ? console.log : console.error)(status === 0
      ? `✓ ${name}: passed`
      : `✗ ${name}: ${failing.length || 1} failed: ${(failing[0] || (r.error ? `could not run: ${r.error.message}` : `exited ${status}`)).trim()}`);
  }
  return status;
}

if (isMain(import.meta.url)) {
  const [name, ...args] = process.argv.slice(2);
  if (!name) {
    console.log(`gates: ${Object.keys(GATES).join(' ')}`);
    process.exit(0);
  }
  process.exit(run(name, args));
}
