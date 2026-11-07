// harness/lib/render-slots.mjs: one machine-wide limit on renders running at once, shared by every
// checkout. A slot is a file `<dir>/slot-<i>.json` ({ pid, start, kind, who }) made with an exclusive
// create, so two renders never take the same slot; a slot whose pid is dead is taken back.
// VAWE_RENDER_SLOTS sets how many renders run at once (default 2).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const DEFAULT_SLOTS = 2;
const POLL_MS = 1000;

export const slotDir = (env = process.env) => env.VAWE_RENDER_SLOT_DIR || path.join(os.tmpdir(), 'vawe-render-slots');
export const slotCount = (env = process.env) => (Number(env.VAWE_RENDER_SLOTS) > 0 ? Math.floor(Number(env.VAWE_RENDER_SLOTS)) : DEFAULT_SLOTS);

const pidAlive = (pid) => {
  try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; }
};

function readSlot(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

/** The live slots in `dir`, after removing the ones whose render died. */
export function slotsInUse(dir = slotDir()) {
  if (!fs.existsSync(dir)) return [];
  const live = [];
  for (const name of fs.readdirSync(dir).filter((f) => /^slot-\d+\.json$/.test(f))) {
    const file = path.join(dir, name);
    const slot = readSlot(file);
    if (slot && pidAlive(slot.pid)) live.push({ ...slot, file });
    else if (slot) reapSlot(file, slot);
  }
  return live;
}

/** Removes the slot file only while it still holds the dead render `seen`: another render may have taken the path since it was read. */
export function reapSlot(file, seen) {
  const now = readSlot(file);
  if (now && now.pid === seen.pid && now.start === seen.start) fs.rmSync(file, { force: true });
}

const ageS = (start, now) => Math.max(0, Math.round((now - Date.parse(start)) / 1000)) || 0;
export const whoLine = (slots, now = Date.now()) => slots.map((s) => `${s.who} (${s.kind}, pid ${s.pid}, running ${ageS(s.start, now)}s)`).join(', ');

// A final holds a slot for minutes: it may take only slots 0 to count-2, so the top slot is always free for a draft (a draft, taking the top slot first, waited up to 357 s behind finals on 2026-10-11).
// A slot file is written in two steps (create, then fill); a reader that sees it empty treats it as taken.
function tryTake(dir, count, entry) {
  slotsInUse(dir);
  const order = entry.kind === 'final' ? [...Array(Math.max(1, count - 1)).keys()] : [...Array(count).keys()].reverse();
  for (const i of order) {
    const file = path.join(dir, `slot-${i}.json`);
    try {
      const fd = fs.openSync(file, 'wx');
      fs.writeSync(fd, JSON.stringify(entry));
      fs.closeSync(fd);
      return file;
    } catch (e) { if (e.code !== 'EEXIST') throw e; }
  }
  return null;
}

/**
 * Waits for a free slot, then holds it until release() or process exit. Prints one line when it has to wait.
 * Returns { release, others }: `others` is how many other renders held a slot when this one got its own.
 */
export async function takeRenderSlot({ kind, who }, { env = process.env, log = (l) => console.log(l) } = {}) {
  const dir = slotDir(env);
  const count = slotCount(env);
  fs.mkdirSync(dir, { recursive: true });
  const entry = { pid: process.pid, start: new Date().toISOString(), kind, who };
  let file = tryTake(dir, count, entry);
  if (!file) {
    log(`waiting for a render slot (${count} in use: ${whoLine(slotsInUse(dir))})`);
    while (!(file = tryTake(dir, count, entry))) await new Promise((r) => setTimeout(r, POLL_MS));
  }
  const others = slotsInUse(dir).filter((s) => s.file !== file).length;
  const drop = () => fs.rmSync(file, { force: true });
  process.on('exit', drop);
  return { others, release: () => { process.off('exit', drop); drop(); } };
}
