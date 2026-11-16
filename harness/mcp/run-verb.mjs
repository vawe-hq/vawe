// Runs one bin/vawe verb as a child process and reads what it printed: the footer, the next: line, the image paths.
import { spawn } from 'node:child_process';
import path from 'node:path';
import { ENGINE, WORK } from '../lib/workspace.mjs';
import { imagesIn } from '../lib/verb-log.mjs';

const FOOTER = /^vawe: (\S+) (ok|FAILED)(?: \((.*)\))? in [\d.]+s$/m;
const MAX_OUTPUT = 3000;
const LIMIT_MS = 30 * 60 * 1000;

/** Parses a verb's stdout and stderr: { ok, reason, next, images, output }. Images are absolute paths. */
export function readVerbOutput(text, work = WORK) {
  const footer = FOOTER.exec(text);
  const next = /^next: (.*)$/m.exec(text);
  return {
    ok: footer?.[2] === 'ok',
    reason: footer?.[3] ?? null,
    next: next?.[1] ?? null,
    images: imagesIn(text).map((p) => (path.isAbsolute(p) ? p : path.join(work, p))),
    output: text.length > MAX_OUTPUT ? `...${text.slice(-MAX_OUTPUT)}` : text,
  };
}

/** Runs `bin/vawe <args>` in the workspace. VAWE_AGENT is passed through, and defaults to "mcp" so the run log names the caller. */
export function runVerb(args, { work = WORK, env = process.env } = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(ENGINE, 'bin', 'vawe'), ...args], {
      cwd: work,
      env: { ...env, VAWE_AGENT: env.VAWE_AGENT || 'mcp' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let text = '';
    child.stdout.on('data', (d) => { text += d; });
    child.stderr.on('data', (d) => { text += d; });
    const timer = setTimeout(() => child.kill('SIGTERM'), LIMIT_MS);
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? 1, ...readVerbOutput(text, work) });
    });
  });
}
