#!/usr/bin/env node
// `vawe storyboard <page> --directions [--out file.html]`: the comparison board of the brief's directions.
//   node harness/media/directions-board.mjs films/my-launch/page.html
// With a test page per direction (films/<name>/directions/<a|b|c>/page.html): stills at the opening, the turn and the end, and a looping clip of the turn.
// Without: one still per direction from films/<name>/directions.html.
import fs from 'node:fs';
import path from 'node:path';
import { openPage, seekAll, resolveFrame, settle, renderPage } from './render-page.mjs';
import { pageStill } from './still.mjs';
import { resolveDuration } from './page-duration.mjs';
import { fontFaceCss } from './storyboard.mjs';
import { parseDirections } from '../lib/directions.mjs';
import { directionsBoardHtml } from '../lib/directions-board.mjs';
import { spectacleOf } from '../lib/board.mjs';
import { filmKeyOf } from '../lib/runlog.mjs';

const die = (m) => { console.error(`error: ${m}`); process.exit(2); };

export const OPENING_S = 0.5;
export const CLIP_BEFORE_S = 1;
export const CLIP_AFTER_S = 1.5;

/** The three seconds and the clip window of a test page of `duration` seconds. Pure. */
export function momentsOf(duration, spectacle) {
  const last = Math.max(0, duration - 0.5);
  const turn = Math.min(spectacle ?? duration / 2, last);
  const from = Math.max(0, turn - CLIP_BEFORE_S);
  return { opening: Math.min(OPENING_S, last), turn, end: last, clip: { from, to: Math.min(duration, turn + CLIP_AFTER_S) } };
}

async function shootTestPage(id, pagePath, dir) {
  const duration = await resolveDuration(pagePath);
  if (!(duration > 0)) throw new Error(`${pagePath} has no <meta name="duration">`);
  const m = momentsOf(duration, spectacleOf(fs.readFileSync(pagePath, 'utf8')));
  const media = { stills: {} };
  for (const k of ['opening', 'turn', 'end']) {
    const file = `${id.toLowerCase()}-${k}.png`;
    await pageStill(pagePath, m[k], path.join(dir, file));
    media.stills[k] = { src: `${path.basename(dir)}/${file}`, at: m[k] };
  }
  const clip = `${id.toLowerCase()}-turn.mp4`;
  try {
    await renderPage(pagePath, path.join(dir, clip), { aspect: readAspect(pagePath), final: false, fps: 30, blur: 1, from: m.clip.from, durArg: m.clip.to - m.clip.from, audio: false, small: true });
    media.clip = `${path.basename(dir)}/${clip}`;
  } catch (e) {
    console.error(`note: no clip for ${id}: ${String(e.message).split('\n')[0]}`);
  }
  return media;
}

const readAspect = (pagePath) => resolveFrame(pagePath).aspect;

async function shootSheet(sheet, count, dir) {
  const opened = await openPage(sheet, resolveFrame(sheet, { final: true }), { warm: true });
  const out = [];
  try {
    if (!opened.reused) { await opened.page.goto(opened.url, { waitUntil: 'load' }); await settle(opened.page); await opened.markWarm?.(); }
    await seekAll(opened.page, 0);
    const frames = await opened.page.$$('figure .frame');
    for (let i = 0; i < Math.min(count, frames.length); i++) {
      const file = `${'abcdefgh'[i]}-key.png`;
      await frames[i].screenshot({ path: path.join(dir, file) });
      out.push({ src: `${path.basename(dir)}/${file}` });
    }
  } finally {
    await opened.close();
  }
  return out;
}

async function main(argv) {
  const flag = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
  const source = argv.find((a, i) => !a.startsWith('--') && argv[i - 1] !== '--out');
  if (!source) die('missing <page>; usage: bin/vawe storyboard <page> --directions [--out file.html]');
  const filmDir = path.dirname(path.resolve(source));
  const briefFile = path.join(filmDir, 'brief.md');
  if (!fs.existsSync(briefFile)) die(`no brief.md next to ${source}; bin/vawe new <name> writes it`);
  const film = filmKeyOf(path.resolve(source));
  const { slots, picked } = parseDirections(fs.readFileSync(briefFile, 'utf8'));
  const testDir = path.join(filmDir, 'directions');
  const folderIds = fs.existsSync(testDir) ? fs.readdirSync(testDir).filter((d) => /^[a-z]$/.test(d)).map((d) => d.toUpperCase()).sort() : [];
  const ids = slots.length ? slots.map((s) => s.id) : folderIds.length ? folderIds : ['A', 'B', 'C'];
  const tests = ids.map((id) => ({ id, page: path.join(testDir, id.toLowerCase(), 'page.html') })).filter((f) => fs.existsSync(f.page));
  const html = path.resolve(flag('--out') ?? path.join('out', `${film}-directions.html`));
  const dir = html.replace(/\.html$/, '');
  fs.mkdirSync(dir, { recursive: true });
  const media = {};
  for (const t of tests) {
    try { media[t.id] = await shootTestPage(t.id, t.page, dir); } catch (e) { console.error(`note: direction ${t.id} not shot: ${String(e.message).split('\n')[0]}`); }
  }
  const missing = ids.filter((id) => !tests.some((t) => t.id === id));
  const sheet = path.join(filmDir, 'directions.html');
  if (missing.length && fs.existsSync(sheet)) {
    const keys = await shootSheet(sheet, ids.length, dir);
    ids.forEach((id, i) => { if (missing.includes(id) && keys[i]) media[id] = { stills: { key: keys[i] } }; });
  } else if (!tests.length) die(`no direction test pages in ${testDir} and no ${sheet}`);
  fs.writeFileSync(html, directionsBoardHtml({ film, slots, picked, media, fontCss: fontFaceCss() }));
  console.log(`✓ ${html}: ${ids.length} directions, ${tests.length} test page(s), ${missing.length} from directions.html; images in ${dir}`);
}

if (import.meta.url === `file://${process.argv[1]}`) main(process.argv.slice(2)).catch((e) => die(e.stack || String(e)));
