#!/usr/bin/env node
// Reference and render frames at the SAME exact seconds, side by side, one row per time, in one PNG.
//   node harness/media/compare-frames.mjs --page <page.html> --at 1,2,3   (no --ref: your frames only, labelled, 3 per row)
//   node harness/media/compare-frames.mjs <ours.mp4> --ref <ref.mp4> --at 2.5,3.1 [--from <s>] [--out file.png]
//   node harness/media/compare-frames.mjs <ours.mp4> --at 1,4,7 [--out file.png]   (no --ref: a labelled sheet of those seconds, 3 per row)
// --at is film seconds, or `cuts` for the middle of each world change (a page, or an mp4 whose film has a measured draft); --from is the film second where ours starts (a --from/--to draft).
// Each frame is an accurate seek (-ss after -i), never an fps=N,tile sheet: those drift about 0.1 s.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { paramsFilm } from '../lib/page-params.mjs';
import { outFile } from '../lib/out-target.mjs';
import { isMain } from '../lib/is-main.mjs';
import { drawtextFont } from '../lib/scratch.mjs';

const ROW_H = 360;
/** `--at cuts`: the middle of each world change of ours, from the last full draft's measured data-world spans. */
export const CUTS = 'cuts';
const die = (m) => { console.error(`✗ ${m}`); process.exit(2); };

function grab(video, t, out, label = t) {
  const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', video, '-ss', String(t), '-frames:v', '1',
    '-vf', `scale=-2:${ROW_H},drawtext=${drawtextFont}text='${path.basename(video, path.extname(video))} ${label}s':x=12:y=12:fontsize=22:fontcolor=white:box=1:boxcolor=black@0.6`, out]);
  if (r.status !== 0 || !fs.existsSync(out)) die(`no frame at ${t}s in ${video}: ${String(r.stderr || '').trim()}`);
}

// One row per time: the reference frame left, `oursAt(t, i, dir)` (a PNG path it writes) right.
async function sheet({ ref, times, out, oursAt }) {
  const dir = fs.mkdtempSync(path.join(fs.realpathSync(path.dirname(out)), '.cmp-'));
  try {
    const rows = [];
    for (const [i, t] of times.entries()) {
      const a = path.join(dir, `r${i}.png`), row = path.join(dir, `row${i}.png`);
      grab(ref, t, a);
      const b = await oursAt(t, i, dir);
      spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', a, '-i', b, '-filter_complex', 'hstack=inputs=2', row]);
      rows.push(row);
    }
    const args = rows.flatMap((r) => ['-i', r]);
    const filter = rows.length > 1 ? ['-filter_complex', `vstack=inputs=${rows.length}`] : [];
    const r = spawnSync('ffmpeg', ['-v', 'error', '-y', ...args, ...filter, out]);
    if (r.status !== 0) die(`stack failed: ${String(r.stderr || '').trim()}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  return out;
}

async function framesOnly({ times, out, oursAt }) {
  const dir = fs.mkdtempSync(path.join(fs.realpathSync(path.dirname(out)), '.cmp-'));
  try {
    const pngs = [];
    for (const [i, t] of times.entries()) pngs.push(await oursAt(t, i, dir));
    tile(pngs, out);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  return out;
}

/** The seconds of a --at value, or an Error naming the flag. Pure. */
export function parseAt(text) {
  if (text === undefined || text === '') throw new Error('missing --at: comma-separated film seconds, for example --at 1,4,7');
  const parts = String(text).split(',').map((s) => s.trim());
  const bad = parts.filter((s) => s === '' || !Number.isFinite(Number(s)) || Number(s) < 0);
  if (bad.length) throw new Error(`--at has a value that is not a number of seconds: "${bad.join('", "')}" (use for example --at 1,4,7)`);
  return parts.map(Number);
}

/** The first problem in the input of compare, naming the flag or argument at fault, or null. Pure. */
export function compareProblem({ ours, page, ref, at }) {
  if (!ours && !page) return 'missing <ours.mp4> or --page <page.html>: name the film to take frames from';
  if (ours && page) return 'give <ours.mp4> or --page, not both';
  if (ref && page && ref === page) return '--ref is the page itself: give a reference mp4';
  if (at === CUTS) return null;
  try { parseAt(at); } catch (e) { return e.message; }
  return null;
}

export async function compareFrames({ ours, ref, times, out, from = 0 }) {
  if (!ref) return framesOnly({ times, out, oursAt: (t, i, dir) => { const png = path.join(dir, `o${i}.png`); grab(ours, t - from, png, t); return png; } });
  return sheet({ ref, times, out, oursAt: (t, i, dir) => {
    const png = path.join(dir, `o${i}.png`);
    grab(ours, t - from, png, t);
    return png;
  } });
}

// No reference: the frames alone, labelled with time, tiled up to 3 per row.
export function tile(pngs, out) {
  const cols = Math.min(pngs.length, 3), rows = Math.ceil(pngs.length / cols);
  const seq = path.join(path.dirname(pngs[0]), 't%d.png');
  pngs.forEach((p, i) => fs.copyFileSync(p, seq.replace('%d', i + 1)));
  const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-framerate', '1', '-i', seq, '-vf', `scale=-2:${ROW_H},tile=${cols}x${rows}`, '-frames:v', '1', out]);
  if (r.status !== 0) die(`tile failed: ${String(r.stderr || '').trim()}`);
}

const labelOn = (text) => {
  const el = document.createElement('div');
  el.id = '__cmp-label';
  el.textContent = text;
  el.style.cssText = 'position:fixed;left:12px;top:12px;z-index:2147483647;font:44px/1.2 monospace;color:#fff;background:rgba(0,0,0,.6);padding:2px 10px';
  document.documentElement.appendChild(el);
};
const labelOff = () => document.getElementById('__cmp-label')?.remove();

// Page mode: seek the page with the renderer's own functions and screenshot at draft (half) size,
// so a look at a few frames costs one page load, not a range render.
export async function comparePage({ page: pagePath, ref, times, out }) {
  const { openPage, seekAll, resolveFrame, settle } = await import('./render-page.mjs');
  const opened = await openPage(pagePath, resolveFrame(pagePath), { warm: true });
  try {
    if (!opened.reused) {
      await opened.page.goto(opened.url, { waitUntil: 'load' });
      await settle(opened.page);
      await opened.markWarm?.();
    }
    const shoot = async (t, file) => {
      await seekAll(opened.page, t * 1000);
      await opened.page.screenshot({ path: file });
      return file;
    };
    const labelled = async (t, i, dir) => {
      await opened.page.evaluate(labelOn, `${t}s`);
      try { return await shoot(t, path.join(dir, `o${i}.png`)); } finally { await opened.page.evaluate(labelOff); }
    };
    const withRef = async (t, i, dir) => {
      const png = path.join(dir, `o${i}.png`);
      grab(await shoot(t, path.join(dir, `s${i}.png`)), 0, png, t);
      return png;
    };
    return ref ? await sheet({ ref, times, out, oursAt: withRef }) : await framesOnly({ times, out, oursAt: labelled });
  } finally {
    await opened.close();
  }
}

export const compareOut = (source) => path.join('out', `${paramsFilm(`compare-${path.basename(source, path.extname(source))}`)}.png`);

async function main() {
  const argv = process.argv.slice(2);
  const flag = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
  const page = flag('--page');
  const ours = argv.find((a, i) => !a.startsWith('--') && !['--ref', '--at', '--out', '--from', '--page'].includes(argv[i - 1]));
  const ref = flag('--ref');
  const problem = compareProblem({ ours, page, ref, at: flag('--at') });
  if (problem) die(`${problem}; usage: compare-frames.mjs <ours.mp4> | --page <page.html> [--ref <ref.mp4>] --at 2.5,3.1 [--out file.png]`);
  for (const [name, f] of [[page ? '--page' : '<ours.mp4>', page || ours], ['--ref', ref]]) if (f && !fs.existsSync(f)) die(`no such file for ${name}: ${f}`);
  const source = page || ours;
  const times = flag('--at') === CUTS ? await (await import('./see/strip.mjs')).cutSeconds(source) : parseAt(flag('--at'));
  const out = outFile(flag('--out'), compareOut(source));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  if (page) await comparePage({ page, ref, times, out });
  else await compareFrames({ ours, ref, times, out, from: Number(flag('--from')) || 0 });
  const which = flag('--at') === CUTS ? 'the middle of each world change, ' : '';
  console.log(ref ? `✓ ${out}: reference left, yours right, ${which}${times.length} row(s) at ${times.join(', ')} s` : `✓ ${out}: your frames, ${which}at ${times.join(', ')} s, 3 per row, left to right`);
}

if (isMain(import.meta.url)) main().catch((e) => die(e.stack || String(e)));
