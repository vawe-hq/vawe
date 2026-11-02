// Reads out/<film>.runs.jsonl records, new and old, into tables. Pure: no I/O, no clock (`now` is passed in).
// Old records (before harness/lib/run-events.mjs) hold `render` for a draft or final and `judge` for a verdict.
import { namedAgent } from './runlog.mjs';
import { causeOf } from './verb-log.mjs';
import { verbNow } from '../cli/aliases.mjs';

const DAY_MS = 86_400_000;
const WINDOW_DAYS = 30;
const MAX_LINES = 40;

const agentName = (agent) => { const name = namedAgent(agent); return name && !/^\d+$/.test(name) ? name : null; };

const median = (xs) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
const num = (x, digits = 1) => (x == null ? '-' : String(Number(x.toFixed(digits))));
const sum = (scores) => {
  const v = Object.values(scores ?? {}).filter(Number.isFinite);
  return v.length > 1 ? v.reduce((a, b) => a + b, 0) : null;
};

const PHASES = [['start', 'startS'], ['slot', 'slotS'], ['chrome', 'chromeS'], ['load', 'loadS'], ['prepass', 'prepassS'], ['capture', 'captureS'], ['verify', 'verifyS'], ['encode', 'encodeS'], ['audio', 'audioS'], ['checks', 'checksTotalS'], ['sheet', 'sheetS'], ['other', 'otherS']];

/** The phase seconds of a draft record by name (start, slot, ... other), or null for a record from before the split. */
const phasesOf = (e) => (e.cmd === 'dev' && e.otherS != null ? Object.fromEntries(PHASES.map(([name, key]) => [name, e[key] ?? 0])) : null);

/** An old record in the new event shape: `render` was a draft or a final, `judge` a verdict. */
function fromOld(r) {
  if (r.render) return { cmd: /-draft/.test(r.render.file ?? '') ? 'dev' : 'ship', seconds: r.render.ms != null ? r.render.ms / 1000 : null };
  if (!r.judge) return {};
  const struct = r.cmd === 'judge-struct';
  return { cmd: 'judge', stage: struct ? 'struct' : 'manual', verdict: r.judge.verdict ?? null, scores: r.judge.overall != null ? { overall: r.judge.overall } : null };
}

/** One record of either age as { at, cmd, agent, model, seconds, green, measured, stage, verdict, scores, total, fired, signature, notes, waivers, sameness, template }. */
export function normalize(r) {
  const e = { ...r, ...fromOld(r) };
  return {
    at: e.at, cmd: e.cmd, agent: agentName(e.agent), model: e.model ?? null,
    seconds: e.cmd === 'verb' ? e.durationS ?? null : e.wallS ?? e.renderS ?? e.seconds ?? null,
    green: e.acceptance?.green ?? null, measured: e.acceptance?.measured ?? null,
    stage: e.stage ?? null, verdict: e.verdict ?? null, scores: e.scores ?? null, total: e.total ?? sum(e.scores),
    fired: Array.isArray(e.rules_fired) ? e.rules_fired.map((f) => f.id) : null,
    signature: e.signature && typeof e.signature === 'object' && !e.signature.offered ? e.signature : null,
    notes: Array.isArray(e.notes) ? e.notes : null, waivers: Array.isArray(e.waivers) ? e.waivers : null,
    sameness: e.sameness ?? null, template: e.template ?? null, bar: Array.isArray(e.bar) ? e.bar : null,
    note: e.cmd === 'approve' ? e.note ?? null : null,
    verb: e.verb ?? null, loopStage: e.cmd === 'verb' ? e.stage ?? null : null, exitCode: e.exitCode ?? null, error: e.error ?? e.reason ?? null,
    phases: phasesOf(e), shape: phasesOf(e) ? { chrome: e.chrome, frames: e.frames, reused: e.reusedFrames } : null,
    slotWaitS: e.slotWaitS ?? null, red: e.acceptance?.red ?? null, tagged: e.cmd === 'verb' ? e.tagged !== false : agentName(e.agent) !== null,
  };
}

const isDraft = (e) => e.cmd === 'dev' && e.seconds != null;
const isRound = (e) => e.cmd === 'judge' && e.stage !== 'stills' && (e.verdict === 'PASS' || e.verdict === 'FIX');

/** { drafts, medianDraftS, rounds, passed, firstTotal, bestTotal } of one film's normalized events, oldest first. */
export function filmStats(events) {
  const drafts = events.filter(isDraft);
  const rounds = events.filter(isRound);
  const passAt = rounds.findIndex((e) => e.verdict === 'PASS');
  const totals = events.filter((e) => e.cmd === 'judge' && e.stage !== 'stills' && e.total != null).map((e) => e.total);
  return {
    drafts: drafts.length, medianDraftS: median(drafts.map((e) => e.seconds)),
    roundsToPass: passAt < 0 ? null : passAt + 1, passed: passAt >= 0,
    firstTotal: totals[0] ?? null, bestTotal: totals.length ? Math.max(...totals) : null,
  };
}

const pad = (rows, widths) => rows.map((r) => r.map((c, i) => (i === widths.length ? c : String(c).padEnd(widths[i]))).join('  ').trimEnd());
export const table = (rows) => pad(rows, rows[0].slice(0, -1).map((_, i) => Math.max(...rows.map((r) => String(r[i]).length))));

const clock = (at) => String(at).slice(5, 16).replace('T', ' ');
const TOP = 8;
const MAX_DRAFTS = 12;

const tally = (events, keyOf) => {
  const rows = new Map();
  for (const e of events) {
    const key = keyOf(e) ?? '-';
    const row = rows.get(key) ?? { key, calls: 0, secs: 0, wait: 0, failed: 0 };
    rows.set(key, { key, calls: row.calls + 1, secs: row.secs + (e.seconds ?? 0), wait: row.wait + (e.slotWaitS ?? 0), failed: row.failed + (e.exitCode ? 1 : 0) });
  }
  return [...rows.values()].sort((a, b) => b.secs - a.secs);
};

const timeTable = (head, rows) => table([[head, 'calls', 'secs', 'slot wait', 'failed'], ...rows.slice(0, TOP).map((r) => [r.key, r.calls, num(r.secs, 0), num(r.wait, 0), r.failed])]).map((l) => `  ${l}`);

/** The three questions about one film: where the time went, what failed, whether the drafts improved. */
function timeLines(calls) {
  const tagged = calls.filter((e) => e.tagged);
  const used = tagged.length ? tagged : calls;
  const rest = calls.length - used.length;
  const minutes = used.reduce((a, e) => a + (e.seconds ?? 0), 0) / 60;
  const wait = used.reduce((a, e) => a + (e.slotWaitS ?? 0), 0);
  return [
    `where time went: ${used.length} verb calls, ${num(minutes, 0)} min of verb time${tagged.length ? '' : ', none tagged with VAWE_AGENT'}${rest ? `; ${rest} untagged calls left out` : ''}`,
    ...timeTable('stage', tally(used, (e) => e.loopStage)),
    ...timeTable('verb', tally(used, (e) => verbNow(e.verb))),
    `  slot wait: ${num(wait, 0)} s over ${used.filter((e) => e.slotWaitS > 0).length} calls`,
  ];
}

function failedLines(events) {
  const failures = events.filter((e) => (e.cmd === 'verb' && e.exitCode) || (e.cmd === 'ship' && e.verdict === 'failed'));
  if (!failures.length) return ['what failed: nothing'];
  const causes = new Map();
  for (const e of failures) causes.set(causeOf(e.error), [...(causes.get(causeOf(e.error)) ?? []), e]);
  const groups = [...causes].sort((a, b) => b[1].length - a[1].length).slice(0, 5);
  const last = failures.at(-1);
  return [`what failed: ${failures.length} of ${events.filter((e) => e.cmd === 'verb').length} verb calls`,
    ...groups.map(([cause, list]) => `  ${list.length} x ${cause} (${[...new Set(list.map((e) => e.verb ?? e.cmd))].join(', ')})`),
    `  last: ${clock(last.at)} ${last.verb ?? last.cmd} ${String(last.error ?? '').slice(0, 100)}`];
}

/** One row per draft: acceptance green, the rules it fired, and the red rows, so a flat series shows at a glance. */
export function draftSeries(events) {
  const drafts = events.filter((e) => e.cmd === 'dev' && e.seconds != null);
  const shown = drafts.slice(-MAX_DRAFTS);
  const hidden = drafts.length - shown.length;
  const rows = shown.map((e, i) => [hidden + i + 1, clock(e.at), e.green != null ? `${e.green}/${e.measured}` : '-', e.fired ? e.fired.length : '-', `${(e.red ?? []).slice(0, 3).join(', ') || '-'}${e.tagged ? '' : ' (untagged)'}`]);
  if (!rows.length) return [];
  const judged = events.filter((e) => e.cmd === 'judge' && e.total != null).map((e) => `${e.stage ?? '?'} ${e.total}`);
  return ['quality per draft:', ...table([['#', 'time', 'accept', 'rules', 'red rows'], ...rows]).map((l) => `  ${l}`), ...(hidden ? [`  (${hidden} earlier drafts not shown)`] : []), ...(judged.length ? [`  judge totals in order: ${judged.join(', ')}`] : [])];
}

const isCriticRound = (e) => e.cmd === 'verb' && e.verb === 'critique' && e.fresh === true && e.verdict;

/** One line per judge round (stage, verdict, total) and per owner approve or reject with its note, in time order. */
export function outcomeLines(events) {
  return events.filter((e) => isRound(e) || e.cmd === 'approve' || isCriticRound(e)).map((e) => (isCriticRound(e) ? `critique ${clock(e.at)} fresh ${e.verdict}` : e.cmd === 'approve'
    ? `owner ${e.verdict} ${clock(e.at)}${e.note ? `: ${e.note}` : ''}`
    : `judge ${clock(e.at)} ${e.stage ?? '?'} ${e.verdict} total ${num(e.total, 0)}`));
}

/** One compact line per draft that logged its rules: the rules it fired, and against the draft before it which were fixed (fired then, not now) and which are still firing. */
export function draftRuleLines(events) {
  const drafts = events.filter((e) => e.cmd === 'dev' && e.fired);
  return drafts.map((e, i) => {
    const before = i ? drafts[i - 1].fired : null;
    const parts = [`fired ${e.fired.join(', ') || 'none'}`];
    if (before?.length) {
      const [fixed, still] = [before.filter((id) => !e.fired.includes(id)), before.filter((id) => e.fired.includes(id))];
      parts.push(`fixed ${fixed.join(', ') || 'none'}`, `still ${still.join(', ') || 'none'}`);
    }
    return `draft ${i + 1} ${String(e.at).slice(5, 16).replace('T', ' ')}: ${parts.join(' · ')}`;
  });
}

/** One compact line per draft that logged its phases: where the wall time went, the zero phases left out. */
export function draftPhaseLines(events) {
  return events.filter((e) => e.phases).map((e) => {
    const parts = PHASES.map(([name]) => [name, e.phases[name]]).filter(([, s]) => s >= 0.05).map(([name, s]) => `${name} ${num(s)}`);
    const frames = `${e.shape.frames} frames${e.shape.reused ? `, ${e.shape.reused} reused` : ''}`;
    return `time ${clock(e.at)}: ${num(e.seconds)} s = ${parts.join(' · ')} (chrome ${e.shape.chrome}, ${frames})`;
  });
}

/** The median seconds of each phase over the drafts that logged them: { wall, drafts, phases: { start: s, ... } }, or null when none did. */
export function phaseMedians(events) {
  const drafts = events.filter((e) => e.phases && e.seconds != null);
  if (!drafts.length) return null;
  return { drafts: drafts.length, wall: median(drafts.map((e) => e.seconds)), phases: Object.fromEntries(PHASES.map(([name]) => [name, median(drafts.map((e) => e.phases[name]))])) };
}

/** The lines of `vawe-dev runs <film>`: time by stage and verb, failures by cause, the draft series, then one summary line. */
export function filmLines(film, records) {
  const events = records.map(normalize).sort((a, b) => String(a.at).localeCompare(String(b.at)));
  if (!events.length) return [`${film}: no runs logged`];
  const calls = events.filter((e) => e.cmd === 'verb');
  const s = filmStats(events);
  const pass = s.passed ? `PASS after ${s.roundsToPass} judge round${s.roundsToPass > 1 ? 's' : ''}` : 'no PASS yet';
  return [
    ...(calls.length ? timeLines(calls) : [`${film}: no verb calls logged (a log from before every verb was logged)`]),
    ...failedLines(events), ...draftSeries(events), ...draftRuleLines(events), ...draftPhaseLines(events), ...outcomeLines(events),
    `drafts ${s.drafts} · median draft ${num(s.medianDraftS)} s · ${pass} · first judged total ${num(s.firstTotal, 0)}`,
  ];
}

/** phaseMedians over every film's events of the last 30 days. */
export function allPhaseMedians(films, now) {
  const since = now - WINDOW_DAYS * DAY_MS;
  return phaseMedians(films.filter(({ film }) => !film.startsWith('_')).flatMap(({ runs }) => runs.map(normalize)).filter((e) => Date.parse(e.at) >= since));
}

/** One row per film with an event in the last 30 days: stats plus who ran it (model, else agent name), newest first. */
export function allRows(films, now) {
  const since = now - WINDOW_DAYS * DAY_MS;
  return films.filter(({ film }) => !film.startsWith('_')).map(({ film, runs }) => {
    const events = runs.map(normalize).filter((e) => Date.parse(e.at) >= since).sort((a, b) => String(a.at).localeCompare(String(b.at)));
    const who = events.findLast((e) => e.model) ?? events.findLast((e) => e.agent);
    return events.length ? { film, last: events.at(-1).at, ...filmStats(events), model: who?.model ?? null, agent: who?.model ? null : who?.agent ?? null } : null;
  }).filter(Boolean).sort((a, b) => b.last.localeCompare(a.last));
}

/** Pooled medians for the films that name a model: [{ model, films, medianDrafts, medianDraftS, medianFirstTotal, passed }]. */
export function modelRows(rows) {
  const models = [...new Set(rows.map((r) => r.model).filter(Boolean))].sort();
  return models.map((model) => {
    const mine = rows.filter((r) => r.model === model);
    return {
      model, films: mine.length, medianDrafts: median(mine.map((r) => r.drafts)),
      medianDraftS: median(mine.filter((r) => r.medianDraftS != null).map((r) => r.medianDraftS)),
      medianFirstTotal: median(mine.filter((r) => r.firstTotal != null).map((r) => r.firstTotal)),
      passed: mine.filter((r) => r.passed).length,
    };
  });
}

/** The lines of `vawe-dev runs --all`: at most 40, plain text; `phases` is phaseMedians over the drafts of the last 30 days. */
export function allLines(rows, models, phases = null) {
  if (!rows.length) return ['no films with runs in the last 30 days'];
  const modelBlock = models.length ? ['', ...table([['model', 'films', 'med drafts', 'med draft s', 'med first total', 'passed'],
    ...models.map((m) => [m.model, m.films, num(m.medianDrafts), num(m.medianDraftS), num(m.medianFirstTotal, 0), `${m.passed}/${m.films}`])])] : [];
  const phaseBlock = phases ? ['', `median of ${phases.drafts} drafts, ${num(phases.wall)} s wall: ${PHASES.map(([name]) => `${name} ${num(phases.phases[name])}`).join(' · ')}`] : [];
  const room = MAX_LINES - 1 - modelBlock.length - phaseBlock.length - 1;
  const shown = rows.length > room ? rows.slice(0, room - 1) : rows;
  const body = table([['film', 'drafts', 'med draft s', 'first total', 'best total', 'PASS', 'agent/model'],
    ...shown.map((r) => [r.film, r.drafts, num(r.medianDraftS), num(r.firstTotal, 0), num(r.bestTotal, 0), r.passed ? 'yes' : 'no', r.model ?? r.agent ?? '-'])]);
  const more = rows.length > shown.length ? [`... ${rows.length - shown.length} more films (use --json)`] : [];
  return [...body, ...more, ...modelBlock, ...phaseBlock];
}
