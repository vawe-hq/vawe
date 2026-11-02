// The old picture verbs, and (DEV_ALIASES) the old maintainer verbs that moved to bin/vawe-dev. Each maps its argv to the argv of the verb that replaced it; none is in VERBS, so the verb table stays small.
// An old verb keeps the flags it required: a call that failed before fails now, naming the frame flag, so it never runs another mode.
import { UsageError } from './parse.mjs';

const AT = /^--at(=|$)/;
const ONE_SECOND = /^\s*\d+(\.\d+)?\s*$/;
const has = (args, flag) => args.some((a) => a === flag || a.startsWith(`${flag}=`));
const target = (args) => args.find((a) => !a.startsWith('--')) ?? '<page|mp4>';

const renamed = (args, from, to) => args.map((a) => (a === `--${from}` ? `--${to}` : a.startsWith(`--${from}=`) ? `--${to}${a.slice(from.length + 2)}` : a));
const valueOf = (args, flag) => {
  const i = args.findIndex((a) => a === flag || a.startsWith(`${flag}=`));
  if (i < 0) return undefined;
  return args[i].includes('=') ? args[i].slice(flag.length + 1) : args[i + 1];
};

const still = (args) => {
  const at = valueOf(args, '--at');
  if (at === undefined) throw new UsageError(`still needs --at <s>: vawe frame ${target(args)} --at <s> writes one frame`);
  if (!ONE_SECOND.test(at)) throw new UsageError(`still takes one second, got "${at}": vawe frame ${target(args)} --at ${at} makes a sheet`);
  return ['frame', ...args];
};

const zoom = (args) => {
  if (!has(args, '--at') || !(has(args, '--box') || has(args, '--auto'))) throw new UsageError(`zoom needs --at <s> and --box x,y,w,h or --auto: vawe frame ${target(args)} --at <s> --box x,y,w,h`);
  return ['frame', ...args];
};

const strip = (args) => {
  if (!has(args, '--at') && !has(args, '--cuts')) throw new UsageError(`strip needs --at <s> or --cuts: vawe frame ${target(args)} --moment <s>, or vawe frame ${target(args)} --cuts`);
  if (has(args, '--at') && has(args, '--cuts')) throw new UsageError(`strip --cuts does not take --at: vawe frame ${target(args)} --cuts, or vawe frame ${target(args)} --moment <s>`);
  return ['frame', ...args.map((a) => (AT.test(a) ? a.replace('--at', '--moment') : a))];
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
  still,
  zoom,
  sheet,
  frames,
  strip,
  storyboard,
};

/** The verbs that left bin/vawe for bin/vawe-dev: `vawe land` runs `vawe-dev land` and says so once. */
export const DEV_ALIASES = ['land', 'claim', 'e2e', 'test', 'runs', 'moves', 'doctor', 'judge', 'approve'];

/** The line an agent sees when it types an old verb: what the call now is. `short` leaves the arguments out, for a call that has no session to remember it. `bin` is the binary the call now runs. */
export const aliasNotice = (name, argv, { short = false, bin = 'vawe' } = {}) => `vawe: \`vawe ${name}\` is now \`${bin} ${short ? argv[0] : argv.join(' ')}\``;

/** The key a notice is remembered by: the old verb and the verb it became. */
export const aliasKey = (name, argv, { bin = 'vawe' } = {}) => `${name}->${bin === 'vawe' ? '' : `${bin} `}${argv[0]}`;

/** Every old name that still runs: the picture verbs and the verbs that moved to vawe-dev. */
export const OLD_NAMES = [...Object.keys(ALIASES), ...DEV_ALIASES];

/** The verb a call of `name` runs today: an old picture verb gives frame (or see), any other name gives itself (`storyboard --text` runs `see`, but the run log counts it with the rest). A run log written before the merge names the old verb. */
export const verbNow = (name) => (ALIASES[name] ? 'frame' : name);
