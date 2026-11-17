// Runs one bin/vawe verb as a child process and reads its result file (VAWE_RESULT), not its printed text.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ENGINE, WORK } from '../lib/workspace.mjs';

const MAX_OUTPUT = 3000;
const LIMIT_MS = 30 * 60 * 1000;
const running = new Set();

// A verb runs child scripts (see.mjs, ffmpeg); killing bin/vawe alone leaves them running and slowing every later call.
function killGroup(child) {
  try { process.kill(-child.pid, 'SIGTERM'); } catch { /* the group already exited */ }
}

/** Ends every verb still running, with its child scripts: for the server's exit. */
export function killRunning() {
  for (const child of running) killGroup(child);
  running.clear();
}

process.on('exit', killRunning);

/** The result bin/vawe wrote: { ok, verb, reason, next (a step, harness/lib/next-step.mjs), images, files, exitCode }, or null when it wrote none (killed, or died before the end). */
export function readResult(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    if (e.code === 'ENOENT' || e instanceof SyntaxError) return null;
    throw e;
  }
}

/** Runs `bin/vawe <args>` in the workspace: { code, ok, reason, next, images, files, output }. VAWE_AGENT is passed through, and defaults to "mcp" so the run log names the caller. */
export function runVerb(args, { work = WORK, env = process.env } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vawe-result-'));
  const file = path.join(dir, 'result.json');
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(ENGINE, 'bin', 'vawe'), ...args], {
      cwd: work,
      env: { ...env, VAWE_AGENT: env.VAWE_AGENT || 'mcp', VAWE_RESULT: file },
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: true,
    });
    running.add(child);
    let text = '';
    child.stdout.on('data', (d) => { text += d; });
    child.stderr.on('data', (d) => { text += d; });
    const timer = setTimeout(() => killGroup(child), LIMIT_MS);
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      running.delete(child);
      const result = readResult(file);
      fs.rmSync(dir, { recursive: true, force: true });
      resolve({
        code: code ?? 1,
        ok: result?.ok ?? false,
        reason: result ? result.reason : `killed by ${signal ?? 'a signal'} before it wrote a result`,
        next: result?.next ?? null,
        images: result?.images ?? [],
        files: result?.files ?? [],
        output: text.length > MAX_OUTPUT ? `...${text.slice(-MAX_OUTPUT)}` : text,
      });
    });
  });
}
