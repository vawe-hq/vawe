// The acceptance table's I/O: reads the measures of a draft or a final, builds the rows
// (harness/lib/acceptance.mjs) and keeps the history in out/<name>.acceptance.json.
import fs from 'node:fs';
import path from 'node:path';
import { FPS } from './motion-curve.mjs';
import { tailMoving } from '../lib/tail-motion.mjs';
import { summarize } from './scene-stats.mjs';
import { readVideo, statsWithCamera } from './draft-check.mjs';
import { parseBriefTables, readBrief, dropGuesses } from '../lib/brief-tables.mjs';
import { smoothness, hardJumps } from '../lib/smoothness.mjs';
import { undeclaredStills } from '../lib/still-limit.mjs';
import { readHolds } from '../lib/worlds.mjs';
import { tailTiles } from '../lib/sheet-tiles.mjs';
import { heldTextRuns } from '../lib/draft-check.mjs';
import { textCollisions } from '../lib/text-collision.mjs';
import { readHoldProblems, readHoldUnmeasured, probeTracks } from '../lib/read-hold.mjs';
import { wordChecks, cutChecks, cutSpans as cutSpansOf, measuredSpec } from '../lib/spec-conformance.mjs';
import { buildRows, withHistory, tableLines, allMeasuredGreen, acceptanceCounts } from '../lib/acceptance.mjs';
import { syncSpec } from '../lib/spec-sync.mjs';
import { pageLook, writeLook, firstFamily } from '../lib/page-look.mjs';
import { pageAuthoring } from '../lib/motion-stamp.mjs';
import { unwaivedContrast } from '../lib/text-contrast.mjs';
import { readDecls } from '../lib/design-decls.mjs';

const outFile = (name, kind) => path.resolve('out', `${name}.${kind}.json`);
const nameOf = (mp4) => path.basename(mp4, '.mp4').replace(/-draft$/, '');

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

/** What the video alone tells: smoothness, still windows, tail tiles and the hard jumps' times, from one read of the video. */
export function videoMeasures({ feats, tiles, motion: diffs }, authoring, shots, tailMoving = false, worlds = null, cameraOnly = [], typing = []) {
  const stats = statsWithCamera(summarize(feats), cameraOnly, typing);
  const cuts = shots.slice(1).map((s) => s.start).filter((t) => typeof t === 'number');
  const worldCuts = (worlds ?? []).flatMap((w) => [w.start, w.end]).filter((t) => t > 0);
  return {
    smooth: smoothness(diffs, { fps: FPS, cuts, cutSpans: cutSpansOf(shots), turns: stats.turns.map((t) => t.t), worldCuts }),
    stills: undeclaredStills(stats.static, authoring, undefined, readHolds(worlds ?? [])),
    tail: tailTiles(tiles.diffs, tiles.fps, authoring, tailMoving),
    cuts: shots.length ? cutChecks(shots, hardJumps(diffs, FPS), FPS) : null,
    hasShots: shots.length > 0,
  };
}

/** What the live page's samples tell: text size, contrast, collisions, read holds, exits and the spec checks. */
function pageMeasures({ probe, findings, authoring }, tables) {
  const spec = probe.spec;
  const wordResult = spec && tables.words.length ? wordChecks(tables.words, spec.samples, spec, spec.times) : null;
  const tracks = probeTracks(probe.samples, probe, tables.words);
  return {
    caps: heldTextRuns(probe.samples, probe).map((r) => ({ text: r.key, cap: r.cap * 100, t: r.t, ...(r.chrome ? { chrome: true } : {}), ...(r.ui ? { ui: true } : {}) })),
    contrast: unwaivedContrast(probe.contrast, authoring),
    collisions: textCollisions(probe.samples),
    readHold: readHoldProblems(tracks),
    readHoldUnmeasured: readHoldUnmeasured(tracks),
    exits: findings.filter((f) => f.code === 'exit-length').map((f) => ({ at: f.at, what: f.what })),
    layout: wordResult && wordResult.filter((c) => !c.label.endsWith('appears')),
    measuredSpec: spec || probe.worlds?.length ? measuredSpec(tables.words, spec?.times ?? [], spec?.objects ?? [], probe.worlds ?? spec?.worlds ?? []) : null,
  };
}

function judgeMeasure(name) {
  const anchor = readJson(outFile(name, 'judge'))?.anchor;
  if (!anchor?.length) return null;
  const no = anchor.filter((a) => !a.yes);
  return { yes: anchor.length - no.length, total: anchor.length, fixes: no.map((a) => `${a.frame}${a.at != null ? ` at ${a.at} s` : ''}: ${a.fix}`) };
}

function record(name, rows, stage, caps = null, spec = null, worlds = null, tailMoving = null, cameraOnly = null, canvasFilm = false, typing = null) {
  const { file, was } = withHistory(readJson(outFile(name, 'acceptance')), rows, { stage, caps, spec, worlds, tailMoving, cameraOnly, typing, canvasFilm, at: new Date().toISOString() });
  fs.mkdirSync(path.dirname(outFile(name, 'acceptance')), { recursive: true });
  fs.writeFileSync(outFile(name, 'acceptance'), JSON.stringify(file, null, 1));
  return was;
}

/**
 * The acceptance rows of a full-length draft: { rows, was, sync }. `findings` are the page's motion-lint findings,
 * `video` the draft video's measures (videoMeasures, null when it could not be read), `mode` the draft's tier mode.
 * Table rows that `vawe new` wrote as template guesses are left out of the spec checks and show "not set".
 */
export function draftAcceptance({ mp4, pagePath, probe, level, findings, video, mode, cameraOnly = [], typing = [] }) {
  const { set, guessed } = dropGuesses(parseBriefTables(readBrief(pagePath)));
  const authoring = pageAuthoring(pagePath);
  const name = nameOf(mp4);
  const page = pageMeasures({ probe, findings, authoring }, set);
  const m = { ...(video ?? {}), ...page, decls: readDecls(pagePath), guessed, lufs: level?.I ?? null, peak: level?.TP ?? null, cues: level?.cues, judge: judgeMeasure(name) };
  const rows = buildRows(set.acceptance, m, { mode, stage: 'draft' });
  const was = record(name, rows, 'draft', page.caps, page.measuredSpec, probe.worlds, tailMoving(probe.tail), cameraOnly, Boolean(probe.canvasFilm), typing);
  return { rows, was, sync: writeBriefFromPage(pagePath, page.measuredSpec, probe.samples) };
}

const largestText = (samples) => samples.flatMap((s) => s.lines).reduce((a, l) => (a && a.fontPx >= l.fontPx ? a : l), null);

/**
 * The page owns the times and the Look: writes the measured times and the page's colours and face into brief.md.
 * Returns the printed lines, or null when nothing changed.
 */
function writeBriefFromPage(pagePath, measured, samples) {
  const text = readBrief(pagePath);
  if (text === null) return null;
  const spec = measured ? syncSpec(text, measured) : { text, changes: [] };
  const largest = largestText(samples);
  const look = writeLook(spec.text, pageLook(fs.readFileSync(pagePath, 'utf8'), largest && { family: firstFamily(largest.family), weight: largest.weight }));
  if (look.text !== text) fs.writeFileSync(path.join(path.dirname(path.resolve(pagePath)), 'brief.md'), look.text);
  return [spec.changes.length && timesLine(spec.changes.length), look.written.length && `brief: look written from the page (${look.written.join(', ')})`].filter(Boolean).join('\n') || null;
}

const timesLine = (n) => `brief: ${n} times written from the page (the page owns the times)`;

async function finalLevel(mp4) {
  try { return (await import('../lib/loudness.mjs')).measureFile(mp4); } catch { return null; }
}

/**
 * The acceptance table for a finished final, after its judge ran: { lines, allGreen, counts }. The rows that need the
 * live page (text, collisions, exits, spec words) keep the value of the last run, marked "(draft)".
 */
export async function finalAcceptance({ page, outputs }) {
  const mp4 = outputs[0];
  const tables = parseBriefTables(readBrief(page));
  const name = nameOf(mp4);
  const history = readJson(outFile(name, 'acceptance'))?.history ?? [];
  const level = await finalLevel(mp4);
  const facts = lastPageFacts(name);
  const m = { ...videoMeasures(readVideo(mp4), pageAuthoring(page), tables.shots, facts.tailMoving, facts.worlds, facts.cameraOnly, facts.typing), decls: readDecls(page), lufs: level?.I ?? null, peak: level?.TP ?? null, judge: judgeMeasure(name) };
  const rows = buildRows(tables.acceptance, m, { carry: history.at(-1)?.rows ?? [] });
  return { lines: [`acceptance (final ${path.basename(mp4)}):`, ...tableLines(rows, record(name, rows, 'final'))], allGreen: allMeasuredGreen(rows), counts: acceptanceCounts(rows) };
}

/** The measured text sizes of the last draft, [{ text, cap, t }] with cap in % of frame height, for the judge. Product chrome is not a line to read, so it is left out. */
export function lastCaps(name) {
  return ((readJson(outFile(name, 'acceptance'))?.history ?? []).findLast((e) => e.caps)?.caps ?? []).filter((c) => !c.chrome);
}

/** The times the last draft measured for the brief's SPEC rows, { words, objects }, or null before any draft. */
export function lastSpec(name) {
  return (readJson(outFile(name, 'acceptance'))?.history ?? []).findLast((e) => e.spec)?.spec ?? null;
}

/**
 * What the live page said at the last full draft, for checks that run on a final video alone:
 * { worlds (lastWorlds), tailMoving (an animation ran on a visible element through the last second), canvasFilm (a canvas covered the frame), cameraOnly (the seconds where only a whole-frame move ran), typing (the seconds where the text kept changing) }.
 */
export function lastPageFacts(name) {
  const last = (readJson(outFile(name, 'acceptance'))?.history ?? []).findLast((e) => e.worlds || e.tailMoving != null || e.canvasFilm);
  return { worlds: last?.worlds ?? null, tailMoving: Boolean(last?.tailMoving), cameraOnly: last?.cameraOnly ?? [], typing: last?.typing ?? [], canvasFilm: Boolean(last?.canvasFilm) };
}

/** The worlds of the last full draft, [{ id, start, end, ground }] (harness/lib/worlds.mjs), or null before any draft. */
export function lastWorlds(name) {
  return (readJson(outFile(name, 'acceptance'))?.history ?? []).findLast((e) => e.worlds)?.worlds ?? null;
}
