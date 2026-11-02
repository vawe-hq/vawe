// `vawe-dev runs --taste`: what the run logs say about the taste rules and about variety across films.
// Pure: it reads the records readAllRuns gives it (new and old; an old record lacks the rule and signature fields).
import { DIALS } from '../../core/motion/signature.js';
import { normalize, table } from './runs-report.mjs';
import { declaredSignature, valueKeys } from './variety.mjs';
import { SAMENESS, TEMPLATE } from './judge-findings.mjs';
import { DIALS as BAR_DIALS, OURS } from './judge-bar.mjs';

export const MAX_LINES = 50;
export const FIX_RATE_MIN = 0.5; // a rule that agents fix in the next draft at least half the time is read
export const NOISY_AT = 0.5; // waived in half the films that meet it, or the judge disagrees half the time: the rule misfires
export const MIN_JUDGED = 2; // one judge answer is an anecdote, not a contradiction rate
export const CONCENTRATED = 0.5; // one value in more than half the films is a house style, not a choice
export const MIN_FILMS_FOR_SPREAD = 3; // two films cannot show a spread
export const SIBLING_PAIRS_SHOWN = 5;
export const TEMPLATE_FILMS_SHOWN = 5;
export const DEAD_CHARS = 160;

const SPECIAL = [SAMENESS, TEMPLATE];
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const byTime = (a, b) => String(a.at).localeCompare(String(b.at));

const blank = () => ({ fired: 0, films: new Set(), opps: 0, fixed: 0, deltas: [], waived: new Set(), earned: 0, confirmed: 0, contradicted: 0 });

/** The judge total just before and just after a draft, as after minus before; null unless both exist. */
function scoreAcross(judges, draft) {
  const before = judges.findLast((j) => j.at < draft.at);
  const after = judges.find((j) => j.at > draft.at);
  return before && after ? after.total - before.total : null;
}

function addFilm(stats, film, events) {
  const get = (id) => { if (!stats.has(id)) stats.set(id, blank()); return stats.get(id); };
  const drafts = events.filter((e) => e.cmd === 'dev' && e.fired);
  const judges = events.filter((e) => e.cmd === 'judge' && e.stage !== 'stills' && e.total != null);
  for (const d of drafts) for (const id of d.fired) { const s = get(id); s.fired++; s.films.add(film); }
  drafts.slice(0, -1).forEach((d, i) => {
    for (const id of d.fired) {
      const s = get(id);
      s.opps++;
      if (drafts[i + 1].fired.includes(id)) continue;
      s.fixed++;
      const delta = scoreAcross(judges, drafts[i + 1]);
      if (delta != null) s.deltas.push(delta);
    }
  });
  for (const j of events.filter((e) => e.cmd === 'judge' && e.notes)) {
    for (const n of j.notes.filter((x) => x.rule && !SPECIAL.includes(x.rule) && x.verdict === 'fail')) { const s = get(n.rule); s.fired++; s.films.add(film); }
    const last = drafts.findLast((d) => d.at < j.at);
    for (const id of last?.fired ?? []) {
      const noted = j.notes.find((n) => n.rule === id);
      if (noted?.verdict === 'fail') get(id).confirmed++;
      else if (!noted) get(id).contradicted++;
    }
  }
  const waivers = events.findLast((e) => e.cmd === 'judge' && e.waivers)?.waivers ?? [];
  for (const w of waivers) { const s = get(w.code); s.waived.add(film); if (w.earned) s.earned++; }
}

/** keep, check, dead or noisy for one rule's stats. */
export function verdictOf(s, meanGain) {
  if (!s.fired) return 'dead';
  const met = new Set([...s.films, ...s.waived]).size;
  const judged = s.confirmed + s.contradicted;
  if (s.waived.size / met >= NOISY_AT || (judged >= MIN_JUDGED && s.contradicted / judged >= NOISY_AT)) return 'noisy';
  const rate = s.opps ? s.fixed / s.opps : 0;
  return rate >= FIX_RATE_MIN && meanGain > 0 ? 'keep' : 'check';
}

function ruleRows(filmEvents, ruleIds) {
  const stats = new Map();
  for (const { film, events } of filmEvents) addFilm(stats, film, events);
  const rows = [...stats].map(([id, s]) => {
    const gain = mean(s.deltas);
    return { id, fired: s.fired, films: s.films.size, opps: s.opps, fixed: s.fixed, rate: s.opps ? s.fixed / s.opps : null, waived: s.waived.size, earned: s.earned, gain, verdict: verdictOf(s, gain) };
  }).filter((r) => r.fired || r.waived).sort((a, b) => b.fired - a.fired || a.id.localeCompare(b.id));
  const seen = new Set(rows.map((r) => r.id));
  return { rows, dead: ruleIds.filter((id) => !seen.has(id)).sort() };
}

function varietyRows(films, readMeta) {
  const sigs = films.map(({ film, runs }) => declaredSignature(film, runs, readMeta)).filter(Boolean);
  return DIALS.map((dial) => {
    const chosen = sigs.filter((s) => s.signature[dial]);
    const counts = new Map();
    for (const s of chosen) for (const k of valueKeys(dial, s.signature[dial])) counts.set(k, (counts.get(k) ?? 0) + 1);
    const values = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    const share = chosen.length ? values[0][1] / chosen.length : null;
    return { dial, films: chosen.length, values: Object.fromEntries(values), share, flag: chosen.length >= MIN_FILMS_FOR_SPREAD && share > CONCENTRATED };
  });
}

function siblingPairs(filmEvents) {
  const pairs = new Map();
  for (const { film, events } of filmEvents) {
    const s = events.findLast((e) => e.cmd === 'judge' && e.sameness)?.sameness;
    if (!s?.sibling) continue;
    for (const other of (s.films ?? []).filter((f) => f !== film)) {
      const key = [film, other].sort().join(' ~ ');
      if (!pairs.has(key)) pairs.set(key, { films: [film, other].sort(), shared: s.shared ?? null });
    }
  }
  return [...pairs.values()].sort((a, b) => a.films.join().localeCompare(b.films.join()));
}

function attractorDays(filmEvents) {
  const days = new Map();
  for (const { events } of filmEvents) {
    for (const e of events) {
      const hits = [...(e.fired ?? []), ...(e.notes ?? []).filter((n) => n.verdict === 'fail').map((n) => n.rule)].filter((id) => /attractor/.test(id ?? ''));
      if (hits.length) days.set(String(e.at).slice(0, 10), (days.get(String(e.at).slice(0, 10)) ?? 0) + hits.length);
    }
  }
  return [...days].sort((a, b) => a[0].localeCompare(b[0])).map(([day, n]) => ({ day, n }));
}

/** Per dial, the side-by-side answers of each film's latest judge run that had them: { films, dials: { text: { won, lost }, ... } }. */
function barRows(filmEvents) {
  const latest = filmEvents.map(({ events }) => events.findLast((e) => e.cmd === 'judge' && e.bar)?.bar).filter(Boolean);
  const dials = Object.fromEntries(BAR_DIALS.map((d) => {
    const rows = latest.flat().filter((b) => b.dial === d);
    return [d, { won: rows.filter((b) => b.winner === OURS).length, lost: rows.filter((b) => b.winner !== OURS).length }];
  }));
  return { films: latest.length, dials };
}

/** The whole report as data. `films` is readAllRuns(); `ruleIds` the rules that exist; `readMeta(film)` the page's signature meta or null. */
export function tasteReport(films, { ruleIds = [], readMeta = () => null } = {}) {
  const filmEvents = films.map(({ film, runs }) => ({ film, events: runs.map(normalize).sort(byTime) }));
  const all = filmEvents.flatMap((f) => f.events);
  const template = filmEvents.map(({ film, events }) => ({ film, n: events.filter((e) => e.template?.tell).length })).filter((t) => t.n).sort((a, b) => b.n - a.n || a.film.localeCompare(b.film));
  return {
    counts: { films: films.length, drafts: all.filter((e) => e.cmd === 'dev').length, draftsWithRules: all.filter((e) => e.cmd === 'dev' && e.fired).length, judges: all.filter((e) => e.cmd === 'judge').length, judgesWithNotes: all.filter((e) => e.cmd === 'judge' && e.notes).length },
    ...ruleRows(filmEvents, ruleIds), variety: varietyRows(films, readMeta), sameness: siblingPairs(filmEvents), attractors: attractorDays(filmEvents), template, bar: barRows(filmEvents),
  };
}

const pct = (x) => (x == null ? 'n/a' : `${Math.round(x * 100)}%`);
const signed = (x) => (x == null ? 'n/a' : `${x > 0 ? '+' : ''}${Number(x.toFixed(1))}`);
const clip = (text, n) => (text.length > n ? `${text.slice(0, n - 3)}...` : text);

/** The lines of `vawe-dev runs --taste`: at most MAX_LINES; the rule rows give way first, the JSON holds all. */
export function tasteLines(r) {
  const c = r.counts;
  const head = [`taste report: ${c.films} films, ${c.drafts} drafts (${c.draftsWithRules} log rules), ${c.judges} judge runs (${c.judgesWithNotes} log notes)`];
  const dead = r.dead.length ? [clip(`dead, never fired (${r.dead.length}): ${r.dead.join(' ')}`, DEAD_CHARS)] : [];
  const variety = ['', 'variety: most common value per dial across films; ! marks a dial over 50 percent',
    ...r.variety.map((v) => `${v.dial.padEnd(8)} ${v.films ? `${pct(v.share)}${v.flag ? ' !' : ''}  ${Object.entries(v.values).slice(0, 4).map(([k, n]) => `${k} ${n}`).join(', ')} (${v.films} films)` : 'no film chose it'}`)];
  const pairs = r.sameness.slice(0, SIBLING_PAIRS_SHOWN).map((p) => `${p.films.join(' ~ ')}: ${clip(p.shared ?? 'no trait named', 80)}`);
  const tail = ['',
    `sameness (siblings the judge named): ${r.sameness.length ? '' : 'none'}`.trimEnd(), ...pairs, ...(r.sameness.length > pairs.length ? [`... ${r.sameness.length - pairs.length} more pairs (use --json)`] : []),
    `attractor hits by day: ${r.attractors.length ? r.attractors.map((a) => `${a.day} ${a.n}`).join(', ') : 'none logged'}`,
    `template tells (judge): ${r.template.length ? r.template.slice(0, TEMPLATE_FILMS_SHOWN).map((t) => `${t.film} ${t.n}`).join(', ') : 'none'}`,
    r.bar.films ? `bar (latest judge per film, ours against reference films, ${r.bar.films} films): ${BAR_DIALS.filter((d) => r.bar.dials[d].won + r.bar.dials[d].lost).map((d) => `${d} won ${r.bar.dials[d].won} lost ${r.bar.dials[d].lost}`).join(', ')}` : 'bar: no judge run compared a film with reference films'];
  const rulesHead = ['', 'rules: fired = draft fires + judge fails; fixed = gone in the next draft; gain = judge total across that draft (shared by the rules it fixed)'];
  const room = MAX_LINES - [...head, ...rulesHead, ...dead, ...variety, ...tail].length - 1;
  const shown = r.rows.length > room ? r.rows.slice(0, Math.max(room - 1, 0)) : r.rows;
  const body = shown.length ? table([['rule', 'fired', 'films', 'fixed', 'rate', 'waived', 'earned', 'gain', 'verdict'],
    ...shown.map((x) => [x.id, x.fired, x.films, `${x.fixed}/${x.opps}`, pct(x.rate), x.waived, x.earned, signed(x.gain), x.verdict])]) : ['no rule fired in the logs'];
  const more = r.rows.length > shown.length ? [`... ${r.rows.length - shown.length} more rules (use --json)`] : [];
  return [...head, ...rulesHead, ...body, ...more, ...dead, ...variety, ...tail];
}
