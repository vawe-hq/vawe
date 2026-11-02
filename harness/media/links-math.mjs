// Pure parts of `vawe-dev check links`. No I/O and no heavy imports: harness/cli/verbs.mjs loads this file to check the arguments.
import { DEFAULT_BASE } from './shot-math.mjs';

export const DEFAULT_MAX = 400;

/** The first problem in the arguments of links, or null. Pure. */
export function linksProblem({ base, max }) {
  if (base !== undefined && !/^https?:\/\//.test(base)) return `--base is not an http(s) url: "${base}"; usage: bin/vawe-dev check links [--base ${DEFAULT_BASE}] [--from /,/blog] [--max ${DEFAULT_MAX}] [--external]`;
  if (max !== undefined && !(Number.isInteger(max) && max >= 1)) return `--max is not a whole number of pages: "${max}"`;
  return null;
}

/** Every link, asset and id of one html page: { links: href values, assets: src values, ids }. Pure. */
export function extractRefs(html) {
  const values = (re) => [...html.matchAll(re)].map((m) => m[1].replace(/&amp;/g, '&'));
  return {
    links: values(/<a\b[^>]*?\shref=["']([^"']*)["']/gi),
    assets: [...values(/<img\b[^>]*?\ssrc=["']([^"']*)["']/gi), ...values(/<source\b[^>]*?\ssrc=["']([^"']*)["']/gi), ...values(/<link\b[^>]*?\srel=["'](?:stylesheet|icon)["'][^>]*?\shref=["']([^"']*)["']/gi)],
    ids: new Set([...values(/\sid=["']([^"']+)["']/gi), ...values(/<a\b[^>]*?\sname=["']([^"']+)["']/gi)]),
  };
}

/** One reference resolved against its page: { url, hash, external } or null for mailto:, tel:, javascript: and data:. Pure. */
export function resolveRef(ref, pageUrl, base) {
  if (!ref || /^(mailto:|tel:|javascript:|data:|blob:)/i.test(ref)) return null;
  let u;
  try { u = new URL(ref, pageUrl); } catch { return null; }
  if (!/^https?:$/.test(u.protocol)) return null;
  const hash = u.hash.slice(1);
  u.hash = '';
  return { url: u.href, hash, external: u.origin !== new URL(base).origin };
}

/** One word for a response: ok, redirect, or broken, with the reason text. Pure. */
export function verdict({ status, location, error }) {
  if (error) return { kind: 'broken', why: error };
  if (status >= 400) return { kind: 'broken', why: `status ${status}` };
  if (status >= 300) return { kind: 'redirect', why: `${status} to ${location || '(no location)'}` };
  return { kind: 'ok', why: String(status) };
}

/** The report lines: broken first with the pages that link there, then redirects, then a count. Pure. */
export function reportLines({ rows, pages, checked }) {
  const by = (k) => rows.filter((r) => r.kind === k);
  const line = (r) => `  ${r.url}  ${r.why}  <- ${[...r.from].slice(0, 3).join(', ')}${r.from.size > 3 ? `, +${r.from.size - 3} more` : ''}`;
  const out = [];
  if (by('broken').length) out.push(`broken (${by('broken').length}):`, ...by('broken').map(line));
  if (by('redirect').length) out.push(`redirecting (${by('redirect').length}): link to the final url instead`, ...by('redirect').map(line));
  out.push(`${pages} page(s) read, ${checked} distinct link(s) checked, ${by('broken').length} broken, ${by('redirect').length} redirecting`);
  return out;
}
