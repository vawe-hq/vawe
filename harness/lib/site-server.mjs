// The site server that `vawe new --from-url` and `vawe-dev check links` need: reuse a running one, or start `next dev` of the vawe.dev site for a localhost base and stop it afterwards.
// The site lives in vawe-hq/vawe-site: a sibling checkout at ../vawe-site, or the folder in VAWE_SITE_DIR.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { REPO_ROOT } from './render-harness.mjs';
import { scratch } from './scratch.mjs';
import { withFileLock } from './file-lock.mjs';

const VENDOR_ASSETS = path.join('scripts', 'site', 'vendor-assets.mjs');
const SERVER_START_MS = 180000;
const LOCK_WAIT_MS = 600000;

export async function reachable(url) {
  try { await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(3000) }); return true; } catch { return false; }
}

/** The vawe-hq/vawe-site checkout, or null when there is none. */
export const siteDir = () => {
  const dir = path.resolve(process.env.VAWE_SITE_DIR || path.join(REPO_ROOT, '..', 'vawe-site'));
  return fs.existsSync(path.join(dir, 'site', 'package.json')) ? dir : null;
};

const isLocal = (base) => /^https?:\/\/(localhost|127\.0\.0\.1)\b/.test(base);

/**
 * Starts `next dev` of the site checkout on the base's port and waits for it; returns a stop function. The caller owns the child.
 * Not `npm run dev`: its predev rewrites tracked files (site/lib/lastmod.json), which would dirty the site checkout.
 * Only vendor-assets runs, because the fonts and copies it writes are ignored and the pages need them.
 */
async function startSite(base) {
  const dir = siteDir();
  if (!dir) throw new Error('the vawe.dev site is not here: clone vawe-hq/vawe-site next to this repo (../vawe-site), set VAWE_SITE_DIR, or pass --base https://vawe.dev');
  const port = new URL(base).port || '80';
  const logFile = scratch('site-server', `dev-${port}.log`);
  const log = fs.openSync(logFile, 'w');
  const vendor = spawnSync('node', [VENDOR_ASSETS], { cwd: dir, encoding: 'utf8' });
  if (vendor.status !== 0) throw new Error(`${VENDOR_ASSETS} failed: ${vendor.stderr || vendor.stdout}`);
  const next = path.join(dir, 'site', 'node_modules', 'next', 'dist', 'bin', 'next');
  if (!fs.existsSync(next)) throw new Error('next is not installed in the site checkout: run npm ci in its site/ folder');
  const child = spawn('node', [next, 'dev', '-p', port], { cwd: path.join(dir, 'site'), detached: true, windowsHide: true, stdio: ['ignore', log, log] });
  const stop = () => { try { process.kill(-child.pid, 'SIGTERM'); } catch { /* already gone */ } };
  process.on('exit', stop);
  const t0 = Date.now();
  while (Date.now() - t0 < SERVER_START_MS && child.exitCode === null) {
    if (await reachable(base)) return stop;
    await new Promise((r) => setTimeout(r, 1000));
  }
  stop();
  throw new Error(`the site server did not answer on ${base}; its log: ${logFile}`);
}

async function run(base, fn, start) {
  let stop = null;
  if (!(await reachable(base))) {
    if (!isLocal(base)) throw new Error(`${base} does not answer`);
    console.log(`starting the site server on ${base} (it is stopped when this verb ends)`);
    stop = await start(base);
  }
  try { return await fn(); } finally { stop?.(); }
}

/**
 * Runs `fn` with the site at `base` answering. A server this call started is stopped when `fn` ends.
 * A local base is held by a lock for the whole call: a second caller waits until the first has stopped its server, then starts its own.
 * The lock is in the OS temp dir, not scratch(): scratch differs per agent, and the port is shared by the whole machine.
 */
export async function withSite(base, fn, { start = startSite, lockDir = os.tmpdir() } = {}) {
  if (!isLocal(base)) return run(base, fn, start);
  const lock = path.join(lockDir, `vawe-site-server-${new URL(base).port || '80'}.lock`);
  return withFileLock(lock, () => run(base, fn, start), { waitMs: LOCK_WAIT_MS });
}
