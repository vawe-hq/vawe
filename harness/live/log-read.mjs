#!/usr/bin/env node
// PostToolUse hook for Read: logs an image the agent opened, wherever it lies, to the film's runs.jsonl (_unfiled when the path names no film),
// so `vawe-dev runs` can say which images were looked at. Settings: matcher "Read", command "node harness/live/log-read.mjs".
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { appendRun, filmKeyOf } from '../lib/runlog.mjs';
import { UNFILED } from '../lib/verb-log.mjs';

const IMAGE = /\.(png|jpe?g|webp)$/i;
const TOOL_FOLDERS = new Set(['strip', 'onion', 'zoom', 'velocity', 'see', 'look', 'compare']);

/** The film an image belongs to: out/<film>-frames/x.png, out/strip/<film>/grid.png, out/<film>-draft.png; UNFILED when the path says none. */
export function filmOfImage(file, root) {
  const parts = path.relative(root, file).split(path.sep);
  if (parts[0] !== 'out' || parts.length < 3) return UNFILED;
  const name = TOOL_FOLDERS.has(parts[1]) && parts.length > 3 ? parts[2] : parts[1];
  return filmKeyOf(name.replace(/-frames$/, '').replace(/-sheet$/, ''));
}

/** The checkout an image belongs to: the path before its last /out/ when that is a vawe checkout, else the checkout that holds this hook (a worktree's image is logged in the worktree, not where the hook runs). */
export function rootOfImage(file, fallback) {
  const at = file.lastIndexOf(`${path.sep}out${path.sep}`);
  return at > 0 && fs.existsSync(path.join(file.slice(0, at), 'bin', 'vawe')) ? file.slice(0, at) : fallback;
}

/** The vawe checkout that holds `dir` (the session's cwd, which names the worktree the hook's own path may not), or null. */
export function checkoutOf(dir) {
  for (let d = typeof dir === 'string' && path.isAbsolute(dir) ? dir : null; d; d = path.dirname(d) === d ? null : path.dirname(d)) {
    if (fs.existsSync(path.join(d, 'bin', 'vawe'))) return d;
  }
  return null;
}

function main() {
  let input = '';
  process.stdin.on('data', (d) => { input += d; });
  process.stdin.on('end', () => {
    try {
      const event = JSON.parse(input);
      const file = event.tool_input?.file_path;
      if (!file || !IMAGE.test(file)) return;
      const hookRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
      const root = rootOfImage(file, checkoutOf(event.cwd) ?? hookRoot);
      appendRun(filmOfImage(file, root), { cmd: 'read', image: file }, { root });
    } catch { /* a hook never fails the tool call */ }
  });
}

if (import.meta.url === `file://${process.argv[1]}`) main();
