// Runs each draft check once per page state and times it. A check outside the mode's tier
// (harness/lib/draft-tiers.mjs) does not run. A result is stored in out/<film>.checks.json under a key of
// the page folder, core/ and the harness code (by size and mtime) plus the check's own settings, so an unchanged
// page re-runs nothing. `put` stores a value the draft derived from them (no cache key). Results are JSON: the value a caller gets is the same on a miss as on a hit.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { REPO_ROOT } from './render-harness.mjs';
import { runsIn } from './draft-tiers.mjs';
import { treeSignature } from '../media/preview-server.mjs';
import { paramsFilm } from './page-params.mjs';

const readJson = (file) => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return {}; } };

export function createChecks({ pagePath, mode = 'draft', cache = true }) {
  const abs = path.resolve(pagePath);
  const base = path.basename(abs, '.html');
  const film = base === 'page' ? path.basename(path.dirname(abs)) : base;
  const file = path.resolve('out', `${paramsFilm(film)}.checks.json`);
  const stored = cache ? readJson(file) : {};
  const kept = {};
  const spent = new Map();
  const outcome = new Map();
  let signature = null;
  const sign = () => (signature ??= treeSignature([path.dirname(abs), path.join(REPO_ROOT, 'core'), path.join(REPO_ROOT, 'harness/lib'), path.join(REPO_ROOT, 'harness/media')]));

  const run = async (check, fn, settings = null) => {
    if (!runsIn(check, mode)) return undefined;
    const key = createHash('sha1').update(JSON.stringify([sign(), check, settings])).digest('hex').slice(0, 16);
    if (stored[check]?.key === key) { kept[check] = stored[check]; spent.set(check, 0); outcome.set(check, 'hit'); return stored[check].value; }
    const t0 = Date.now();
    const value = JSON.parse(JSON.stringify((await fn()) ?? null));
    spent.set(check, (spent.get(check) ?? 0) + Date.now() - t0);
    kept[check] = { key, value };
    outcome.set(check, 'miss');
    return value;
  };

  const put = (check, value) => { kept[check] = { key: 'derived', value }; };

  const time = async (name, fn) => {
    const t0 = Date.now();
    try { return await fn(); } finally { spent.set(name, (spent.get(name) ?? 0) + Date.now() - t0); }
  };

  return {
    run,
    put,
    time,
    mode,
    save: () => { if (cache) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(kept)); } },
    seconds: () => [...spent].map(([check, ms]) => [check, ms / 1000]),
    cache: () => ({ hit: [...outcome.values()].filter((o) => o === 'hit').length, miss: [...outcome.values()].filter((o) => o === 'miss').length }),
  };
}

/** The time line a draft prints: `time: capture 18.0 s (draft: jpeg, gpu) · checks 8.8 s (contrast 3.1, spec 2.0) · encode 0.3 s`. Pure. */
export function timeLine({ captureMs, encodeMs, checks, capture }) {
  const total = checks.reduce((a, [, s]) => a + s, 0);
  const parts = checks.filter(([, s]) => s >= 0.05).sort((a, b) => b[1] - a[1]).map(([name, s]) => `${name} ${s.toFixed(1)}`);
  return `time: capture ${(captureMs / 1000).toFixed(1)} s${capture ? ` (${capture})` : ''} · checks ${total.toFixed(1)} s${parts.length ? ` (${parts.join(', ')})` : ''} · encode ${(encodeMs / 1000).toFixed(1)} s`;
}
