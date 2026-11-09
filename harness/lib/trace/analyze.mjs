import { brief } from './redact.mjs';
import { hintOutcomes, nextLineOutcomes, verbEvents } from './verbs.mjs';
import { adviceOutcomes } from './advice.mjs';
import { roundsOf } from './rounds.mjs';
import { stallsOf } from './stalls.mjs';
import { stageFirstUse, stageOrder } from './stages.mjs';
import { ownerNotes } from './notes.mjs';
import { navigationOf } from './navigation.mjs';

export const BIG_RESULT = 8000;
const WAIT_TOOLS = new Set(['Monitor', 'TaskOutput']);
const sec = (ms) => Math.round(ms / 1000);
const callSecs = (c) => (c.resultMs && c.ms ? Math.max(0, (c.resultMs - c.ms) / 1000) : 0);
const count = (items, key) => items.reduce((o, i) => ({ ...o, [key(i)]: (o[key(i)] ?? 0) + 1 }), {});

function tokensOf(usage) {
  const t = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  for (const u of usage.values()) {
    t.input += u.input_tokens ?? 0;
    t.output += u.output_tokens ?? 0;
    t.cacheRead += u.cache_read_input_tokens ?? 0;
    t.cacheWrite += u.cache_creation_input_tokens ?? 0;
  }
  return t;
}

function filmsOf(calls) {
  const films = new Set();
  for (const c of calls) {
    c.writes.forEach((w) => films.add(w.film));
    if (c.newFilm) films.add(c.newFilm);
    for (const v of c.verbs) for (const m of v.args.matchAll(/films\/([a-z0-9][\w-]*)\//g)) films.add(m[1]);
  }
  return [...films].filter((f) => f !== 'examples');
}

function docReads(calls, startMs, firstPage, firstDev) {
  const docs = [];
  for (const c of calls) {
    for (const key of c.docs) docs.push({ doc: key, sec: sec(c.ms - startMs), beforePage: firstPage === null || c.ms < firstPage, beforeDev: firstDev === null || c.ms < firstDev });
  }
  return docs;
}

function failureList(calls) {
  const list = [];
  const add = (cls, call, why) => list.push({ cls, call: brief(`${call.name} ${call.cmd}`, 100), why: brief(why, 140) });
  for (const c of calls) {
    const f = c.flags;
    if (!f) continue;
    const bad = c.footers.filter((x) => !x.ok);
    if (c.blockedByHook || (f.exitFail && f.hook)) add('hook', c, c.blockedByHook || c.lastLine);
    else if (bad.length) bad.forEach((x) => add('vawe', c, `${x.verb}: ${x.reason}`));
    else if (c.name === 'Bash' && f.glob) add('glob', c, c.lastLine);
    else if (c.name === 'Bash' && f.notFound) add('not-found', c, c.lastLine);
    else if (c.name === 'Bash' && f.testFail) add('test', c, c.lastLine);
    else if (f.exitFail) add('other', c, c.lastLine);
  }
  return list;
}

function repeatsOf(calls) {
  const seen = new Map();
  for (const c of calls) seen.set(`${c.name} ${c.cmd}`, (seen.get(`${c.name} ${c.cmd}`) ?? 0) + 1);
  return [...seen].filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1]).map(([k, n]) => ({ call: k.slice(0, 120), times: n }));
}

const isWaitVerb = (v) => v.verb === 'wait' || (v.verb === 'ship' && /--(status|wait)\b/.test(v.args));
const eventSecs = (e) => e.secs ?? e.callSecs;

function waitSecs(calls, events) {
  const waits = calls.filter((c) => !c.verbs.some(isWaitVerb)
    && (WAIT_TOOLS.has(c.name) || c.raw.some((r) => /^(sleep|psPoll|hint:wait)$/.test(r))));
  const verbSecs = events.filter((e) => !e.help && isWaitVerb(e)).reduce((t, e) => t + eventSecs(e), 0);
  return Math.round(waits.reduce((t, c) => t + callSecs(c), verbSecs));
}

function costOf(calls, events) {
  const repeats = repeatsOf(calls);
  const renders = events.filter((e) => !e.help && ['dev', 'ship'].includes(e.verb) && !/--(status|wait|animatic|studio)\b/.test(e.args));
  const hasLog = events.some((e) => e.fromRunLog);
  const big = calls.filter((c) => c.chars > BIG_RESULT).sort((a, b) => b.chars - a.chars);
  return {
    calls: calls.length,
    byTool: count(calls, (c) => c.name),
    repeats: repeats.reduce((t, r) => t + r.times - 1, 0),
    topRepeats: repeats.slice(0, 5),
    bigResults: big.length,
    bigChars: big.reduce((t, c) => t + c.chars, 0),
    topBig: big.slice(0, 3).map((c) => ({ chars: c.chars, call: `${c.name} ${c.cmd}`.slice(0, 100) })),
    waitSecs: waitSecs(calls, events),
    renderSecs: Math.round(renders.filter((e) => e.fromRunLog || !hasLog).reduce((t, e) => t + eventSecs(e), 0)),
    unloggedRenderSecs: hasLog ? Math.round(renders.filter((e) => !e.fromRunLog).reduce((t, e) => t + eventSecs(e), 0)) : 0,
    slotWaitSecs: Math.round(events.reduce((t, e) => t + (e.slotWaitS ?? 0), 0)),
  };
}

function rawUse(calls) {
  const raw = {};
  for (const c of calls) for (const id of new Set(c.raw)) raw[id] = (raw[id] ?? 0) + 1;
  return raw;
}

function ruleBreaks(events, wrotePage, unattended) {
  const first = (pred) => events.findIndex(pred);
  const finals = events.filter((e) => e.verb === 'ship' && !e.help && !/--(status|wait)\b/.test(e.args));
  const attempt = first((e) => finals.includes(e));
  const approved = events.some((e) => e.verb === 'approve' && e.ok !== false);
  const critique = first((e) => e.verb === 'critique');
  const review = first((e) => e.verb === 'critique' || e.verb === 'judge');
  const draft = first((e) => e.verb === 'dev' && e.ok !== false && !e.help && !/--(from|to)\b/.test(e.args));
  const started = finals.some((e) => e.ok !== false && !e.refused);
  return {
    reviewBySameAgent: wrotePage && review >= 0,
    shipAttempted: attempt >= 0,
    shipRefusedNoApproval: finals.some((e) => e.refused),
    shipStarted: started,
    shipWithoutCritique: attempt >= 0 && (critique < 0 || critique > attempt),
    shipWithoutApprovalInTrace: started && !approved && !unattended,
    shipBeforeFullDraft: attempt >= 0 && (draft < 0 || draft > attempt),
  };
}

function routingOf(calls, events, hints) {
  const next = nextLineOutcomes(calls, events);
  const hinted = hintOutcomes(hints, events);
  return { next, nextCounts: count(next, (n) => n.outcome), hints: hinted, hintCounts: count(hinted, (h) => h.outcome) };
}

function banSeen(calls) {
  const seen = {};
  for (const c of calls) for (const b of c.flags?.ban ?? []) if (c.verbs.length) (seen[b] ??= new Set()).add(c.verbs.at(-1).verb);
  return Object.fromEntries(Object.entries(seen).map(([k, v]) => [k, [...v]]));
}

/** One agent's record: identity, verb sequence, stages, routing, raw tools, docs, navigation, failures, cost, rule breaks. Pure over a fold. */
export function analyze(fold, file, readRuns = () => []) {
  const { calls, meta } = fold;
  const startMs = meta.startMs ?? 0;
  const runLog = filmsOf(calls).flatMap((film) => readRuns(film, meta));
  const judges = runLog.filter((r) => r.cmd === 'judge');
  const events = verbEvents(calls, startMs, runLog.filter((r) => r.cmd !== 'judge'));
  const writes = calls.flatMap((c) => c.writes.map((w) => ({ ...w, ms: c.ms })));
  const pageMs = writes.find((w) => w.what === 'page')?.ms ?? null;
  const devMs = calls.find((c) => c.verbs.some((v) => v.verb === 'dev' && !v.help))?.ms ?? null;
  const wrotePage = pageMs !== null || calls.some((c) => c.newFilm);
  const failures = failureList(calls);
  const first = stageFirstUse(calls, events, startMs);
  const rounds = roundsOf(fold, events, judges);
  return {
    file, kind: file.includes('/subagents/') ? 'sub' : 'main',
    session: meta.session ?? null, agent: meta.agent ?? null, label: calls.find((c) => c.label)?.label ?? null,
    model: [...meta.models].join(',') || null, cwd: meta.cwd ?? null, branch: meta.branch ?? null,
    start: meta.startMs ? new Date(meta.startMs).toISOString() : null, end: meta.endMs ? new Date(meta.endMs).toISOString() : null,
    minutes: meta.startMs ? Number(((meta.endMs - meta.startMs) / 60000).toFixed(1)) : 0,
    activeMinutes: Number((fold.active.reduce((t, a) => t + a.dt, 0) / 60000).toFixed(1)), helpCalls: events.filter((e) => e.help).length,
    tokens: tokensOf(fold.usage), films: filmsOf(calls),
    filmAgent: wrotePage, wrotePage: pageMs !== null, ranNew: calls.some((c) => c.newFilm),
    verbs: events,
    stages: { first, ...stageOrder(first) },
    routing: routingOf(calls, events, fold.hints),
    raw: rawUse(calls),
    docs: docReads(calls, startMs, pageMs, devMs),
    navigation: navigationOf(calls, pageMs),
    banSeen: banSeen(calls),
    failures: { total: failures.length, byClass: count(failures, (f) => f.cls), hookErrors: fold.hookErrors, list: failures.slice(0, 20) },
    rounds,
    ownerNotes: ownerNotes(rounds),
    stalls: stallsOf(fold),
    advice: adviceOutcomes(calls, fold.notes, runLog),
    cost: costOf(calls, events),
    breaks: ruleBreaks(events, wrotePage, calls.some((c) => c.unattended)),
  };
}
