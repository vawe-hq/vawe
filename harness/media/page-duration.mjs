// harness/media/page-duration.mjs: the one owner of a page's length. <meta name="duration"> is a number of seconds, or "auto":
// the last move's end plus a hold. Every reader asks resolveDuration; none parses the meta itself.
import fs from 'node:fs';
import path from 'node:path';
import { metaOf } from '../lib/page-meta.mjs';
import { HOLD_RULE, lineNeed } from '../lib/read-hold.mjs';
import { pageDigest } from '../lib/approval.mjs';

// A draft renders at 30 fps and a final at 60: a length on the 1/30 s grid is a whole number of frames in both.
const GRID_FPS = 30;

const ADD_NUMBER = 'add <meta name="duration" content="N"> (N in seconds)';

export class DurationError extends Error {
  fix = ADD_NUMBER;
}

/** The page's own length text: a number of seconds, 'auto', or null when the page has none. Pure. */
export function statedLength(html) {
  const text = metaOf(html, 'duration')?.trim();
  if (text == null) return null;
  return text === 'auto' ? 'auto' : Number(text);
}

/** Auto length from the last move's end, the read time of the longest line of the last world, and a floor hold. Pure. */
export function autoLength({ endS, lastWorldWords }) {
  const holdS = Math.max(HOLD_RULE.floor, ...lastWorldWords.map(lineNeed));
  const seconds = Math.ceil((endS + holdS) * GRID_FPS - 1e-6) / GRID_FPS;
  return { seconds, endS, holdS };
}

// Runs in the page: the end of the last finite animation, whether a frame hook or window.seek can add motion later, and the word count of each text leaf in the last world.
function readPageEnd() {
  const { endS, infinite } = window.vawe.animationEnd();
  const world = [...document.querySelectorAll('[data-world]')].at(-1);
  const leaves = world ? [...world.querySelectorAll('*')].filter((el) => !el.closest('[aria-hidden="true"]') && !el.children.length && el.textContent.trim()) : [];
  const late = typeof window.seek === 'function' || (window.__vaweFrameHooks || []).length > 0;
  return { endS, infinite, late, lastWorldWords: leaves.map((el) => el.textContent.split(/\s+/).filter(Boolean).length) };
}

/**
 * { seconds, auto, endS?, holdS?, ignoredInfinite? } of a loaded, settled page (openPage, then settle). A stated number is returned as written.
 * Throws DurationError for an auto page with no finite animation: it drives time through window.seek alone, so only a number can say its length.
 */
export async function lengthOfOpenPage(page, pagePath) {
  const stated = statedLength(fs.readFileSync(pagePath, 'utf8'));
  if (typeof stated === 'number') return { seconds: stated || 0, auto: false };
  const read = await page.evaluate(readPageEnd);
  if (stated === null) return { seconds: read.endS, auto: false };
  if (read.late) {
    throw new DurationError(`${pagePath}: auto needs every animation to exist at load; state a number: ${ADD_NUMBER}`);
  }
  if (!(read.endS > 0)) {
    throw new DurationError(`${pagePath}: duration is auto but no animation ends (a page driven by window.seek alone has no end to find): state a number: ${ADD_NUMBER}`);
  }
  return { ...autoLength(read), auto: true, ignoredInfinite: read.infinite };
}

const found = new Map();

/**
 * The length of a page as an object, see lengthOfOpenPage. A stated number needs no browser. An auto page is measured at `frame` (the aspect
 * the render uses, default the page's own), once per version of the page and the files it references; a render passes the number on in frame.duration.
 */
export async function resolveLength(pagePath, frame = null) {
  const file = path.resolve(pagePath);
  const stated = statedLength(fs.readFileSync(file, 'utf8'));
  if (typeof stated === 'number') return { seconds: stated || 0, auto: false };
  const { resolveFrame } = await import('./render-page.mjs');
  const at = resolveFrame(file, { aspect: frame?.aspect });
  const key = `${file}:${pageDigest(file)}:${at.width}x${at.height}`;
  if (!found.has(key)) found.set(key, measure(file, at));
  return found.get(key);
}

/** The length the engine hands an auto page as window.vawe.duration, so animations sized to the film span it; undefined for a page that states a number. */
export async function autoDuration(pagePath, frame = null) {
  if (statedLength(fs.readFileSync(pagePath, 'utf8')) !== 'auto') return undefined;
  return (await resolveLength(pagePath, frame)).seconds;
}

async function measure(file, frame) {
  const { openPage, gotoLoaded, settle } = await import('./render-page.mjs');
  const { page, url, close } = await openPage(file, frame, { final: false, measure: true });
  try {
    await gotoLoaded(page, url, file);
    await settle(page);
    return await lengthOfOpenPage(page, file);
  } finally { await close(); }
}

/** The length of a page in seconds: the number it states, or the auto length. 0 when the page has none. */
export async function resolveDuration(pagePath) {
  return (await resolveLength(pagePath)).seconds;
}

/** The html with its duration meta set to `seconds`. Pure. */
export function lockLength(html, seconds) {
  const tag = html.match(/<meta\b[^>]*\bname\s*=\s*["']duration["'][^>]*>/i)?.[0];
  if (!tag) throw new DurationError('the page has no <meta name="duration"> to lock');
  return html.replace(tag, tag.replace(/(\bcontent\s*=\s*["'])[^"']*/i, `$1${+seconds.toFixed(3)}`));
}

/** Writes the found length of an auto page into its meta, so a cut to music can fix it. Returns the line to print. */
export function lockPageLength(pagePath, length) {
  if (!length.auto) return `${pagePath}: the length is already a number, nothing to lock`;
  fs.writeFileSync(pagePath, lockLength(fs.readFileSync(pagePath, 'utf8'), length.seconds));
  return `${pagePath}: duration locked at ${+length.seconds.toFixed(3)} s`;
}
