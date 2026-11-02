// The one place that fetches the free faces: `vawe new` and `vawe-dev moves` call it when a face they need is missing from the gitignored assets/fonts.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { REPO_ROOT } from './render-harness.mjs';

const FACE = /assets\/fonts\/([\w.-]+\.woff2)/g;
const STYLESHEET_HREF = /<link\b[^>]*\bhref=["']([^"':]+\.css)["']/gi;

/** The font file names that the given source texts reference under assets/fonts. */
export const fontFilesIn = (...texts) => [...new Set(texts.flatMap((t) => [...t.matchAll(FACE)].map((m) => m[1])))];

/** The names in `files` that assets/fonts under `root` does not hold. */
export const missingFonts = (root, files) => files.filter((f) => !fs.existsSync(path.join(root, 'assets', 'fonts', f)));

/** Runs generators/media/fonts.mjs when any of `files` is missing; true when it ran. */
export function ensureFonts(root, files, { run = (cmd, args, opts) => spawnSync(cmd, args, opts) } = {}) {
  if (!missingFonts(root, files).length) return false;
  run(process.execPath, [path.join(root, 'generators', 'media', 'fonts.mjs')], { cwd: root, stdio: 'inherit' });
  return true;
}

function pageSources(pagePath) {
  const html = fs.readFileSync(pagePath, 'utf8');
  const sheets = [...html.matchAll(STYLESHEET_HREF)].map((m) => path.resolve(path.dirname(pagePath), m[1])).filter((f) => fs.existsSync(f));
  return [html, ...sheets.map((f) => fs.readFileSync(f, 'utf8'))];
}

/** Fetches the faces a page needs into this checkout, the one that serves assets/ to every page (preview-server.mjs pageMount), when any is missing, after one line saying so; true when the fetch ran. Offline the fetch fails and the render says what is missing. */
export function ensurePageFonts(pagePath, { run, log = console.log } = {}) {
  const root = REPO_ROOT;
  const files = fontFilesIn(...pageSources(pagePath));
  if (!missingFonts(root, files).length) return false;
  log('fonts missing from assets/fonts: fetching them with generators/media/fonts.mjs');
  return ensureFonts(root, files, { run });
}

/** The command to run when the page's faces are missing from this checkout, else ''. */
export function missingFontsLine(root, pagePath) {
  const missing = missingFonts(root, fontFilesIn(...pageSources(pagePath)));
  return missing.length ? `fonts missing from assets/fonts (${missing.join(', ')}): run \`node generators/media/fonts.mjs\`` : '';
}

export const drewNothingHint = (root, pagePath) => missingFontsLine(root, pagePath) || 'check that every font, image and script the page loads exists (a 404 draws nothing)';
