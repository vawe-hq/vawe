#!/usr/bin/env node
// `vawe frame <page> --world all`: one still of each data-world element alone, before any motion is written.
//   node harness/media/frames.mjs <page.html> [--full] [--zoom] [--world <id>[,<id>]]
// Writes out/<film>-frames/<id>.png, the artboard sheet out/<film>-frames.png and films/<film>/frames.html, then prints the
// absolute path of each PNG and the still-frame layout rules each world fires. The still is at the middle of the world's visible span
// (the first second inside it where the world shows); the other worlds are hidden.
// frames.html zooms into <id>-full.png when it exists: --zoom shoots them in the same session (about 5 s more), --full leaves them behind.
// --full: full-size stills out/<film>-frames/<id>-full.png, no sheet or frames.html. --world: only those worlds, no sheet or frames.html.
import fs from 'node:fs';
import path from 'node:path';
import { openPage, seekAll, settle, resolveFrame, readPageMeta } from './render-page.mjs';
import { sampleWorlds, stillCandidates, worldShowsNow, readWorldAnimations } from './world-sample.mjs';
import { sampleLayout } from './draft-check.mjs';
import { artboardCaption, cutSpans } from '../lib/artboard.mjs';
import { writeArtboardSheet } from './artboard-sheet.mjs';
import { layoutLint, namedText } from '../lib/layout-lint.mjs';
import { readBrief } from '../lib/brief-tables.mjs';
import { pageAuthoring } from '../lib/motion-stamp.mjs';
import { unwaived } from '../lib/motion-lint.mjs';
import { firedRules, firedLines } from '../lib/taste-steps.mjs';
import { worldLines, parseFramesArgs, selectWorlds, isStarterPage } from '../lib/frames-page.mjs';
import { resolveDuration } from './page-duration.mjs';

const die = (m) => { console.error(`error: ${m}`); process.exit(2); };
const hideOthers = (id) => `[data-world]:not([data-world="${id}"]) { display: none !important; }`;
const noSeek = async () => {};

/** Seeks to the first candidate second at which the world shows (the others are hidden); returns that second, or the first candidate when none does. */
async function seekToShown(page, span, anims) {
  const times = stillCandidates(span, anims);
  for (const t of times) {
    await seekAll(page, t * 1000);
    if (await worldShowsNow(page, span.id)) return t;
  }
  console.error(`frames: world ${span.id} shows at none of ${times.join(', ')} s; its still may be blank`);
  await seekAll(page, times[0] * 1000);
  return times[0];
}

/** Screenshots the page at its own size (scale 1) and puts the viewport back; the layout does not change, only the pixels. */
async function shootFullSize(page, out) {
  const view = page.viewport();
  await page.setViewport({ ...view, deviceScaleFactor: 1 });
  try { await page.screenshot({ path: out }); } finally { await page.setViewport(view); }
  return out;
}

/** Shoots the wanted worlds of the page (all when `ids` is empty); returns [{ id, at, png, fullPng, fired }] (fullPng only with `zoom`) in page order. */
export async function shootWorlds(opened, pagePath, stills, { ids, suffix, zoom, layout = true }) {
  const dur = await resolveDuration(pagePath);
  const anims = await readWorldAnimations(opened.page);
  const found = await sampleWorlds(opened.page, dur, (ms) => opened.page.evaluate((t) => window.__pageSeek(t / 1000), ms));
  if (!found.length) die(`${pagePath} has no data-world element: give each beat one, for example <section data-world="s1">`);
  let spans;
  try { spans = selectWorlds(found, ids); } catch (e) { die(e.message); }
  const named = namedText(readPageMeta(pagePath, 'message'), readBrief(pagePath));
  const authoring = pageAuthoring(pagePath);
  const shots = [];
  for (const span of spans) {
    const style = await opened.page.addStyleTag({ content: hideOthers(span.id) });
    const at = await seekToShown(opened.page, span, anims);
    const png = path.join(stills, `${span.id}${suffix}.png`);
    await opened.page.screenshot({ path: png });
    const fullPng = zoom ? await shootFullSize(opened.page, path.join(stills, `${span.id}-full.png`)) : undefined;
    let fired = [];
    if (layout) {
      const sampled = await sampleLayout(opened.page, [at], noSeek);
      fired = firedRules(unwaived(layoutLint(sampled, { named }), authoring), [], []);
    }
    await style.evaluate((el) => el.remove());
    shots.push({ id: span.id, start: span.start, end: span.end, at, png, fullPng, fired });
  }
  return shots;
}

/** The full-size still of a shot when one on disk is newer than the page, else undefined (the page then zooms into the draft still). */
export function zoomStill(shot, pageMs) {
  const onDisk = path.join(path.dirname(shot.png), `${shot.id}-full.png`);
  return shot.fullPng ?? (fs.existsSync(onDisk) && fs.statSync(onDisk).mtimeMs >= pageMs ? onDisk : undefined);
}

async function main(argv) {
  const t0 = Date.now();
  let args;
  try { args = parseFramesArgs(argv); } catch (e) { die(e.message); }
  const { page: pagePath, full, zoom, worlds: ids } = args;
  if (!pagePath) die('missing <page>; usage: node harness/media/frames.mjs <page.html> [--full] [--zoom] [--world <id>[,<id>]]');
  if (!fs.existsSync(pagePath)) die(`no such page: ${pagePath}`);
  const abs = path.resolve(pagePath);
  const film = path.basename(path.dirname(abs));
  const stills = path.resolve('out', `${film}-frames`);
  fs.mkdirSync(stills, { recursive: true });
  const opened = await openPage(abs, resolveFrame(abs, { final: full }), { warm: true });
  let shots;
  try {
    if (!opened.reused) {
      await opened.page.goto(opened.url, { waitUntil: 'load' });
      await settle(opened.page);
      await opened.markWarm?.();
    }
    shots = await shootWorlds(opened, abs, stills, { ids, suffix: full ? '-full' : '', zoom: zoom && !full && !ids.length });
  } finally {
    await opened.close();
  }
  const partial = full || ids.length > 0;
  const head = `${shots.length} worlds: ${shots.map((s) => `${s.id} @${s.at}s`).join(', ')}`;
  const paths = shots.map((s) => `  ${s.id}  ${s.png}`);
  const rules = worldLines(shots, firedLines, { starter: isStarterPage(fs.readFileSync(abs, 'utf8')) });
  const done = () => `time: ${((Date.now() - t0) / 1000).toFixed(1)} s`;
  if (partial) {
    console.log([`frames${full ? ' (full size)' : ''}: ${head}`, ...paths, ...rules, done()].join('\n'));
    return;
  }
  const sheet = path.resolve('out', `${film}-frames.png`);
  const html = path.join(path.dirname(abs), 'frames.html');
  const cuts = cutSpans(shots, await resolveDuration(abs));
  await writeArtboardSheet({ title: `${film}: key frames`, aspect: readPageMeta(abs, 'aspect') || '16:9', htmlPath: html, png: sheet,
    items: shots.map((s, i) => ({ ...artboardCaption(i, s.id, ...cuts[i]), png: s.png, fullPng: zoomStill(s, fs.statSync(abs).mtimeMs) })) });
  console.log([`frames: ${head}`, `  sheet  ${sheet}`, `  page   ${html}`, ...paths, ...rules, done()].join('\n'));
}

if (import.meta.url === `file://${process.argv[1]}`) main(process.argv.slice(2)).catch((e) => die(e.stack || String(e)));
