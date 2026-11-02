// Pure parts of `vawe new --from-url`. No I/O and no heavy imports: harness/cli/verbs.mjs loads this file to check the arguments.
import path from 'node:path';

export const DEFAULT_WIDTHS = [1440, 390];
export const DEFAULT_BASE = 'http://localhost:3080';
const USAGE = 'usage: bin/vawe new [name] --from-url <route|url|page.html>[,more] [--w 1440,390] [--full] [--base http://localhost:3080] [--tour steps.json --fps 60]';

/** The widths of `--w`, in order, or null when the text is not a comma list of widths from 200 to 4000. Pure. */
export function parseWidths(text) {
  const list = String(text).split(',').map((s) => Number(s.trim()));
  return list.length && list.every((w) => Number.isInteger(w) && w >= 200 && w <= 4000) ? list : null;
}

/** The targets of the positional argument: a comma list of routes, urls and html files. Pure. */
export const parseTargets = (text) => String(text || '').split(',').map((s) => s.trim()).filter(Boolean);

/** The first problem in the arguments of shot, or null. Pure. */
export function shotProblem({ targets, w, base, tour, fps, scale }) {
  if (!targets.length) return `missing <route|url|page.html>; ${USAGE}`;
  if (w !== undefined && !parseWidths(w)) return `--w is not a comma list of widths from 200 to 4000: "${w}"`;
  if (base !== undefined && !/^https?:\/\//.test(base)) return `--base is not an http(s) url: "${base}"`;
  if (tour !== undefined && targets.length !== 1) return '--tour takes one route, url or html file, not a list';
  if (fps !== undefined && !(Number.isInteger(fps) && fps >= 1 && fps <= 120)) return `--fps is not a whole number from 1 to 120: "${fps}"`;
  if (scale !== undefined && !(scale >= 1 && scale <= 4)) return `--scale is not a number from 1 to 4: "${scale}"`;
  const bare = targets.find((t) => !/^https?:\/\//.test(t) && !t.startsWith('/') && !t.endsWith('.html'));
  if (bare) return `"${bare}" is not a route (/blog), a url (https://...) or a .html file; ${USAGE}`;
  return null;
}

/** What a target opens: { kind: 'file', file } for an html file, else { kind: 'url', url } joined onto the base. Pure. */
export function resolveTarget(target, base) {
  if (/^https?:\/\//.test(target)) return { kind: 'url', url: target };
  if (target.endsWith('.html')) return { kind: 'file', file: target };
  return { kind: 'url', url: new URL(target, base).href };
}

/** The PNG name for one target at one width: /blog/x at 390 is blog-x-390.png, / is home-390.png, /blog?view=list is blog-view-list-390.png. Pure. */
export function shotName(target, width) {
  const t = resolveTarget(target, 'http://x');
  const raw = t.kind === 'file' ? path.basename(path.dirname(path.resolve(t.file))) + '-' + path.basename(t.file, '.html') : (({ pathname, search }) => pathname + search)(new URL(t.url));
  const slug = raw.replace(/^\/+|\/+$/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'home';
  return `${slug}-${width}.png`;
}

/** A phone width gets a phone-height viewport. Pure. */
export const viewportHeight = (width) => (width <= 500 ? 844 : 900);

/** Why a navigation did not load the page asked for, or null: an HTTP error status, or Chrome's own error page. Pure. */
export function navigationProblem({ url, status, finalUrl }) {
  if (status >= 400) return `${url} answered HTTP ${status}`;
  if (finalUrl.startsWith('chrome-error:')) return `Chrome showed an error page for ${url}`;
  return null;
}

export const PROBLEM_LINES_MAX = 10;

/** The lines that name each failed request and console error of one shot, the first `max` of each kind and "and N more". Pure. */
export function problemLines({ errors, failed }, max = PROBLEM_LINES_MAX) {
  const list = (label, items) => [...items.slice(0, max).map((i) => `  ${label}: ${i}`), ...(items.length > max ? [`  and ${items.length - max} more ${label}s`] : [])];
  return [...list('failed request', failed), ...list('console error', errors)];
}

// Chrome logs "Failed to load resource" for every 404, and the failed-request line already names the URL. A page without a favicon always misses /favicon.ico.
export const isRequestNoise = (text) => /^Failed to load resource/.test(text);
export const isFaviconUrl = (url) => /\/favicon\.ico(\?|$)/.test(url);
