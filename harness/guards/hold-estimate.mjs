// A read-hold finding at write time (taste/rules/readable-hold.md): a beat shorter than the time its longest line needs. The beat's
// window comes from the page's own `--beat-N` properties and the duration meta; the entrance is not counted, so a finding here is a miss
// the render would also report. It advises with the length that would fit; it never refuses.
import { lineNeed } from '../lib/read-hold.mjs';
import { metaOf } from '../lib/page-meta.mjs';
import { beatsOf } from './beat-topics.mjs';

const PASS = 0.9; // the render check passes a line at this share of its read time (harness/lib/read-hold.mjs)
const LINE = /<(h[1-6]|p|li|blockquote|figcaption)\b([^>]*)>([\s\S]*?)<\/\1>/gi;
const SKIP = /\b(?:aria-hidden\s*=\s*["']true|data-chrome|data-texture|data-ui)\b/i;
const INLINE = /<\/?(?:span|b|i|em|strong|a|small|mark|u|sub|sup|abbr|code)\b[^>]*>/gi;
const ENTITY = { '&amp;': '&', '&nbsp;': ' ', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" };

const textOf = (inner) => inner.replace(INLINE, '').replace(/<[^>]*>/g, ' ').replace(/&[a-z#0-9]+;/gi, (e) => ENTITY[e] ?? ' ').replace(/\s+/g, ' ').trim();
const wordsOf = (text) => text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w));

function beatTimes(html) {
  const times = new Map();
  for (const m of html.matchAll(/--beat-(\d+)\s*:\s*([\d.]+)\s*(ms|s)\b/g)) times.set(Number(m[1]), Number(m[2]) / (m[3] === 'ms' ? 1000 : 1));
  return times;
}

/** [{ id, from, to }] for each world whose start and end the page names; the first starts at 0, the last ends at the duration. */
function windows(html, ids) {
  const times = beatTimes(html);
  const duration = Number(metaOf(html, 'duration'));
  return ids.map((id, i) => ({ id, from: i === 0 ? 0 : times.get(i + 1), to: i + 1 < ids.length ? times.get(i + 2) : duration }))
    .filter((w) => Number.isFinite(w.from) && Number.isFinite(w.to) && w.to > w.from);
}

const longestLine = (beat) => [...beat.matchAll(LINE)].filter((m) => !SKIP.test(m[2]))
  .map((m) => ({ text: textOf(m[3]), n: wordsOf(textOf(m[3])).length }))
  .reduce((best, l) => (l.n && (!best || lineNeed(l.n) > lineNeed(best.n) || (lineNeed(l.n) === lineNeed(best.n) && l.n > best.n)) ? l : best), null);

const fittingWords = (hold) => { let n = 0; while (lineNeed(n + 1) * PASS <= hold) n++; return n; };
const lineAt = (html, index) => html.slice(0, index).split('\n').length;

/** Findings { code: 'read-hold', severity: 'advise', line, message, fix } for each beat shorter than its longest line needs. Pure over html. */
export function holdFindings(html) {
  const beats = beatsOf(html);
  const out = [];
  for (const w of windows(html, Object.keys(beats))) {
    const line = longestLine(beats[w.id]);
    if (!line) continue;
    const need = lineNeed(line.n);
    const hold = w.to - w.from;
    if (hold >= need * PASS) continue;
    const fits = fittingWords(hold);
    const cut = fits > 0 ? `, or cut the line to ${fits} word${fits === 1 ? '' : 's'}` : '';
    out.push({
      code: 'read-hold', severity: 'advise', line: lineAt(html, html.indexOf(beats[w.id])),
      message: `world "${w.id}" shows from ${w.from.toFixed(1)} to ${w.to.toFixed(1)} s (${hold.toFixed(1)} s) and its line "${line.text.slice(0, 40)}" (${line.n} word${line.n === 1 ? '' : 's'}) needs ${need.toFixed(1)} s settled, before the entrance`,
      fix: `hold the beat at least ${(need * PASS + 0.4).toFixed(1)} s (an earlier start or a later cut)${cut}; taste/rules/readable-hold.md`,
    });
  }
  return out;
}
