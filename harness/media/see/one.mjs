#!/usr/bin/env node
// `vawe see <mp4 | page.html | ref-id> [--vs <other>] [--at s] [--from s --to s]`: ONE command that reads a film completely.
// It joins the measures of spec, strip, onion, velocity, timeline, audio, frames, compare, refs frames, look and zoom into one report
// (out/see/<name>/see.md and see.json) and writes every image with its numbers. Cached by content hash: a second run is instant.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { die, ROOT } from './core.mjs';
import { measureSide } from './one-measure.mjs';
import { makeImages, momentImages } from './one-images.mjs';
import { resolveSource, SourceError } from './one-input.mjs';
import { momentLines, seeReport, seeSummary } from './one-report.mjs';
import { pairImages } from './one-pairs.mjs';
import { compareSides, vsLines } from './one-vs.mjs';
import { isMain } from '../../lib/is-main.mjs';

const CODE_DIRS = ['harness/media/see', 'harness/lib/ref-measure'];
const CODE_FILES = ['harness/media/ref-spec.mjs', 'harness/lib/move-fit.mjs', 'harness/media/shot-detect.mjs', 'harness/lib/board.mjs', 'harness/lib/timeline.mjs', 'harness/media/page-audio.mjs', 'harness/lib/sound-read.mjs', 'harness/lib/sound-class.mjs'];

function codeHash() {
  const files = [...CODE_DIRS.flatMap((d) => fs.readdirSync(path.join(ROOT, d)).filter((f) => f.endsWith('.mjs')).sort().map((f) => path.join(d, f))), ...CODE_FILES];
  const h = crypto.createHash('sha1');
  for (const f of files) h.update(f).update(fs.readFileSync(path.join(ROOT, f)));
  return h.digest('hex');
}

const keyOf = (src, opts) => crypto.createHash('sha1').update(JSON.stringify([codeHash(), src.hash, opts.ocr, opts.at ?? null, opts.from ?? null, opts.to ?? null])).digest('hex');

const imageFiles = (images, moment) => [
  ...images.shots.flatMap((s) => [s.frame?.file, s.cut?.file, s.onion?.file, ...s.zooms.map((z) => z.file), ...s.flashes.flatMap((f) => [f.file, f.zoom?.file])]),
  moment?.frame, moment?.strip?.file, moment?.onion, moment?.zoom?.file,
].filter(Boolean);

/** One side: the measures and the images, from the cache when the film, the options and the code are unchanged. */
async function readSide(src, opts, dir, log) {
  const key = keyOf(src, opts), file = path.join(dir, 'side.json');
  if (!opts.noCache && fs.existsSync(file)) {
    const kept = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (kept.key === key && imageFiles(kept.images, kept.moment).every((f) => fs.existsSync(f))) return { ...kept, cached: true };
  }
  fs.rmSync(path.join(dir, 'images'), { recursive: true, force: true });
  const m = await measureSide(src, opts, dir, log);
  const images = await makeImages(src, m, dir, log);
  const moment = opts.at == null ? null : momentImages(src, m, opts.at, dir, log);
  const side = { key, measures: m, images, moment };
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(side)}\n`);
  return { ...side, cached: false };
}

/** In `from`..`to` only: the shots, images and rows outside the window are dropped from the report. */
function windowed(side, from, to) {
  if (from == null && to == null) return side;
  const keep = (s) => s.end > (from ?? 0) && s.start < (to ?? Infinity);
  const indexes = new Set(side.measures.shots.filter(keep).map((s) => s.index));
  return { ...side, measures: { ...side.measures, shots: side.measures.shots.filter(keep) }, images: { shots: side.images.shots.filter((s) => indexes.has(s.index)) } };
}

/** Runs `vawe see`: returns { dir, md, json, summary, cached } and writes see.md and see.json. */
async function runSee(input, opts = {}) {
  const t0 = Date.now();
  const log = opts.quiet ? () => {} : (m) => console.error(`see: [${((Date.now() - t0) / 1000).toFixed(1)} s] ${m}`);
  const a = await resolveSource(input, { draft: opts.draft, log });
  const b = opts.vs ? await resolveSource(opts.vs, { log }) : null;
  const name = b ? `${a.name}-vs-${b.name}` : a.name;
  const root = path.resolve(opts.out ?? path.join('out', 'see', name));
  fs.mkdirSync(root, { recursive: true });
  const sideOpts = { ocr: opts.ocr !== false, noCache: opts.noCache, at: opts.at, from: opts.from, to: opts.to };
  const sa = windowed(await readSide(a, sideOpts, b ? path.join(root, 'a') : root, log), opts.from, opts.to);
  const sb = b ? windowed(await readSide(b, { ...sideOpts, at: null }, path.join(root, 'b'), log), opts.from, opts.to) : null;
  const L = seeReport(sa.measures, sa.images, sa.moment);
  let vs = null;
  if (sb) {
    const rows = compareSides(sa.measures, sb.measures);
    fs.rmSync(path.join(root, 'pairs'), { recursive: true, force: true });
    const pairs = pairImages([{ src: a, m: sa.measures }, { src: b, m: sb.measures }], root, opts, log);
    vs = { rows, pairs };
    L.splice(0, L.length, `# vawe see: ${sa.measures.source.name} against ${sb.measures.source.name}`, '', ...vsSection(rows, pairs, sa.measures, sb.measures), '', '# SIDE A (yours)', '', ...seeReport(sa.measures, sa.images, sa.moment), '', '# SIDE B (the reference)', '', ...seeReport(sb.measures, sb.images, null));
  }
  const md = path.join(root, 'see.md'), json = path.join(root, 'see.json');
  fs.writeFileSync(md, `${L.join('\n')}\n`);
  fs.writeFileSync(json, `${JSON.stringify({ a: sa.measures, images: sa.images, moment: sa.moment, b: sb?.measures ?? null, imagesB: sb?.images ?? null, vs }, null, 1)}\n`);
  const summary = [...seeSummary(sa.measures), ...(sb ? [`vs ${sb.measures.source.name}: ${vs.rows.filter((r) => r.advice).length} deltas with advice`] : [])];
  return { dir: root, md, json, summary, cached: sa.cached && (!sb || sb.cached) };
}

function vsSection(rows, pairs, a, b) {
  const L = ['## VS: yours (a) against the reference (b)', '', `a: ${a.source.video}`, `b: ${b.source.video}`, '', ...vsLines(rows, [a.source.name, b.source.name]), '', 'Paired images (the same moment of both; a left, b right):', ''];
  for (const p of pairs) L.push(`${p.label}: a ${p.ta.toFixed(2)} s, b ${p.tb.toFixed(2)} s`, ...momentLines(a, p.ta).map((l) => `  a, ${l}`), ...momentLines(b, p.tb).map((l) => `  b, ${l}`), `  frames: ${p.frames}`, ...(p.zoom ? [`  zoom ${p.zoom.box.x},${p.zoom.box.y},${p.zoom.box.w},${p.zoom.box.h} at 8x: ${p.zoom.file}`] : []), '');
  return L;
}

async function main(argv) {
  const flag = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
  const num = (n) => (flag(n) === undefined ? undefined : Number(flag(n)));
  const skip = new Set(['--vs', '--at', '--at-b', '--from', '--to', '--draft', '--out']);
  const input = argv.find((x, i) => !x.startsWith('--') && !skip.has(argv[i - 1]));
  if (!input) die('usage: vawe see <mp4 | page.html | ref-id> [--vs <other>] [--at s] [--from s --to s] [--draft mp4] [--no-ocr] [--no-cache]');
  const started = Date.now();
  const r = await runSee(input, { vs: flag('--vs'), at: num('--at'), atB: num('--at-b'), from: num('--from'), to: num('--to'), draft: flag('--draft'), out: flag('--out'), ocr: !argv.includes('--no-ocr'), noCache: argv.includes('--no-cache') });
  console.log(r.summary.join('\n'));
  console.log(`${r.cached ? 'cached' : 'measured'} in ${((Date.now() - started) / 1000).toFixed(1)} s`);
  console.log(`report: ${r.md}`);
  console.log(`data:   ${r.json}`);
}

if (isMain(import.meta.url)) main(process.argv.slice(2)).catch((e) => die(e instanceof SourceError ? e.message : e.stack || String(e)));
