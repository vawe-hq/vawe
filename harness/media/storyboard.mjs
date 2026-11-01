#!/usr/bin/env node
// `vawe frame <page|draft mp4> --board [--page page.html] [--out file.html]`: one self-contained HTML storyboard, a pan-and-zoom canvas of frame
// cards, handoff arrows and a rhythm strip.
//   node harness/media/storyboard.mjs films/my-launch/page.html
// Worlds, cues and eases come from the page (the data `vawe see --plan` and `vawe frame --world all` read); the plan comes from brief.md. With an mp4
// the frames are cut from it and the page is found by the film's name.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { openPage, seekAll, resolveFrame, readPageMeta } from './render-page.mjs';
import { sampleWorlds, readWorldAnimations } from './world-sample.mjs';
import { readPageAudio } from './page-audio.mjs';
import { videoStill } from './still.mjs';
import { readBrief } from '../lib/brief-tables.mjs';
import { lockedSpectacle, spectacleOf } from '../lib/board.mjs';
import { metaOf } from '../lib/page-meta.mjs';
import { filmKeyOf } from '../lib/runlog.mjs';
import { storyboardOf } from '../lib/storyboard.mjs';
import { readPlanFindings, loadOpened } from './plan-read.mjs';
import { planLines } from '../lib/plan-findings.mjs';
import { storyboardHtml } from '../lib/storyboard-html.mjs';
import { resolveDuration } from './page-duration.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const die = (m) => { console.error(`error: ${m}`); process.exit(2); };
const FONTS = [['Geist', '400 800', 'Geist.woff2'], ['IBM Plex Mono', '400', 'IBMPlexMono-400.woff2'], ['IBM Plex Mono', '500', 'IBMPlexMono-500.woff2'], ['Geist Mono', '400', 'GeistMono.woff2']];

/** The @font-face rules of the site's faces that the font pipeline has written to assets/fonts, embedded so the page opens from disk; a missing face falls back in the CSS stack. */
export function fontFaceCss(dir = path.join(ROOT, 'assets', 'fonts')) {
  return FONTS.filter(([, , file]) => fs.existsSync(path.join(dir, file)))
    .map(([family, weight, file]) => `@font-face{font-family:'${family}';font-weight:${weight};font-display:block;src:url(data:font/woff2;base64,${fs.readFileSync(path.join(dir, file)).toString('base64')}) format('woff2')}`)
    .join('\n');
}

/** The page.html of the film a draft is named after: films/<key>, films/examples/<key> or films/*\/<key> under `root`. Null when none. */
export function pageOfFilm(key, root = ROOT) {
  const films = path.join(root, 'films');
  const direct = [path.join(films, key, 'page.html'), path.join(films, 'examples', key, 'page.html')].find((p) => fs.existsSync(p));
  if (direct) return direct;
  const dirs = fs.existsSync(films) ? fs.readdirSync(films, { withFileTypes: true }).filter((e) => e.isDirectory()) : [];
  return dirs.map((d) => path.join(films, d.name, key, 'page.html')).find((p) => fs.existsSync(p)) ?? null;
}

async function readPage(opened, abs, duration) {
  await loadOpened(opened);
  const anims = await readWorldAnimations(opened.page);
  const seek = (ms) => opened.page.evaluate((t) => window.__pageSeek(t / 1000), ms);
  const spans = await sampleWorlds(opened.page, duration, seek);
  const { specs } = await readPageAudio(opened.page, { pagePath: abs, spans });
  return { duration, spans, specs, anims };
}

const imageName = (s) => `${String(s.n).padStart(2, '0')}-${s.id}.jpg`;

async function shootShots(page, shots, dir) {
  const images = {};
  for (const s of shots) {
    await seekAll(page, s.at * 1000);
    await page.screenshot({ path: path.join(dir, imageName(s)), type: 'jpeg', quality: 90 });
    images[s.id] = imageName(s);
  }
  return images;
}

function mp4Frames(mp4, shots, dir) {
  const images = {};
  for (const s of shots) {
    videoStill(mp4, s.at, path.join(dir, imageName(s)));
    images[s.id] = imageName(s);
  }
  return images;
}

// The ground of a frame is the mean of its top-left tenth: the card and the rhythm strip take their colour from the picture.
function groundOfImage(file) {
  const r = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-vf', 'crop=iw/10:ih/10:0:0,scale=1:1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { encoding: 'buffer' });
  return r.status === 0 && r.stdout.length >= 3 ? `rgb(${r.stdout[0]}, ${r.stdout[1]}, ${r.stdout[2]})` : null;
}

function sourcePage(source, pageFlag) {
  if (source.endsWith('.html')) return path.resolve(source);
  const found = pageFlag ?? pageOfFilm(filmKeyOf(source));
  if (!found) die(`no films/**/${filmKeyOf(source)}/page.html found for ${source}; pass --page <page.html>`);
  return path.resolve(found);
}

async function main(argv) {
  const flag = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
  const valued = new Set(['--page', '--out']);
  const showAll = argv.includes('--all');
  const source = argv.find((a, i) => !a.startsWith('--') && !valued.has(argv[i - 1]));
  if (!source) die('missing <page|mp4>; usage: bin/vawe frame <page|draft mp4> --board [--page page.html] [--out file.html]');
  if (!fs.existsSync(source)) die(`no such file: ${source}`);
  const abs = sourcePage(source, flag('--page'));
  if (!fs.existsSync(abs)) die(`no such page: ${abs}`);
  const duration = await resolveDuration(abs);
  if (!(duration > 0)) die(`${abs} has no <meta name="duration">`);
  const film = filmKeyOf(abs);
  const html = path.resolve(flag('--out') ?? path.join('out', `${film}-storyboard.html`));
  const dir = html.replace(/\.html$/, '');
  fs.mkdirSync(dir, { recursive: true });
  const text = fs.readFileSync(abs, 'utf8');
  const brief = readBrief(abs);
  const opened = await openPage(abs, resolveFrame(abs, { final: true }), { warm: true });
  try {
    const read = await readPage(opened, abs, duration);
    const board = storyboardOf({
      film, brief,
      read: { ...read, spectacle: lockedSpectacle(brief, spectacleOf(text)), signature: metaOf(text, 'signature'), message: readPageMeta(abs, 'message') },
    });
    const plan = await readPlanFindings(opened.page, abs, duration);
    const docLines = planLines(plan.findings, ROOT);
    board.plan = [...docLines, ...plan.advice];
    const images = source.endsWith('.html') ? await shootShots(opened.page, board.shots, dir) : mp4Frames(source, board.shots, dir);
    for (const shot of board.shots) shot.ground = groundOfImage(path.join(dir, images[shot.id])) ?? shot.ground;
    const relative = Object.fromEntries(Object.entries(images).map(([id, f]) => [id, `${path.basename(dir)}/${f}`]));
    fs.writeFileSync(html, storyboardHtml(board, { images: relative, fontCss: fontFaceCss() }));
    console.log(`✓ ${html}: ${board.shots.length} shots, ${board.cues.length} cues${board.hasBrief ? '' : ', no brief.md'}; images in ${dir}`);
    if (!board.plan.length) console.log('from the docs: no finding');
    else if (showAll) console.log([`from the docs and the page, before any render (${board.plan.length}; advice, the page keeps what it does on purpose):`, ...board.plan.map((l) => `  ${l}`)].join('\n'));
    else console.log(`advice: ${docLines.length} from the docs, ${plan.advice.length} from the page (the page keeps what it does on purpose); all of it is on the board, or run with --all`);
  } catch (e) {
    die(e.stack || String(e));
  } finally {
    await opened.close();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main(process.argv.slice(2)).catch((e) => die(e.stack || String(e)));
