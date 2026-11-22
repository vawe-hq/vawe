#!/usr/bin/env node
// Per-step SSIM between your render and the reference at the reference size, so no second of the film
// goes unchecked. Prints min SSIM per second and the worst moments, writes the worst 6 as one compare sheet.
//   node harness/media/coverage.mjs <ours.mp4> --ref <ref.mp4> [--step 0.1] [--min 0.5] [--out sheet.png]
// Exit 1 when any second falls below --min.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { compareFrames } from './compare-frames.mjs';
import { textTimeline } from './see/text-timeline.mjs';
import { scratch } from '../lib/scratch.mjs';
import { isMain } from '../lib/is-main.mjs';

const SHEET_ROWS = 6;
const SIZE = '736:414';
const die = (m) => { console.error(`✗ ${m}`); process.exit(2); };

function ssimRows(ours, ref, step) {
  const fps = 1 / step;
  const lavfi = `[0:v]fps=${fps},scale=${SIZE},format=gray[a];[1:v]fps=${fps},scale=${SIZE},format=gray[b];[a][b]ssim=stats_file=-`;
  const r = spawnSync('ffmpeg', ['-v', 'error', '-i', ours, '-i', ref, '-lavfi', lavfi, '-f', 'null', '-'],
    { encoding: 'utf8', maxBuffer: 1 << 26 });
  if (r.status !== 0) die(`ffmpeg ssim failed: ${String(r.stderr || '').trim()}`);
  return r.stdout.split('\n').filter(Boolean).map((l) => ({
    t: (Number(/n:(\d+)/.exec(l)[1]) - 1) * step,
    ssim: Number(/All:([\d.]+)/.exec(l)[1]),
  }));
}

// The worst samples, at least `gap` seconds apart, so the sheet shows six moments, not one bad second six times.
export function worstMoments(rows, count, gap) {
  const picked = [];
  for (const row of [...rows].sort((a, b) => a.ssim - b.ssim)) {
    if (picked.every((p) => Math.abs(p.t - row.t) >= gap)) picked.push(row);
    if (picked.length === count) break;
  }
  return picked.sort((a, b) => a.t - b.t);
}

export async function coverage({ ours, ref, step = 0.1, min = 0.5, out }) {
  const rows = ssimRows(ours, ref, step);
  if (!rows.length) die('no samples: the two videos share no frames');
  const mean = rows.reduce((a, b) => a + b.ssim, 0) / rows.length;
  const perSecond = [];
  for (const row of rows) (perSecond[Math.floor(row.t)] ||= []).push(row.ssim);
  const mins = perSecond.map((v) => (v ? Math.min(...v) : 1));
  const worst = worstMoments(rows, SHEET_ROWS, 0.5);
  const low = mins.map((m, s) => ({ s, m })).filter((x) => x.m < min);

  console.log(`${rows.length} samples every ${step}s, mean SSIM ${mean.toFixed(3)}, worst ${Math.min(...rows.map((r) => r.ssim)).toFixed(2)}`);
  console.log('\nper second (min SSIM, lower = more different):');
  console.log(mins.map((m, s) => `${String(s).padStart(3)}s ${m.toFixed(2)} ${'#'.repeat(Math.round(m * 20))}${m < min ? '  < min' : ''}`).join('\n'));
  console.log('\nworst moments:', worst.map((w) => `${w.t.toFixed(1)}s=${w.ssim.toFixed(2)}`).join(' '));
  if (out) {
    fs.mkdirSync(path.dirname(out), { recursive: true });
    await compareFrames({ ours, ref, times: worst.map((w) => w.t), out });
    console.log(`sheet: ${path.relative(process.cwd(), out)} (reference left, yours right, rows at ${worst.map((w) => w.t.toFixed(1)).join(', ')} s)`);
  }
  return { mean, low };
}

const TEXT_FPS = 4;
const TEXT_TOLERANCE = 0.25;
const TOKEN_OVERLAP = 0.6;
const PERSISTENT_SHARE = 0.5;
const MAX_SHIFT = 2;

const tokens = (text) => new Set(text.toLowerCase().match(/[a-z0-9]{3,}/g) || []);
const overlap = (refTokens, ourTokens) => {
  if (!refTokens.size) return 0;
  let hit = 0;
  for (const t of refTokens) if (ourTokens.has(t)) hit++;
  return hit / refTokens.size;
};
const samplesOf = (rows) => rows.reduce((n, r) => n + Math.round((r.t1 - r.t0) * TEXT_FPS) + 1, 0);

/** Walks the reference text rows against ours. -> { persistent: words, missing, shifted, ok } (rows carry t0, text, offset).
 *  A match further than MAX_SHIFT seconds away counts as missing, not shifted. */
export function textCoverage(refRows, ourRows) {
  const prep = (rows) => rows.filter((r) => r.text).map((r) => ({ ...r, tok: tokens(r.text) })).filter((r) => r.tok.size);
  const refs = prep(refRows);
  const ours = prep(ourRows);
  const shareOf = (rows, token, total) => samplesOf(rows.filter((r) => r.tok.has(token))) / total;
  const refTotal = Math.max(1, samplesOf(refRows));
  const ourTotal = Math.max(1, samplesOf(ourRows));
  const persistentTokens = new Set();
  const refOnly = [];
  for (const token of new Set(refs.flatMap((r) => [...r.tok]))) {
    if (shareOf(refs, token, refTotal) < PERSISTENT_SHARE) continue;
    if (shareOf(ours, token, ourTotal) >= PERSISTENT_SHARE) persistentTokens.add(token);
    else refOnly.push(token);
  }
  const strip = (rows) => rows.map((r) => ({ ...r, tok: new Set([...r.tok].filter((t) => !persistentTokens.has(t))) })).filter((r) => r.tok.size);
  const result = { persistent: [...persistentTokens], refOnly, missing: [], shifted: [], ok: [] };
  const ourRowsLeft = strip(ours);
  for (const row of strip(refs)) {
    const found = ourRowsLeft.filter((o) => overlap(row.tok, o.tok) >= TOKEN_OVERLAP && Math.abs(o.t0 - row.t0) <= MAX_SHIFT);
    if (!found.length) { result.missing.push(row); continue; }
    const offset = found.map((o) => o.t0 - row.t0).sort((a, b) => Math.abs(a) - Math.abs(b))[0];
    if (Math.abs(offset) > TEXT_TOLERANCE + 1e-9) result.shifted.push({ ...row, offset });
    else result.ok.push(row);
  }
  return result;
}

async function textMain(ours, ref) {
  const work = scratch('coverage-text');
  const [refRuns, ourRuns] = await Promise.all([textTimeline(ref, work, TEXT_FPS), textTimeline(ours, work, TEXT_FPS)]);
  const cov = textCoverage(refRuns, ourRuns);
  const at = (r) => `${r.t0.toFixed(2)}s`.padStart(7);
  console.log(`text rows in the reference: ${cov.ok.length} on time, ${cov.shifted.length} shifted, ${cov.missing.length} missing, ${cov.persistent.length} persistent word(s)`);
  if (cov.refOnly.length) console.log(`  PERSISTENT in the reference only (a corner label yours lacks?): ${cov.refOnly.join(' ')}`);
  if (cov.persistent.length) console.log(`  PERSISTENT words on almost every sample in both, not checked further: ${cov.persistent.join(' ')}`);
  for (const r of cov.shifted) console.log(`  ${r.offset > 0 ? 'LATE   ' : 'EARLY  '}   ${at(r)}  ${Math.abs(r.offset).toFixed(2)}s ${r.offset > 0 ? 'late' : 'early'}  ${r.text}`);
  for (const r of cov.missing) console.log(`  MISSING    ${at(r)}  ${r.text}`);
  if (cov.missing.length) {
    console.error(`✗ ${cov.missing.length} reference text row(s) not found in ${path.basename(ours)}`);
    process.exit(1);
  }
}

async function main() {
  const argv = process.argv.slice(2);
  const flag = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
  const ours = argv.find((a, i) => !a.startsWith('--') && !['--ref', '--step', '--min', '--out'].includes(argv[i - 1]));
  const ref = flag('--ref');
  if (!ours || !ref) die('usage: coverage.mjs <ours.mp4> --ref <ref.mp4> [--step 0.1] [--min 0.5] [--text]');
  for (const f of [ours, ref]) if (!fs.existsSync(f)) die(`no such file: ${f}`);
  if (argv.includes('--text')) return textMain(ours, ref);
  const step = Number(flag('--step')) || 0.1;
  const min = flag('--min') === undefined ? 0.5 : Number(flag('--min'));
  const out = path.resolve(flag('--out') || path.join('out', `coverage-${path.basename(ours, path.extname(ours))}.png`));
  const { low } = await coverage({ ours, ref, step, min, out });
  if (low.length) {
    console.error(`✗ ${low.length} second(s) below ${min}: ${low.map((x) => `${x.s}s`).join(' ')}`);
    process.exit(1);
  }
}

if (isMain(import.meta.url)) main().catch((e) => die(e.stack || String(e)));
