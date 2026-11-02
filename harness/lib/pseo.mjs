// The pure reads behind `vawe-dev check seo-pseo` (quality/gates/seo-pseo.mjs): they take HTML or markdown
// text and return numbers, so tests/lib/seo-pseo.test.mjs can run them on small fixtures. No network here.

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
const DROP = new Set(['script', 'style', 'svg', 'template']);
const INLINE = new Set(['a', 'abbr', 'b', 'code', 'em', 'i', 'kbd', 'mark', 'small', 'span', 'strong', 'sub', 'sup', 'u']);
// A paragraph inside one of these is card or table text, not prose.
const CARD_TAGS = new Set(['a', 'article', 'li', 'button', 'table', 'figure', 'form', 'dl']);
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '-', mdash: '-', hellip: '...', rsquo: "'", lsquo: "'", ldquo: '"', rdquo: '"' };

const decode = (s) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    return ENTITIES[e.toLowerCase()] ?? m;
  });

const TAG = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g;

/** Walks the HTML and calls open(tag, attrs, stack), close(tag) and text(raw, stack). Script, style and svg bodies are skipped. */
function walk(html, { open, close, text }) {
  const stack = [];
  let last = 0;
  let skip = null;
  for (const m of html.matchAll(TAG)) {
    if (!skip && m.index > last) text?.(html.slice(last, m.index), stack);
    last = m.index + m[0].length;
    if (!m[2]) continue;
    const tag = m[2].toLowerCase();
    if (skip) {
      if (m[1] && tag === skip) skip = null;
      continue;
    }
    if (m[1]) {
      const at = stack.lastIndexOf(tag);
      if (at >= 0) stack.length = at;
      close?.(tag);
      continue;
    }
    open?.(tag, m[3], stack);
    if (DROP.has(tag)) {
      skip = tag;
      continue;
    }
    if (!VOID.has(tag) && !m[3].trimEnd().endsWith('/')) stack.push(tag);
  }
  if (!skip && last < html.length) text?.(html.slice(last), stack);
}

const attr = (attrs, name) => {
  const m = new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(attrs);
  return m ? decode(m[1] ?? m[2] ?? m[3]) : null;
};

/** The <main> element's HTML, or the whole page when it has none. Header and footer links are outside it. */
export function mainOf(html) {
  const start = html.search(/<main[\s>]/i);
  if (start < 0) return html;
  const end = html.lastIndexOf('</main>');
  return html.slice(start, end > start ? end : undefined);
}

/** Visible text of the HTML: block tags break words, inline tags do not. */
export function textOf(html) {
  let out = '';
  walk(html, {
    open: (tag) => { if (!INLINE.has(tag)) out += ' '; },
    close: (tag) => { if (!INLINE.has(tag)) out += ' '; },
    text: (raw) => { out += decode(raw); },
  });
  return out.replace(/\s+/g, ' ').trim();
}

const wordCount = (s) => (s.match(/\S+/g) ?? []).length;

/** Root-relative paths this HTML links to: no origin, query, hash or trailing slash. Links to other hosts are dropped. */
export function internalLinks(html, origins = ['https://vawe.dev', 'https://www.vawe.dev']) {
  const out = new Set();
  walk(html, {
    open: (tag, attrs) => {
      if (tag !== 'a') return;
      let href = attr(attrs, 'href');
      if (!href) return;
      for (const o of origins) if (href.startsWith(o)) href = href.slice(o.length) || '/';
      if (!href.startsWith('/') || href.startsWith('//')) return;
      const p = href.split(/[?#]/)[0].replace(/\/+$/, '');
      out.add(p || '/');
    },
  });
  return out;
}

/** Same as internalLinks, for the markdown in docs and blog source: [text](/path) and href="/path". */
export function markdownLinks(md) {
  const out = new Set();
  for (const m of md.matchAll(/\]\(((?:https?:\/\/(?:www\.)?vawe\.dev)?\/[^)\s]*)\)|href="((?:https?:\/\/(?:www\.)?vawe\.dev)?\/[^"]*)"/g)) {
    const p = (m[1] ?? m[2]).replace(/^https?:\/\/(www\.)?vawe\.dev/, '').split(/[?#]/)[0].replace(/\/+$/, '');
    out.add(p || '/');
  }
  return out;
}

/** The paragraphs of the page's <main> that sit outside cards, lists and tables, with their word counts. */
export function proseParagraphs(html) {
  const found = [];
  let current = null;
  walk(mainOf(html), {
    open: (tag, attrs, stack) => {
      if (tag !== 'p' || current) return;
      const cls = attr(attrs, 'class') ?? '';
      const insideCard = stack.some((t) => CARD_TAGS.has(t));
      current = { card: insideCard || /card/i.test(cls), text: '' };
    },
    text: (raw) => { if (current) current.text += decode(raw); },
    close: (tag) => {
      if (tag !== 'p' || !current) return;
      const text = current.text.replace(/\s+/g, ' ').trim();
      if (!current.card && text) found.push({ text, words: wordCount(text) });
      current = null;
    },
  });
  return found;
}

/** Prose a reader gets above or between the cards: paragraphs of at least `minWords` words. */
export function hubProse(html, minWords = 12) {
  const paragraphs = proseParagraphs(html).filter((p) => p.words >= minWords);
  return { paragraphs: paragraphs.length, words: paragraphs.reduce((n, p) => n + p.words, 0) };
}

const tokens = (s) => s.toLowerCase().match(/[a-z0-9]+/g) ?? [];

/** The markdown copy without its header lines, its Related list and its link targets, as plain text. */
export function mdBody(md) {
  return md
    .replace(/^> .*$/m, '')
    .replace(/^(Canonical|Last updated): .*$/gm, '')
    .replace(/\n## Related\n[\s\S]*$/, '\n')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^```.*$/gm, '')
    .replace(/<[^>]+>/g, ' ');
}

/** Share of the markdown's 4-word runs that also occur in the page text: 1 means all the copy is in the HTML. */
export function copyShare(mdText, htmlText, run = 4) {
  const want = tokens(mdText);
  if (want.length < run) return 1;
  const have = new Set();
  const got = tokens(htmlText);
  for (let i = 0; i + run <= got.length; i++) have.add(got.slice(i, i + run).join(' '));
  let hit = 0;
  const total = want.length - run + 1;
  for (let i = 0; i < total; i++) if (have.has(want.slice(i, i + run).join(' '))) hit++;
  return hit / total;
}

export const MAX_HTML_BYTES = 2 * 1024 * 1024;

/** Inbound counts: for each target path, the sorted list of source pages that link to it. `links` is a Map of source path to a Set of paths. */
export function inbound(links, targets, sources) {
  const out = new Map(targets.map((t) => [t, []]));
  for (const s of sources) {
    for (const t of links.get(s) ?? []) if (t !== s && out.has(t)) out.get(t).push(s);
  }
  for (const list of out.values()) list.sort();
  return out;
}

/** Items whose fingerprint equals a sibling's. `fingerprint(item)` returns a string; the result maps each such item name to the siblings it repeats. */
export function repeats(items, name, fingerprint) {
  const byPrint = new Map();
  for (const it of items) {
    const key = fingerprint(it);
    byPrint.set(key, [...(byPrint.get(key) ?? []), name(it)]);
  }
  const out = new Map();
  for (const group of byPrint.values()) if (group.length > 1) for (const n of group) out.set(n, group.filter((g) => g !== n));
  return out;
}
