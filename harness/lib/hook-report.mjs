import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DATA_DIR = process.env.VAWE_HOOK_DATA_DIR || path.join(ROOT, '.vawe-data');
const REPORT_DIR = path.join(DATA_DIR, 'hook-reports');
const STATE = path.join(DATA_DIR, 'hook-report-state.json');
const HEAD_LINES = 5;

function readState() {
  try { return JSON.parse(fs.readFileSync(STATE, 'utf8')); } catch { return {}; }
}

function writeState(s) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(STATE, JSON.stringify(s));
}

/**
 * summarize(hook, rel, full) -> the text to print. Never empty.
 *
 * hook: the hook's own short name ("code-quality", "scene-live", ...), used as the report subfolder
 *   and half the dedupe key.
 * rel:  the file the finding is about, repo-relative, the other half of the dedupe key.
 * full: the complete message exactly as the hook used to print it to stderr.
 *
 * VAWE_HOOK_FULL=1 returns `full` unchanged and skips the dedupe check entirely, so the old,
 * un-shortened behaviour stays reachable for an A/B comparison.
 */
export function summarize(hook, rel, full) {
  if (process.env.VAWE_HOOK_FULL) return full;

  const hash = crypto.createHash('sha1').update(full).digest('hex').slice(0, 12);
  const key = `${hook}::${rel}`;
  const state = readState();
  const reportPath = path.join(REPORT_DIR, hook, `${rel.replace(/[/\\]/g, '__')}.txt`);
  const relReport = path.relative(ROOT, reportPath);
  const lines = full.split('\n').filter((l) => l.trim());
  if (state[key] === hash) return `${hook}: unchanged since the last edit to ${rel} (${lines.length} line(s)). Full text: ${relReport}`;
  state[key] = hash;
  writeState(state);

  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, full);

  const head = lines.slice(0, HEAD_LINES);
  const rest = lines.length - head.length;
  const tail = rest > 0 ? [`  … ${rest} more line(s). Full text: ${relReport}`] : [`  Full text: ${relReport}`];
  return [...head, ...tail, '  (VAWE_HOOK_FULL=1 prints findings in full instead of writing this file)'].join('\n');
}
