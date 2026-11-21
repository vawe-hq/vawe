// vawe-dev seo: the pure parts of the weekly report (window, diff, change-log effect, actions, text). No network, no disk.
import { summarize } from './bots-report.mjs';

export const MIN_IMPRESSIONS = 3;
export const MAX_ACTIONS = 8;
const PER_KIND = 3;
const DAY = 86400000;
const CRAWLERS = ['GPTBot', 'OAI-SearchBot', 'ClaudeBot', 'Claude-SearchBot', 'PerplexityBot', 'Googlebot', 'Bingbot'];
const MIN_CRAWLER_HITS = 10;
const SCANNER = /\/wp-|\/_api|\.php($|\?)|\/\.(env|git)|\/xmlrpc/i;
const STOP = new Set(['the', 'and', 'for', 'with', 'how', 'to', 'of', 'in', 'on', 'a', 'an', 'is', 'vs', 'what', 'my', 'your']);

const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
const addDays = (date, n) => iso(Date.parse(date) + n * DAY);
const round1 = (n) => Math.round(n * 10) / 10;

export const toPath = (url) => {
  try {
    const p = new URL(url).pathname.replace(/\/+$/, '');
    return p || '/';
  } catch {
    return url;
  }
};

/** The days GSC has: the `days` days that end `lag` days before today. */
export function windowDates(today, days, lag = 3) {
  const end = addDays(today, -lag);
  return { start: addDays(end, -(days - 1)), end, days };
}

/** GSC rows ({keys, clicks, impressions, position}) into flat rows named by `names`; a page key becomes a path. */
export function flatRows(rows, names) {
  return rows.map((r) => {
    const out = { clicks: r.clicks, impressions: r.impressions, position: round1(r.position) };
    names.forEach((n, i) => { out[n] = n === 'page' ? toPath(r.keys[i]) : r.keys[i]; });
    return out;
  });
}

/** Per key, now against before. Sorted by the biggest change in impressions. */
export function diffRows(prev, cur, keyOf) {
  const before = new Map(prev.map((r) => [keyOf(r), r]));
  const seen = new Set();
  const out = cur.map((r) => {
    const k = keyOf(r);
    seen.add(k);
    const p = before.get(k);
    return {
      key: k, impressions: r.impressions, clicks: r.clicks, position: r.position,
      dImpressions: r.impressions - (p?.impressions ?? 0), dClicks: r.clicks - (p?.clicks ?? 0),
      dPosition: p ? round1(r.position - p.position) : null, isNew: !p,
    };
  });
  for (const [k, p] of before) {
    if (!seen.has(k)) out.push({ key: k, impressions: 0, clicks: 0, position: null, dImpressions: -p.impressions, dClicks: -p.clicks, dPosition: null, isNew: false, gone: true });
  }
  return out.sort((a, b) => Math.abs(b.dImpressions) - Math.abs(a.dImpressions) || (a.key < b.key ? -1 : 1));
}

export function diffCounts(prev = {}, cur = {}) {
  return [...new Set([...Object.keys(prev), ...Object.keys(cur)])]
    .map((key) => ({ key, prev: prev[key] ?? 0, cur: cur[key] ?? 0, delta: (cur[key] ?? 0) - (prev[key] ?? 0) }))
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta) || (a.key < b.key ? -1 : 1));
}

/** The bot log events as the counts the report keeps. Reuses summarize() of the bots verb. */
function aiReadsOf(rows) {
  const out = {};
  for (const g of rows) {
    if (g.class === 'ai-search' || g.class === 'ai-user-fetch') for (const [p, n] of g.paths) out[p] = (out[p] ?? 0) + n;
  }
  return out;
}

function actionCounts(actions) {
  const actionPages = {};
  const actionSources = {};
  for (const [p, m] of actions) {
    for (const [k, n] of m) {
      const [a, src] = k.split('\t');
      (actionPages[p] ??= {})[a] = (actionPages[p][a] ?? 0) + n;
      (actionSources[a] ??= {})[src] = (actionSources[a][src] ?? 0) + n;
    }
  }
  return { actionPages, actionSources };
}

export function botSummary(events) {
  const { rows, referrals, visits, actions } = summarize(events);
  const crawlers = {};
  for (const g of rows) crawlers[g.bot] = { class: g.class, hits: g.hits };
  const visitPages = Object.fromEntries([...visits].map(([p, m]) => [p, Object.fromEntries(m)]));
  const { actionPages, actionSources } = actionCounts(actions);
  const aiReads = aiReadsOf(rows);
  const referralPages = {};
  const referralPageSources = {};
  const bySource = {};
  for (const [p, m] of referrals) {
    referralPageSources[p] = Object.fromEntries(m);
    for (const [bot, n] of m) {
      referralPages[p] = (referralPages[p] ?? 0) + n;
      bySource[bot] = (bySource[bot] ?? 0) + n;
    }
  }
  const notFound = {};
  for (const e of events) if (e.status === 404 && e.class !== 'ai-referral') notFound[e.path] = (notFound[e.path] ?? 0) + 1;
  return { events: events.length, crawlers, referrals: bySource, referralPages, referralPageSources, notFound, aiReads, visitPages, actionPages, actionSources };
}

const sum = (rows, f) => rows.reduce((a, r) => a + r[f], 0);
const total = (counts = {}) => Object.values(counts).reduce((a, b) => a + b, 0);
const INSTALL_ACTIONS = ['copy-install', 'copy-prompt', 'npm', 'github'];

/** One row per page: Google, Bing, AI reads, visits and actions. A visit from inside the site is not counted. */
export function pageTable({ gscPages = [], bingPages = [], bots }) {
  const rows = new Map();
  const row = (page) => rows.get(page) ?? rows.set(page, {
    page, visits: 0, aiVisits: 0, actions: 0, installs: 0, aiReads: 0,
    gscClicks: 0, gscImpressions: 0, gscPosition: null, bingClicks: 0, bingImpressions: 0,
  }).get(page);
  // Two GSC urls can share a path (https://vawe.dev/ and https://www.vawe.dev/), so rows add up and the position is weighted.
  for (const r of gscPages) {
    const x = row(r.page);
    const impressions = x.gscImpressions + r.impressions;
    const position = impressions ? round1(((x.gscPosition ?? 0) * x.gscImpressions + r.position * r.impressions) / impressions) : r.position;
    Object.assign(x, { gscClicks: x.gscClicks + r.clicks, gscImpressions: impressions, gscPosition: position });
  }
  for (const r of bingPages) Object.assign(row(r.page), { bingClicks: row(r.page).bingClicks + r.clicks, bingImpressions: row(r.page).bingImpressions + r.impressions });
  if (bots) {
    for (const [p, srcs] of Object.entries(bots.visitPages ?? {})) row(p).visits += total(srcs) - (srcs.internal ?? 0);
    for (const [p, n] of Object.entries(bots.referralPages ?? {})) Object.assign(row(p), { visits: row(p).visits + n, aiVisits: n });
    for (const [p, acts] of Object.entries(bots.actionPages ?? {})) {
      Object.assign(row(p), { actions: total(acts), installs: INSTALL_ACTIONS.reduce((a, k) => a + (acts[k] ?? 0), 0) });
    }
    for (const [p, n] of Object.entries(bots.aiReads ?? {})) row(p).aiReads = n;
  }
  return [...rows.values()].sort((a, b) => b.visits - a.visits || b.aiReads - a.aiReads || b.gscImpressions - a.gscImpressions || (a.page < b.page ? -1 : 1));
}

const CSV_COLUMNS = ['page', 'visits', 'aiVisits', 'actions', 'installs', 'aiReads', 'gscClicks', 'gscImpressions', 'gscPosition', 'bingClicks', 'bingImpressions'];

export function pageCsv(table) {
  const cell = (v) => (v === null || v === undefined ? '' : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  return [CSV_COLUMNS.join(','), ...table.map((r) => CSV_COLUMNS.map((c) => cell(r[c])).join(','))].join('\n') + '\n';
}

/** Clicks, impressions and impression-weighted position of the rows that belong to `paths`. */
export function totalsFor(rows, paths) {
  const want = new Set(paths);
  const hit = rows.filter((r) => want.has(r.page));
  const impressions = sum(hit, 'impressions');
  const position = impressions ? round1(hit.reduce((a, r) => a + r.position * r.impressions, 0) / impressions) : null;
  return { clicks: sum(hit, 'clicks'), impressions, position };
}

/** The changes old enough to judge, with their two windows: 28 days before and the days after (up to the last day GSC has). */
export function changeWindows(changes, endDate, span = 28) {
  return changes
    .filter((c) => Date.parse(c.date) <= Date.parse(endDate) + 3 * DAY - span * DAY)
    .map((c) => ({
      change: c,
      before: { start: addDays(c.date, -span), end: addDays(c.date, -1) },
      after: { start: c.date, end: [addDays(c.date, span - 1), endDate].sort()[0] },
    }));
}

export function changeEffect(window, beforeRows, afterRows) {
  const { change } = window;
  return { ...change, before: totalsFor(beforeRows, change.pages), after: totalsFor(afterRows, change.pages), windows: { before: window.before, after: window.after } };
}

const words = (s) => s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !STOP.has(w));

export function titleLacksQuery(title, query) {
  const q = words(query);
  if (!q.length) return false;
  const t = new Set(words(title));
  return q.filter((w) => t.has(w)).length * 2 < q.length;
}

const act = (kind, score, text) => ({ kind, score, text });

const pageOneActions = (pageQuery) => pageQuery
  .filter((r) => r.impressions >= MIN_IMPRESSIONS && r.position >= 4 && r.position <= 20)
  .map((r) => act('page-one', r.impressions * (21 - r.position) / 17, `"${r.query}" is at position ${r.position} with ${r.impressions} impressions (${r.page}). Push it to page 1.`));

const noClickActions = (pages) => pages
  .filter((r) => r.impressions >= MIN_IMPRESSIONS && r.clicks === 0 && r.position <= 10)
  .map((r) => act('no-clicks', r.impressions, `${r.page} has ${r.impressions} impressions, 0 clicks, position ${r.position}. Rewrite its title or description.`));

const gapActions = (pageQuery, titles) => pageQuery
  .filter((r) => titles[r.page] !== undefined && r.impressions >= MIN_IMPRESSIONS && titleLacksQuery(titles[r.page], r.query))
  .map((r) => act('gap', r.impressions * 0.8, `"${r.query}" has ${r.impressions} impressions but the title of ${r.page} lacks its words. Add a page or a section.`));

const notFoundActions = (notFound) => Object.entries(notFound)
  .filter(([p, n]) => n >= 3 && !SCANNER.test(p))
  // Until 2026-11-09 a 404 on a path the middleware skips (assets, files) was logged with no path.
  .map(([p, n]) => act('404', n, `${p || 'A path logged before 2026-11-09 (with no path recorded)'} gave a 404 to bots ${n} times. Add the page or a redirect.`));

const isBigMove = (d) => (d.prev === 0 ? d.cur >= MIN_IMPRESSIONS : Math.abs(d.delta) / d.prev >= 0.3 && Math.max(d.prev, d.cur) >= MIN_IMPRESSIONS);

const referralActions = (prevBots, bots) => (!prevBots ? [] : diffCounts(prevBots.referralPages, bots.referralPages)
  .filter(isBigMove)
  .map((d) => act('referral', Math.abs(d.delta) * 2, `AI referrals to ${d.key} ${d.delta > 0 ? 'grew' : 'fell'} from ${d.prev} to ${d.cur}. ${d.delta > 0 ? 'Learn why and repeat it.' : 'Check the page and its answer.'}`)));

// Until the beacon has sent its first action, every page reads as 0 actions, so those actions wait for one.
function pageActions(table, bots, days) {
  if (!bots || !Object.keys(bots.actionPages ?? {}).length) return [];
  const floor = Math.max(3, Math.round(10 * days / 28));
  const busy = table.filter((r) => r.visits >= floor);
  return [
    ...busy.filter((r) => r.actions === 0).map((r) => act('no-action', r.visits, `${r.page} had ${r.visits} visits and no copy or click. Add the install line or a clear next step.`)),
    ...busy.filter((r) => r.installs / r.visits >= 0.2).map((r) => act('converts', r.installs * 2, `${r.page} turns ${Math.round((100 * r.installs) / r.visits)}% of its visits into an install step. Link to it from pages with more visits.`)),
  ];
}

function crawlerActions(bots, days) {
  const floor = Math.round(MIN_CRAWLER_HITS * days / 28);
  const low = CRAWLERS.filter((b) => (bots.crawlers[b]?.hits ?? 0) < floor);
  if (!low.length) return [];
  return [act('crawler', 50, `Crawlers under ${floor} hits in ${days} days: ${low.map((b) => `${b} ${bots.crawlers[b]?.hits ?? 0}`).join(', ')}. Check robots.txt and the sitemap.`)];
}

/**
 * Ranked next actions, at most 8, at most 3 of a kind. Each is { kind, score, text }.
 * input: { gsc: { pageQuery, pages }, bots, prevBots, titles: { path: title }, days, table: pageTable() }
 */
export function buildActions({ gsc, bots, prevBots, titles = {}, days = 28, table = [] }) {
  const all = [
    ...pageOneActions(gsc.pageQuery), ...noClickActions(gsc.pages), ...gapActions(gsc.pageQuery, titles), ...pageActions(table, bots, days),
    ...(bots ? [...notFoundActions(bots.notFound), ...referralActions(prevBots, bots), ...crawlerActions(bots, days)] : []),
  ];
  const used = {};
  return all
    .sort((a, b) => b.score - a.score || (a.text < b.text ? -1 : 1))
    .filter((a) => (used[a.kind] = (used[a.kind] ?? 0) + 1) <= PER_KIND)
    .slice(0, MAX_ACTIONS);
}

const sign = (n) => (n > 0 ? `+${n}` : `${n}`);
const posText = (r) => (r.position === null ? 'gone' : `pos ${r.position}${r.dPosition === null ? ' (new)' : ` (${sign(r.dPosition)})`}`);

function rowLines(diff, label, limit) {
  return diff.slice(0, limit).map((r) => `  ${label(r.key)}: impr ${r.impressions} (${sign(r.dImpressions)}), clicks ${r.clicks} (${sign(r.dClicks)}), ${posText(r)}`);
}

function totals(rows) {
  return `${sum(rows, 'clicks')} clicks, ${sum(rows, 'impressions')} impressions`;
}

/** The report as lines. snapshot is the new one; prev the older one or null; effects the change-log results. */
export function renderReport({ snapshot, prev, effects = [], actions, botNote, table = [] }) {
  const w = snapshot.window;
  const out = [`SEO report ${snapshot.date}`, `Window ${w.start} to ${w.end} (${w.days} days)`, ''];
  out.push('Next actions');
  out.push(...(actions.length ? actions.map((a, i) => `${i + 1}. ${a.text}`) : ['  none']));

  out.push('', `Search: ${totals(snapshot.gsc.pages)}`);
  if (!prev) {
    out.push('  no earlier snapshot, so no comparison yet');
  } else {
    out.push(`  last snapshot ${prev.date}: ${totals(prev.gsc.pages)}`);
    out.push('Pages, biggest change');
    out.push(...rowLines(diffRows(prev.gsc.pages, snapshot.gsc.pages, (r) => r.page), (k) => k, 10));
    out.push('Queries, biggest change');
    out.push(...rowLines(diffRows(prev.gsc.queries, snapshot.gsc.queries, (r) => r.query), (k) => `"${k}"`, 10));
  }

  out.push('', 'Bots and AI');
  if (!snapshot.bots) {
    out.push(`  ${botNote}`);
  } else {
    const prevBots = prev?.bots;
    out.push(`  ${snapshot.bots.events} events`);
    const crawlerDiff = diffCounts(Object.fromEntries(Object.entries(prevBots?.crawlers ?? {}).map(([b, c]) => [b, c.hits])), Object.fromEntries(Object.entries(snapshot.bots.crawlers).map(([b, c]) => [b, c.hits])));
    out.push('Crawler hits');
    out.push(...(crawlerDiff.length ? crawlerDiff.slice(0, 12).map((d) => `  ${d.key}: ${d.cur}${prevBots ? ` (${sign(d.delta)})` : ''}`) : ['  none']));
    const refDiff = diffCounts(prevBots?.referrals, snapshot.bots.referrals);
    out.push('AI referral visits');
    out.push(...(refDiff.length ? refDiff.map((d) => `  ${d.key}: ${d.cur}${prevBots ? ` (${sign(d.delta)})` : ''}`) : ['  none']));
    out.push(...landingLines(snapshot.bots));
    out.push(...visitorLines(snapshot.bots, prevBots));
  }
  out.push(...bingLines(snapshot.bing));
  out.push(...tableLines(table));

  out.push(...githubLines(snapshot.github, prev?.github));
  out.push(...npmLines(snapshot.npm, prev?.npm));

  if (effects.length) {
    out.push('', 'Past changes, 28 days before and after');
    for (const e of effects) {
      const f = (t) => `${t.clicks} clicks, ${t.impressions} impr, ${t.position === null ? 'no position' : `pos ${t.position}`}`;
      out.push(`  ${e.date} ${e.what} [${e.pages.join(', ')}]`, `    before: ${f(e.before)}`, `    after:  ${f(e.after)}`);
    }
  }
  return out;
}

export function landingLines(bots, top = 8) {
  const pages = Object.entries(bots.referralPages ?? {}).sort((a, b) => b[1] - a[1]).slice(0, top);
  if (!pages.length) return [];
  const sources = (p) => Object.entries(bots.referralPageSources?.[p] ?? {}).sort((a, b) => b[1] - a[1]).map(([s, n]) => `${s} ${n}`).join(', ');
  return ['AI visitors by landing page', ...pages.map(([p, n]) => `  ${p}: ${n}${sources(p) ? ` (${sources(p)})` : ''}`)];
}

const sourceTotals = (visitPages = {}) => {
  const out = {};
  for (const srcs of Object.values(visitPages)) for (const [src, n] of Object.entries(srcs)) if (src !== 'internal') out[src] = (out[src] ?? 0) + n;
  return out;
};

export function visitorLines(bots, prevBots) {
  const out = [];
  const visits = diffCounts(prevBots?.visitPages ? sourceTotals(prevBots.visitPages) : undefined, sourceTotals(bots.visitPages));
  if (visits.length) out.push('Visits by source', ...visits.slice(0, 10).map((d) => `  ${d.key}: ${d.cur}${prevBots?.visitPages ? ` (${sign(d.delta)})` : ''}`));
  const acts = Object.entries(bots.actionSources ?? {}).map(([a, srcs]) => [a, total(srcs), srcs]).sort((x, y) => y[1] - x[1]);
  if (acts.length) {
    const from = (srcs) => Object.entries(srcs).sort((x, y) => y[1] - x[1]).slice(0, 3).map(([s, n]) => `${s} ${n}`).join(', ');
    out.push('Actions (copies and clicks)', ...acts.map(([a, n, srcs]) => `  ${a}: ${n} (${from(srcs)})`));
  }
  return out;
}

export function bingLines(bing) {
  const out = ['', 'Bing'];
  if (!bing) return [...out, '  not collected'];
  if (bing.note) return [...out, `  ${bing.note}`];
  out.push(`  ${totals(bing.pages)}`);
  for (const q of [...bing.queries].sort((a, b) => b.impressions - a.impressions).slice(0, 5)) out.push(`  "${q.query}": impr ${q.impressions}, clicks ${q.clicks}`);
  return out;
}

const pad = (v, n) => String(v).padStart(n);

export function tableLines(table, top = 15) {
  if (!table.length) return [];
  const width = Math.min(44, Math.max(...table.slice(0, top).map((r) => r.page.length)));
  const head = `  ${'page'.padEnd(width)} ${pad('visits', 6)} ${pad('AI', 4)} ${pad('acts', 4)} ${pad('inst', 4)} ${pad('AIread', 6)} ${pad('G clk', 5)} ${pad('G imp', 5)} ${pad('G pos', 5)} ${pad('B clk', 5)} ${pad('B imp', 5)}`;
  const line = (r) => `  ${r.page.slice(0, width).padEnd(width)} ${pad(r.visits, 6)} ${pad(r.aiVisits, 4)} ${pad(r.actions, 4)} ${pad(r.installs, 4)} ${pad(r.aiReads, 6)} ${pad(r.gscClicks, 5)} ${pad(r.gscImpressions, 5)} ${pad(r.gscPosition ?? '-', 5)} ${pad(r.bingClicks, 5)} ${pad(r.bingImpressions, 5)}`;
  return ['', `Pages, top ${Math.min(top, table.length)} of ${table.length} (all in pages/<date>.csv)`, head, ...table.slice(0, top).map(line)];
}

// Installs are the conversion: a visit counts when it ends in npm install @vawe/cli.
export function npmLines(npm, prevNpm) {
  const out = ['', 'npm @vawe/cli (last 7 days)'];
  if (!npm) return [...out, '  not collected'];
  if (npm.note) return [...out, `  ${npm.note}`];
  const was = prevNpm && !prevNpm.note ? ` (${sign(npm.downloads - prevNpm.downloads)})` : '';
  return [...out, `  downloads: ${npm.downloads}${was}`];
}

// The last step of the funnel: AI and search visits on vawe.dev, then people who reach the repo, then stars.
export function githubLines(gh, prevGh) {
  const out = ['', 'GitHub (its last 14 days)'];
  if (!gh) return [...out, '  not collected'];
  if (gh.note) return [...out, `  ${gh.note}`];
  const was = (v) => (prevGh && !prevGh.note && v !== undefined ? ` (${sign(gh.stars - v)})` : '');
  out.push(`  stars: ${gh.stars}${was(prevGh?.stars)}`);
  out.push(`  repo views: ${gh.views.count} by ${gh.views.uniques} people`);
  for (const r of gh.referrers.slice(0, 6)) out.push(`  from ${r.referrer}: ${r.uniques} people`);
  return out;
}
