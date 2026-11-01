// `vawe frame --moment <s> --velocity`: the speed and scale of page elements over a window, read from the page itself (its own seek, no video), as one graph and a summary per element.
// The boxes come from harness/lib/box-track.mjs sampleBoxTracks, the one box sampler of the page checks.
import fs from 'node:fs';
import path from 'node:path';
import { sampleBoxTracks } from '../../lib/box-track.mjs';
import { openPage, resolveFrame } from '../render-page.mjs';
import { die } from './core.mjs';
import { stripWindow } from './strip-math.mjs';
import { GRAPH_H, GRAPH_W, LINE_COLOURS, velocitySvg } from './velocity-graph.mjs';
import { analyseTrack, moveScore, sampleTimes, summaryLines, topMovers, VELOCITY_SPAN, velocityProblem, visiblePoints } from './velocity-math.mjs';
import { resolveDuration } from '../page-duration.mjs';

const TAG = 'data-velocity-pick';

/** The scope for sampleBoxTracks: the elements named by --sel (each match tagged) or --ids, else every element. */
async function scopeOf(page, { sel, ids }) {
  if (ids) return { selectors: ids.map((id) => `[id="${id}"]`) };
  if (!sel) return 'visible';
  const count = await page.evaluate((css, tag) => [...document.querySelectorAll(css)].map((el, i) => el.setAttribute(tag, i)).length, sel, TAG);
  if (!count) die(`--sel "${sel}" matches no element in the page`);
  return { selectors: Array.from({ length: count }, (_, i) => `[${TAG}="${i}"]`) };
}

/** The moves of an open page between `from` and `to` seconds: { times, height, rows } with one row { label, colour, analysis } per element (the `opts.sel`, `opts.ids` or the elements that move most); no rows when nothing moves. */
export async function readVelocity(page, opts, from, to) {
  const scope = await scopeOf(page, opts);
  const times = sampleTimes(from, to);
  const sampled = await sampleBoxTracks(page, times, scope);
  const picked = scope === 'visible' ? topMovers(sampled.tracks.map((t) => moveScore(visiblePoints(times, t).points, sampled.height))) : sampled.tracks.map((_, i) => i).filter((i) => sampled.tracks[i].length).slice(0, LINE_COLOURS.length);
  const rows = picked.map((i, k) => {
    const run = visiblePoints(times, sampled.tracks[i]);
    const shown = run.points.length && (run.from > times[0] + 1e-6 || run.to < times.at(-1) - 1e-6) ? ` (drawn ${run.from.toFixed(2)} to ${run.to.toFixed(2)} s)` : '';
    return { label: `${k + 1}. ${sampled.labels[i]}${shown}`, colour: LINE_COLOURS[k], analysis: run.points.length >= 3 ? analyseTrack(run.points, sampled.height) : null };
  }).filter((r) => r.analysis);
  return { times, height: sampled.height, rows };
}

/** Runs `vawe frame --moment <s> --velocity`: samples the page at 120 a second across `opts.span` seconds around `opts.at`, writes the graph, prints its path and the summary. */
export async function runVelocity(pagePath, opts) {
  if (!fs.existsSync(pagePath)) die(`no such page: ${pagePath}`);
  const dur = await resolveDuration(pagePath) || Infinity;
  const { from, to } = stripWindow(opts.at, opts.span, dur);
  const frame = resolveFrame(pagePath, {});
  const { page, url, close } = await openPage(pagePath, frame, { final: false });
  try {
    await page.goto(url, { waitUntil: 'load' });
    const { times, height, rows } = await readVelocity(page, opts, from, to);
    if (!rows.length) die(`nothing moves in ${pagePath} from ${from} to ${to} s (a page that paints a canvas in window.seek has no element to read: pass --sel for the elements that carry the move)`);
    const series = rows.map(({ label, colour, analysis: a }) => ({
      label, colour, speed: a.speed,
      peak: a.pos.moves ? { t: a.pos.peakAt, v: a.pos.peakSpeed } : null,
      rel: a.scale.moves ? a.rel : null,
    }));
    const outDir = path.resolve(opts.out ?? path.join('out', 'velocity'));
    fs.mkdirSync(outDir, { recursive: true });
    const out = path.join(outDir, `${path.basename(pagePath, '.html') === 'page' ? path.basename(path.dirname(pagePath)) : path.basename(pagePath, '.html')}-velocity-${opts.at.toFixed(2)}.png`);
    await page.setViewport({ width: GRAPH_W, height: GRAPH_H });
    await page.setContent(`<body style="margin:0">${velocitySvg({ from, to, series })}</body>`);
    await page.screenshot({ path: out, type: 'png' });
    console.log(`velocity of ${pagePath}, ${from.toFixed(2)} to ${to.toFixed(2)} s, ${times.length} samples (${height} px frame height)`);
    for (const r of rows) for (const l of summaryLines(r.label, r.analysis.pos, r.analysis.scale, height)) console.log(l);
    console.log(out);
  } finally {
    await close();
  }
}

export async function dispatchVelocity(pagePath, flag) {
  const ids = flag('--ids', undefined);
  const opts = { at: flag('--velocity', undefined), span: Number(flag('--span', VELOCITY_SPAN)), sel: flag('--sel', undefined), ids: ids ? ids.split(',') : undefined, out: flag('--out', undefined) };
  const problem = velocityProblem({ ...opts, ids });
  if (problem) die(problem);
  return runVelocity(pagePath, { ...opts, at: Number(opts.at) });
}
