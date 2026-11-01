// The tail of `vawe critique`: findings grouped by rule, one block of image paths, one summary.
import fs from 'node:fs';
import path from 'node:path';

const GLYPH = { error: '✗', warn: '~', info: '·' };
const SINGLE_MAX = 3;
const SECONDS_SHOWN = 4;

/** The name of a film from its page or render path: films/<name>/page.html and out/<name>.mp4 both give <name>. */
export function filmKey(input) {
  const base = path.basename(input).replace(/\.[^.]+$/, '');
  return base === 'page' ? path.basename(path.dirname(path.resolve(input))) : base;
}

const countByCode = (records) => {
  const counts = new Map();
  for (const r of records) counts.set(r.code, (counts.get(r.code) || 0) + 1);
  return counts;
};

/** Output lines for findings: a rule with up to 3 findings prints each; a rule with more prints one line with the count, the first seconds and the first fix. */
export function groupFindingLines(records, indent = '  ') {
  const counts = countByCode(records);
  const lines = [];
  for (const [code, n] of counts) {
    const rows = records.filter((r) => r.code === code);
    if (n <= SINGLE_MAX) {
      for (const r of rows) lines.push(`${indent}${GLYPH[r.severity] || '~'} [${code}] ${r.summary}${r.at ? ` (at ${r.at})` : ''}`);
      continue;
    }
    const seconds = rows.map((r) => r.at).filter(Boolean);
    const shown = seconds.slice(0, SECONDS_SHOWN).join(', ');
    const more = seconds.length > SECONDS_SHOWN ? ` and ${seconds.length - SECONDS_SHOWN} more` : '';
    lines.push(`${indent}${GLYPH[rows[0].severity] || '~'} [${code}] ${n} findings${shown ? ` at ${shown}${more}` : ''}; first: ${rows[0].summary}`);
    if (rows[0].fix) lines.push(`${indent}    fix: ${rows[0].fix}`);
  }
  return lines;
}

/** Every .png and .md under `dir` written at or after `sinceMs`, sorted. Empty when `dir` does not exist. */
export function freshImages(dir, sinceMs) {
  if (!fs.existsSync(dir)) return [];
  const found = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) found.push(...freshImages(p, sinceMs));
    else if (/\.(png|md)$/.test(e.name) && fs.statSync(p).mtimeMs >= sinceMs) found.push(p);
  }
  return found.sort();
}

export const MAX_CUT_STRIPS = 8;

/** The pngs of `dir` written at or after the draft `mp4`, sorted and capped at `cap`. Empty when the draft is missing. */
export function pngsSince(dir, mp4, cap = MAX_CUT_STRIPS) {
  if (!mp4 || !fs.existsSync(mp4)) return [];
  const since = fs.statSync(mp4).mtimeMs;
  return freshImages(dir, since).filter((f) => f.endsWith('.png')).slice(0, cap);
}

export function summaryLines(records, images) {
  const counts = [...countByCode(records)].map(([code, n]) => `${code} ${n}`);
  const lines = ['', records.length ? `summary: ${records.length} finding(s): ${counts.join(', ')}` : 'summary: no findings'];
  if (images.length) lines.push('images to Read (full size):', ...images.map((p) => `  ${p}`));
  else lines.push('no images were written by this run');
  return lines;
}
