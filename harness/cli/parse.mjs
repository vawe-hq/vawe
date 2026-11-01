// Argument parsing and help text for bin/vawe. A verb declares its flags once; this file parses,
// validates and prints them, so a typo always ends in one line naming the valid flags.

export class UsageError extends Error {}

export function closest(word, options) {
  const dist = (a, b) => {
    const row = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
      let prev = row[0];
      row[0] = i;
      for (let j = 1; j <= b.length; j++) {
        const cur = row[j];
        row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
        prev = cur;
      }
    }
    return row[b.length];
  };
  const ranked = options.map((o) => [o, dist(word, o)]).sort((x, y) => x[1] - y[1]);
  return ranked.length && ranked[0][1] <= Math.max(2, Math.floor(word.length / 2)) ? ranked[0][0] : null;
}

function coerce(flag, raw) {
  if (flag.type === 'number') {
    const n = Number(raw);
    if (raw === undefined || raw === '' || Number.isNaN(n)) throw new UsageError(`--${flag.name} needs a number, got ${raw === undefined ? 'nothing' : `"${raw}"`}`);
    return n;
  }
  if (raw === undefined || raw.startsWith('--')) throw new UsageError(`--${flag.name} needs a ${flag.type} value`);
  return raw;
}

// Returns { values, positional }. Throws UsageError with a one-line reason.
export function parseArgs(verb, argv) {
  const flags = verb.flags || [];
  const known = flags.map((f) => f.name);
  const values = {};
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) { positional.push(a); continue; }
    const [name, inline] = a.slice(2).split(/=(.*)/s);
    const flag = flags.find((f) => f.name === name);
    if (!flag) {
      const guess = closest(name, known);
      throw new UsageError(`unknown flag --${name}; valid: ${known.map((k) => `--${k}`).join(' ') || '(none)'}${guess ? `; did you mean --${guess}?` : ''}`);
    }
    if (flag.type === 'bool') { values[name] = true; continue; }
    const raw = inline !== undefined ? inline : argv[++i];
    values[name] = flag.repeat ? [...(values[name] || []), coerce(flag, raw)] : coerce(flag, raw);
  }
  const needed = (verb.positional || []).filter((p) => p.required);
  if (positional.length < needed.length) throw new UsageError(`missing <${needed[positional.length].name}>; usage: ${usageLine(verb)}`);
  if (!verb.rest && positional.length > (verb.positional || []).length) throw new UsageError(`unexpected argument "${positional[(verb.positional || []).length]}"; usage: ${usageLine(verb)}`);
  return { values, positional };
}

function usageLine(verb) {
  const pos = (verb.positional || []).map((p) => (p.required ? `<${p.name}>` : `[${p.name}]`)).join(' ');
  return `vawe ${verb.name}${pos ? ` ${pos}` : ''}${(verb.flags || []).length ? ' [flags]' : ''}`;
}

export function verbHelp(verb) {
  if (verb.help) return `${verb.summary}\n\n${verb.help}`;
  const lines = [verb.summary, '', usageLine(verb)];
  for (const p of verb.positional || []) lines.push(`  ${`<${p.name}>`.padEnd(14)} ${p.help}`);
  if ((verb.flags || []).length) {
    lines.push('', 'flags:');
    for (const f of verb.flags) {
      const type = f.type === 'bool' ? '' : ` <${f.type}>`;
      lines.push(`  ${`--${f.name}${type}`.padEnd(18)} ${f.help} (default: ${f.default ?? (f.type === 'bool' ? 'off' : 'none')})`);
    }
  }
  lines.push('', `example: ${verb.example}`);
  return lines.join('\n');
}

export const TIERS = [
  ['core', 'the loop'],
  ['more', 'more'],
  ['maintainer', 'maintainers (the framework, not a film)'],
];

/** The text of `vawe --help`: the core verbs, or with `all` every verb in its tier. Pure. */
export function topHelp(verbs, { all = false } = {}) {
  const width = Math.max(...verbs.map((v) => v.name.length)) + 2;
  const row = (v) => `  ${v.name.padEnd(width)}${v.summary}`;
  const shown = all ? TIERS : TIERS.slice(0, 1);
  const groups = shown.flatMap(([tier, title]) => ['', `${title}:`, ...verbs.filter((v) => v.tier === tier).map(row)]);
  const hidden = all ? [] : ['', `${verbs.filter((v) => v.tier !== 'core').length} more verbs: vawe --help --all`];
  return ['vawe: one HTML page in, one film out.', '', 'usage: vawe <verb> [args]   (vawe <verb> --help for flags)', ...groups, ...hidden].join('\n');
}
