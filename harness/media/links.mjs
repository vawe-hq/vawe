#!/usr/bin/env node
// `vawe-dev check links [--base url] [--from /,/blog] [--max 400] [--external]`: crawl the site from its start routes and check every link, image and stylesheet.
//   node harness/media/links.mjs --base https://vawe.dev
// Pages are read from the start routes by following internal links; redirects are reported, not followed, so a link that lands through a hop shows up. Exit 1 when any link is broken.
import { withSite } from '../lib/site-server.mjs';
import { DEFAULT_BASE } from './shot-math.mjs';
import { DEFAULT_MAX, extractRefs, linksProblem, reportLines, resolveRef, verdict } from './links-math.mjs';

const die = (m) => { console.error(`error: ${m}`); process.exit(2); };
const CONCURRENCY = 8;
const TIMEOUT_MS = 30000;

async function fetchOnce(url, method) {
  try {
    const r = await fetch(url, { method, redirect: 'manual', signal: AbortSignal.timeout(TIMEOUT_MS), headers: { 'user-agent': 'vawe-links' } });
    return { status: r.status, location: r.headers.get('location'), type: r.headers.get('content-type') || '', res: r };
  } catch (e) {
    return { error: e.cause?.code || e.message };
  }
}

async function pool(items, worker) {
  const queue = [...items];
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => { for (let it = queue.shift(); it; it = queue.shift()) await worker(it); }));
}

async function crawl({ base, starts, max, external }) {
  const rows = new Map();
  const pageIds = new Map();
  const anchors = [];
  const checks = [];
  const seen = new Set();
  let pending = starts.map((s) => ({ url: new URL(s, base).href, from: '(start)' }));
  pending.forEach((p) => seen.add(p.url));
  let pages = 0;
  const record = (url, v, from) => {
    const row = rows.get(url) || { url, ...v, from: new Set() };
    row.from.add(from);
    rows.set(url, row);
  };

  const visit = async ({ url, from }) => {
    const r = await fetchOnce(url, 'GET');
    const v = verdict(r);
    if (v.kind !== 'ok') return record(url, v, from);
    if (!r.type.includes('text/html')) return;
    pages++;
    const refs = extractRefs(await r.res.text());
    pageIds.set(url, refs.ids);
    for (const [list, isAsset] of [[refs.links, false], [refs.assets, true]]) {
      for (const ref of list) {
        const t = resolveRef(ref, url, base);
        if (!t || (t.external && !external)) continue;
        if (t.hash && !t.external && !isAsset) anchors.push({ url: t.url, hash: t.hash, from: url });
        if (seen.has(t.url)) { if (rows.has(t.url)) rows.get(t.url).from.add(url); continue; }
        seen.add(t.url);
        if (!t.external && !isAsset && seen.size <= max) pending.push({ url: t.url, from: url });
        else checks.push({ url: t.url, from: url });
      }
    }
  };

  while (pending.length) {
    const batch = pending;
    pending = [];
    await pool(batch, visit);
  }
  await pool(checks, async ({ url, from }) => {
    let r = await fetchOnce(url, 'HEAD');
    if (r.status === 405 || r.status === 501) r = await fetchOnce(url, 'GET');
    const v = verdict(r);
    if (v.kind !== 'ok') record(url, v, from);
  });
  for (const a of anchors) {
    const ids = pageIds.get(a.url);
    const id = decodeURIComponent(a.hash);
    // /blog#<section> selects the radio filter with id f-<section>; it is a client-side filter, not an anchor.
    if (ids && !ids.has(id) && !ids.has(`f-${id}`)) record(`${a.url}#${a.hash}`, { kind: 'broken', why: 'no element with this id on the page' }, a.from);
  }
  return { rows: [...rows.values()], pages, checked: seen.size };
}

async function main(argv) {
  const flag = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
  const base = flag('--base') || process.env.VAWE_SITE_URL || DEFAULT_BASE;
  const max = flag('--max') === undefined ? DEFAULT_MAX : Number(flag('--max'));
  const problem = linksProblem({ base, max });
  if (problem) die(problem);
  const starts = (flag('--from') || '/').split(',').map((s) => s.trim()).filter(Boolean);
  const { rows, pages, checked } = await withSite(base, () => crawl({ base, starts, max, external: argv.includes('--external') }));
  for (const l of reportLines({ rows, pages, checked })) console.log(l);
  process.exit(rows.some((r) => r.kind === 'broken') ? 1 : 0);
}

main(process.argv.slice(2)).catch((e) => die(e.stack || String(e)));
