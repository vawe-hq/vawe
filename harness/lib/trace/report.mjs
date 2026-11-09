import { notesByClass } from './notes.mjs';

const cell = (r) => (r.of ? `${r.count}/${r.of} (${r.pct}%)` : '-');
const table = (head, rows) => [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.join(' | ')} |`)].join('\n');
const list = (items) => items.join(', ') || 'none';
const entries = (o) => Object.entries(o).map(([k, v]) => `${k} ${v}`).join(', ') || 'none';

function routingLine(r) {
  const pct = (n, of) => (of ? `${Math.round((100 * n) / of)}%` : '-');
  return [`next lines followed ${r.nextFollowed}/${r.nextLines} (${pct(r.nextFollowed, r.nextLines)}), same verb again ${r.nextRepeated}, ignored ${r.nextIgnored} (in a result over 8000 chars ${r.nextIgnoredBig}, not near the end ${r.nextIgnoredBuried}, neither ${r.nextIgnoredPlain})`,
    `hook hints followed ${r.hintsFollowed}/${r.hints} (${pct(r.hintsFollowed, r.hints)}), ignored ${r.hintsIgnored}`].join('; ');
}

function navigationLine(n) {
  return [`navigation: before the page ${n.readsBeforePage} reads, ${n.searchesBeforePage} searches`,
    `in all ${n.reads} reads, ${n.searches} searches, ${n.rereads} read again, ${n.pollReads} task-output polls`,
    `found nothing ${n.missedReads} reads, ${n.missedSearches} searches${n.missed.length ? ` (${n.missed.join('; ')})` : ''}`].join('; ');
}

function verbUseLines(use) {
  const ran = Object.entries(use).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
  return [`Verbs by agents that ran them: ${ran.map(([v, n]) => `${v} ${n}`).join(', ') || 'none'}.`, `No agent ran: ${Object.keys(use).filter((v) => !use[v]).join(', ') || 'none'}.`].join('\n');
}

/** The aggregate table as markdown. Pure. */
export function aggregateMarkdown(agg, title = 'Aggregate') {
  return [`## ${title} (${agg.n} agents)`, '',
    table(['what', 'agents'], agg.rows.map((r) => [r.label, cell(r)])), '',
    table(['number', 'mean', 'median'], agg.numbers.map((n) => [n.label, n.mean, n.median])), '',
    `Routing: ${routingLine(agg.routing)}.`, '', verbUseLines(agg.verbUse), ...notesTable(agg.notes ?? [])].join('\n');
}

/** Before and after a cutoff, side by side. Pure. */
export function compareMarkdown({ before, after }, cutoffText) {
  const rows = before.rows.map((b, i) => {
    const a = after.rows[i];
    const delta = b.pct === null || a.pct === null ? '-' : `${a.pct - b.pct > 0 ? '+' : ''}${a.pct - b.pct} pts`;
    return [b.label, cell(b), cell(a), delta];
  });
  const nums = before.numbers.map((b, i) => [b.label, b.mean, after.numbers[i].mean, `${(after.numbers[i].mean - b.mean).toFixed(1)}`]);
  return [`## Before and after ${cutoffText} (${before.n} agents before, ${after.n} after)`, '',
    table(['what', 'before', 'after', 'change'], rows), '',
    table(['number (mean)', 'before', 'after', 'change'], nums), '',
    `Routing before: ${routingLine(before.routing)}.`, `Routing after: ${routingLine(after.routing)}.`].join('\n');
}

const clip = (t, n) => t.slice(0, n).replace(/\|/g, '/');

function notesLines(a) {
  return notesByClass(a.ownerNotes ?? []).flatMap((g) => [`owner notes, ${g.class} ${g.notes.length}:`, ...g.notes.map((n) => `  - round ${n.round}: ${clip(n.text, 120)}`)]);
}

function notesTable(notes) {
  if (!notes.length) return [];
  return ['', table(['note class', 'notes', 'agents', 'repeats across agents'], notes.map((c) => [c.class, c.count, c.agents, c.repeats ? 'yes' : 'no']))];
}

const M = (n) => (n / 1e6).toFixed(2);

function roundsTable(rounds) {
  return table(['round', 'start-end min', 'wall', 'active', 'calls', 'renders', 'cache write M', 'cache read M', 'judge', 'note'],
    rounds.map((r) => [r.index, `${r.startMin}-${r.endMin}`, r.wallMin, r.activeMin, r.calls, `${r.renders} (${r.renderSecs}s)`, M(r.cacheWrite), M(r.cacheRead), r.judge ? `${r.judge.total} ${r.judge.verdict ?? ''}`.trim() : '-', `${r.note.slice(0, 90).replace(/\|/g, '/')}`]));
}

function adviceLine({ drafts, items, waived, waivedEntries }) {
  const named = (outcome) => items.filter((i) => i.outcome === outcome).map((i) => i.id).join(', ') || 'none';
  const same = items.filter((i) => i.waivedSameRound).map((i) => i.id).join(', ') || 'none';
  return `advice over ${drafts} drafts: waived ${waived} (${waivedEntries} allow entries; same round as first fired: ${same}); ignored: ${named('ignored')}; still open: ${named('open')}; fixed ${items.filter((i) => i.outcome === 'fixed').length}`;
}

function stallsLine(st) {
  const gaps = st.list.map((s) => `${s.kind} ${s.min} min at ${s.startMin} (next cache write ${M(s.nextCacheWrite)}M)`).join('; ') || 'none';
  return `stalls over 5 min: model-silent ${st.modelMin} min, tool ${st.toolMin} min, wait or cut-off ${st.waitMin} min: ${gaps}`;
}

const sequence = (verbs) => verbs.map((v) => `${v.verb}${v.help ? '?' : ''}${v.ok === false ? '!' : ''}@${v.sec}s`).join(' ') || 'none';

/** One agent's report as markdown. Pure. */
export function agentMarkdown(a) {
  const { first, skipped, inversions } = a.stages;
  const lines = [
    `### ${a.label ?? a.agent ?? a.file}`,
    `${a.file}`,
    `${a.model ?? '?'} · ${a.branch ?? '?'} · ${a.start?.slice(0, 16) ?? '?'} · ${a.minutes} min (${a.activeMinutes} active) · tokens in ${((a.tokens.input + a.tokens.cacheWrite) / 1e6).toFixed(1)}M, cache read ${(a.tokens.cacheRead / 1e6).toFixed(1)}M, out ${(a.tokens.output / 1e3).toFixed(0)}k · films ${list(a.films)}`,
    `verbs: ${sequence(a.verbs)}`,
    `stages (first second): ${Object.entries(first).map(([s, t]) => `${s} ${t}`).join(', ') || 'none'}; skipped ${list(skipped)}; out of order ${list(inversions)}`,
    `routing: next ${entries(a.routing.nextCounts)}; hints ${entries(a.routing.hintCounts)}`,
    `raw tools: ${entries(a.raw)}`,
    `docs read: ${list(a.docs.map((d) => `${d.doc}@${d.sec}s${d.beforePage ? '' : ' (after page)'}`))}; ban lines seen ${entries(Object.fromEntries(Object.entries(a.banSeen).map(([k, v]) => [k, v.join('/')])))}`,
    navigationLine(a.navigation),
    `failures ${a.failures.total}: ${entries(a.failures.byClass)}; hook errors ${a.failures.hookErrors}`,
    `cost: ${a.cost.calls} calls, ${a.cost.repeats} repeats, ${a.cost.bigResults} big results (${a.cost.bigChars} chars), wait ${a.cost.waitSecs}s, render ${a.cost.renderSecs}s${a.cost.unloggedRenderSecs ? ` (+${a.cost.unloggedRenderSecs}s in render calls with no run-log record)` : ''}, slot wait ${a.cost.slotWaitSecs}s`,
    `rule breaks: ${list(Object.entries(a.breaks).filter(([, v]) => v).map(([k]) => k))}`,
  ];
  lines.push(stallsLine(a.stalls), adviceLine(a.advice), ...notesLines(a), '', roundsTable(a.rounds));
  for (const f of a.failures.list.slice(0, 5)) lines.push(`  - ${f.cls}: ${f.call} :: ${f.why}`);
  for (const r of a.cost.topRepeats.slice(0, 3)) lines.push(`  - ${r.times}x ${r.call}`);
  return lines.join('\n');
}
