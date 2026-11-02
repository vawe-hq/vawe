#!/usr/bin/env node
// quality/gates/seo-pseo.mjs: do the site's template pages and hubs hold up as search and AI-crawler pages?
//
//   node quality/gates/seo-pseo.mjs [--base http://localhost:3187] [--all] [--json]   ·   vawe-dev check seo-pseo
//
// Run it against a production build (`npm --prefix site run build && npm --prefix site run start`), because
// the third read is the HTML the server sends. It advises and never fails: every finding is a warning.
//
//   1. each template page (/video-components/<name>, /easing/<slug>, /vs/<slug>) has a data point no sibling
//      has, and is linked from at least 2 hand-written pages (a gallery or index page does not count)
//   2. each hub page (/video-components, /easing, /resources, /blog) has prose outside its cards
//   3. each route in site/lib/site-pages.json has its main text in the server HTML, and the HTML is
//      under 2 MB (Googlebot reads the first 2 MB; AI crawlers run no JavaScript)
//
// WHY. Template pages get deindexed unless each has a unique data point and 2 or more hand-written pages
// link to it (https://www.reddit.com/r/bigseo/comments/1t0xwsy). A hub that is only a card grid got 0 of 15
// pages indexed (https://arnjen.com/blog/programmatic-seo-225-pages-google-indexed-18-percent). AI crawlers
// do not run JavaScript (https://vercel.com/blog/the-rise-of-the-ai-crawler). The thresholds below are
// those numbers, not measured on this site.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { docsDir } from '../../scripts/site/docs-dir.mjs';
import { gateFindings } from '../../harness/lib/findings.mjs';
import { MAX_HTML_BYTES, copyShare, hubProse, inbound, internalLinks, mainOf, markdownLinks, mdBody, repeats, textOf } from '../../harness/lib/pseo.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SITE_LIB = path.join(ROOT, 'site/lib');
const DOCS_DIR = path.join(docsDir(ROOT), 'content/docs');
const json = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
const base = (argv[argv.indexOf('--base') + 1] && argv.includes('--base') ? argv[argv.indexOf('--base') + 1] : 'http://localhost:3187').replace(/\/$/, '');

// MIN_INBOUND is the 2 hand-written links from https://www.reddit.com/r/bigseo/comments/1t0xwsy.
// MIN_HUB_PROSE_WORDS is a judgement for "more than a card grid" (https://arnjen.com/blog/programmatic-seo-225-pages-google-indexed-18-percent), not a measured number.
// MIN_COPY_SHARE is a judgement: AI crawlers read only the server HTML (https://vercel.com/blog/the-rise-of-the-ai-crawler).
const MIN_INBOUND = 2;
const MIN_HUB_PROSE_WORDS = 40;
const MIN_COPY_SHARE = 0.8;
const HUBS = ['/video-components', '/easing', '/resources', '/blog'];
// Galleries and indexes: they link every item, so a link from one says nothing about the item.
const INDEXES = new Set(['/video-components', '/easing', '/inspiration', '/blog']);
const TEMPLATES = [
  { id: 'video-components', prefix: '/video-components/' },
  { id: 'easing', prefix: '/easing/' },
  { id: 'vs', prefix: '/vs/' },
];

const f = gateFindings();
const say = (s = '') => console.log(s);

async function get(url, timeout = 30000) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(timeout), redirect: 'follow' });
    return { status: r.status, text: await r.text() };
  } catch (e) {
    return { status: 0, text: '', error: e.message };
  }
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: limit }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  }));
  return out;
}

const sitemap = await get(`${base}/sitemap.xml`);
if (sitemap.status !== 200) {
  f.warn('pseo-no-server', `${base}/sitemap.xml did not answer (${sitemap.status || sitemap.error}), so nothing was checked`, {
    fix: 'build and start the site (npm --prefix site run build, then npm --prefix site run start) or pass --base <url>',
  });
  f.emit();
  process.exit(0);
}

const pages = json(path.join(SITE_LIB, 'site-pages.json'));
const pathOf = (u) => new URL(u).pathname.replace(/\/$/, '') || '/';
const sitemapPaths = [...sitemap.text.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => pathOf(m[1]));
const routePaths = pages.routes.map((r) => r.path);
const docPaths = pages.docs.map((d) => d.path);
const sitePaths = [...new Set([...sitemapPaths, ...routePaths])].filter((p) => !docPaths.includes(p));

const html = new Map();
await mapLimit(sitePaths, 8, async (p) => {
  const r = await get(`${base}${p}`);
  html.set(p, r);
});

const templateOf = (p) => TEMPLATES.find((t) => p.startsWith(t.prefix))?.id ?? null;
const isBlogPost = (p) => p.startsWith('/blog/');

// ===== 1. unique data point and hand-written inbound links ======================================
const links = new Map();
for (const [p, r] of html) if (r.status === 200) links.set(p, internalLinks(mainOf(r.text)));
for (const d of docPaths) {
  const file = path.join(DOCS_DIR, `${d === '/docs' ? 'index' : d.replace('/docs/', '')}.mdx`);
  if (fs.existsSync(file)) links.set(d, markdownLinks(fs.readFileSync(file, 'utf8')));
}

const handWritten = (p) => !INDEXES.has(p) && templateOf(p) !== 'video-components' && templateOf(p) !== 'easing';
const moves = json(path.join(SITE_LIB, 'moves.json')).moves;
const eases = json(path.join(SITE_LIB, 'easing.json')).eases;
const round = (n) => Math.round(n);

const dataPoint = {
  'video-components': (() => {
    const measured = repeats(moves, (m) => `/video-components/${m.name}`, (m) => JSON.stringify([m.duration, m.eases, m.sound]));
    const snippet = repeats(moves, (m) => `/video-components/${m.name}`, (m) => m.snippet.trim());
    return (p) => (measured.has(p) ? { ok: false, why: `same duration, eases and sound as ${measured.get(p).join(', ')}`, snippetRepeats: snippet.has(p) } : { ok: true });
  })(),
  easing: (() => {
    const same = repeats(eases, (e) => `/easing/${e.slug}`, (e) => [round(e.t50 * 100), round(e.t90 * 100), e.peakSpeed, e.overshoot, e.undershoot].join('|'));
    return (p) => (same.has(p) ? { ok: false, why: `same 50%, 90%, peak speed and overshoot as ${same.get(p).join(', ')}` } : { ok: true });
  })(),
  vs: (() => {
    const external = (p) => {
      const out = new Set();
      for (const m of mainOf(html.get(p)?.text ?? '').matchAll(/href="(https?:\/\/(?!(?:www\.)?vawe\.dev)[^"]+)"/g)) out.add(m[1]);
      return out;
    };
    const rivals = sitePaths.filter((p) => templateOf(p) === 'vs');
    const own = new Map(rivals.map((p) => [p, external(p)]));
    const used = new Map();
    for (const urls of own.values()) for (const u of urls) used.set(u, (used.get(u) ?? 0) + 1);
    return (p) => {
      const mine = [...(own.get(p) ?? [])].filter((u) => used.get(u) === 1);
      return mine.length ? { ok: true } : { ok: false, why: 'every outside source it cites is cited by a sibling too' };
    };
  })(),
};

const rows = [];
for (const t of TEMPLATES) {
  const targets = sitePaths.filter((p) => templateOf(p) === t.id);
  const sources = [...links.keys()].filter((s) => handWritten(s) && templateOf(s) !== t.id);
  const counts = inbound(links, targets, sources);
  for (const p of targets) rows.push({ template: t.id, path: p, data: dataPoint[t.id](p), from: counts.get(p) });
}

say(`\n  1. TEMPLATE PAGES · ${rows.length} page(s) · base ${base}\n`);
for (const t of TEMPLATES) {
  const mine = rows.filter((r) => r.template === t.id);
  const noData = mine.filter((r) => !r.data.ok);
  const thin = mine.filter((r) => r.from.length < MIN_INBOUND);
  say(`  ${t.prefix}<name>: ${mine.length} page(s), ${noData.length} without a data point of their own, ${thin.length} with fewer than ${MIN_INBOUND} hand-written links`);
  const hist = {};
  for (const r of mine) hist[Math.min(r.from.length, 5)] = (hist[Math.min(r.from.length, 5)] ?? 0) + 1;
  say(`    hand-written links in, pages per count: ${[0, 1, 2, 3, 4, 5].map((n) => `${n}${n === 5 ? '+' : ''}:${hist[n] ?? 0}`).join('  ')}`);
}
for (const r of rows) {
  if (!r.data.ok) f.warn('pseo-no-unique-data', `${r.path} has no data point its siblings lack: ${r.data.why}`, { at: r.path, fix: 'add a measured value to its data source that only this page has' });
  if (r.from.length < MIN_INBOUND) f.warn('pseo-under-linked', `${r.path} is linked from ${r.from.length} hand-written page(s)${r.from.length ? `: ${r.from.join(', ')}` : ''}`, { at: r.path, fix: `link it from ${MIN_INBOUND - r.from.length} more hand-written page(s) where it helps a reader, in site/lib/content/*.ts` });
}
if (flag('--all')) {
  say();
  for (const r of rows) say(`  ${r.path.padEnd(44)} data:${r.data.ok ? 'yes' : 'NO '}  in:${String(r.from.length).padStart(2)}  ${r.from.join(' ')}`);
}

// ===== 2. hubs have prose =======================================================================
say('\n  2. HUB PAGES\n');
for (const h of HUBS) {
  const r = html.get(h);
  if (!r || r.status !== 200) {
    f.warn('pseo-hub-missing', `${h} did not answer 200`, { at: h });
    continue;
  }
  const prose = hubProse(r.text);
  say(`  ${h.padEnd(18)} ${prose.paragraphs} paragraph(s) of prose outside the cards, ${prose.words} words`);
  if (prose.words < MIN_HUB_PROSE_WORDS) f.warn('pseo-hub-grid-only', `${h} has ${prose.words} words of prose outside its cards (want ${MIN_HUB_PROSE_WORDS}+): it is a grid`, { at: h, fix: 'add a short factual intro in the content data file the page reads' });
}

// ===== 3. text is in the server HTML, and the HTML is small enough ===============================
say('\n  3. SERVER HTML\n');
const checked = [];
await mapLimit(routePaths, 6, async (p) => {
  const r = html.get(p);
  if (!r || r.status !== 200) {
    f.warn('pseo-route-unreachable', `${p} answered ${r?.status ?? 'nothing'}`, { at: p });
    return;
  }
  const bytes = Buffer.byteLength(r.text);
  const md = await get(`${base}${p === '/' ? '/index' : p}.md`);
  const share = md.status === 200 ? copyShare(mdBody(md.text), textOf(mainOf(r.text))) : null;
  checked.push({ path: p, bytes, share });
  if (bytes > MAX_HTML_BYTES) f.warn('pseo-html-too-large', `${p} sends ${(bytes / 1048576).toFixed(2)} MB of HTML, over the 2 MB Googlebot reads`, { at: p, fix: 'send less in the first response: move the repeated data out of the page' });
  if (share === null) f.warn('pseo-no-md-copy', `${p} has no markdown copy to compare against`, { at: p });
  else if (share < MIN_COPY_SHARE) f.warn('pseo-text-not-in-html', `${p}: ${Math.round(share * 100)}% of the markdown copy is in the server HTML (want ${Math.round(MIN_COPY_SHARE * 100)}%+)`, { at: p, fix: 'render the missing text on the server, not in a client component' });
});
checked.sort((a, b) => a.path.localeCompare(b.path));
for (const c of checked) say(`  ${c.path.padEnd(32)} ${(c.bytes / 1024).toFixed(0).padStart(6)} KB  text in HTML: ${c.share === null ? 'no md copy' : `${Math.round(c.share * 100)}%`}`);
{
  const r = await get(`${base}${docPaths[0]}`, 5000);
  if (r.status !== 200) f.note('pseo-docs-not-served', `the ${docPaths.length} /docs pages come from the docs app, which this server does not reach (${r.status || r.error}): their HTML was not checked`, { at: '/docs' });
}

say(`\n  SEO PSEO · ${rows.length} template page(s), ${HUBS.length} hub(s), ${routePaths.length} route(s) · ${f.count} finding(s)\n`);
f.emit();
