import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { classifyRequest, buildBotEvent, appendBotEvent, logBotRequest, buildActionEvent, isPageView, sourceOf } from '../../site/lib/bots.ts';
import { linkAction } from '../../site/lib/actions.ts';
import { cidrsFromJson, ipInList, readEvents, reportLines } from '../../harness/lib/bots-report.mjs';
import config from '../../site/next.config.mjs';
import { ALIAS_HOST_PATTERN } from '../../site/lib/redirects.mjs';

const UA = {
  gptbot: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.4; +https://openai.com/gptbot',
  oaiSearch: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36; compatible; OAI-SearchBot/1.4; +https://openai.com/searchbot',
  chatgptUser: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot',
  claudeUser: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Claude-User/1.0; +Claude-User@anthropic.com)',
  perplexity: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)',
  perplexityUser: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Perplexity-User/1.0; +https://perplexity.ai/perplexity-user)',
  googlebot: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  chrome: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
};

test('vendor user agents map to their class', () => {
  const cases = [
    [UA.gptbot, 'ai-training', 'GPTBot'],
    ['Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)', 'ai-training', 'ClaudeBot'],
    ['Mozilla/5.0 (Applebot-Extended/0.1)', 'ai-training', 'Applebot-Extended'],
    [UA.oaiSearch, 'ai-search', 'OAI-SearchBot'],
    [UA.perplexity, 'ai-search', 'PerplexityBot'],
    [UA.chatgptUser, 'ai-user-fetch', 'ChatGPT-User'],
    [UA.claudeUser, 'ai-user-fetch', 'Claude-User'],
    [UA.perplexityUser, 'ai-user-fetch', 'Perplexity-User'],
    [UA.googlebot, 'search-engine', 'Googlebot'],
    ['Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)', 'search-engine', 'Bingbot'],
    ['Mozilla/5.0 (Macintosh) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17 Safari/605.1.15 (Applebot/0.1)', 'search-engine', 'Applebot'],
  ];
  for (const [userAgent, cls, bot] of cases) assert.deepEqual(classifyRequest({ userAgent }), { class: cls, bot }, bot);
});

test('coding agents are told apart by the fingerprints in arxiv 2604.02544', () => {
  assert.equal(classifyRequest({ userAgent: 'axios/1.8.4' }).bot, 'claude-code');
  assert.equal(classifyRequest({ userAgent: 'axios/1.7.0' }).class, 'other');
  assert.equal(classifyRequest({ userAgent: 'got (https://github.com/sindresorhus/got)' }).bot, 'cursor');
  assert.equal(classifyRequest({ userAgent: 'colly - https://github.com/gocolly/colly' }).bot, 'windsurf');
  assert.equal(classifyRequest({ userAgent: 'Mozilla/5.0 (X11) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0 Safari/537.36 Aider/0.86.2 +https://aider.chat/' }).bot, 'aider');
  const opencodeAccept = 'text/html;q=1.0, application/xhtml+xml;q=0.9, text/plain;q=0.8, text/markdown;q=0.7, */*;q=0.1';
  assert.equal(classifyRequest({ userAgent: UA.chrome, accept: opencodeAccept }).bot, 'opencode');
  assert.equal(classifyRequest({ userAgent: UA.chrome, accept: 'text/html,application/xhtml+xml' }).class, 'other');
});

test('a human is other, or an ai-referral by referer host or utm_source', () => {
  assert.equal(classifyRequest({ userAgent: UA.chrome }).class, 'other');
  assert.deepEqual(classifyRequest({ userAgent: UA.chrome, referer: 'https://chatgpt.com/' }), { class: 'ai-referral', bot: 'chatgpt' });
  assert.equal(classifyRequest({ userAgent: UA.chrome, referer: 'https://www.perplexity.ai/search?q=x' }).bot, 'perplexity');
  assert.equal(classifyRequest({ userAgent: UA.chrome, referer: 'https://claude.ai/' }).bot, 'claude');
  assert.equal(classifyRequest({ userAgent: UA.chrome, referer: 'https://www.google.com/' }).class, 'other');
  assert.equal(classifyRequest({ userAgent: UA.chrome, utmSource: 'chatgpt.com' }).class, 'ai-referral');
});

test('the IP is stored for bot classes and never for humans', () => {
  const bot = buildBotEvent({ userAgent: UA.gptbot, ip: '20.0.0.1', path: '/x' });
  assert.equal(bot.ip, '20.0.0.1');
  const human = buildBotEvent({ userAgent: UA.chrome, referer: 'https://chatgpt.com/', ip: '9.9.9.9', path: '/x' });
  assert.equal(human.class, 'ai-referral');
  assert.equal('ip' in human, false);
  assert.equal(JSON.stringify(human).includes('9.9.9.9'), false);
  assert.equal(buildBotEvent({ userAgent: UA.chrome, ip: '9.9.9.9', path: '/x' }), null);
});

test('the event carries served, wantsMd and refHost', () => {
  const e = buildBotEvent({ userAgent: UA.claudeUser, accept: 'text/markdown, text/html', path: '/blog/a.md', referer: 'https://claude.ai/x', ip: '1.1.1.1', now: new Date('2026-10-28T10:00:00Z') });
  assert.deepEqual(e, { t: '2026-10-28T10:00:00.000Z', class: 'ai-user-fetch', bot: 'Claude-User', path: '/blog/a.md', served: 'md', wantsMd: true, refHost: 'claude.ai', ip: '1.1.1.1' });
});

test('logBotRequest writes one line per bot request, none for humans, none without BOT_LOG_DIR', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bots-'));
  const req = (ua, ip) => ({
    headers: { get: (n) => ({ 'user-agent': ua, 'x-forwarded-for': `${ip}, 10.0.0.1` })[n] ?? null },
    nextUrl: { pathname: '/pricing', searchParams: { get: () => null } },
  });
  logBotRequest(req(UA.gptbot, '20.0.0.1'));
  assert.equal(fs.existsSync(dir) && fs.readdirSync(dir).length, 0);
  process.env.BOT_LOG_DIR = dir;
  try {
    logBotRequest(req(UA.chrome, '9.9.9.9'));
    await appendBotEvent(dir, buildBotEvent({ userAgent: UA.gptbot, ip: '20.0.0.1', path: '/pricing', now: new Date('2026-10-28T00:00:00Z') }));
    logBotRequest(req(UA.gptbot, '20.0.0.1'));
    await new Promise((r) => setTimeout(r, 100));
  } finally {
    delete process.env.BOT_LOG_DIR;
  }
  const files = fs.readdirSync(dir);
  assert.ok(files.includes('bots-2026-10-28.jsonl'));
  const all = files.flatMap((f) => fs.readFileSync(path.join(dir, f), 'utf8').trim().split('\n'));
  assert.equal(all.length, 2);
  assert.equal(all.some((l) => l.includes('9.9.9.9')), false);
  assert.equal(JSON.parse(all.find((l) => !l.includes('2026-10-28T00'))).ip, '20.0.0.1');
});

test('coding agents and a person in VS Code are never logged with an IP', () => {
  const vscode = 'Mozilla/5.0 (Macintosh) AppleWebKit/537.36 (KHTML, like Gecko) Code/1.95.0 Chrome/128.0 Electron/32.0.0 Safari/537.36';
  assert.equal(buildBotEvent({ userAgent: vscode, ip: '9.9.9.9', path: '/x' }), null);
  const agent = buildBotEvent({ userAgent: 'got (https://github.com/sindresorhus/got)', ip: '9.9.9.9', path: '/x' });
  assert.equal(agent.class, 'coding-agent');
  assert.equal('ip' in agent, false);
});

test('the first write of a day deletes bot logs older than 90 days', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'botprune-'));
  for (const f of ['bots-2026-07-01.jsonl', 'bots-2026-07-30.jsonl', 'bots-2026-10-27.jsonl', 'notes.txt']) fs.writeFileSync(path.join(dir, f), '{}\n');
  await appendBotEvent(dir, buildBotEvent({ userAgent: UA.gptbot, path: '/a', now: new Date('2026-10-28T10:00:00Z') }));
  assert.deepEqual(fs.readdirSync(dir).sort(), ['bots-2026-07-30.jsonl', 'bots-2026-10-27.jsonl', 'bots-2026-10-28.jsonl', 'notes.txt']);
  fs.writeFileSync(path.join(dir, 'bots-2026-07-31.jsonl'), '{}\n');
  await appendBotEvent(dir, buildBotEvent({ userAgent: UA.gptbot, path: '/b', now: new Date('2026-10-28T11:00:00Z') }));
  assert.ok(fs.existsSync(path.join(dir, 'bots-2026-07-31.jsonl')));
});

test('IP lists: CIDR matching for v4 and v6', () => {
  const lists = cidrsFromJson({ prefixes: [{ ipv4Prefix: '20.171.206.0/24' }, { ipv6Prefix: '2001:db8::/32' }, { ipv4Prefix: '34.162.230.222/32' }] });
  assert.equal(lists.length, 3);
  assert.ok(ipInList('20.171.206.77', lists));
  assert.ok(!ipInList('20.171.207.1', lists));
  assert.ok(ipInList('2001:db8:1::5', lists));
  assert.ok(ipInList('34.162.230.222', lists));
});

test('the report summarises a fixture log', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'botlog-'));
  const lines = [
    { t: '2026-10-27T10:00:00Z', class: 'ai-training', bot: 'GPTBot', path: '/a', served: 'html', wantsMd: false, refHost: '', ip: '20.171.206.5' },
    { t: '2026-10-27T10:01:00Z', class: 'ai-training', bot: 'GPTBot', path: '/missing', served: 'html', wantsMd: false, refHost: '', ip: '6.6.6.6' },
    { t: '2026-10-27T10:01:00Z', class: 'ai-training', bot: 'GPTBot', path: '/missing', status: 404, served: 'html', wantsMd: false, refHost: '', ip: '6.6.6.6' },
    { t: '2026-10-27T10:02:00Z', class: 'ai-user-fetch', bot: 'Claude-User', path: '/a.md', served: 'md', wantsMd: true, refHost: '', ip: '1.2.3.4' },
    { t: '2026-10-27T10:03:00Z', class: 'coding-agent', bot: 'cursor', path: '/a', served: 'html', wantsMd: false, refHost: '' },
    { t: '2026-10-27T10:04:00Z', class: 'ai-referral', bot: 'chatgpt', path: '/a', served: 'html', wantsMd: false, refHost: 'chatgpt.com' },
    { t: '2026-09-01T10:04:00Z', class: 'ai-referral', bot: 'chatgpt', path: '/old', served: 'html', wantsMd: false, refHost: 'chatgpt.com' },
  ];
  fs.writeFileSync(path.join(dir, 'bots-2026-10-27.jsonl'), lines.map((l) => JSON.stringify(l)).join('\n') + '\n{torn');
  const events = readEvents(dir, { days: 30, now: Date.parse('2026-10-28T00:00:00Z') });
  assert.equal(events.length, 6);
  const text = reportLines(events, { GPTBot: cidrsFromJson({ prefixes: [{ ipv4Prefix: '20.171.206.0/24' }] }), 'Claude-User': null }).join('\n');
  assert.match(text, /GPTBot: 2 hits, 2 pages, md 0%, wantsMd 0%; ip: 1 verified, 1 UNVERIFIED/);
  assert.match(text, /404: 1 on \/missing \(1\)/);
  assert.match(text, /Claude-User: 1 hits, 1 pages, md 100%, wantsMd 100%; ip: 1 no vendor list/);
  assert.match(text, /cursor: 1 hits.*no vendor list/);
  assert.match(text, /ai-referral landings\n {2}\/a: 1 \(chatgpt 1\)/);
});

test('alias hosts redirect to the apex with a 301; own and loopback hosts do not', async () => {
  const env = process.env.NODE_ENV;
  process.env.NODE_ENV = 'development';
  assert.equal((await config.redirects()).some((r) => r.has?.[0]?.value === ALIAS_HOST_PATTERN), false);
  process.env.NODE_ENV = 'production';
  const rules = await config.redirects();
  process.env.NODE_ENV = env;
  const rule = rules.find((r) => r.has?.[0]?.value === ALIAS_HOST_PATTERN);
  assert.equal(rule.statusCode, 301);
  assert.equal(rule.destination, 'https://vawe.dev/:path*');
  const re = new RegExp(ALIAS_HOST_PATTERN);
  for (const h of ['167.233.71.93', 'vawe-abc.workers.dev', 'example.com', '167.233.71.93:3000']) assert.ok(re.test(h), h);
  for (const h of ['vawe.dev', 'localhost', 'localhost:3000', '127.0.0.1:3000', '0.0.0.0:3000', '[::1]:3000']) assert.ok(!re.test(h), h);
  assert.ok(rules.findIndex((r) => r.has?.[0]?.value === 'www.vawe.dev') < rules.indexOf(rule));
});

test('a person loading a page is a visit, named by where they came from', () => {
  const page = { userAgent: UA.chrome, secFetchDest: 'document', method: 'GET' };
  assert.deepEqual(classifyRequest({ ...page, referer: 'https://www.google.com/' }), { class: 'visit', bot: 'google' });
  assert.deepEqual(classifyRequest(page), { class: 'visit', bot: 'direct' });
  assert.deepEqual(classifyRequest({ ...page, referer: 'https://vawe.dev/blog' }), { class: 'visit', bot: 'internal' });
  assert.deepEqual(classifyRequest({ ...page, referer: 'https://dev.to/x' }), { class: 'visit', bot: 'dev.to' });
  assert.deepEqual(classifyRequest({ ...page, utmSource: 'GitHub' }), { class: 'visit', bot: 'github' });
  assert.deepEqual(classifyRequest({ ...page, referer: 'https://chatgpt.com/' }), { class: 'ai-referral', bot: 'chatgpt' });
});

test('prefetches, client navigations, HEAD requests and scripts are not page views', () => {
  const page = { userAgent: UA.chrome, secFetchDest: 'document', method: 'GET' };
  assert.equal(isPageView(page), true);
  assert.equal(isPageView({ ...page, secFetchDest: 'empty' }), false);
  assert.equal(isPageView({ ...page, secFetchDest: null }), false);
  assert.equal(isPageView({ ...page, purpose: 'prefetch;prerender' }), false);
  assert.equal(isPageView({ ...page, method: 'HEAD' }), false);
  assert.equal(isPageView({ ...page, userAgent: 'curl/8.4.0' }), false);
  assert.equal(isPageView({ ...page, userAgent: 'Mozilla/5.0 (X11; Linux x86_64) HeadlessChrome/131.0.0.0' }), false);
  const visit = buildBotEvent({ ...page, path: '/a', ip: '203.0.113.9' });
  assert.equal(visit.class, 'visit');
  assert.equal(visit.ip, undefined);
});

test('sourceOf names search engines, sites and AI hosts, and caps an unknown host', () => {
  assert.equal(sourceOf('www.google.co.in'), 'google');
  assert.equal(sourceOf('news.ycombinator.com'), 'hn');
  assert.equal(sourceOf('t.co'), 'x');
  assert.equal(sourceOf('perplexity.ai'), 'perplexity');
  assert.equal(sourceOf('', 'chatgpt.com'), 'chatgpt');
  assert.equal(sourceOf('a'.repeat(300)).length, 100);
});

test('the beacon body becomes an action event only with a known action and a path', () => {
  const now = new Date('2026-11-21T00:00:00Z');
  assert.deepEqual(buildActionEvent({ a: 'copy-install', p: '/', r: 'https://chatgpt.com/' }, now), {
    t: '2026-11-21T00:00:00.000Z', class: 'action', bot: 'copy-install', path: '/', served: 'html', wantsMd: false, refHost: 'chatgpt.com', src: 'chatgpt',
  });
  assert.equal(buildActionEvent({ a: 'copy-install', p: '/', r: '' }, now).src, 'direct');
  assert.equal(buildActionEvent({ a: 'rm -rf', p: '/' }), null);
  assert.equal(buildActionEvent({ a: 'github', p: 'https://evil.example/' }), null);
  assert.equal(buildActionEvent(null), null);
  assert.equal(buildActionEvent({ a: 'docs', p: '/' + 'x'.repeat(900) }).path.length, 512);
});

test('linkAction counts the repo, the npm package and the docs, nothing else', () => {
  assert.equal(linkAction('https://github.com/vawe-hq/vawe', 'vawe.dev'), 'github');
  assert.equal(linkAction('https://github.com/other/repo', 'vawe.dev'), null);
  assert.equal(linkAction('https://www.npmjs.com/package/@vawe/cli', 'vawe.dev'), 'npm');
  assert.equal(linkAction('https://vawe.dev/docs/quickstart', 'vawe.dev'), 'docs');
  assert.equal(linkAction('https://vawe.dev/docsx', 'vawe.dev'), null);
  assert.equal(linkAction('https://vawe.dev/blog', 'vawe.dev'), null);
  assert.equal(linkAction('not a url', 'vawe.dev'), null);
});
