#!/usr/bin/env node
// A fresh, default-reject taste judge an authoring agent can call itself: it prepares the evidence
// deterministically, then asks a separate headless Claude session (Read tool only) to score it.
//   node harness/media/judge-fresh.mjs <page.html | film.mp4 | sheet.png> [--brief brief.md] [--stage stills|draft|final]
// Advises, never blocks: exit 0 with a verdict either way. Exit 2 when the claude CLI is missing.
// Writes out/<name>.judge.json with the fix ledger (harness/lib/judge-ledger.mjs), or out/<name>.stills.json for stills.
// Env: VAWE_TASTE_CARD (overrides the taste card the judge reads, default taste/build/CARD.md), VAWE_JUDGE_TIMEOUT (seconds, default 240).
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { runFreshSession, requireClaude } from '../lib/fresh-session.mjs';
import { scratch } from '../lib/scratch.mjs';
import { appendRun, readRuns } from '../lib/runlog.mjs';
import { judgeEvent } from '../lib/run-events.mjs';
import { pageDigest } from '../lib/approval.mjs';
import { isTemplateBrief } from '../lib/draft-check.mjs';
import { parseDirections, rangeProblems, attractorProblems } from '../lib/directions.mjs';
import { TILE_W } from '../lib/sheet-tiles.mjs';
import { contactSheet as buildSheet, durationOf as readDuration, keyFrameFiles } from '../lib/contact-sheet.mjs';
import { previousItems, openItems, ledgerPrompt, mergeLedger, ledgerLines } from '../lib/judge-ledger.mjs';
import { adviceBlock } from '../lib/advice.mjs';
import { reportLines } from '../lib/judge-report.mjs';
import { findingsPrompt, readFindings, ruleOf, findingsEvent } from '../lib/judge-findings.mjs';
import { declaredSilent, declaredNoText } from '../lib/board.mjs';
import { readTricks, capByTricks, selfApprovedTricks } from '../lib/judge-tricks.mjs';
import { readApproval } from '../lib/approval.mjs';
import { siblingFilms } from '../lib/judge-siblings.mjs';
import { parseSignature } from '../../core/motion/signature.js';
import { sizeLines, capLines, holdLines, anchorLines, anchorResult, barLines, TASTE_CARD_REL } from '../lib/judge-prompt.mjs';
import { barResult, capScores, lostBoth, barFix, barEvent } from '../lib/judge-bar.mjs';
import { chooseRefs, refsDir } from '../lib/refs.mjs';
import { pickTemplate, readRouting } from '../cli/route.mjs';
import { referenceFor, pageAuthoring } from '../lib/motion-stamp.mjs';
import { waiverVerdicts } from '../lib/waivers.mjs';
import { parseBriefTables } from '../lib/brief-tables.mjs';
import { probeSize } from './scene-stats.mjs';
import { lastCaps } from './acceptance-run.mjs';
import { RULES } from '../lib/draft-check.mjs';
import { judgeLines, parseDecls, readDecls } from '../lib/design-decls.mjs';
import { freshRubric, FRESH_AXES } from '../../quality/gates/rubric.mjs';

const repoRoot = path.resolve(import.meta.dirname, '../..');
const KEY_FRAMES = 6;
const PASS_AT = 8;
const TASTE_CARD = path.join(repoRoot, TASTE_CARD_REL);
const RULE_IDS = fs.readdirSync(path.join(repoRoot, 'taste/rules')).filter((f) => f.endsWith('.md')).map((f) => f.slice(0, -3));
const SIBLING_W = 320;

const die = (m, code = 1) => { console.error(`vawe judge --fresh: ${m}`); process.exit(code); };
const arg = (k) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : null; };
const ff = (args, opts = {}) => spawnSync('ffmpeg', ['-hide_banner', '-nostdin', '-y', ...args], { encoding: opts.raw ? 'buffer' : 'utf8', maxBuffer: 1 << 28 });

const orDie = (fn) => (...args) => { try { return fn(...args); } catch (e) { return die(e.message); } };
const durationOf = orDie(readDuration);

const hasAudio = (file) => spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=index', '-of', 'csv=p=0', file], { encoding: 'utf8' }).stdout.trim() !== '';

function filmName(input) {
  const base = path.basename(input).replace(/\.[^.]+$/, '');
  return base === 'page' || base === 'directions' ? path.basename(path.dirname(path.resolve(input))) : base.replace(/-draft$/, '');
}

async function screenshotPage(page, out) {
  const { openPage, settle, resolveFrame } = await import('./render-page.mjs');
  const opened = await openPage(page, resolveFrame(page, { final: true }));
  try {
    await opened.page.goto(opened.url, { waitUntil: 'load' });
    await settle(opened.page);
    await opened.page.screenshot({ path: out });
  } finally { await opened.close(); }
}

async function draftOf(page, name) {
  const video = path.resolve('out', `${name}-draft.mp4`);
  if (fs.existsSync(video) && fs.statSync(video).mtimeMs >= fs.statSync(page).mtimeMs) return video;
  fs.mkdirSync(path.dirname(video), { recursive: true });
  const { renderPage } = await import('./render-page.mjs');
  await renderPage(page, video, {});
  return video;
}

const contactSheet = orDie(buildSheet);

function keyFrames(video, dur, dir, tables) {
  return keyFrameFiles(video, dur, dir, { words: tables.words, shots: tables.shots, count: KEY_FRAMES });
}

function loudness(file) {
  const r = ff(['-i', file, '-af', 'ebur128=peak=true', '-f', 'null', '-']);
  const tail = String(r.stderr).split('Summary:').pop();
  const get = (re) => (tail.match(re) || [])[1];
  const I = get(/I:\s+(-?[\d.]+)\s+LUFS/), LRA = get(/LRA:\s+([\d.]+)\s+LU/), peak = get(/Peak:\s+(-?[\d.]+|-inf)\s+dBFS/);
  return I ? `loudness: ${I} LUFS integrated, ${LRA} LU range, true peak ${peak} dBFS` : 'loudness: not measured';
}

function anchorOf(input, brief) {
  const dir = path.extname(input).toLowerCase() === '.html' ? path.dirname(path.resolve(input)) : brief ? path.dirname(path.resolve(brief)) : null;
  const ref = dir && referenceFor(path.join(dir, 'page.html'));
  if (ref && fs.existsSync(path.resolve(ref))) return { kind: 'reference', ref: path.resolve(ref) };
  return { kind: brief ? 'brief' : 'none' };
}

function anchorFrames(ref, keys, dir) {
  const last = Math.max(0, durationOf(ref) - 0.05);
  return keys.map((k, i) => {
    const file = path.join(dir, `anchor-${i + 1}-${k.t.toFixed(1)}s.png`);
    ff(['-ss', String(Math.min(k.t, last)), '-i', ref, '-frames:v', '1', file]);
    return { t: k.t, file };
  }).filter((a) => fs.existsSync(a.file));
}

function pageOf(input, brief) {
  if (path.extname(input).toLowerCase() === '.html') return path.resolve(input);
  const page = brief && path.join(path.dirname(path.resolve(brief)), 'page.html');
  return page && fs.existsSync(page) ? page : null;
}

async function declaredOf(page) {
  if (!page) return { signature: {}, waivers: [], message: null };
  const { readPageMeta } = await import('./render-page.mjs');
  const authoring = pageAuthoring(page);
  return { signature: parseSignature(readPageMeta(page, 'signature')), message: readPageMeta(page, 'message'), waivers: waiverVerdicts(authoring).map(({ entry, why, problem }) => ({ code: entry, why, problem })) };
}

function siblingThumbs(name, dir) {
  return siblingFilms(path.resolve('out'), name).map((s, i) => {
    const file = path.join(dir, `sibling-${i + 1}-${s.name}.png`);
    ff(['-ss', String(durationOf(s.video) / 2), '-i', s.video, '-vf', `scale=${SIBLING_W}:-2`, '-frames:v', '1', file]);
    return { name: s.name, file };
  }).filter((s) => fs.existsSync(s.file));
}

const routeRequest = (request, length) => { const r = pickTemplate({ request, length }, readRouting(repoRoot)); return r.known ? r.template : null; };

function referencesFor(briefFile, dur) {
  const found = chooseRefs({ dir: refsDir(), briefText: briefFile ? fs.readFileSync(briefFile, 'utf8') : null, seconds: dur, routeRequest });
  if (found.skipped) console.error(`judge: side-by-side comparison skipped: ${found.skipped}`);
  if (found.named) console.error(`judge: side-by-side includes ${found.named}, the reference the brief names`);
  return found.refs;
}

async function prepare(input, stage, brief) {
  const name = filmName(input);
  const dir = scratch('judge-fresh', name);
  const ext = path.extname(input).toLowerCase();
  if (stage === 'stills') {
    let image = path.resolve(input);
    if (ext === '.html') { image = path.join(dir, 'stills.png'); await screenshotPage(path.resolve(input), image); }
    return { name, stage, files: [image], notes: [`stills: ${image}`] };
  }
  let video = path.resolve(input);
  if (ext === '.html') {
    if (stage === 'final') {
      video = path.resolve('out', `${name}.mp4`);
      if (!fs.existsSync(video)) die(`no final render at ${video}; run: bin/vawe ship ${input}`);
    } else video = await draftOf(path.resolve(input), name);
  }
  const dur = durationOf(video);
  const sheet = contactSheet(video, dur, dir);
  const keys = keyFrames(video, dur, dir, parseBriefTables(brief ? fs.readFileSync(brief, 'utf8') : null));
  const briefText = brief ? fs.readFileSync(brief, 'utf8') : null;
  const silent = stage === 'final' && declaredSilent(briefText);
  const sound = stage === 'final' && !silent && hasAudio(video) ? loudness(video) : null;
  const anchor = anchorOf(input, brief);
  const anchorShots = anchor.kind === 'reference' ? anchorFrames(anchor.ref, keys, dir) : [];
  const sizeOf = (label, file, tile) => ({ label, ...probeSize(file), ...(tile ? { tile } : {}) });
  const images = [sizeOf('the sheet', sheet.file, TILE_W), ...keys.map((k, i) => sizeOf(`key frame ${i + 1}`, k.file)), ...anchorShots.map((a, i) => sizeOf(`anchor frame ${i + 1}`, a.file))];
  const notes = [
    `video: ${video} (${dur.toFixed(2)} s)`,
    `sheet: ${sheet.file}  (one frame every ${(1 / sheet.fps).toFixed(2)} s, read left to right and top to bottom, each tile is labelled with its time in seconds)`,
    ...keys.map((k, i) => `key frame ${i + 1} at ${k.t.toFixed(1)} s (a settled moment: nothing mid-transition): ${k.file}`),
    ...anchorShots.map((a, i) => `anchor frame ${i + 1} (the reference at ${a.t.toFixed(1)} s, the anchor for key frame ${i + 1}): ${a.file}`),
    sound || (silent ? 'sound: the brief declares a silent film; not scored' : stage === 'final' ? 'sound: the file has no audio track' : 'sound: not scored at this stage'),
  ];
  const siblings = siblingThumbs(name, dir);
  const refs = referencesFor(briefArg, dur);
  const declared = await declaredOf(pageOf(input, brief));
  return { name, stage, silent, noText: declaredNoText(briefText), files: [sheet.file, ...keys.map((k) => k.file), ...anchorShots.map((a) => a.file), ...siblings.map((s) => s.file), ...refs.map((r) => r.file)], notes, dir, keys, images, anchor, caps: lastCaps(name), siblings, refs, declared };
}

const STILLS_TASK = `The image shows three directions side by side: A on the left, B in the middle, C on the right, each a key frame with a caption.
Score each direction 1 to 10 for how well its one frame would carry the film the brief asks for, and how far it is from a template.
Name the strongest with one reason. Does the product UI read as a designed interface, or as placeholder bars? Answer in the reason. Then score the axes below for the strongest direction only.`;

const STILLS_JSON = `
Add three more keys to that object: "directions":[{"id":"A","score":n,"note":"one short line"},{"id":"B",...},{"id":"C",...}], "strongest":"A, B or C", "reason":"one sentence".`;

const findingsBlock = (ev) => findingsPrompt({ card: fs.readFileSync(path.resolve(process.env.VAWE_TASTE_CARD || TASTE_CARD), 'utf8'), declared: ev.declared, siblings: ev.siblings });

function checkBlock(ev, decls) {
  if (ev.stage === 'stills') return '';
  const parts = [sizeLines(ev.images || []), capLines(ev.caps, { copy: decls.typeScale ?? RULES.capFrac * 100, ui: decls.uiScale ?? RULES.uiCapFrac * 100 }), holdLines(), ev.keys?.length ? anchorLines(ev.anchor, ev.keys) : [], ev.refs?.length ? barLines(ev.refs) : []].filter((p) => p.length);
  return parts.map((p) => `${p.join('\n')}\n\n`).join('');
}

function designOf(brief) {
  const file = brief && path.join(path.dirname(path.resolve(brief)), 'DESIGN.md');
  return file && fs.existsSync(file) ? file : null;
}

function buildPrompt(ev, brief, ledger = '') {
  const decls = brief ? readDecls(brief) : parseDecls('');
  const declared = judgeLines(decls);
  const optional = [
    brief && `The brief (Read it): ${path.resolve(brief)}`,
    designOf(brief) && `The film's DESIGN.md (the owner's decisions for this film; Read it and judge the film against it): ${designOf(brief)}`,
    `Taste card: the scored rules and 5 anti-patterns (Read this file once; besides it, open only the evidence images and the sibling thumbnails): ${path.resolve(process.env.VAWE_TASTE_CARD || TASTE_CARD)}. Score the axes below with these rules in mind, and name the rule id in each fix. Where the brief asks for something a card rule treats as a default to avoid (glow, gradients, rich colour, several hues), the brief wins: do not mark it down.`,
  ].filter(Boolean);
  const kind = ev.stage === 'stills' ? 'three still directions for a film' : `a ${ev.stage} cut of a film`;
  return `You are a fresh taste judge. You did not make this work and you own no part of it. You judge ${kind} from the evidence files below.
Use only the Read tool: open the image files and look at them before you score. Do not guess from file names.
${ev.stage === 'stills' ? STILLS_TASK : 'Open the sheet first, then every key frame at full size. The sheet is a grid of separate frames; confirm any defect you see on it (an echo, a repeat, a small copy of the frame) on a full-size key frame before you name it.'}

Evidence:
${ev.notes.map((n) => `- ${n}`).join('\n')}
${optional.length ? `\n${optional.map((o) => `- ${o}`).join('\n')}\n` : ''}
${declared.length ? `${declared.join('\n')}\n\n` : ''}${checkBlock(ev, decls)}${freshRubric({ stage: ev.stage })}${ev.stage === 'stills' ? STILLS_JSON : `\n\n${findingsBlock(ev)}`}${ledger ? `\n\n${ledger}` : ''}`;
}

function extractJson(text) {
  const a = text.indexOf('{'), b = text.lastIndexOf('}');
  if (a < 0 || b < a) return null;
  try { return JSON.parse(text.slice(a, b + 1)); } catch { return null; }
}

function runJudge(prompt, ev) {
  const dirs = [...new Set([...ev.files.map((f) => path.dirname(f)), repoRoot])];
  let session;
  try { session = runFreshSession({ prompt, dirs, cwd: ev.dir || path.dirname(ev.files[0]), timeoutS: Number(process.env.VAWE_JUDGE_TIMEOUT || 240), timeoutVar: 'VAWE_JUDGE_TIMEOUT', name: 'judge' }); } catch (e) { die(e.message, e.exitCode ?? 1); }
  const verdict = extractJson(session.text);
  if (!verdict?.scores) die(`the judge reply had no scores: ${session.text.slice(0, 300)}`);
  return { verdict, costUsd: session.costUsd };
}

function finish(ev, raw, ms) {
  const axes = FRESH_AXES[ev.stage === 'stills' ? 'stills' : 'film'].map(([k]) => k).filter((k) => !(k === 'sound' && (ev.stage !== 'final' || ev.silent)) && !(k === 'type' && ev.noText));
  const bar = ev.refs?.length ? barResult(raw.bar, ev.refs).filter((b) => !(ev.noText && b.dial === 'text')) : null;
  const given = Object.fromEntries(axes.map((k) => [k, Number(raw.scores[k])]));
  const tricks = ev.stage === 'stills' ? [] : [...readTricks(raw), ...selfApprovedTricks(readApproval(filmName(input), repoRoot), readRuns(filmName(input), repoRoot))];
  const scores = capByTricks(bar ? capScores(given, bar).scores : given, tricks);
  const low = axes.filter((k) => !(scores[k] >= PASS_AT));
  const fixes = low.map((k) => {
    const asked = (raw.fixes || []).find((x) => x.axis === k) || {};
    return { axis: k, score: scores[k], rule: ruleOf(asked, RULE_IDS), at: asked.at ?? null, fix: asked.fix || (bar && barFix(k, bar)) || 'no fix given' };
  });
  const pass = low.length === 0 && !(bar && lostBoth(bar).length);
  const first = raw.fixFirst || fixes[0]?.fix || null;
  const time = fixes.map((x) => parseFloat(x.at)).find((t) => Number.isFinite(t)) ?? null;
  return { fresh: true, stage: ev.stage, verdict: pass ? 'PASS' : 'FIX', pass, scores, worlds: ev.stage === 'stills' ? null : raw.worlds ?? null, fixes, fixFirst: first, time, topFix: first, ...(ev.stage === 'stills' ? { directions: raw.directions ?? null, strongest: raw.strongest ?? null, reason: raw.reason ?? null } : {}), ...(ev.keys?.length ? { anchor: anchorResult(raw.anchor, ev.keys) } : {}), ...(bar ? { bar, scoresGiven: given } : {}), ...(ev.stage === 'stills' ? {} : { ...readFindings(raw, RULE_IDS), tricks }), ms, recorded: new Date().toISOString().slice(0, 10) };
}

const input = process.argv[2];
if (!input || input.startsWith('--')) die('usage: vawe judge --fresh <page.html | film.mp4 | sheet.png> [--brief brief.md] [--stage stills|draft|final]', 2);
if (!fs.existsSync(input)) die(`no such file: ${input}`, 2);
try { requireClaude(); } catch (e) { die(e.message, e.exitCode); }
const briefArg = arg('--brief');
if (briefArg && !fs.existsSync(briefArg)) die(`no such brief: ${briefArg}`, 2);
const templateBrief = briefArg && isTemplateBrief(fs.readFileSync(briefArg, 'utf8'));
if (templateBrief) console.error(`${briefArg} still holds the template defaults: judged without a brief`);
const brief = templateBrief ? null : briefArg;
const ext = path.extname(input).toLowerCase();
const stage = arg('--stage') || (ext === '.mp4' ? 'final' : ext === '.png' || ext === '.jpg' ? 'stills' : 'draft');
if (!['stills', 'draft', 'final'].includes(stage)) die(`--stage is stills, draft or final, not "${stage}"`, 2);

if (stage === 'stills' && briefArg) {
  const text = fs.readFileSync(briefArg, 'utf8');
  const lines = adviceBlock([...rangeProblems(parseDirections(text).slots), ...attractorProblems(text)], '(advice only: the judge ran)');
  if (lines.length) console.log(lines.join('\n'));
}

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

const t0 = Date.now();
const pageHash = ext === '.html' ? pageDigest(input) : null;
const ev = await prepare(input, stage, brief);
const file = path.resolve('out', `${ev.name}.${stage === 'stills' ? 'stills' : 'judge'}.json`);
const prevItems = stage === 'stills' ? [] : previousItems(readJson(file));
const { verdict: raw } = runJudge(buildPrompt(ev, brief, ledgerPrompt(openItems(prevItems), prevItems)), ev);
const result = finish(ev, raw, Date.now() - t0);
const led = stage === 'stills' ? null : mergeLedger(prevItems, raw, result.fixes, result.notes);
if (led) Object.assign(result, { fixes: led.fixes, items: led.items, ledger: ledgerLines(led) });
appendRun(ev.name, judgeEvent({ pageHash, stage, verdict: result.verdict, scores: result.scores, anchor: result.anchor, bar: result.bar ? barEvent(result.bar) : null, ledger: led?.counts, seconds: result.ms / 1000, findings: stage === 'stills' ? null : findingsEvent(result) }));
fs.mkdirSync(path.dirname(file), { recursive: true });
fs.writeFileSync(file, JSON.stringify(result, null, 1));
console.log(reportLines(result, path.relative(process.cwd(), file)).join('\n'));
process.exit(0);
