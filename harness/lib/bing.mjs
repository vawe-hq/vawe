// Bing Webmaster Tools, read with the site's API key (bing.com/webmasters, Settings, API access).
// Bing's index also feeds ChatGPT search and Copilot, so its numbers sit next to Google's in the report.
import { toPath } from './seo-report.mjs';

const API = 'https://ssl.bing.com/webmaster/api.svc/json';

// Bing writes dates as "/Date(1731456000000)/" or "/Date(1731456000000-0800)/".
export function bingDate(value) {
  const ms = /\/Date\((-?\d+)/.exec(String(value))?.[1];
  return ms === undefined ? null : new Date(Number(ms)).toISOString().slice(0, 10);
}

/** Bing's QueryStats rows summed per key over the window. `keyName` is "page" or "query". */
export function sumBingRows(rows, window, keyName) {
  const out = new Map();
  for (const r of rows) {
    const day = bingDate(r.Date);
    if (!day || day < window.start || day > window.end) continue;
    const key = keyName === 'page' ? toPath(r.Query) : r.Query;
    const cur = out.get(key) ?? { [keyName]: key, clicks: 0, impressions: 0 };
    cur.clicks += r.Clicks ?? 0;
    cur.impressions += r.Impressions ?? 0;
    out.set(key, cur);
  }
  return [...out.values()].sort((a, b) => b.impressions - a.impressions);
}

export async function bingStats({ key, siteUrl, window, fetchImpl = fetch }) {
  const get = async (method) => {
    const url = `${API}/${method}?siteUrl=${encodeURIComponent(siteUrl)}&apikey=${encodeURIComponent(key)}`;
    const res = await fetchImpl(url, { signal: AbortSignal.timeout(30000) });
    if (!res.ok) throw new Error(`${method} answered ${res.status}`);
    return (await res.json()).d ?? [];
  };
  const [pages, queries] = await Promise.all([get('GetPageStats'), get('GetQueryStats')]);
  return { pages: sumBingRows(pages, window, 'page'), queries: sumBingRows(queries, window, 'query') };
}
