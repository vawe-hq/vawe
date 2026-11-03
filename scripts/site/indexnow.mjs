#!/usr/bin/env node
// Tell Bing (and the other IndexNow engines) which vawe.dev pages changed, after a deploy.
// It reads the live sitemap and sends every URL whose <lastmod> is on or after --since.
//   node scripts/site/indexnow.mjs [--since YYYY-MM-DD | --all] [--dry-run]
// The default --since is yesterday, so running it after each deploy covers that day's changes.
const HOST = 'vawe.dev';
// The key file site/public/<KEY>.txt must hold exactly this key; the engines fetch it to check ownership.
const KEY = 'b46c6d7bc36449c988f4016eaeb49a66';
// IndexNow accepts at most 10,000 URLs per request.
const BATCH = 10000;

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args[i + 1];
};
const all = args.includes('--all');
const dryRun = args.includes('--dry-run');
const since = flag('--since') ?? new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
if (!all && !/^\d{4}-\d{2}-\d{2}$/.test(since)) throw new Error(`--since must be YYYY-MM-DD, got "${since}"`);

function changedUrls(xml, { since, all }) {
  const urls = [];
  for (const [, block] of xml.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
    const loc = /<loc>([^<]+)<\/loc>/.exec(block)?.[1];
    const lastmod = /<lastmod>([^<]+)<\/lastmod>/.exec(block)?.[1]?.slice(0, 10);
    if (loc && (all || (lastmod && lastmod >= since))) urls.push(loc);
  }
  return urls;
}

const res = await fetch(`https://${HOST}/sitemap.xml`);
if (!res.ok) throw new Error(`sitemap: HTTP ${res.status}`);
const urls = changedUrls(await res.text(), { since, all });
console.log(`${urls.length} URL(s) ${all ? 'in the sitemap' : `changed since ${since}`}`);
if (dryRun || urls.length === 0) {
  for (const u of urls.slice(0, 20)) console.log(`  ${u}`);
  process.exit(0);
}

for (let i = 0; i < urls.length; i += BATCH) {
  const r = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host: HOST, key: KEY, keyLocation: `https://${HOST}/${KEY}.txt`, urlList: urls.slice(i, i + BATCH) }),
  });
  // 200 and 202 both mean accepted; 202 means the key check is still pending.
  if (r.status !== 200 && r.status !== 202) throw new Error(`IndexNow: HTTP ${r.status} ${await r.text()}`);
  console.log(`✓ sent ${Math.min(BATCH, urls.length - i)} URL(s): HTTP ${r.status}`);
}
