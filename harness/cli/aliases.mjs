// The old picture verbs. Each maps its argv to the argv of the verb that replaced it; none is in VERBS, so the verb table stays small.
const AT = /^--at(=|$)/;

const renamed = (args, from, to) => args.map((a) => (a === `--${from}` ? `--${to}` : a.startsWith(`--${from}=`) ? `--${to}${a.slice(from.length + 2)}` : a));
const valueOf = (args, flag) => {
  const i = args.findIndex((a) => a === flag || a.startsWith(`${flag}=`));
  if (i < 0) return undefined;
  return args[i].includes('=') ? args[i].slice(flag.length + 1) : args[i + 1];
};

const sheet = (args) => {
  const at = valueOf(args, '--at');
  const one = at !== undefined && /^\s*\d+(\.\d+)?\s*$/.test(at);
  return ['frame', ...renamed(args, 'ref', 'vs'), ...(one && valueOf(args, '--ref') === undefined ? ['--sheet'] : [])];
};

const frames = (args) => {
  if (args.includes('--looks')) return ['frame', ...args];
  const rest = renamed(args, 'zoom', 'sharp');
  return ['frame', ...rest, ...(valueOf(args, '--world') === undefined ? ['--world', 'all'] : [])];
};

const storyboard = (args) => {
  if (args.includes('--text')) return ['see', ...args.filter((a) => a !== '--text'), '--plan'];
  return ['frame', ...args, ...(args.includes('--directions') ? [] : ['--board'])];
};

export const ALIASES = {
  still: (args) => ['frame', ...args],
  zoom: (args) => ['frame', ...args],
  sheet,
  frames,
  strip: (args) => ['frame', ...args.map((a) => (AT.test(a) ? a.replace('--at', '--moment') : a))],
  storyboard,
};

/** The line an agent sees once when it types an old verb: what the call now is. */
export const aliasNotice = (name, argv) => `vawe: \`vawe ${name}\` is now \`vawe ${argv.join(' ')}\``;

/** The verb a call of `name` runs today: an old picture verb gives frame (or see), any other name gives itself. A run log written before the merge names the old verb. */
export const verbNow = (name) => ALIASES[name]?.([])[0] ?? name;
