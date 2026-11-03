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
export function botSummary(events) {
  const { rows, referrals } = summarize(events);
  const crawlers = {};
  for (const g of rows) crawlers[g.bot] = { class: g.class, hits: g.hits };
  const referralPages = {};
  const bySource = {};
  for (const [p, m] of referrals) {
    for (const [bot, n] of m) {
      referralPages[p] = (referralPages[p] ?? 0) + n;
      bySource[bot] = (bySource[bot] ?? 0) + n;
    }
  }
  const notFound = {};
  for (const e of events) if (e.status === 404 && e.class !== 'ai-referral') notFound[e.path] = (notFound[e.path] ?? 0) + 1;
  return { events: events.length, crawlers, referrals: bySource, referralPages, notFound };
}

const sum = (rows, f) => rows.reduce((a, r) => a + r[f], 0);

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
  // The middleware skips image and file paths, so a 404 on one of them is logged with no path.
  .map(([p, n]) => act('404', n, `${p || 'An image or file path (the log does not record which)'} gave a 404 to bots ${n} times. Add the page or a redirect.`));

const isBigMove = (d) => (d.prev === 0 ? d.cur >= MIN_IMPRESSIONS : Math.abs(d.delta) / d.prev >= 0.3 && Math.max(d.prev, d.cur) >= MIN_IMPRESSIONS);

const referralActions = (prevBots, bots) => (!prevBots ? [] : diffCounts(prevBots.referralPages, bots.referralPages)
  .filter(isBigMove)
  .map((d) => act('referral', Math.abs(d.delta) * 2, `AI referrals to ${d.key} ${d.delta > 0 ? 'grew' : 'fell'} from ${d.prev} to ${d.cur}. ${d.delta > 0 ? 'Learn why and repeat it.' : 'Check the page and its answer.'}`)));

function crawlerActions(bots, days) {
  const floor = Math.round(MIN_CRAWLER_HITS * days / 28);
  const low = CRAWLERS.filter((b) => (bots.crawlers[b]?.hits ?? 0) < floor);
  if (!low.length) return [];
  return [act('crawler', 50, `Crawlers under ${floor} hits in ${days} days: ${low.map((b) => `${b} ${bots.crawlers[b]?.hits ?? 0}`).join(', ')}. Check robots.txt and the sitemap.`)];
}

/**
 * Ranked next actions, at most 8, at most 3 of a kind. Each is { kind, score, text }.
 * input: { gsc: { pageQuery, pages }, bots, prevBots, titles: { path: title }, days }
 */
export function buildActions({ gsc, bots, prevBots, titles = {}, days = 28 }) {
  const all = [
    ...pageOneActions(gsc.pageQuery), ...noClickActions(gsc.pages), ...gapActions(gsc.pageQuery, titles),
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
export function renderReport({ snapshot, prev, effects = [], actions, botNote }) {
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
  }

  if (effects.length) {
    out.push('', 'Past changes, 28 days before and after');
    for (const e of effects) {
      const f = (t) => `${t.clicks} clicks, ${t.impressions} impr, ${t.position === null ? 'no position' : `pos ${t.position}`}`;
      out.push(`  ${e.date} ${e.what} [${e.pages.join(', ')}]`, `    before: ${f(e.before)}`, `    after:  ${f(e.after)}`);
    }
  }
  return out;
}
