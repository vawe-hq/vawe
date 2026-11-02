// Variety across films: the signatures of the last films, the dial values none of them used, and a
// push-away line for a value that repeats. Pure except `recentFromDisk`; the dial values come from the
// rule that owns each dial (tests/lib/variety.test.mjs checks they stay inside its range text).
import fs from 'node:fs';
import path from 'node:path';
import { DIALS, parseSignature } from '../../core/motion/signature.js';
import { BANDS, EASE_HANDLES } from '../../core/motion/presets.js';
import { readAllRuns } from './runlog.mjs';
import { table } from './runs-report.mjs';

export const RECENT_FILMS = 6;
export const REPEAT_AT = 3;
export const BRAND_DIALS = ['palette'];

export const DIAL_VALUES = {
  band: Object.keys(BANDS),
  ease: Object.keys(EASE_HANDLES),
  seam: ['soft', 'motion', 'shape', 'spatial'],
  palette: ['warm neutral', 'cool neutral', 'saturated', 'mono', 'duotone'],
  thread: ['object', 'type', 'colour', 'rhythm'],
};

const EXACT = new Set(['band', 'ease']);

/** The vocabulary values a chosen value names (a free-text palette or thread may name two), else the value itself. Pure. */
export function valueKeys(dial, value) {
  const v = String(value).trim().toLowerCase();
  const vocab = DIAL_VALUES[dial] ?? [];
  const hits = vocab.filter((w) => (EXACT.has(dial) ? w.toLowerCase() === v : v.includes(w.toLowerCase())));
  return hits.length ? hits : [v];
}

const BRAND_WORDS = /#[0-9a-f]{3,8}\b|\bbrand[- ]?(?:colou?rs?|kit|palette|fonts?|typeface)\b|\b(?:fonts?|typeface)\b/i;

/** True when the ask names brand colours (a hex value, "brand colours") or fonts. Pure. */
export const namesBrandKit = (text) => BRAND_WORDS.test(String(text ?? ''));

/** { at, signature } of a film's newest dev event that holds a signature, else of its page meta (`readMeta(film)` gives the meta content or null), else null. */
export function declaredSignature(film, runs, readMeta) {
  const ordered = [...runs].sort((a, b) => String(a.at).localeCompare(String(b.at)));
  const dev = ordered.findLast((r) => r.cmd === 'dev' && r.signature && Object.keys(r.signature).length);
  if (dev) return { at: dev.at, signature: dev.signature };
  const signature = parseSignature(readMeta(film));
  return Object.keys(signature).length ? { at: ordered.at(-1)?.at ?? '', signature } : null;
}

/** [{ film, at, signature }] of the newest films that declared a signature, newest first. */
export function recentSignatures(films, readMeta, { limit = RECENT_FILMS, skip = null } = {}) {
  const found = films.filter((f) => f.film !== skip).map(({ film, runs }) => {
    const declared = declaredSignature(film, runs, readMeta);
    return declared ? { film, ...declared } : null;
  }).filter(Boolean);
  return found.sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, limit);
}

/** One row per film, one column per dial. */
export const signatureTable = (sigs) => table([['film', ...DIALS], ...sigs.map((s) => [s.film, ...DIALS.map((d) => s.signature[d] ?? '-')])]);

const usedKeys = (sigs, dial) => new Set(sigs.flatMap((s) => (s.signature[dial] ? valueKeys(dial, s.signature[dial]) : [])));

/** { dial: [values no film used] } for the dials with a closed list, except `exempt` dials; empty when no film is known. Pure. */
export function unusedByDial(sigs, exempt = []) {
  if (!sigs.length) return {};
  const out = {};
  for (const [dial, vocab] of Object.entries(DIAL_VALUES)) {
    if (exempt.includes(dial)) continue;
    const used = usedKeys(sigs, dial);
    const open = vocab.filter((w) => !used.has(w));
    if (open.length) out[dial] = open;
  }
  return out;
}

export const unusedLine = (unused) => {
  const parts = Object.entries(unused).map(([dial, values]) => `${dial} ${values.join(', ')}`);
  return parts.length ? `unused so far: ${parts.join('; ')}` : null;
};

/** One advice line for each value that REPEAT_AT or more of the films share. Pure. */
export function repeatAdvice(sigs, exempt = []) {
  const lines = [];
  for (const dial of DIALS.filter((d) => !exempt.includes(d))) {
    const counts = new Map();
    for (const s of sigs) if (s.signature[dial]) for (const k of valueKeys(dial, s.signature[dial])) counts.set(k, (counts.get(k) ?? 0) + 1);
    for (const [key, n] of counts) if (n >= REPEAT_AT) lines.push(`advice: ${dial} ${key} in ${n} of the last ${sigs.length} films; push away from it unless the brief needs it`);
  }
  return lines;
}

const HISTORY_ONLY = 'these count past films, not this ask: choose the dials for this direction in <meta name="signature"> (ranges: brief.md, ## Signature)';

/** What `vawe new` shows and the brief block uses: { lines, unused, exempt }. Nothing to show when no film has declared a signature. */
export function varietyFor(sigs, brand) {
  const exempt = brand ? BRAND_DIALS : [];
  if (!sigs.length) return { lines: [], unused: {}, exempt };
  const unused = unusedByDial(sigs, exempt);
  const brandLine = brand ? [`brand kit: the brief names brand colours or fonts, so ${exempt.join(', ')} is not varied`] : [];
  return { lines: [`signatures of the last ${sigs.length} films:`, ...signatureTable(sigs), ...[unusedLine(unused)].filter(Boolean), ...brandLine, ...repeatAdvice(sigs, exempt), HISTORY_ONLY], unused, exempt };
}

/** (film) => the signature meta content of <root>/films/<film>/page.html, or null. */
export const metaReader = (root) => (film) => {
  try { return fs.readFileSync(path.join(root, 'films', film, 'page.html'), 'utf8').match(/<meta\s+name="signature"\s+content="([^"]*)"/)?.[1] ?? null; } catch { return null; }
};

/** The recent signatures of the films under `root` (out/ for the logs, films/ for the page meta), without film `skip`. */
export function recentFromDisk(root, skip) {
  return recentSignatures(readAllRuns(path.join(root, 'out')), metaReader(root), { skip });
}
