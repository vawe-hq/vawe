// The brief's ACCEPTANCE table with a measured value on every row it can measure. Pure: the measures come
// from harness/media/acceptance-run.mjs, the brief's targets from brief-tables.mjs, and each number is
// the one its own module already computes (still-limit, sheet-tiles, text-contrast, text-collision,
// read-hold, motion-lint, peak-limit, smoothness, spec-conformance).
import { LAYOUT_TOL_PCT, checkLine } from './spec-conformance.mjs';
import { RULES, loudnessFix } from './draft-check.mjs';
import { PEAK_DBFS, loudestCue } from './peak-limit.mjs';
import { DRAFT_MIN_RATIO } from './text-contrast.mjs';
import { unrunReason } from './draft-tiers.mjs';

export const HISTORY_KEEP = 10;
const SHOW = 3;
const { lufsLow: LUFS_LOW, lufsHigh: LUFS_HIGH } = RULES;
const CHROME_CAP_PCT = RULES.chromeCapFrac * 100;
const UI_CAP_PCT = RULES.uiCapFrac * 100;

export const DEFAULT_ROWS = [
  ['frozen runs of 3+ frames inside a shot', '0'],
  ['jerky steps', 'under 5'],
  ['jumps not at a declared cut', '0'],
  ['still windows over 0.5 s outside a declared hold', '0'],
  ['near-identical tail tiles', '4 or fewer'],
  ['text cap height', '6% or more'],
  ['text contrast', `${DRAFT_MIN_RATIO}:1 or more`],
  ['text collisions', '0'],
  ['read hold per line', 'max(1.2 s, words/3 s) or more'],
  ['exits shorter than entrances', 'all'],
  ['word cap height and position vs spec', `within ${LAYOUT_TOL_PCT}% of frame`],
  ['cuts vs spec', 'within 1 frame'],
  ['loudness', `${LUFS_LOW} to ${LUFS_HIGH} LUFS`],
  ['peak', `${PEAK_DBFS} dBFS or lower`],
  ['judge: each storyboard frame as beautiful as the anchor, full size', 'YES'],
].map(([metric, target]) => ({ metric, target }));

// Times are written from the page into the brief (spec-sync), so a row that compares them to the brief would compare a time to itself.
const RETIRED_ROWS = new Set(['word appear time vs spec', 'objects in/settle/out vs spec']);

const num = '(-?\\d+(?:\\.\\d+)?)';
const unit = '(?::1|%| s| dBFS| LUFS)?';

/** A target's test as a function of the measured number, or null when the text holds no number rule. */
export function targetTest(text) {
  const t = String(text).replace(/\(.*?\)/g, '').trim();
  let m;
  if ((m = new RegExp(`${num}\\s*to\\s*${num}`).exec(t))) return (v) => v >= Number(m[1]) && v <= Number(m[2]);
  if ((m = new RegExp(`under\\s+${num}`).exec(t))) return (v) => v < Number(m[1]);
  if ((m = new RegExp(`${num}${unit}\\s+or\\s+(?:fewer|lower|less)`).exec(t))) return (v) => v <= Number(m[1]);
  if ((m = new RegExp(`${num}${unit}\\s+or\\s+(?:more|higher|greater)`).exec(t))) return (v) => v >= Number(m[1]);
  if ((m = new RegExp(`within\\s+${num}`).exec(t))) return (v) => v <= Number(m[1]) + 1e-9;
  if ((m = /^(\d+)$/.exec(t))) return (v) => v <= Number(m[1]);
  return null;
}

const skip = (reason, label = 'not measured', atShip = false) => ({ skip: reason, label, atShip });
const DRAFT_SKIP = 'not measured in a draft (ship measures it)';
const done = (ok, measured, detail = []) => ({ ok, measured, detail });

function countRow(list, pass, describe, fix) {
  if (!list) return skip('the draft video was not read');
  const detail = list.slice(0, SHOW).map(describe);
  return done(pass(list.length), String(list.length), detail.length ? [...detail, fix] : []);
}

function deviationRow(checks, pass, none, fmt, fix, guessed = 0) {
  if (!checks || !checks.length) return guessed ? skip('the rows are still template guesses: replace them with your numbers', 'not set') : skip(none);
  const worst = Math.max(...checks.map((c) => c.dev));
  const off = checks.filter((c) => !pass(c.dev));
  return done(!off.length, worst === Infinity ? 'not found' : fmt(worst), off.length ? [...off.slice(0, SHOW).map(checkLine), fix] : []);
}

// Each row reads its measure from `m`, a plain object the run fills; a key left out is "not measured".
const ROWS = {
  'frozen runs of 3+ frames inside a shot': (m, pass) => countRow(m.smooth?.frozen, pass, (f) => `${f.t.toFixed(2)} s: ${f.frames} frames still between moves`, 'keep the motion going through those frames, or finish the move before the stop'),
  'jerky steps': (m, pass) => countRow(m.smooth?.jerky, pass, (j) => `${j.t.toFixed(2)} s: speed changes ${j.ratio.toFixed(1)}x in one frame`, 'ease the start and the stop of the move instead of a sudden speed change'),
  'jumps not at a declared cut': (m, pass) => countRow(m.smooth?.jumps, pass, (j) => `${j.t.toFixed(2)} s: the picture jumps (${j.mag.toFixed(0)} of 255) with no cut declared`, 'move the cut to a Shots boundary, or soften the jump'),
  'still windows over 0.5 s outside a declared hold': (m, pass) => countRow(m.stills, pass, (r) => `${r.a}-${r.b} s ${r.camera ? 'only the camera moves' : 'held still'}`, 'give the hold an element motion (a camera drift does not count), or declare the hold with static-window@a-b and a _why'),
  'near-identical tail tiles': (m, pass) => (m.tail == null ? skip('the draft video was not read') : done(pass(m.tail), String(m.tail), m.tail ? ['the last tiles of the judge sheet barely change: add a move near the end'] : [])),
  'text cap height': (m, pass) => {
    if (!m.caps) return skip('no text probe');
    if (!m.caps.length) return done(true, 'no held text');
    const uiFloor = m.decls?.uiScale ?? UI_CAP_PCT;
    const floorOf = (c) => (c.chrome ? CHROME_CAP_PCT : c.ui ? uiFloor : null);
    const ok = (c) => (floorOf(c) == null ? pass(c.cap) : c.cap >= floorOf(c));
    const short = m.caps.filter((c) => !ok(c));
    const lowest = (list) => list.reduce((a, c) => (c.cap < a.cap ? c : a));
    const group = (test) => m.caps.filter(test);
    const plain = group((c) => !c.chrome && !c.ui), ui = group((c) => c.ui && !c.chrome), chrome = group((c) => c.chrome);
    const measured = [...(plain.length ? [`${lowest(plain).cap.toFixed(1)}%`] : []), ...(ui.length ? [`data-ui ${lowest(ui).cap.toFixed(1)}% (floor ${uiFloor}%)`] : []), ...(chrome.length ? [`data-chrome ${lowest(chrome).cap.toFixed(1)}% (floor ${CHROME_CAP_PCT}%)`] : [])].join(', ');
    const note = (c) => (c.chrome ? ` (data-chrome floor ${CHROME_CAP_PCT}%)` : c.ui ? ` (data-ui floor ${uiFloor}%)` : '');
    return done(!short.length, measured, short.slice(0, SHOW).map((c) => `"${c.text}" at ${c.t.toFixed(1)} s: ${c.cap.toFixed(1)}%${note(c)}`).concat(short.length ? 'raise the font size until the cap height reaches the target' : []));
  },
  'text contrast': (m, pass) => {
    if (!m.contrast) return skip('no pixels sampled behind the text');
    const low = m.contrast.reduce((a, c) => Math.min(a, c.ratio), Infinity);
    return done(m.contrast.every((c) => pass(c.ratio)), m.contrast.length ? `${low.toFixed(1)}:1` : 'all pass', m.contrast.slice(0, SHOW).map((c) => `"${c.text}" at ${c.t.toFixed(2)} s: ${c.ratio.toFixed(1)}:1`));
  },
  'text collisions': (m, pass) => countRow(m.collisions, pass, (c) => `"${c.a}" and "${c.b}" overlap at ${c.t.toFixed(2)} s`, 'move one, or time one out before the other comes in'),
  'read hold per line': (m) => {
    if (!m.readHold) return skip('no text probe');
    const unmeasured = m.readHoldUnmeasured?.length ? ` (${m.readHoldUnmeasured.length} not measured: settle time after the line left)` : '';
    return done(!m.readHold.length, `${m.readHold.length ? `${m.readHold.length} line(s) short` : 'all long enough'}${unmeasured}`, m.readHold.slice(0, SHOW).map((p) => `"${p.text.slice(0, 40)}" holds ${p.hold.toFixed(2)} s, needs ${p.need.toFixed(2)} s`));
  },
  'exits shorter than entrances': (m) => (m.exits ? done(!m.exits.length, m.exits.length ? `${m.exits.length} too long` : 'all', m.exits.slice(0, SHOW).map((e) => `${e.at.toFixed(2)} s: ${e.what}`)) : skip('no motion probe')),
  'word cap height and position vs spec': (m, pass) => {
    const left = m.layoutSkipped ? [...m.layoutSkipped.unseen.map((t) => `"${t}" never on screen`), ...m.layoutSkipped.moving.map((t) => `"${t}" never at rest in the frame`)] : [];
    const out = deviationRow(m.layout, pass, left.length ? `no Words text measurable: ${left.slice(0, SHOW).join(', ')}` : 'no spec', (d) => `${d.toFixed(1)}%`, 'set the font size and box to the Words table, or change the table', m.guessed?.words);
    return out.skip || !left.length ? out : { ...out, measured: `${out.measured} (not measured: ${left.slice(0, SHOW).join(', ')}${left.length > SHOW ? `, ${left.length - SHOW} more` : ''})` };
  },
  'cuts vs spec': (m, pass) => deviationRow(m.cuts, pass, m.hasShots ? 'no hard cut near a shot start' : 'no spec', (d) => `${d.toFixed(1)} frames`, 'land the cut on the Shots boundary, or change the table'),
  loudness: (m, pass) => (m.lufs == null ? skip('no audio in the video') : done(pass(m.lufs), `${m.lufs.toFixed(1)} LUFS`, pass(m.lufs) ? [] : [loudnessFix({ I: m.lufs, TP: m.peak ?? -Infinity, cues: m.cues })])),
  peak: (m, pass) => (m.peak == null ? skip('no audio in the video') : done(pass(m.peak), `${m.peak.toFixed(1)} dBFS`, pass(m.peak) ? [] : [`lower data-gain on ${loudestCue(m.cues)} by ${Math.ceil(m.peak - PEAK_DBFS)} dB`])),
  'judge: each storyboard frame as beautiful as the anchor, full size': (m) => (m.judge ? done(m.judge.yes === m.judge.total, `${m.judge.yes} of ${m.judge.total} YES`, m.judge.fixes.slice(0, SHOW)) : skip('not run')),
};

/**
 * A row whose target is still the house default follows the film's DESIGN.md declaration (harness/lib/design-decls.mjs); the target then
 * names the line it followed. A target the brief changed is the owner's own and stays.
 */
export function followDecls(row, decls) {
  const house = DEFAULT_ROWS.find((r) => r.metric === row.metric);
  if (!decls || !house || row.target !== house.target) return row;
  if (row.metric === 'text cap height' && decls.typeScale != null) return { ...row, target: `${decls.typeScale}% or more (followed DESIGN.md type-scale: ${decls.typeScale}%${decls.uiScale != null ? `; data-ui ${decls.uiScale}%` : ''})` };
  if (row.metric === 'text cap height' && decls.uiScale != null) return { ...row, target: `${house.target} (data-ui ${decls.uiScale}%, followed DESIGN.md ui-scale)` };
  return row;
}

const JUDGE_ROW = 'judge: each storyboard frame as beautiful as the anchor, full size';
const DEFAULT_TEST = new Map(DEFAULT_ROWS.map((r) => [r.metric, targetTest(r.target)]));

const read = (row, m, carried, mode, stage) => {
  const unrun = unrunReason(row.metric, mode);
  if (unrun) return stage === 'draft' ? skip(`${DRAFT_SKIP}: ${unrun}`, 'not measured', true) : skip(unrun);
  const measure = ROWS[row.metric];
  if (!measure) return skip('no measure for this metric');
  const pass = targetTest(row.target) ?? DEFAULT_TEST.get(row.metric) ?? (() => true);
  const out = measure(m, pass);
  if (out.skip && stage === 'draft' && row.metric === JUDGE_ROW) return skip(DRAFT_SKIP, 'not measured', true);
  if (out.skip && carried?.status && carried.status !== 'not measured') return { ok: carried.status === 'ok', measured: `${carried.measured} (draft)`, detail: carried.detail ?? [] };
  return out;
};

/**
 * The table rows: { metric, target, status: 'ok' | 'advice' | 'not measured', measured, detail }. `brief` is the
 * parsed Acceptance rows (empty: the defaults), `m` the measures, `carry` the rows of an earlier run, used where this
 * run could not measure a row. Pure.
 */
export function buildRows(brief, m, { carry = [], mode = 'full', stage = 'final' } = {}) {
  const rows = (brief.length ? brief.filter((r) => !RETIRED_ROWS.has(r.metric)) : DEFAULT_ROWS).map((r) => followDecls(r, m.decls));
  return rows.map((row) => {
    const out = read(row, m, carry.find((c) => c.metric === row.metric), mode, stage);
    if (out.skip) return { metric: row.metric, target: row.target, status: 'not measured', measured: out.atShip ? out.skip : `${out.label}: ${out.skip}`, detail: [], ...(out.atShip ? { atShip: true } : {}) };
    return { metric: row.metric, target: row.target, status: out.ok ? 'ok' : 'advice', measured: out.measured, detail: out.detail ?? [] };
  });
}

const greens = (rows) => rows.filter((r) => r.status === 'ok').length;

/** { green, measured, red }: the green rows, the rows measured (not "not measured"), and the names of the red ones. Pure. */
export const acceptanceCounts = (rows) => ({
  green: greens(rows),
  measured: rows.filter((r) => r.status !== 'not measured').length,
  red: rows.filter((r) => r.status === 'advice').map((r) => r.metric),
});

/** The history entry for one run, and the file with it appended (the last HISTORY_KEEP kept). Pure. */
export function withHistory(file, rows, { stage, caps = null, spec = null, worlds = null, tailMoving = null, cameraOnly = null, typing = null, canvasFilm = false, at }) {
  const entry = { at, stage, green: greens(rows), total: rows.length, unmeasured: rows.filter((r) => r.status === 'not measured').length, rows, ...(caps ? { caps } : {}), ...(spec ? { spec } : {}), ...(worlds ? { worlds } : {}), ...(tailMoving !== null ? { tailMoving } : {}), ...(cameraOnly ? { cameraOnly } : {}), ...(typing?.length ? { typing } : {}), ...(canvasFilm ? { canvasFilm } : {}) };
  const past = file?.history ?? [];
  return { file: { history: [...past, entry].slice(-HISTORY_KEEP) }, entry, was: past.length ? past[past.length - 1].green : null };
}

/** Only the rows that are not green in full, then the one-line trend. */
export function tableLines(rows, was = null) {
  const lines = rows.filter((r) => r.status !== 'ok').flatMap((r) => [`  ${r.metric} | ${r.target} | ${r.measured}`, ...r.detail.map((d) => `      ${d}`)]);
  const unmeasured = rows.filter((r) => r.status === 'not measured').length;
  lines.push(`acceptance: ${greens(rows)} of ${rows.length} green${unmeasured ? `, ${unmeasured} not measured` : ''}${was === null ? '' : ` (was ${was})`}`);
  return lines;
}

/** One printed line for a red row: the measure, its worst example and the fix. Pure. */
export const redLine = (r) => `  ${r.metric}: ${r.measured}${r.detail[0] ? ` (${r.detail[0]})` : ''}${r.detail.length > 1 ? `; ${r.detail.at(-1)}` : ''}`;

/** The one summary line of a draft: green of measured, the rows only ship measures, the rows in all (the ship's denominator), the trend and the extras. */
export function summaryLine(rows, was, extras = []) {
  const { green, measured } = acceptanceCounts(rows);
  const atShip = rows.filter((r) => r.atShip).length;
  return ['acceptance: ' + `${green} of ${measured} measured green${atShip ? `, ${atShip} more at ship` : ''} (${rows.length} rows)${was === null ? '' : ` (was ${was})`}`, ...extras].join(' · ');
}

/** Every row, green or not, as markdown table lines with each row's detail under it. Pure. */
export const fullTable = (rows) => ['| status | metric | target | measured |', '| --- | --- | --- | --- |',
  ...rows.map((r) => `| ${r.status} | ${r.metric} | ${r.target} | ${r.measured} |`),
  ...rows.filter((r) => r.detail.length).flatMap((r) => ['', `${r.metric}:`, ...r.detail.map((d) => `- ${d}`)])];

/** True when every measured row is green. A row that could not be measured does not count against it. Pure. */
export const allMeasuredGreen = (rows) => rows.every((r) => r.status !== 'advice');
