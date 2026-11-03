import test from 'node:test';
import assert from 'node:assert/strict';
import { tokenMatches, parseDays, logFilesFor } from '../../site/lib/bot-log-download.ts';
import { buildActions, botSummary, changeEffect, changeWindows, diffRows, flatRows, renderReport, titleLacksQuery, toPath, totalsFor, windowDates } from '../../harness/lib/seo-report.mjs';

const row = (page, query, impressions, clicks, position) => ({ page, query, impressions, clicks, position });

test('the window ends 3 days before today and has the asked length', () => {
  assert.deepEqual(windowDates('2026-11-03', 28), { start: '2026-10-04', end: '2026-10-31', days: 28 });
});

test('flatRows turns page urls into paths', () => {
  assert.deepEqual(flatRows([{ keys: ['https://vawe.dev/easing/', 'ease'], clicks: 1, impressions: 9, position: 4.26 }], ['page', 'query']),
    [{ clicks: 1, impressions: 9, position: 4.3, page: '/easing', query: 'ease' }]);
  assert.equal(toPath('https://vawe.dev/'), '/');
});

test('diffRows shows changes, new keys and lost keys, biggest first', () => {
  const prev = [row('/a', '', 10, 1, 5), row('/b', '', 8, 0, 9)];
  const cur = [row('/a', '', 30, 3, 4), row('/c', '', 5, 0, 12)];
  const d = diffRows(prev, cur, (r) => r.page);
  assert.deepEqual(d.map((r) => [r.key, r.dImpressions]), [['/a', 20], ['/b', -8], ['/c', 5]]);
  assert.equal(d[0].dPosition, -1);
  assert.equal(d[1].gone, true);
  assert.equal(d[2].isNew, true);
});

test('actions: page one, no clicks, gap, 404, referral change and low crawlers', () => {
  const gsc = {
    pageQuery: [row('/easing', 'css easing', 20, 0, 6), row('/moves', 'video loop', 2, 0, 6), row('/blog/x', 'riso print', 7, 1, 30)],
    pages: [row('/home', '', 40, 0, 3), row('/low', '', 2, 0, 3), row('/easing', '', 40, 5, 6)],
  };
  const bots = {
    crawlers: { GPTBot: { class: 'ai-training', hits: 50 }, PerplexityBot: { class: 'ai-search', hits: 4 } },
    referrals: {}, referralPages: { '/a': 10, '/b': 10, '/c': 10 },
    notFound: { '/old-page': 4, '/wp-login.php': 30, '/rare': 2 },
  };
  const prevBots = { referralPages: { '/a': 5, '/b': 9, '/c': 20 } };
  const titles = { '/blog/x': 'Posters in two colours', '/easing': 'CSS easing curves' };
  const text = buildActions({ gsc, bots, prevBots, titles }).map((a) => a.text).join('\n');
  assert.match(text, /"css easing" is at position 6 with 20 impressions/);
  assert.doesNotMatch(text, /video loop/);
  assert.match(text, /\/home has 40 impressions, 0 clicks/);
  assert.doesNotMatch(text, /\/low/);
  assert.match(text, /"riso print".*lacks its words/);
  assert.doesNotMatch(text, /"css easing" has/);
  assert.match(text, /\/old-page gave a 404 to bots 4 times/);
  assert.doesNotMatch(text, /wp-login|\/rare/);
  assert.match(text, /referrals to \/a grew from 5 to 10/);
  assert.match(text, /referrals to \/c fell from 20 to 10/);
  assert.doesNotMatch(text, /referrals to \/b/);
  assert.match(text, /PerplexityBot 4/);
  assert.doesNotMatch(text, /GPTBot 50/);
});

test('actions are capped at 8 and 3 per kind', () => {
  const pageQuery = Array.from({ length: 12 }, (_, i) => row(`/p${i}`, `q${i}`, 10 + i, 0, 8));
  const actions = buildActions({ gsc: { pageQuery, pages: [] }, bots: null });
  assert.equal(actions.length, 3);
  const many = { pageQuery, pages: pageQuery.map((r) => ({ ...r })) };
  const bots = { crawlers: {}, referrals: {}, referralPages: {}, notFound: Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`/n${i}`, 5])) };
  assert.ok(buildActions({ gsc: many, bots, titles: Object.fromEntries(pageQuery.map((r) => [r.page, 'zzz'])) }).length <= 8);
});

test('titleLacksQuery needs half of the query words in the title', () => {
  assert.equal(titleLacksQuery('CSS easing curves', 'css easing'), false);
  assert.equal(titleLacksQuery('Posters', 'riso print guide'), true);
});

test('a change is judged once it is 28 days old, with 28 days before and after', () => {
  const changes = [{ date: '2026-09-01', pages: ['/a'], what: 'old' }, { date: '2026-10-20', pages: ['/a'], what: 'new' }];
  const ws = changeWindows(changes, '2026-10-31');
  assert.equal(ws.length, 1);
  assert.deepEqual(ws[0].before, { start: '2026-08-04', end: '2026-08-31' });
  assert.deepEqual(ws[0].after, { start: '2026-09-01', end: '2026-09-28' });
  const live = changeWindows([{ date: '2026-10-05', pages: ['/a'], what: 'x' }], '2026-10-31');
  assert.equal(live[0].after.end, '2026-10-31');
});

test('change effect sums clicks and impressions and weights the position', () => {
  const before = [row('/a', '', 10, 1, 10), row('/a2', '', 30, 2, 6), row('/z', '', 99, 9, 1)];
  const after = [row('/a', '', 40, 8, 5)];
  const e = changeEffect(changeWindows([{ date: '2026-09-01', pages: ['/a', '/a2'], what: 'w' }], '2026-10-31')[0], before, after);
  assert.deepEqual(e.before, { clicks: 3, impressions: 40, position: 7 });
  assert.deepEqual(e.after, { clicks: 8, impressions: 40, position: 5 });
  assert.deepEqual(totalsFor([], ['/a']), { clicks: 0, impressions: 0, position: null });
});

test('botSummary counts crawlers, referral sources, landing pages and 404s', () => {
  const ev = (o) => ({ t: '2026-10-30T00:00:00Z', served: 'html', wantsMd: false, refHost: '', ...o });
  const s = botSummary([
    ev({ class: 'ai-training', bot: 'GPTBot', path: '/a' }), ev({ class: 'ai-training', bot: 'GPTBot', path: '/b' }),
    ev({ class: 'ai-training', bot: 'GPTBot', path: '/gone', status: 404 }),
    ev({ class: 'ai-referral', bot: 'chatgpt', path: '/a' }),
  ]);
  assert.equal(s.crawlers.GPTBot.hits, 2);
  assert.deepEqual(s.referrals, { chatgpt: 1 });
  assert.deepEqual(s.referralPages, { '/a': 1 });
  assert.deepEqual(s.notFound, { '/gone': 1 });
});

test('the report says when there is no earlier snapshot and when the bot part is skipped', () => {
  const snapshot = { date: '2026-11-03', window: windowDates('2026-11-03', 28), gsc: { pageQuery: [], pages: [row('/a', '', 5, 1, 3)], queries: [] }, bots: null };
  const text = renderReport({ snapshot, prev: null, actions: [], botNote: 'bot log skipped: no token' }).join('\n');
  assert.match(text, /no earlier snapshot/);
  assert.match(text, /bot log skipped: no token/);
  assert.doesNotMatch(text, new RegExp(String.fromCharCode(0x2014)));
});

test('the bot log download checks the token in constant time form and picks files by day', () => {
  assert.equal(tokenMatches('Bearer abc', 'abc'), true);
  assert.equal(tokenMatches('Bearer abd', 'abc'), false);
  assert.equal(tokenMatches('Bearer ab', 'abc'), false);
  assert.equal(tokenMatches('abc', 'abc'), false);
  assert.equal(tokenMatches(null, 'abc'), false);
  assert.equal(tokenMatches('Bearer abc', undefined), false);
  assert.equal(tokenMatches('Bearer ', ''), false);
  assert.deepEqual([parseDays(null), parseDays('x'), parseDays('0'), parseDays('28'), parseDays('500')], [7, 7, 7, 28, 90]);
  const names = ['bots-2026-10-01.jsonl', 'bots-2026-10-30.jsonl', 'bots-2026-11-02.jsonl', 'other.txt'];
  assert.deepEqual(logFilesFor(names, 7, new Date('2026-11-03T10:00:00Z')), ['bots-2026-10-30.jsonl', 'bots-2026-11-02.jsonl']);
});

test('githubLines shows stars with the change since the last snapshot, views and the referrers', async () => {
  const { githubLines } = await import('../../harness/lib/seo-report.mjs');
  const gh = { stars: 16, views: { count: 143, uniques: 77 }, referrers: [{ referrer: 'vawe.dev', count: 55, uniques: 40 }] };
  assert.deepEqual(githubLines(gh, { stars: 14 }), ['', 'GitHub (its last 14 days)', '  stars: 16 (+2)', '  repo views: 143 by 77 people', '  from vawe.dev: 40 people']);
  assert.deepEqual(githubLines(gh, undefined).slice(2, 3), ['  stars: 16']);
  assert.deepEqual(githubLines({ note: 'GitHub skipped: x' }), ['', 'GitHub (its last 14 days)', '  GitHub skipped: x']);
});
