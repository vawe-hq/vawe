#!/usr/bin/env node
// `vawe frame <page|mp4|folder> [--at s,s,...] [--from s] [--labels] [--cols n] [--out file.png]`: a storyboard sheet, one tile per second,
// the second printed on each tile and, with --labels, the data-world id of the world on top (a page only).
//   node harness/media/sheet.mjs films/my-launch/page.html --at 0.5,1.2,3 --labels
// Default seconds: the middle of each world of a page, else 12 evenly spaced. A folder of images gives one tile per image, named by its file.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { frameTile } from '../lib/tile.mjs';
import { paramsFilm } from '../lib/page-params.mjs';

import { artboardLayout, artboardCaption } from '../lib/artboard.mjs';
import { writeArtboardSheet } from './artboard-sheet.mjs';
import { durationOf } from '../lib/contact-sheet.mjs';
import { worldAt, worldRows } from '../lib/timeline.mjs';
import { REPO_ROOT } from '../lib/render-harness.mjs';
import { drewNothingHint } from '../lib/ensure-fonts.mjs';
import { parseAt } from './compare-frames.mjs';
import { filmNameOf } from './see/strip-math.mjs';
import { resolveDuration } from './page-duration.mjs';

const die = (m) => { console.error(`error: ${m}`); process.exit(2); };
const EVEN_TILES = 12;
const IMAGE_TILES_MAX = 48;
const IMAGE = /\.(png|jpe?g|webp)$/i;

export const tileLabel = (t, world) => `${t}s${world ? ` ${world}` : ''}`;

/** `n` seconds spread over the film, centred in equal parts. */
export const evenSeconds = (dur, n = EVEN_TILES) => Array.from({ length: n }, (_, i) => +((i + 0.5) * dur / n).toFixed(2));

function videoSize(file) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', file], { encoding: 'utf8' });
  const [w, h] = r.stdout.trim().split(',').map(Number);
  if (!(w > 0 && h > 0)) die(`cannot read the size of ${file}`);
  return { w, h };
}

/** The middle of each world that shows, or `evenSeconds` for a page with none. */
export function storyboardSeconds(spans, dur) {
  const mids = worldRows(spans).map((w) => +((w.start + w.end) / 2).toFixed(2));
  return mids.length ? mids : evenSeconds(dur);
}

async function pageTiles(pagePath, at, withWorlds, dir) {
  const { openPage, seekAll, resolveFrame, settle, probeStats, oneFlatColour } = await import('./render-page.mjs');
  const dur = await resolveDuration(pagePath);
  if (!(dur > 0)) die(`${pagePath} has no <meta name="duration">`);
  const frame = resolveFrame(pagePath);
  const opened = await openPage(pagePath, frame, { warm: true });
  try {
    if (!opened.reused) {
      await opened.page.goto(opened.url, { waitUntil: 'load' });
      await settle(opened.page);
      await opened.markWarm?.();
    }
    const spans = withWorlds || !at ? await (await import('./world-sample.mjs')).sampleWorlds(opened.page, dur, (ms) => opened.page.evaluate((t) => window.__pageSeek(t / 1000), ms)) : [];
    const times = at ? parseAt(at) : storyboardSeconds(spans, dur);
    const shots = [];
    for (const [i, t] of times.entries()) {
      await seekAll(opened.page, t * 1000);
      const png = path.join(dir, `s${i}.png`);
      await opened.page.screenshot({ path: png });
      shots.push({ t, png, world: withWorlds ? worldAt(spans, t) : null });
    }
    const tiles = shots.map((s) => probeStats(s.png)[0]);
    if (tiles.some((t) => !t)) throw new Error('a tile has no frame stats: ffmpeg did not read its screenshot');
    if (shots.length > 1 && oneFlatColour(tiles)) throw new Error(`every tile is one flat colour: the page drew nothing; ${drewNothingHint(REPO_ROOT, pagePath)}`);
    return { shots, size: { w: frame.width, h: frame.height } };
  } finally {
    await opened.close();
  }
}

/** The file-local second of each film second `times` in an mp4 that starts at film second `from` and lasts `dur`; throws naming the span when one falls outside it. Pure. */
export function localSeconds(times, from, dur) {
  const span = `${from}-${+(from + dur).toFixed(2)}`;
  const outside = times.filter((t) => t < from - 1e-9 || t > from + dur + 1e-9);
  if (outside.length) throw new Error(`${outside.join(', ')} s is outside the film seconds ${span} this mp4 holds (a --from/--to draft starts its time at the span start; pass --from <s> with the start second of the draft, or --at seconds inside ${span})`);
  return times.map((t) => Math.min(+(t - from).toFixed(3), Math.max(0, dur - 0.05)));
}

function videoTiles(mp4, at, from) {
  const dur = durationOf(mp4);
  const times = at ? parseAt(at) : evenSeconds(dur).map((t) => +(t + from).toFixed(2));
  const local = localSeconds(times, from, dur);
  return { shots: times.map((t, i) => ({ t, at: local[i], png: mp4, world: null })), size: videoSize(mp4) };
}

/** The tiles of an mp4, each labelled with the world its page shows at that film second. */
async function withPageWorlds(read, page) {
  const { spans } = await (await import('./timeline.mjs')).readTimeline(page);
  return { ...read, shots: read.shots.map((s) => ({ ...s, world: worldAt(spans, s.t) })) };
}

/** One tile per image of a folder, sorted by name, each labelled with its file name (at most IMAGE_TILES_MAX). */
function imageTiles(dir) {
  const files = fs.readdirSync(dir).filter((f) => IMAGE.test(f)).sort().slice(0, IMAGE_TILES_MAX);
  if (!files.length) throw new Error(`no png, jpg or webp image in ${dir}`);
  const shots = files.map((f) => ({ t: 0, at: 0, png: path.join(dir, f), world: null, label: f }));
  return { shots, size: videoSize(shots[0].png) };
}

async function main(argv) {
  const flag = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
  const valued = new Set(['--at', '--cols', '--out', '--from']);
  const source = argv.find((a, i) => !a.startsWith('--') && !valued.has(argv[i - 1]));
  if (!source) die('missing <page|mp4|folder>; usage: bin/vawe frame <page|mp4|folder> [--at s,s,...] [--from s] [--labels] [--cols n] [--out file.png]');
  if (!fs.existsSync(source)) die(`no such file: ${source}`);
  const labels = argv.includes('--labels');
  const isPage = source.endsWith('.html');
  const isFolder = fs.statSync(source).isDirectory();
  const labelPage = labels && !isPage ? `films/${filmNameOf(source)}/page.html` : null;
  if (labels && (isFolder || (labelPage && !fs.existsSync(labelPage)))) die(`--labels reads the worlds from the film's page${labelPage ? ` (${labelPage} does not exist)` : ''}; give the page, or an mp4 named after its film`);
  const out = path.resolve(flag('--out') || path.join('out', `${paramsFilm(`sheet-${path.basename(source, path.extname(source)) === 'page' ? path.basename(path.dirname(path.resolve(source))) : path.basename(source, path.extname(source))}`)}.png`));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vawe-sheet-'));
  try {
    let read;
    try { read = isFolder ? imageTiles(source) : isPage ? await pageTiles(source, flag('--at'), labels, dir) : videoTiles(source, flag('--at'), Number(flag('--from') ?? 0)); } catch (e) { die(e.message); }
    if (labelPage) read = await withPageWorlds(read, labelPage);
    const cols = Number(flag('--cols')) || undefined;
    const { items: boxes } = artboardLayout({ count: read.shots.length, aspect: `${read.size.w}:${read.size.h}`, cols });
    const items = read.shots.map((s, i) => {
      const png = frameTile(s.png, s.at ?? s.t, path.join(dir, `t${i}.png`), { tw: boxes[i].frame.w, th: boxes[i].frame.h });
      const caption = s.label ? { left: s.label, right: '' } : { ...artboardCaption(i, s.world ?? '', NaN, NaN), right: `${s.t} s` };
      return { ...caption, png };
    });
    const layout = await writeArtboardSheet({ title: path.basename(out), aspect: `${read.size.w}:${read.size.h}`, items, htmlPath: path.join(dir, 'sheet.html'), png: out, cols });
    console.log(`✓ ${out}: ${items.length} tile(s), ${layout.cols} per row, left to right: ${read.shots.map((s) => s.label ?? tileLabel(s.t, s.world)).join(', ')}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main(process.argv.slice(2)).catch((e) => die(e.stack || String(e)));
