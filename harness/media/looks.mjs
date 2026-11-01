#!/usr/bin/env node
// `vawe frame <page> --looks`: the page frame at each --at second once per camera look (and as-is), one labelled grid per second.
//   node harness/media/looks.mjs <page.html> --at 4.5,9 [--only clean,crt] [--out dir]
// Each look is a full override of the page's lens effects (core/surfaces/lens.js lookOverride), set as window.__vaweLensOverride
// before the page runs, so the page file is never edited. A page in another checkout runs with this checkout's lens.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { openPage, resolveFrame, seekAll, settle, gotoLoaded, pageSourceMatches } from './render-page.mjs';
import { tile, parseAt } from './compare-frames.mjs';
import { insideRoot, REPO_ROOT } from '../lib/render-harness.mjs';
import { lookOverride } from '../../core/surfaces/lens.js';
import { AS_IS, looksOf } from '../lib/looks.mjs';

const TILE_H = 360;
const LABEL_H = 36;
const USES_LENS = /surfaces\/lens\.js/;
const OUR_LENS = /^\/core\/surfaces\/lens(-source)?\.js$/;
const die = (m) => { console.error(`error: ${m}`); process.exit(2); };

function labelled(png, text, out) {
  const vf = `scale=-2:${TILE_H - LABEL_H},pad=iw:${TILE_H}:0:0:black,drawtext=text='${text}':x=10:y=h-${LABEL_H - 6}:fontsize=24:fontcolor=white`;
  const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', png, '-vf', vf, out]);
  if (r.status !== 0) die(`label failed: ${String(r.stderr || '').trim()}`);
}

// A page in another checkout imports that checkout's lens, which has no looks: this checkout's lens answers instead.
async function useOurLens(page) {
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const file = OUR_LENS.test(new URL(req.url()).pathname) && path.join(REPO_ROOT, new URL(req.url()).pathname);
    if (file) req.respond({ status: 200, contentType: 'text/javascript', body: fs.readFileSync(file) });
    else req.continue();
  });
}

/** The PNG of the page at each second under one look ('as-is': the page unchanged). */
async function shootLook(pagePath, frame, name, times, dir) {
  const opened = await openPage(pagePath, frame);
  try {
    if (!insideRoot(REPO_ROOT, path.resolve(pagePath))) await useOurLens(opened.page);
    if (name !== AS_IS) await opened.page.evaluateOnNewDocument(`window.__vaweLensOverride = ${JSON.stringify(lookOverride(name))};`);
    await gotoLoaded(opened.page, opened.url, pagePath);
    await settle(opened.page);
    const pngs = [];
    for (const t of times) {
      await seekAll(opened.page, t * 1000);
      pngs.push(path.join(dir, `${name}-${t}.png`));
      await opened.page.screenshot({ path: pngs.at(-1) });
    }
    return pngs;
  } finally {
    await opened.close();
  }
}

function parseArgs(argv) {
  const flag = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
  const page = argv.find((a, i) => !a.startsWith('--') && !['--at', '--only', '--out'].includes(argv[i - 1]));
  if (!page) die('missing <page>; usage: looks.mjs <page.html> --at 4.5,9 [--only a,b] [--out dir]');
  if (!fs.existsSync(page)) die(`no such page: ${page}`);
  try { return { page: path.resolve(page), times: parseAt(flag('--at')), names: looksOf(flag('--only')), out: flag('--out') }; } catch (e) { die(e.message); }
}

async function main(argv) {
  const { page, times, names, out } = parseArgs(argv);
  if (!pageSourceMatches(page, USES_LENS)) die(`${page} does not use the lens (core/surfaces/lens.js), and the looks are lens options: film the screen with lens() first (prompts/moves/lens.md)`);
  const dir = path.resolve(out || path.join('out', `looks-${path.basename(path.dirname(page))}`));
  fs.mkdirSync(dir, { recursive: true });
  const work = fs.mkdtempSync(path.join(fs.realpathSync(dir), '.looks-'));
  const frame = resolveFrame(page);
  try {
    const shots = new Map();
    for (const name of [AS_IS, ...names]) shots.set(name, await shootLook(page, frame, name, times, work));
    for (const [i, t] of times.entries()) {
      const tiles = [...shots].map(([name, pngs]) => { const file = path.join(work, `tile-${name}-${t}.png`); labelled(pngs[i], name, file); return file; });
      const grid = path.join(dir, `looks-${t}s.png`);
      tile(tiles, grid);
      console.log(`looks: ${t}s  ${grid}`);
    }
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
  console.log(`looks: as-is plus ${names.length} looks (${names.join(', ')}), ${times.length} grid(s), 3 tiles per row, the look name under each tile`);
}

if (import.meta.url === `file://${process.argv[1]}`) main(process.argv.slice(2)).catch((e) => die(e.stack || String(e)));
