#!/usr/bin/env node
// Render every prompts/moves/demo/<move>.html to prompts/moves/<move>.mp4: 1280 px wide, 60 fps, the
// demo's own duration. Renders only stale clips (source hash differs from clips.lock.json); --all or --only forces. The masters are not tracked.
// A demo with <meta name="variants" content="light"> and <html data-theme="dark"> also renders <move>-light.mp4: the same page with data-theme set to the variant.
// Runs a few renders at once; each waits for a machine-wide render slot (harness/lib/render-slots.mjs).
//   node harness/media/render-moves.mjs [--only <name>] [--all]
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolveFrame, readPageMeta } from './render-page.mjs';
import { ensureFonts, fontFilesIn } from '../lib/ensure-fonts.mjs';
import { JOBS } from '../../core/motion/ease-jobs.js';
import { pageAuthoring } from '../lib/motion-stamp.mjs';
import { isWaived, waiverHint } from '../lib/waivers.mjs';
import { clipHash } from '../lib/clip-hash.mjs';
import { chooseCrf, RENDER_CRF, CLIP_BUDGET_BYTES } from '../lib/clip-budget.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const MOVES = path.join(ROOT, 'prompts', 'moves');
const CLIP_WIDTH = 1280;
const CLIP_FPS = 60;
const WORKERS_PER_RENDER = 2;
const PARALLEL = Math.max(1, Math.min(4, Math.floor(os.cpus().length / 2)));

const VARIANT_SUFFIX = '.variant.html';
export const moveNames = () => fs.readdirSync(path.join(MOVES, 'demo')).filter((f) => f.endsWith('.html') && !f.endsWith(VARIANT_SUFFIX)).map((f) => f.slice(0, -5)).sort();
const demoPath = (name, moves = MOVES) => path.join(moves, 'demo', `${name}.html`);

/** The clips of a demo: the default, then one per theme in its variants meta, named <move>-<theme>. */
export function clipsOf(name, moves = MOVES) {
  const themes = (readPageMeta(demoPath(name, moves), 'variants') || '').split(/\s+/).filter(Boolean);
  return [{ id: name, name, theme: null }, ...themes.map((theme) => ({ id: `${name}-${theme}`, name, theme }))];
}

const LOCK = path.join(MOVES, 'clips.lock.json');
const IMPORT = /(?:from\s*|import\s*\(?\s*)['"]([^'"]+\.m?js)['"]/g;

function importedFiles(file, seen = new Set()) {
  if (seen.has(file) || !fs.existsSync(file)) return seen;
  seen.add(file);
  for (const [, spec] of fs.readFileSync(file, 'utf8').matchAll(IMPORT)) {
    if (spec.startsWith('/')) importedFiles(path.join(ROOT, spec), seen);
    else if (spec.startsWith('.')) importedFiles(path.resolve(path.dirname(file), spec), seen);
  }
  return seen;
}

/** The footage and images a demo keeps in its own folder, demo/assets/<name>/ (credits.json is not content). */
export function ownAssets(name, moves = MOVES) {
  const dir = path.join(moves, 'demo', 'assets', name);
  return fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f !== 'credits.json').sort().map((f) => path.join(dir, f)) : [];
}

/** Throws when the demo names a file in its own assets folder that is not there: raw footage is not committed. */
export function assertOwnAssets(name, moves = MOVES) {
  const html = fs.readFileSync(demoPath(name, moves), 'utf8');
  for (const [ref, file] of html.matchAll(new RegExp(`assets/${name}/([\\w.-]+)`, 'g'))) {
    if (file === 'credits.json' || fs.existsSync(path.join(moves, 'demo', ref))) continue;
    throw new Error(`${name}: prompts/moves/demo/${ref} is missing. It is not committed; prompts/moves/demo/assets/${name}/credits.json says where to get it.`);
  }
}

const POWER = /\*\*\s*[\d.]+|Math\.pow\(/;
const EASE_WORD = /\b(?:[Ee]ase\w*|EASE\w*|[Ee]asing|[Cc]urve|CURVE|[Cc]ubic|[Qq]uart|[Qq]uint)\b|(?<=[a-z0-9_])(?:Ease|Curve|Cubic|Quart|Quint)/;
const EASE_FIX = JOBS.map((j) => `${j.job.toLowerCase()}: easeFn('${j.ease}')`).join('; ');

/** The lines of a demo that hand-write an ease: a cubic-bezier( string, or a power expression on an ease or curve (a line naming one, or inside a function named like one). */
function handWrittenEases(html) {
  const found = [];
  let inEaseFn = false;
  html.split('\n').forEach((line, i) => {
    const decl = line.match(/function\s+(\w+)|(?:const|let)\s+(\w+)\s*=\s*(?:\([^)]*\)|\w+)\s*=>/);
    if (decl && EASE_WORD.test(decl[1] || decl[2])) inEaseFn = /\{\s*$/.test(line) || 'once';
    if (/cubic-bezier\(/.test(line) || (POWER.test(line) && (inEaseFn || EASE_WORD.test(line)))) found.push(`line ${i + 1}: ${line.trim().slice(0, 80)}`);
    if (inEaseFn === 'once' || /^\s*\};?\s*$/.test(line)) inEaseFn = false;
  });
  return found;
}

/** The custom properties a css text declares, and for each class it styles alone (a rule whose selector is just `.name`) the properties it sets. */
function definedNames(css) {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/:(?:is|where|not)\([^)]*\)/g, '');
  const props = new Set([...clean.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));
  const classes = new Map();
  for (const [, selectors, body] of clean.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const set = (cls) => classes.set(cls, new Set([...(classes.get(cls) || []), ...[...body.matchAll(/(?:^|;)\s*([a-z-]+)\s*:/g)].map((m) => m[1])]));
    selectors.split(',').map((s) => s.trim()).filter((s) => /^\.[\w-]+$/.test(s)).forEach(set);
  }
  return { props, classes };
}

const sharedNames = new Map();
const demoCssNames = (moves) => {
  if (!sharedNames.has(moves)) sharedNames.set(moves, definedNames(fs.readFileSync(path.join(moves, 'demo', 'demo.css'), 'utf8')));
  return sharedNames.get(moves);
};

function redefinedNames(html, moves) {
  const own = definedNames([...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n'));
  const shared = demoCssNames(moves);
  const shadowed = [...own.classes].map(([cls, set]) => [cls, [...set].filter((p) => shared.classes.get(cls)?.has(p))]).filter(([, ps]) => ps.length);
  return { props: [...own.props].filter((p) => shared.props.has(p)), classes: shadowed.map(([cls, ps]) => `${cls} (${ps.join(', ')})`) };
}

/** What makes a demo refuse to render: a hand-written ease, with the job table's fix. */
export function demoProblems(name, moves = MOVES) {
  const file = demoPath(name, moves);
  if (isWaived(pageAuthoring(file), 'hand-written-ease')) return [];
  return handWrittenEases(fs.readFileSync(file, 'utf8')).map((at) => `${name}: hand-written ease at ${at}. Use easeFn from core/motion, by job (${EASE_FIX}); ${waiverHint('hand-written-ease')} for a faithful copy of a real product's curve`);
}

/** One advice line for a demo that shadows demo.css (custom properties first), or none. It never refuses. */
export function demoWarnings(name, moves = MOVES) {
  const { props, classes } = redefinedNames(fs.readFileSync(demoPath(name, moves), 'utf8'), moves);
  const parts = [props.length ? `custom properties ${props.join(', ')}` : '', classes.length ? `class rules ${classes.join('; ')}` : ''].filter(Boolean);
  return parts.length ? [`${name}: shadows demo.css: ${parts.join(' and ')}. Rename it to a demo-local name if the change is not on purpose.`] : [];
}

/** Throws when the demo has any problem from demoProblems. */
export function assertDemo(name, moves = MOVES) {
  const problems = demoProblems(name, moves);
  if (problems.length) throw new Error(problems.join('\n'));
}

/** Hash of the clip size and rate, the theme variant, the demo page, demo.css, the demo's own asset files and every core/ file the page imports. */
export function sourceHash(name, theme = null, moves = MOVES) {
  const demo = demoPath(name, moves);
  const files = [demo, path.join(moves, 'demo', 'demo.css'), ...ownAssets(name, moves), ...[...importedFiles(demo)].filter((f) => f !== demo).sort()];
  const h = crypto.createHash('sha256').update(`${CLIP_WIDTH}w ${CLIP_FPS}fps`);
  if (theme) h.update(theme);
  for (const f of files) h.update(path.relative(ROOT, f)).update(fs.readFileSync(f));
  return h.digest('hex').slice(0, 16);
}

const hashOf = (entry) => (typeof entry === 'string' ? entry : entry?.hash);
const readLock = (file = LOCK) => (fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {});
const LOCK_WAIT_MS = 15_000;

/** Merges `entries` into the lock file. Two renders at once each hold the mkdir lock for the read, merge and rename, so neither loses the other's clips. */
export async function recordClips(entries, lockFile = LOCK) {
  const guard = `${lockFile}.d`;
  const giveUp = Date.now() + LOCK_WAIT_MS;
  for (;;) {
    try { fs.mkdirSync(guard); break; } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      if (Date.now() > giveUp) throw new Error(`${guard} has been held for ${LOCK_WAIT_MS / 1000} s; remove it if no render is running`);
      await new Promise((r) => setTimeout(r, 50));
    }
  }
  try {
    const merged = { ...readLock(lockFile), ...entries };
    const tmp = `${lockFile}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, `${JSON.stringify(Object.fromEntries(Object.entries(merged).sort()), null, 2)}\n`);
    fs.renameSync(tmp, lockFile);
  } finally {
    fs.rmdirSync(guard);
  }
}

/** Why the clip must be rendered again, or '' when its sources match the recorded hash. The masters are not tracked, so a lock entry makes a clip current without a local file. */
export function staleReason({ id, name, theme }, lock) {
  if (!lock[id]) return 'no clip yet';
  return hashOf(lock[id]) === sourceHash(name, theme) ? '' : 'the clip size, demo, demo.css, its asset files or a core/ import changed';
}

function fetchMissingFonts(names) {
  const read = (f) => fs.readFileSync(f, 'utf8');
  const files = fontFilesIn(read(path.join(MOVES, 'demo', 'demo.css')), ...names.map((n) => read(path.join(MOVES, 'demo', `${n}.html`))));
  if (ensureFonts(ROOT, files)) console.log('  fonts    a face was missing from assets/fonts; fetched with generators/media/fonts.mjs');
}

/** The page a clip renders from: the demo, or for a variant a copy of it with data-theme set, deleted after the render. */
function variantPage({ id, name, theme }) {
  const html = fs.readFileSync(demoPath(name), 'utf8');
  if (!/<html[^>]*data-theme="[a-z]+"/.test(html)) throw new Error(`${name}: a variants meta needs <html data-theme="dark"> to replace`);
  const file = path.join(MOVES, 'demo', `${id}${VARIANT_SUFFIX}`);
  fs.writeFileSync(file, html.replace(/(<html[^>]*data-theme=")[a-z]+"/, `$1${theme}"`));
  return file;
}

function renderArgs({ id, name }, demo) {
  const { width, height } = resolveFrame(demo);
  return ['harness/media/render-page.mjs', demo, path.join(MOVES, `${id}.mp4`), '--w', String(CLIP_WIDTH), '--h', String(Math.round((CLIP_WIDTH * height) / width)), '--fps', String(CLIP_FPS), '--workers', String(WORKERS_PER_RENDER), '--silent'];
}

function renderOne(clip) {
  const { id, theme } = clip;
  const demo = theme ? variantPage(clip) : demoPath(clip.name);
  return new Promise((resolve) => {
    const child = spawn(process.execPath, renderArgs(clip, demo), { cwd: ROOT, stdio: ['ignore', 'ignore', 'pipe'], env: { ...process.env, VAWE_RENDER_KIND: 'clip' } });
    let stderr = '';
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('close', (code) => {
      if (theme) fs.rmSync(demo, { force: true });
      resolve({ id, code, stderr: stderr.trim() });
    });
  });
}

// The render encodes at RENDER_CRF. A clip over the budget is encoded again from that file at the next CRFs; the last file written is the one kept.
function fitBudget(name) {
  const file = path.join(MOVES, `${name}.mp4`), fit = path.join(MOVES, `${name}.fit.mp4`);
  const sizeAt = (crf) => {
    if (crf === RENDER_CRF) return fs.statSync(file).size;
    const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', file, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-preset', 'fast', '-crf', String(crf), '-x264-params', 'aq-mode=3', '-movflags', '+faststart', '-f', 'mp4', fit]);
    if (r.status !== 0) throw new Error(`ffmpeg re-encode of ${name} at crf ${crf} failed: ${r.stderr}`);
    return fs.statSync(fit).size;
  };
  const chosen = chooseCrf(sizeAt);
  if (chosen.crf !== RENDER_CRF) fs.renameSync(fit, file);
  if (!chosen.fits) console.log(`  warn     ${name}: ${(chosen.bytes / 1048576).toFixed(1)} MB at crf ${chosen.crf}, over the ${CLIP_BUDGET_BYTES / 1048576} MB budget`);
  return chosen.crf;
}

/** Writes the 12-frame contact sheet of a rendered clip with the code of `vawe frame --at s,s,s` and returns its path. */
export function writeClipSheet(name, out = path.join(ROOT, 'out', 'moves', `${name}-sheet.png`)) {
  const r = spawnSync(process.execPath, ['harness/media/sheet.mjs', path.join(MOVES, `${name}.mp4`), '--out', out], { cwd: ROOT, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`the sheet of ${name} failed: ${(r.stderr || r.stdout).trim()}`);
  return out;
}

async function renderAll(clips) {
  const queue = [...clips], results = [];
  const lane = async () => {
    for (let clip = queue.shift(); clip; clip = queue.shift()) {
      const r = await renderOne(clip);
      if (r.code === 0) r.crf = fitBudget(r.id);
      console.log(r.code === 0 ? `  rendered ${r.id} (crf ${r.crf})` : `  FAILED   ${r.id}: ${r.stderr.split('\n').slice(-3).join(' | ')}`);
      results.push({ ...r, clip });
    }
  };
  await Promise.all(Array.from({ length: Math.min(PARALLEL, clips.length) }, lane));
  return results;
}

async function main() {
  const argv = process.argv.slice(2);
  const only = argv.includes('--only') ? argv[argv.indexOf('--only') + 1] : null;
  const all = moveNames();
  if (only && !all.includes(only)) {
    console.error(`vawe-dev moves: no demo named ${only}; valid: ${all.join(' ')}`);
    process.exit(2);
  }
  const lock = readLock();
  const force = only || argv.includes('--all');
  const clips = (only ? [only] : all).flatMap((name) => clipsOf(name)).filter((clip) => {
    const reason = staleReason(clip, lock);
    if (reason) console.log(`  stale    ${clip.id}: ${reason}`);
    return force || reason;
  });
  const names = [...new Set(clips.map((clip) => clip.name))];
  for (const name of names) {
    if (!fs.existsSync(path.join(MOVES, `${name}.md`))) console.log(`  warn     ${name}: no ${name}.md next to the clip`);
  }
  if (!clips.length) {
    console.log(`all ${all.length} clips are current; --all re-renders them`);
    return;
  }
  fetchMissingFonts(names);
  for (const name of names) { assertOwnAssets(name); assertDemo(name); }
  if (only) demoWarnings(only).forEach((w) => console.log(`  warn     ${w}`));
  const results = await renderAll(clips);
  const failed = results.filter((r) => r.code !== 0);
  const done = results.filter((r) => r.code === 0);
  if (done.length) await recordClips(Object.fromEntries(done.map((r) => [r.id, { hash: sourceHash(r.clip.name, r.clip.theme), crf: r.crf, clip: clipHash(path.join(MOVES, `${r.id}.mp4`)) }])));
  console.log(`${results.length - failed.length} of ${results.length} clips rendered to prompts/moves/`);
  if (only && done.some((r) => r.id === only)) {
    console.log(`  sheet    ${path.relative(ROOT, writeClipSheet(only))}`);
    console.log('next: Read the sheet at full size');
  }
  process.exit(failed.length ? 1 : 0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href) {
  main().catch((e) => {
    console.error(`vawe-dev moves: ${e.message}`);
    process.exit(1);
  });
}
