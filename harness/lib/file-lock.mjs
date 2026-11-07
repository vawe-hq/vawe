// harness/lib/file-lock.mjs: one holder at a time for a file path. The lock is a file made with an
// exclusive create and holding the owner pid; a lock whose pid is dead is taken back.
import fs from 'node:fs';

const POLL_MS = 50;

const pidAlive = (pid) => {
  try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; }
};

const readOwner = (file) => {
  try { return Number(fs.readFileSync(file, 'utf8')) || null; } catch { return null; }
};

function tryCreate(file) {
  try {
    const fd = fs.openSync(file, 'wx');
    fs.writeSync(fd, String(process.pid));
    fs.closeSync(fd);
    return true;
  } catch (e) { if (e.code !== 'EEXIST') throw e; return false; }
}

/** Removes the lock only while it still names the owner `seen`: another process may have taken the path since it was read. */
function reap(file, seen) {
  if (readOwner(file) === seen) fs.rmSync(file, { force: true });
}

/** Runs `fn` while holding `file`. Waits up to `waitMs` of real time for the holder, then throws. */
export async function withFileLock(file, fn, { waitMs = 30000 } = {}) {
  const t0 = Date.now();
  while (!tryCreate(file)) {
    const owner = readOwner(file);
    if (owner && !pidAlive(owner)) { reap(file, owner); continue; }
    if (Date.now() - t0 > waitMs) throw new Error(`${file} is held by pid ${owner ?? '?'} for more than ${Math.round(waitMs / 1000)}s`);
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
  try { return await fn(); } finally { reap(file, process.pid); }
}
