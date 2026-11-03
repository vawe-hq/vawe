// vawe-dev bots: reads the site's bot log (site/lib/bots.ts writes it) into per-bot lines.
import fs from 'node:fs';
import path from 'node:path';

// Bots whose vendor publishes an IP list. A bot absent here cannot be verified by address.
export const IP_LISTS = {
  GPTBot: 'https://openai.com/gptbot.json',
  'OAI-SearchBot': 'https://openai.com/searchbot.json',
  'ChatGPT-User': 'https://openai.com/chatgpt-user.json',
  ClaudeBot: 'https://claude.com/crawling/bots.json',
  'Claude-SearchBot': 'https://claude.com/crawling/bots.json',
  'Claude-User': 'https://claude.com/crawling/bots.json',
  PerplexityBot: 'https://www.perplexity.com/perplexitybot.json',
  'Perplexity-User': 'https://www.perplexity.com/perplexity-user.json',
  Googlebot: 'https://developers.google.com/static/search/apis/ipranges/googlebot.json',
  Bingbot: 'https://www.bing.com/toolbox/bingbot.json',
};

export function readEvents(target, { days, now = Date.now() } = {}) {
  const files = fs.statSync(target).isDirectory()
    ? fs.readdirSync(target).filter((f) => /^bots-.*\.jsonl$/.test(f)).sort().map((f) => path.join(target, f))
    : [target];
  return files.flatMap((file) => parseEvents(fs.readFileSync(file, 'utf8'), { days, now }));
}

/** The events of one jsonl text, from the last `days` days when given. */
export function parseEvents(text, { days, now = Date.now() } = {}) {
  const since = days ? now - days * 86400000 : 0;
  const events = [];
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    try {
      const e = JSON.parse(line);
      if (Date.parse(e.t) >= since) events.push(e);
    } catch { /* a torn last line */ }
  }
  return events;
}

function ipToBig(ip) {
  if (ip.includes(':')) {
    const [head, tail = ''] = ip.split('::');
    const h = head ? head.split(':') : [];
    const t = tail ? tail.split(':') : [];
    const groups = ip.includes('::') ? [...h, ...Array(8 - h.length - t.length).fill('0'), ...t] : h;
    if (groups.length !== 8) return null;
    return { v: 6, n: groups.reduce((a, g) => (a << 16n) | BigInt(parseInt(g || '0', 16)), 0n) };
  }
  const p = ip.split('.').map(Number);
  if (p.length !== 4 || p.some((x) => !(x >= 0 && x <= 255))) return null;
  return { v: 4, n: p.reduce((a, x) => (a << 8n) | BigInt(x), 0n) };
}

export function parseCidr(s) {
  const [addr, len] = s.split('/');
  const a = ipToBig(addr);
  if (!a) return null;
  const bits = a.v === 4 ? 32 : 128;
  const l = len === undefined ? bits : Number(len);
  return { v: a.v, base: a.n >> BigInt(bits - l), shift: BigInt(bits - l) };
}

export function ipInList(ip, cidrs) {
  const a = ipToBig(ip);
  return !!a && cidrs.some((c) => c.v === a.v && a.n >> c.shift === c.base);
}

export function cidrsFromJson(json) {
  const out = [];
  const walk = (x) => {
    if (typeof x === 'string') {
      if (/^[0-9a-f:.]+(\/\d+)?$/i.test(x) && (x.includes('.') || x.includes(':'))) {
        const c = parseCidr(x);
        if (c) out.push(c);
      }
    } else if (x && typeof x === 'object') Object.values(x).forEach(walk);
  };
  walk(json);
  return out;
}

const pct = (n, d) => (d ? `${Math.round((100 * n) / d)}%` : '0%');
const top = (counts, n) => [...counts.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, n);
const bump = (m, k) => m.set(k, (m.get(k) ?? 0) + 1);

// lists: { botName: parsed cidr[] | null } where null means "list not available". Pure.
export function summarize(events, lists = {}) {
  const groups = new Map();
  const referrals = new Map();
  for (const e of events) {
    if (e.class === 'ai-referral') {
      const m = referrals.get(e.path) ?? new Map();
      bump(m, e.bot);
      referrals.set(e.path, m);
      continue;
    }
    const key = `${e.class}/${e.bot}`;
    const g = groups.get(key) ?? { class: e.class, bot: e.bot, hits: 0, paths: new Map(), md: 0, wantsMd: 0, nf: new Map(), verified: 0, unverified: 0, noList: 0, noIp: 0 };
    if (e.status === 404) {
      bump(g.nf, e.path);
      continue;
    }
    g.hits++;
    bump(g.paths, e.path);
    if (e.served === 'md') g.md++;
    if (e.wantsMd) g.wantsMd++;
    const list = lists[e.bot];
    if (!IP_LISTS[e.bot] || list === null || list === undefined) g.noList++;
    else if (!e.ip) g.noIp++;
    else if (ipInList(e.ip, list)) g.verified++;
    else g.unverified++;
    groups.set(key, g);
  }
  const rows = [...groups.values()].sort((a, b) => (a.class < b.class ? -1 : a.class > b.class ? 1 : b.hits - a.hits));
  return { rows, referrals };
}

export function reportLines(events, lists) {
  if (!events.length) return ['no bot events'];
  const { rows, referrals } = summarize(events, lists);
  const ts = events.map((e) => e.t).sort();
  const out = [`${events.length} events, ${ts[0].slice(0, 10)} to ${ts.at(-1).slice(0, 10)}`];
  let cls = '';
  for (const g of rows) {
    if (g.class !== cls) { cls = g.class; out.push('', cls); }
    const ip = [g.verified && `${g.verified} verified`, g.unverified && `${g.unverified} UNVERIFIED`, g.noList && `${g.noList} no vendor list`, g.noIp && `${g.noIp} no ip`].filter(Boolean).join(', ');
    out.push(`  ${g.bot}: ${g.hits} hits, ${g.paths.size} pages, md ${pct(g.md, g.hits)}, wantsMd ${pct(g.wantsMd, g.hits)}; ip: ${ip}`);
    out.push(`    top: ${top(g.paths, 5).map(([p, n]) => `${p} (${n})`).join(', ')}`);
    if (g.nf.size) out.push(`    404: ${[...g.nf.values()].reduce((a, b) => a + b, 0)} on ${top(g.nf, 8).map(([p, n]) => `${p} (${n})`).join(', ')}`);
  }
  if (referrals.size) {
    out.push('', 'ai-referral landings');
    const sorted = [...referrals.entries()].map(([p, m]) => [p, m, [...m.values()].reduce((a, b) => a + b, 0)]).sort((a, b) => b[2] - a[2]);
    for (const [p, m, n] of sorted.slice(0, 15)) out.push(`  ${p}: ${n} (${top(m, 5).map(([b, c]) => `${b} ${c}`).join(', ')})`);
  }
  return out;
}
