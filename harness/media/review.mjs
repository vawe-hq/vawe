#!/usr/bin/env node
// One command, one report, one picture sheet: what to fix in a page film, worst first.
//   node harness/media/review.mjs <page.html> [--ref <ref.mp4>] [--final] [--text] [--table] [--judge] [--out sheet.png]
// Draft by default (half size, 30 fps): an up-to-date draft is reused, else it is rendered and the old
// one kept as out/<name>-draft.prev.mp4. Each part is a function (ctx) -> findings
// { severity, t, frame, what, fix, crop? }; the report sorts them by severity, then time.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { scratch, drawtext } from '../lib/scratch.mjs';
import { sampleText, clippedGlyphs, timingRows, shortHolds, holdsBeyondRef, leastSeen } from '../lib/text-timing.mjs';
import { textTimeline } from './see/text-timeline.mjs';
import { clipMessage } from '../../quality/gates/page-check.mjs';
import { frameMotion, startJumps, earlyStops, frozenInside, secondSsim, collateralChange, changedSpan, collectMoves, repeatedMove, FPS } from './motion-curve.mjs';
import { coverage } from './coverage.mjs';
import { probe } from './see-views.mjs';
import { resolveDuration } from './page-duration.mjs';

const RANK = { error: 0, warn: 1, info: 2 };
const SHEET_ROWS = 6;
const SHOWN = 20;
const TILE_W = 480, TILE_H = 270;
const CROP_PAD = 16;
const REF_TEXT_FPS = 10;
const die = (m) => { console.error(`✗ ${m}`); process.exit(2); };
const frameOf = (t) => Math.round(t * FPS);
const finding = (severity, t, what, fix, extra = {}) => ({ severity, t, frame: frameOf(t), what, fix, ...extra });

function draftPaths(page, final) {
  const abs = path.resolve(page), base = path.basename(abs, '.html');
  const name = base === 'page' ? path.basename(path.dirname(abs)) : base;
  const video = path.resolve('out', `${name}${final ? '' : '-draft'}.mp4`);
  return { name, video, prev: video.replace(/\.mp4$/, '.prev.mp4') };
}

async function ensureRender(page, paths, final) {
  const fresh = fs.existsSync(paths.video) && fs.statSync(paths.video).mtimeMs >= fs.statSync(page).mtimeMs;
  if (fresh) return { reused: true, ms: 0 };
  fs.mkdirSync(path.dirname(paths.video), { recursive: true });
  if (fs.existsSync(paths.video) && !final) fs.copyFileSync(paths.video, paths.prev);
  const { renderPage } = await import('./render-page.mjs');
  const t0 = Date.now();
  await renderPage(page, paths.video, { final });
  return { reused: false, ms: Date.now() - t0 };
}

async function cropOf(opened, c, out) {
  const { seekAll } = await import('./render-page.mjs');
  await seekAll(opened.page, c.t * 1000);
  const b = c.box, i = c.ink;
  await opened.page.evaluate((r) => {
    const d = document.createElement('div');
    d.id = '__review-box';
    d.style.cssText = `position:fixed;left:${r.x}px;top:${r.y}px;width:${r.w}px;height:${r.h}px;border:1px solid #f0f;pointer-events:none;z-index:2147483647`;
    document.body.appendChild(d);
  }, b);
  const x = Math.max(0, Math.min(i.x, b.x) - CROP_PAD), y = Math.max(0, Math.min(i.y, b.y) - CROP_PAD);
  const right = Math.max(i.x + i.w, b.x + b.w) + CROP_PAD, bottom = Math.max(i.y + i.h, b.y + b.h) + CROP_PAD;
  await opened.page.screenshot({ path: out, clip: { x, y, width: Math.max(8, right - x), height: Math.max(8, bottom - y) } });
  await opened.page.evaluate(() => document.getElementById('__review-box').remove());
  return out;
}

async function textPass(ctx) {
  const { openPage, settle, resolveFrame } = await import('./render-page.mjs');
  const opened = await openPage(ctx.page, resolveFrame(ctx.page, { final: ctx.final }));
  try {
    await opened.page.goto(opened.url, { waitUntil: 'load' });
    await settle(opened.page);
    const moves = await opened.page.evaluate(collectMoves);
    const samples = await sampleText(opened.page, ctx.dur, ctx.step);
    const clipped = clippedGlyphs(samples);
    for (const [k, c] of clipped.slice(0, SHEET_ROWS).entries()) c.crop = await cropOf(opened, c, path.join(ctx.work, `crop-${k}.png`));
    return { samples, clipped, moves };
  } finally { await opened.close(); }
}

function groupClips(clipped) {
  const groups = new Map();
  for (const c of clipped) {
    const key = [c.kind, c.side, ...Object.values(c.box).map((v) => typeof v === 'number' ? Math.round(v / 4) : v)].join('|');
    const g = groups.get(key);
    if (!g) groups.set(key, { ...c, count: 1 });
    else { g.count++; if (c.px > g.px) Object.assign(g, { px: c.px, sizeShare: c.sizeShare }); if (c.t < g.t) { g.t = c.t; g.crop = c.crop || g.crop; } }
  }
  return [...groups.values()];
}

const clipPart = async (ctx) => groupClips((await ctx.sampled).clipped).map((c) => finding(
  c.sizeShare >= 0.15 ? 'error' : 'warn', c.t, `${clipMessage(c)}${c.count > 1 ? ` (${c.count} text runs in this box)` : ''}`,
  `grow the ${c.kind} box by ${Math.ceil(c.px)} px on the ${c.side}, or raise the line-height so the glyphs fit`, { crop: c.crop }));

async function referenceHolds(ctx) {
  try { return { runs: await textTimeline(ctx.ref, ctx.work, REF_TEXT_FPS) }; } catch (e) { return { why: String(e.message).split('\n')[0] }; }
}

async function timingPart(ctx) {
  let holds = shortHolds(timingRows((await ctx.sampled).samples, ctx.step, ctx.dur));
  const notes = [];
  if (ctx.ref) {
    const ref = await referenceHolds(ctx);
    if (ref.runs) holds = holdsBeyondRef(holds, ref.runs, 1 / REF_TEXT_FPS);
    else { holds = []; notes.push(finding('info', 0, `reading holds not checked: the reference text timeline is not available (${ref.why})`, 'none: install tesseract, or read the holds against the reference by eye')); }
  }
  return [...notes, ...holds.map((r) => finding(
    r.hold < r.need * 0.6 ? 'error' : 'warn', r.readable,
    `"${r.text}" (${r.words} word${r.words > 1 ? 's' : ''}) is readable ${r.hold.toFixed(2)} s, from ${r.readable.toFixed(1)} s to ${r.leave.toFixed(1)} s, and needs ${r.need.toFixed(1)} s`,
    `hold it ${(r.need - r.hold).toFixed(1)} s longer: move its exit to ${(r.readable + r.need).toFixed(1)} s`))];
}

const changeText = (x, label) => `${label} at f${x.frame}${x.frames ? ` for ${x.frames} frame(s)` : ''}, motion ${x.mag.toFixed(1)}`;

function motionAgainstRef(a, b) {
  const at = (x) => x.frame / FPS;
  return [
    ...startJumps(a, b).map((x) => finding('warn', at(x), `starts with a jump: frame ${x.frame} moves ${x.mag.toFixed(1)}, the reference ${x.ref.toFixed(1)}`, 'ease the first move in: start from rest and let it accelerate over 6 to 10 frames', { frame: x.frame })),
    ...earlyStops(a, b).map((x) => finding('error', at(x), `stops early: still for ${x.frames} frames from f${x.frame} while the reference moves ${x.mag.toFixed(1)}`, 'keep the move going until the reference settles, or ease it out later', { frame: x.frame })),
    ...frozenInside(a, b).map((x) => finding('warn', at(x), `${changeText(x, 'frozen frames inside motion')} before it`, 'the render repeats a frame: seed the motion from t, not from the last frame', { frame: x.frame })),
  ];
}

function motionAlone(a) {
  return frozenInside(a).map((x) => finding('warn', x.frame / FPS, `${changeText(x, 'frozen frames inside motion')} before it`, 'a move stalls for a moment: check the keyframes for a repeated value', { frame: x.frame }));
}

function motionAgainstPrev(ctx) {
  if (!fs.existsSync(ctx.prev)) return [];
  const { edit, collateral } = collateralChange(secondSsim(ctx.video, ctx.prev));
  const span = (r) => `${r.from}-${r.to} s`;
  const out = collateral.map((r) => finding('warn', r.from, `changed since the last render although the edit was at ${span(edit)}: ${span(r)} differs, SSIM ${r.ssim.toFixed(2)}`, 'the fix broke something else: compare the two drafts at that second and undo the side effect'));
  if (edit) out.push(finding('info', edit.from, `the edit changed ${span(edit)} (SSIM ${edit.ssim.toFixed(2)}) against the last render`, 'none: this is the expected change'));
  return out;
}

async function motionPart(ctx) {
  const a = frameMotion(ctx.video);
  if (ctx.ref) return motionAgainstRef(a, frameMotion(ctx.ref));
  return [...motionAlone(a), ...motionAgainstPrev(ctx)];
}

function textCoverageFindings(ctx) {
  const r = spawnSync('node', ['harness/media/coverage.mjs', ctx.video, '--ref', ctx.ref, '--text'], { encoding: 'utf8', cwd: path.resolve(import.meta.dirname, '../..') });
  const out = [];
  for (const line of r.stdout.split('\n')) {
    const m = /^\s+(MISSING|LATE|EARLY)\s+([\d.]+)s\s+(.*)$/.exec(line);
    if (m) out.push(finding(m[1] === 'MISSING' ? 'error' : 'warn', Number(m[2]), `text ${m[1].toLowerCase()} against the reference: ${m[3].trim()}`, m[1] === 'MISSING' ? 'add the words at that time' : 'move the words to the reference time'));
  }
  return out;
}

async function coveragePart(ctx) {
  if (!ctx.ref) return [];
  const log = console.log;
  console.log = () => {};
  let low;
  try { ({ low } = await coverage({ ours: ctx.video, ref: ctx.ref, min: 0.5 })); } finally { console.log = log; }
  const rows = low.filter((x) => x.s < ctx.dur).map((x) => finding(x.m < 0.3 ? 'error' : 'warn', x.s, `second ${x.s} matches the reference badly: SSIM ${x.m.toFixed(2)}`, 'compare that second against the reference and fix the biggest difference'));
  return ctx.withText ? [...rows, ...textCoverageFindings(ctx)] : rows;
}

const QUIET_LUFS = -30, LOUD_LUFS = -12, TYPICAL_LUFS = -20;

/** loudnessFinding(lufs) -> a warn when the written mix is quieter than -30 or louder than -12 LUFS, else null. */
export function loudnessFinding(lufs) {
  if (lufs >= QUIET_LUFS && lufs <= LOUD_LUFS) return null;
  const n = Math.abs(Math.round(TYPICAL_LUFS - lufs));
  const quiet = lufs < QUIET_LUFS;
  return finding('warn', 0, `the mix is ${quiet ? 'quiet' : 'loud'}: ${lufs.toFixed(1)} LUFS as written, outside ${QUIET_LUFS} to ${LOUD_LUFS}`,
    `${quiet ? 'raise' : 'lower'} every data-gain by ${n} dB`);
}

function loudnessPart(ctx) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', ctx.video, '-vn', '-af', 'ebur128', '-f', 'null', '-'], { encoding: 'utf8' });
  const m = r.stderr.slice(r.stderr.lastIndexOf('Summary:')).match(/I:\s+(-?[\d.]+) LUFS/);
  const found = m && parseFloat(m[1]) > -70 ? loudnessFinding(parseFloat(m[1])) : null;
  return found ? [found] : [];
}

export const PARTS = [clipPart, timingPart, motionPart, coveragePart, loudnessPart];

const partName = (part) => part.name.replace(/Part$/, '');
const ranParts = (ref) => PARTS.filter((p) => p !== coveragePart || ref).map(partName);

// A file in quality/gates/ that `vawe check` cannot load would never run and never say so.
function gateProblems(dir) {
  return fs.readdirSync(dir).flatMap((f) => {
    if (!f.endsWith('.mjs')) return [`${f} is not a .mjs file, so vawe check never finds it`];
    const r = spawnSync(process.execPath, ['--check', path.join(dir, f)], { encoding: 'utf8' });
    return r.status === 0 ? [] : [`${f} does not parse: ${(r.stderr || '').split('\n').find((l) => /Error/.test(l)) || 'node --check failed'}`];
  });
}

export function checksLines(ref, gateDir = path.resolve(import.meta.dirname, '../../quality/gates')) {
  const ran = ranParts(ref);
  return [`ran ${ran.length} checks: ${ran.join(', ')}`, ...gateProblems(gateDir).map((p) => `warn: quality/gates/${p}`)];
}

export function sortFindings(list) {
  return [...list].sort((x, y) => RANK[x.severity] - RANK[y.severity] || x.t - y.t);
}

function tile(video, t, label, out) {
  const vf = `scale=${TILE_W}:${TILE_H}:force_original_aspect_ratio=decrease,pad=${TILE_W}:${TILE_H}:(ow-iw)/2:(oh-ih)/2:black,drawtext=text='${drawtext(label)}':x=8:y=8:fontsize=20:fontcolor=white:box=1:boxcolor=black@0.6`;
  spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', video, '-ss', String(Math.max(0, t)), '-frames:v', '1', '-vf', vf, out]);
  return out;
}

function cropTile(png, out) {
  const vf = `scale=${TILE_W}:${TILE_H}:force_original_aspect_ratio=decrease:flags=neighbor,pad=${TILE_W}:${TILE_H}:(ow-iw)/2:(oh-ih)/2:black`;
  spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', png, '-vf', vf, out]);
  return out;
}

/** Six rows, reference left, ours, then the crop when the finding has one. -> the PNG path or null. */
export function writeSheet(list, ctx, out) {
  const picks = list.filter((f) => f.severity !== 'info').slice(0, SHEET_ROWS);
  const rows = [];
  for (const [k, f] of picks.entries()) {
    const tiles = [];
    if (ctx.ref) tiles.push(tile(ctx.ref, f.t, `reference ${k + 1} f${f.frame}`, path.join(ctx.work, `s${k}r.png`)));
    tiles.push(tile(ctx.video, f.t, `${k + 1} ${f.severity} f${f.frame}`, path.join(ctx.work, `s${k}o.png`)));
    if (f.crop) tiles.push(cropTile(f.crop, path.join(ctx.work, `s${k}c.png`)));
    const row = path.join(ctx.work, `row${k}.png`);
    const args = tiles.flatMap((p) => ['-i', p]);
    const graph = `${tiles.length > 1 ? `hstack=inputs=${tiles.length},` : ''}pad=${TILE_W * 3}:${TILE_H}:0:0:black`;
    spawnSync('ffmpeg', ['-v', 'error', '-y', ...args, '-vf', graph, row]);
    rows.push(row);
  }
  if (!rows.length) return null;
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const stack = rows.length > 1 ? ['-filter_complex', `vstack=inputs=${rows.length}`] : [];
  spawnSync('ffmpeg', ['-v', 'error', '-y', ...rows.flatMap((r) => ['-i', r]), ...stack, out]);
  return fs.existsSync(out) ? out : null;
}

/** A suggestion, never a failure: the least seen text line and the most repeated move. -> [line] ; empty while an error stands. */
export function cutLines(findings, { samples, moves }, step) {
  if (findings.some((f) => f.severity === 'error')) return [];
  const seen = leastSeen(samples, step), move = repeatedMove(moves);
  const parts = [seen && `the least seen text, "${seen.text}" (${seen.seconds.toFixed(1)} s on screen)`, move && `the most repeated move, ${move.name} (${move.count} times)`].filter(Boolean);
  return ['Cut: remove one element and one move, then review again' + (parts.length ? `: ${parts.join('; ')}` : '')];
}

/** The latest `vawe-dev judge` result for this page, as one header line. */
export function judgeLine(name, page) {
  const file = path.resolve('out', `${name}.judge.json`);
  if (!fs.existsSync(file)) return 'judge: no judge yet';
  const j = JSON.parse(fs.readFileSync(file, 'utf8'));
  const stale = fs.statSync(file).mtimeMs < fs.statSync(page).mtimeMs ? ' (older than the page)' : '';
  return `judge: ${j.pass ? 'pass' : 'fail'}${j.time != null ? ` at ${j.time} s` : ''}${j.topFix ? `, top fix: ${j.topFix}` : ''}${stale}`;
}

/** Prepare the default-reject judge; the fresh session that scores it needs the printed command. */
export function judgeHandoff(page, ref, name) {
  const args = ['quality/gates/judge.mjs', page, ...(ref ? ['--ref', ref] : [])];
  const r = spawnSync(process.execPath, args, { encoding: 'utf8', cwd: path.resolve(import.meta.dirname, '../..') });
  if (r.status !== 0) return [`judge not prepared: ${String(r.stderr || r.stdout).trim().split('\n')[0]}`];
  const who = `VAWE_AGENT=judge-${name}`;
  return [`judge prepared. In a fresh session, read the sheet and rubric, then record:`,
    `  ${who} bin/vawe-dev judge ${page} --verdict FIX --at <seconds> --top-fix "<one fix>"   (or --verdict PASS)`];
}

/** Compare this render with the one the last review saw. -> { line, diff } ; the render is saved for the next review. */
export function sheetDiff(ctx, sheetOut) {
  const last = sheetOut.replace(/\.png$/, '.last.mp4'), diff = sheetOut.replace(/\.png$/, '.diff.png');
  const result = { line: 'changed since last review: no earlier review to compare', diff: null };
  if (fs.existsSync(last)) {
    try {
      const span = changedSpan(secondSsim(ctx.video, last));
      if (!span) result.line = 'changed since last review: nothing';
      else {
        const t = Math.min(span.worst + 0.5, ctx.dur - 0.05);
        const args = [tile(last, t, 'before', path.join(ctx.work, 'd0.png')), tile(ctx.video, t, 'after', path.join(ctx.work, 'd1.png'))].flatMap((p) => ['-i', p]);
        spawnSync('ffmpeg', ['-v', 'error', '-y', ...args, '-filter_complex', 'hstack=inputs=2', diff]);
        Object.assign(result, { line: `changed since last review: seconds ${span.from}-${span.to}`, diff: fs.existsSync(diff) ? diff : null });
      }
    } catch (e) { result.line = `changed since last review: not measured (${String(e.message).split('\n')[0]})`; }
  }
  fs.copyFileSync(ctx.video, last);
  return result;
}

export function reportLines(list, { sheet, timing, table, changed, cut = [], header, handoff = [] }) {
  const n = (s) => list.filter((f) => f.severity === s).length;
  const lines = [...(header ? [header] : []), `${list.length} finding(s): ${n('error')} error, ${n('warn')} warn, ${n('info')} info`];
  list.slice(0, SHOWN).forEach((f, i) => {
    lines.push(`${String(i + 1).padStart(2)}. [${f.severity}] f${f.frame} (${f.t.toFixed(2)}s) ${f.what}`, `      fix: ${f.fix}${f.crop ? `\n      crop: ${f.crop}` : ''}`);
  });
  if (list.length > SHOWN) lines.push(`... ${list.length - SHOWN} more, lowest severity last, all in the json`);
  if (table) {
    lines.push('text timing (line, enter, readable, leave, hold, need):');
    for (const r of timing) lines.push(`  f${frameOf(r.readable)} ${r.enter.toFixed(2)} ${r.readable.toFixed(2)} ${r.leave.toFixed(2)} ${r.hold.toFixed(2)}/${r.need.toFixed(1)}${r.endsFilm ? ' (to end)' : ''}  "${r.text}"`);
  }
  if (sheet) lines.push(`sheet: ${sheet}`);
  if (changed) lines.push(changed.line, ...(changed.diff ? [`before and after, the most changed frame: ${changed.diff}`] : []));
  const top = list.find((f) => f.severity !== 'info');
  lines.push(top ? `Fix first: f${top.frame} (${top.t.toFixed(2)}s): ${top.fix}` : 'Fix first: nothing measured is wrong. The eye still judges what a number cannot.');
  lines.push(...cut, ...handoff);
  return lines;
}

/** review({ page, ref, final, text, out }) -> { findings, timing, sheet, video, ms, reused }. Throws on a bad input. */
export async function review({ page, ref, final = false, text = false, out, judge = false }) {
  if (!fs.existsSync(page)) throw new Error(`no such file: ${page}`);
  if (ref && !fs.existsSync(ref)) throw new Error(`no such reference: ${ref}`);
  const t0 = Date.now();
  const paths = draftPaths(page, final);
  const rendering = ensureRender(page, paths, final);
  const metaDur = await resolveDuration(page);
  if (!metaDur) await rendering;
  const dur = metaDur || probe(paths.video).dur;
  const work = scratch('review', paths.name);
  const ctx = { page, ref, final, withText: text, video: paths.video, prev: paths.prev, dur, work, step: 0.1 };
  ctx.sampled = textPass(ctx);
  const render = await rendering;
  const findings = sortFindings((await Promise.all(PARTS.map((p) => p(ctx)))).flat());
  const sheetOut = out || path.resolve('out', `review-${paths.name}.png`);
  if (fs.existsSync(sheetOut)) fs.copyFileSync(sheetOut, sheetOut.replace(/\.png$/, '.prev.png'));
  const sheet = writeSheet(findings, ctx, sheetOut);
  const changed = sheetDiff(ctx, sheetOut);
  const header = judgeLine(paths.name, page);
  const handoff = judge ? judgeHandoff(page, ref, paths.name) : [];
  const cut = cutLines(findings, await ctx.sampled, ctx.step);
  const timing = timingRows((await ctx.sampled).samples, ctx.step, dur);
  fs.writeFileSync(path.resolve('out', `${paths.name}-review.json`), JSON.stringify({ findings, timing, sheet, changed, cut, header }, null, 1));
  return { findings, timing, sheet, changed, cut, header, handoff, video: paths.video, ms: Date.now() - t0, reused: render.reused };
}

async function main() {
  const argv = process.argv.slice(2);
  const flag = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
  const page = argv.find((a, i) => !a.startsWith('--') && !['--ref', '--out'].includes(argv[i - 1]));
  if (!page) die('usage: review.mjs <page.html> [--ref <ref.mp4>] [--final] [--text] [--table] [--judge] [--out sheet.png]');
  const ref = flag('--ref');
  const r = await review({ page, ref, final: argv.includes('--final'), text: argv.includes('--text'), out: flag('--out'), judge: argv.includes('--judge') });
  console.log(reportLines(r.findings, { sheet: r.sheet, timing: r.timing, table: argv.includes('--table'), changed: r.changed, cut: r.cut, header: r.header, handoff: r.handoff }).join('\n'));
  console.log(checksLines(ref).join('\n'));
  console.log(`(${(r.ms / 1000).toFixed(1)} s${r.reused ? ', draft reused' : ''}; data: out/${path.basename(r.video, '.mp4')}-review.json)`);
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((e) => die(e.message));
