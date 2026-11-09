import { VERBS } from '../../cli/verbs.mjs';
import { OLD_NAMES } from '../../cli/aliases.mjs';
import { noteAggregate } from './notes.mjs';
import { BIG_RESULT } from './analyze.mjs';

const used = (a, stage) => stage in a.stages.first;
const before = (a, x, y) => used(a, x) && (!used(a, y) || a.stages.first[x] < a.stages.first[y]);
const failed = (a, cls) => (a.failures.byClass[cls] ?? 0) > 0;
const read = (a, doc) => a.docs.some((d) => d.doc === doc);
const sawBan = (a, ban) => ban in a.banSeen;
const withDev = (a) => used(a, 'dev');
const firstSec = (a, pred) => a.verbs.find((v) => !v.help && pred(v))?.sec ?? null;
const refsBeforeDev = (a) => { const refs = firstSec(a, (v) => v.verb === 'refs'); return refs !== null && refs <= firstSec(a, (v) => v.verb === 'dev'); };
const GUIDE_DOC = /^(taste|guides)\/|^prompts\/moves\/lens\.md$/;
const rate = (list, outcome) => list.filter((x) => x.outcome === outcome).length;

/** Each row: id, label, applies (which agents count in the denominator), test (which of those count). */
export const METRICS = [
  { id: 'new', label: 'ran bin/vawe new', test: (a) => used(a, 'new') },
  { id: 'studyFirst', label: 'a refs study before the first dev', applies: withDev, test: refsBeforeDev },
  { id: 'designFirst', label: 'DESIGN.md or kit written before the first dev', applies: withDev, test: (a) => before(a, 'design', 'dev') },
  { id: 'framesFirst', label: 'vawe frame --world before the first dev', applies: withDev, test: (a) => before(a, 'frames', 'dev') },
  { id: 'ideasFirst', label: 'Ideas rows written before the first dev', applies: withDev, test: (a) => before(a, 'ideas', 'dev') },
  { id: 'storyboard', label: 'ran vawe frame --board or see --plan', test: (a) => used(a, 'storyboard') },
  { id: 'boardFirst', label: 'Board rows written before the first dev', applies: withDev, test: (a) => before(a, 'board', 'dev') },
  { id: 'motion', label: 'motion pass verbs after dev (frame --cuts, --onion, --velocity)', applies: withDev, test: (a) => used(a, 'motion') },
  { id: 'critique', label: 'ran critique', test: (a) => used(a, 'critique') },
  { id: 'judge', label: 'ran judge', test: (a) => used(a, 'judge') },
  { id: 'shipAttempted', label: 'tried a final render (ship, refused or not)', test: (a) => a.breaks.shipAttempted },
  { id: 'shipRefused', label: 'ship refused for no approval', applies: (a) => a.breaks.shipAttempted, test: (a) => a.breaks.shipRefusedNoApproval },
  { id: 'shipStarted', label: 'started a final render', applies: (a) => a.breaks.shipAttempted, test: (a) => a.breaks.shipStarted },
  { id: 'critiqueBeforeShip', label: 'critique before the final render attempt', applies: (a) => a.breaks.shipAttempted, test: (a) => !a.breaks.shipWithoutCritique },
  { id: 'fixAfterCritique', label: 'dev --from/--to after critique or judge', applies: (a) => used(a, 'critique') || used(a, 'judge'), test: (a) => used(a, 'fix') },
  { id: 'reviewBySameAgent', label: 'critique or judge run by the agent that wrote the page', applies: (a) => a.filmAgent, test: (a) => a.breaks.reviewBySameAgent },
  { id: 'shipNoApproval', label: 'final render started with no approve in the trace', applies: (a) => a.breaks.shipStarted, test: (a) => a.breaks.shipWithoutApprovalInTrace },
  { id: 'shipBeforeDraft', label: 'final render attempt before a full draft', applies: (a) => a.breaks.shipAttempted, test: (a) => a.breaks.shipBeforeFullDraft },
  { id: 'readAgents', label: 'read AGENTS.md', test: (a) => read(a, 'AGENTS.md') },
  { id: 'readDigest', label: 'read taste/build/DIGEST.md', test: (a) => read(a, 'taste/build/DIGEST.md') },
  { id: 'docBeforePage', label: 'read a taste or guide doc before the first page write (AGENTS.md not counted)', applies: (a) => a.wrotePage, test: (a) => a.docs.some((d) => d.beforePage && GUIDE_DOC.test(d.doc)) },
  { id: 'digestBeforePage', label: 'read taste/build/DIGEST.md before the first page write', applies: (a) => a.wrotePage, test: (a) => a.docs.some((d) => d.beforePage && d.doc === 'taste/build/DIGEST.md') },
  { id: 'sawNoTells', label: 'saw the no-tells ban line in verb output', test: (a) => sawBan(a, 'noTells') },
  { id: 'sawAttractors', label: 'saw the attractors ban line in verb output', test: (a) => sawBan(a, 'attractors') },
  { id: 'sawSlideshow', label: 'saw the slideshow ban line in verb output', test: (a) => sawBan(a, 'slideshow') },
  { id: 'rawFfmpeg', label: 'used raw ffmpeg', test: (a) => 'ffmpeg' in a.raw },
  { id: 'rawSleep', label: 'used sleep', test: (a) => 'sleep' in a.raw },
  { id: 'rawCurl', label: 'used curl', test: (a) => 'curl' in a.raw },
  { id: 'rawBrowser', label: 'used a browser or screenshot script', test: (a) => 'browser' in a.raw },
  { id: 'rawPs', label: 'polled with ps or pgrep', test: (a) => 'psPoll' in a.raw },
  { id: 'rawHinted', label: 'did by hand what a verb does (verb-hint rules)', test: (a) => Object.keys(a.raw).some((k) => k.startsWith('hint:')) },
  { id: 'ignoredFindings', label: 'a dev finding ignored for 3 or more drafts', applies: (a) => a.advice.drafts > 0, test: (a) => a.advice.items.some((i) => i.outcome === 'ignored') },
  { id: 'waivedSameRound', label: 'a waiver added in the round its rule first fired', applies: (a) => a.advice.drafts > 0, test: (a) => a.advice.items.some((i) => i.waivedSameRound) },
  { id: 'failHook', label: 'a hook blocked a call', test: (a) => failed(a, 'hook') },
  { id: 'failGlob', label: 'a zsh glob matched nothing', test: (a) => failed(a, 'glob') },
  { id: 'failNotFound', label: 'a command was not found', test: (a) => failed(a, 'not-found') },
  { id: 'failVawe', label: 'a vawe verb failed', test: (a) => failed(a, 'vawe') },
  { id: 'failTest', label: 'a test failed', test: (a) => failed(a, 'test') },
  { id: 'repeats', label: 'repeated an identical call', test: (a) => a.cost.repeats > 0 },
  { id: 'bigResults', label: 'got a result over 8000 chars', test: (a) => a.cost.bigResults > 0 },
  { id: 'missedRead', label: 'read a path that does not exist', test: (a) => a.navigation.missedReads > 0 },
  { id: 'pollRead', label: 'read background task output to wait', test: (a) => a.navigation.pollReads > 0 },
];

/** Numbers averaged over agents: id, label, value of one agent. */
export const NUMBERS = [
  { id: 'minutes', label: 'minutes (first row to last)', of: (a) => a.minutes },
  { id: 'activeMinutes', label: 'active minutes (gaps over 10 min left out)', of: (a) => a.activeMinutes },
  { id: 'calls', label: 'tool calls', of: (a) => a.cost.calls },
  { id: 'failures', label: 'failed calls', of: (a) => a.failures.total },
  { id: 'verbs', label: 'vawe verb calls', of: (a) => a.verbs.filter((v) => !v.help).length },
  { id: 'readsBeforePage', label: 'file reads before the first page write', of: (a) => a.navigation.readsBeforePage },
  { id: 'searchesBeforePage', label: 'searches (grep, find, ls, Glob) before the first page write', of: (a) => a.navigation.searchesBeforePage },
  { id: 'rereads', label: 'text files read again (images and task output left out)', of: (a) => a.navigation.rereads },
  { id: 'missedSearches', label: 'searches that found nothing', of: (a) => a.navigation.missedSearches },
  { id: 'waitMin', label: 'minutes waiting (wait, Monitor, sleep, ps)', of: (a) => a.cost.waitSecs / 60 },
  { id: 'renderMin', label: 'minutes of dev and ship render', of: (a) => a.cost.renderSecs / 60 },
  { id: 'waivedRules', label: 'rules waived (findings now in the page allow block)', of: (a) => a.advice.waived },
  { id: 'waivedEntries', label: 'entries in the page allow block (all waivers)', of: (a) => a.advice.waivedEntries },
  { id: 'tokIn', label: 'input tokens (M, fresh + cache write)', of: (a) => (a.tokens.input + a.tokens.cacheWrite) / 1e6 },
  { id: 'tokCache', label: 'cache read tokens (M)', of: (a) => a.tokens.cacheRead / 1e6 },
  { id: 'tokOut', label: 'output tokens (k)', of: (a) => a.tokens.output / 1e3 },
];

// The verb footer prints after the next line, so 2 lines after it is the normal end of a result.
const BURIED_AFTER = 2;

/** Why ignored next lines may have been missed: the result was big, the line was not near its end, or neither. Pure. */
function nextCauses(ignored) {
  const big = (n) => n.chars > BIG_RESULT;
  const buried = (n) => n.linesAfter !== null && n.linesAfter > BURIED_AFTER;
  return {
    nextIgnoredBig: ignored.filter(big).length,
    nextIgnoredBuried: ignored.filter((n) => !big(n) && buried(n)).length,
    nextIgnoredPlain: ignored.filter((n) => !big(n) && !buried(n)).length,
  };
}

const median = (xs) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] : 0);
const round = (x) => Number(x.toFixed(1));

/** For each vawe verb, how many agents ran it (help calls left out); a verb no agent ran has 0. Pure. */
function verbUse(agents) {
  const use = Object.fromEntries([...VERBS.map((v) => v.name), ...OLD_NAMES].map((name) => [name, 0]));
  for (const a of agents) for (const verb of new Set(a.verbs.filter((v) => !v.help).map((v) => v.verb))) use[verb] = (use[verb] ?? 0) + 1;
  return use;
}

/** The aggregate table: { n, rows: [{ id, label, count, of, pct }], numbers: [{ id, label, mean, median }], routing }. Pure. */
export function aggregate(agents) {
  const rows = METRICS.map((m) => {
    const pool = m.applies ? agents.filter(m.applies) : agents;
    const count = pool.filter(m.test).length;
    return { id: m.id, label: m.label, count, of: pool.length, pct: pool.length ? Math.round((100 * count) / pool.length) : null };
  });
  const numbers = NUMBERS.map((m) => {
    const xs = agents.map(m.of);
    return { id: m.id, label: m.label, mean: xs.length ? round(xs.reduce((t, x) => t + x, 0) / xs.length) : 0, median: round(median(xs)) };
  });
  const next = agents.flatMap((a) => a.routing.next);
  const hints = agents.flatMap((a) => a.routing.hints);
  const routing = {
    nextLines: next.length, nextFollowed: rate(next, 'followed'), nextRepeated: rate(next, 'repeated'), nextIgnored: rate(next, 'ignored'),
    ...nextCauses(next.filter((n) => n.outcome === 'ignored')),
    hints: hints.length, hintsFollowed: rate(hints, 'followed'), hintsIgnored: rate(hints, 'ignored'),
  };
  return { n: agents.length, rows, numbers, routing, verbUse: verbUse(agents), notes: noteAggregate(agents) };
}

/** Before and after a cutoff (ms): the aggregate of the agents that started on each side. Pure. */
export function compareAt(agents, cutoff) {
  const side = (keep) => aggregate(agents.filter((a) => a.start && keep(Date.parse(a.start))));
  return { before: side((t) => t < cutoff), after: side((t) => t >= cutoff) };
}
