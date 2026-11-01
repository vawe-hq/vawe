#!/usr/bin/env node
// `vawe see <page.html> --plan [--json]`: the worlds, the cut rhythm, the spectacle and every audio cue as text, before any pixel.
//   node harness/media/timeline.mjs <page.html> [--json]
// Worlds come from the page's own seek (sampleWorlds), so it loads the page once and takes a second or two; no frame is rendered.
import fs from 'node:fs';
import path from 'node:path';
import { openPage, settle, resolveFrame } from './render-page.mjs';
import { sampleWorlds } from './world-sample.mjs';
import { readPageAudio } from './page-audio.mjs';
import { spectacleOf } from '../lib/board.mjs';
import { timelineOf, timelineLines } from '../lib/timeline.mjs';
import { resolveDuration } from './page-duration.mjs';

const die = (m) => { console.error(`error: ${m}`); process.exit(2); };

/** Loads the page and returns { duration, spans, specs, loudness, spectacle }: the worlds' spans and the audio tags with data-on resolved. */
export async function readTimeline(pagePath) {
  const abs = path.resolve(pagePath);
  if (!fs.existsSync(abs)) die(`no such page: ${pagePath}`);
  const duration = await resolveDuration(abs);
  if (!(duration > 0)) die(`${pagePath} has no <meta name="duration">`);
  const opened = await openPage(abs, resolveFrame(abs, { final: false }), { final: false });
  try {
    await opened.page.goto(opened.url, { waitUntil: 'load' });
    await settle(opened.page);
    const spans = await sampleWorlds(opened.page, duration, (ms) => opened.page.evaluate((t) => window.__pageSeek(t / 1000), ms));
    const { specs, loudness } = await readPageAudio(opened.page, { pagePath: abs, spans });
    return { duration, spans, specs, loudness, spectacle: spectacleOf(fs.readFileSync(abs, 'utf8')) };
  } finally {
    await opened.close();
  }
}

async function main(argv) {
  const t0 = Date.now();
  const json = argv.includes('--json');
  const [pagePath] = argv.filter((a) => !a.startsWith('--'));
  if (!pagePath) die('missing <page>; usage: node harness/media/timeline.mjs <page.html> [--json]');
  let read;
  try { read = await readTimeline(pagePath); } catch (e) { die(e.message); }
  const t = timelineOf(read);
  console.log(json ? JSON.stringify(t, null, 2) : [...timelineLines(t), `time: ${((Date.now() - t0) / 1000).toFixed(1)} s`].join('\n'));
}

if (import.meta.url === `file://${process.argv[1]}`) main(process.argv.slice(2)).catch((e) => die(e.stack || String(e)));
