// vawe-dev seo [--days n] [--no-save] | --log "<what>" --pages /a,/b: the weekly SEO report for vawe.dev.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseEvents } from '../lib/bots-report.mjs';
import { gscClient } from '../lib/gsc.mjs';
import { MIN_IMPRESSIONS, botSummary, buildActions, changeEffect, changeWindows, flatRows, renderReport, windowDates } from '../lib/seo-report.mjs';

const args = process.argv.slice(2);
const flag = (name) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : undefined);
const days = flag('days') === undefined ? 28 : Number(flag('days'));
const noSave = args.includes('--no-save');
const today = new Date().toISOString().slice(0, 10);

const SEO_DIR = process.env.SEO_DIR || path.join(os.homedir(), '.vawe', 'seo');
const SITE = process.env.GSC_SITE || 'sc-domain:vawe.dev';
const ORIGIN = SITE.startsWith('sc-domain:') ? `https://${SITE.slice('sc-domain:'.length)}` : SITE.replace(/\/$/, '');
const CHANGES = path.join(SEO_DIR, 'changes.jsonl');

function fail(reason) {
  console.error(`vawe-dev seo: ${reason}`);
  process.exit(1);
}

function readJsonl(file) {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l));
}

if (args.includes('--log')) {
  const what = flag('log');
  if (!what || what.startsWith('--')) fail('--log needs the text of the change');
  const pages = (flag('pages') ?? '').split(',').map((p) => p.trim()).filter(Boolean);
  fs.mkdirSync(SEO_DIR, { recursive: true });
  fs.appendFileSync(CHANGES, `${JSON.stringify({ date: today, pages, what })}\n`);
  console.log(`logged ${today}: ${what} [${pages.join(', ')}]`);
  process.exit(0);
}

if (!Number.isInteger(days) || days < 1) fail('--days needs a whole number of 1 or more');
const keyPath = process.env.GSC_SA_JSON;
if (!keyPath || !fs.existsSync(keyPath)) fail('set GSC_SA_JSON to the path of the service-account key file');

async function botEvents() {
  const token = process.env.VAWE_BOT_LOG_TOKEN;
  if (!token) return { note: 'bot log skipped: VAWE_BOT_LOG_TOKEN is not set' };
  const res = await fetch(`${ORIGIN}/api/bot-log?days=${days}`, { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(30000) });
  if (!res.ok) return { note: `bot log skipped: ${ORIGIN}/api/bot-log answered ${res.status} (route not deployed, or the token is wrong)` };
  return { events: parseEvents(await res.text()) };
}

async function pageTitles(pages) {
  const titles = {};
  await Promise.all(pages.map(async (p) => {
    try {
      const html = await (await fetch(ORIGIN + p, { signal: AbortSignal.timeout(15000) })).text();
      const t = /<title[^>]*>([^<]*)<\/title>/i.exec(html);
      if (t) titles[p] = t[1].trim();
    } catch { /* a page that does not load gives no title and no gap action */ }
  }));
  return titles;
}

function previousSnapshot() {
  const dir = path.join(SEO_DIR, 'snapshots');
  if (!fs.existsSync(dir)) return null;
  const newest = fs.readdirSync(dir).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f) && f.slice(0, 10) < today).sort().at(-1);
  return newest ? JSON.parse(fs.readFileSync(path.join(dir, newest), 'utf8')) : null;
}

const gsc = await gscClient(keyPath, SITE).catch((e) => fail(e.message));
const window = windowDates(today, days);
const pull = (dims, w = window) => gsc.query({ start: w.start, end: w.end, dimensions: dims });
let pageQuery, pages, queries, effects;
try {
  [pageQuery, pages, queries] = await Promise.all([pull(['page', 'query']), pull(['page']), pull(['query'])]);
  const data = { pageQuery: flatRows(pageQuery, ['page', 'query']), pages: flatRows(pages, ['page']), queries: flatRows(queries, ['query']) };
  [pageQuery, pages, queries] = [data.pageQuery, data.pages, data.queries];
  effects = [];
  for (const w of changeWindows(readJsonl(CHANGES), window.end)) {
    const [b, a] = await Promise.all([pull(['page'], w.before), pull(['page'], w.after)]);
    effects.push(changeEffect(w, flatRows(b, ['page']), flatRows(a, ['page'])));
  }
} catch (e) {
  fail(e.message);
}

const log = await botEvents().catch((e) => ({ note: `bot log skipped: ${e.message}` }));
const snapshot = {
  date: today, window,
  gsc: { pageQuery, pages, queries },
  bots: log.events ? botSummary(log.events) : null,
};
const prev = previousSnapshot();
const candidates = [...new Set(pageQuery.filter((r) => r.impressions >= MIN_IMPRESSIONS).map((r) => r.page))].slice(0, 25);
const actions = buildActions({ gsc: snapshot.gsc, bots: snapshot.bots, prevBots: prev?.bots, titles: await pageTitles(candidates), days });
const report = renderReport({ snapshot, prev, effects, actions, botNote: log.note }).join('\n');

if (!noSave) {
  fs.mkdirSync(path.join(SEO_DIR, 'snapshots'), { recursive: true });
  fs.mkdirSync(path.join(SEO_DIR, 'reports'), { recursive: true });
  fs.writeFileSync(path.join(SEO_DIR, 'snapshots', `${today}.json`), JSON.stringify(snapshot));
  fs.writeFileSync(path.join(SEO_DIR, 'reports', `${today}.md`), `${report}\n`);
}
console.log(report);
console.log(noSave ? '\nnot saved (--no-save)' : `\nsaved to ${SEO_DIR}`);
