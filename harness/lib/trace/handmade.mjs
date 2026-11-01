import { VERBS } from '../../cli/verbs.mjs';
import { RULES } from '../../live/verb-hint.mjs';
import { RAW_TOOLS } from './calls.mjs';

const HAND_KINDS = new Set([...Object.keys(RAW_TOOLS), 'pil', 'nodeEval']);
const SCRIPT_WRITE = /\.(?:mjs|js|py|sh)$/;
const VAWE_DIR = /(?:^|\/)(?:films|harness|core|studio|tests|scripts|site)\//;
const FILM = /films\/([a-z0-9][\w-]*)\//;
const SHAPE_TOKENS = 14;
const LEADING = /^\s*(?:cd\s+\S+\s*(?:&&|;)\s*|(?:[A-Z_][A-Z0-9_]*=\S*\s+)+|rtk\s+)+/;
const VERB_BY_RULE = { links: 'check links', sheet: 'frame', still: 'frame' };

const writeShape = (file) => `write ${file.split('/').pop().replace(/\d+/g, 'N')}`;

/** One shape per command kind: paths, numbers and quoted strings become placeholders, tool and flag names stay. Pure. */
export function normaliseShape(cmd) {
  return String(cmd).replace(LEADING, '')
    .replace(/"[^"]*"|'[^']*'/g, 'Q')
    .split(/\s+/).filter(Boolean)
    .map((t, i) => (i === 0 ? t.split('/').pop() : t.includes('/') || /\.[a-z0-9]{2,4}$/i.test(t) ? 'P' : t.replace(/\$\{?\w+\}?/g, 'V').replace(/(?<![A-Za-z_])\d[\d.]*/g, 'N')))
    .slice(0, SHAPE_TOKENS).join(' ');
}

/** The hand-made events in parsed calls, as { kind, shape, sample, films, session }. Pure. */
export function handmadeShapes(calls, { session = null, films = [] } = {}) {
  const events = [];
  for (const c of calls) {
    const kind = c.name === 'Bash' ? c.raw.find((id) => HAND_KINDS.has(id)) : null;
    const isScript = c.name === 'Write' && SCRIPT_WRITE.test(c.cmd) && !VAWE_DIR.test(c.cmd);
    if (!kind && !isScript) continue;
    const film = c.cmd.match(FILM);
    events.push({ kind: kind ?? 'write', shape: isScript ? writeShape(c.cmd) : normaliseShape(c.cmd), sample: c.cmd, films: film ? [film[1]] : films, session });
  }
  return events;
}

/** The shapes with count, films and sessions, most frequent first. Pure. */
export function rankShapes(events) {
  const byShape = new Map();
  for (const e of events) {
    const row = byShape.get(e.shape) ?? { shape: e.shape, kind: e.kind, sample: e.sample, count: 0, films: new Set(), sessions: new Set() };
    row.count += 1;
    e.films.forEach((f) => row.films.add(f));
    if (e.session) row.sessions.add(e.session);
    byShape.set(e.shape, row);
  }
  return [...byShape.values()].map((r) => ({ ...r, films: [...r.films].sort(), sessions: [...r.sessions].sort() }))
    .sort((a, b) => b.count - a.count || a.shape.localeCompare(b.shape));
}

/** The vawe verb that already does what a command does by hand (a verb-hint rule matches it, or it polls for a job), or null. Pure. */
export function coveringVerb(cmd) {
  const rule = RULES.find((r) => r.test.test(cmd));
  const name = rule ? (VERB_BY_RULE[rule.id] ?? rule.id) : null;
  return name && VERBS.some((v) => v.name === name.split(' ')[0]) ? name : null;
}
