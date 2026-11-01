// The one owner of "ask a separate headless claude session, Read tool only": judge-fresh.mjs and critic-fresh.mjs both call it.
import { spawnSync } from 'node:child_process';

export class FreshSessionError extends Error {
  constructor(message, exitCode = 1) {
    super(message);
    this.exitCode = exitCode;
  }
}

const MISSING = 'the claude CLI is not installed. Install it: npm install -g @anthropic-ai/claude-code';

/** Throws FreshSessionError (exitCode 2) when the claude CLI is not installed. */
export function requireClaude() {
  if (spawnSync('claude', ['--version'], { encoding: 'utf8' }).error) throw new FreshSessionError(MISSING, 2);
}

/** Runs `prompt` in a fresh session that may only Read under `dirs`; returns { text, costUsd }. `model` is passed only when given. */
export function runFreshSession({ prompt, dirs, cwd, timeoutS, model = null, name = 'fresh' }) {
  const args = ['-p', '--output-format', 'json', '--tools', 'Read', '--allowedTools', 'Read', '--no-session-persistence', '--disable-slash-commands', ...(model ? ['--model', model] : []), '--add-dir', ...dirs];
  const r = spawnSync('claude', args, { input: prompt, encoding: 'utf8', cwd, timeout: timeoutS * 1000, maxBuffer: 1 << 26 });
  if (r.error?.code === 'ENOENT') throw new FreshSessionError(MISSING, 2);
  if (r.error) throw new FreshSessionError(`the ${name} session failed: ${r.error.message}`);
  let envelope;
  try { envelope = JSON.parse(r.stdout); } catch { throw new FreshSessionError(`the ${name} session gave no JSON: ${String(r.stderr || r.stdout).slice(0, 300)}`); }
  return { text: String(envelope.result ?? ''), costUsd: envelope.total_cost_usd ?? null };
}
