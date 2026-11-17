// A next step is data: an array of parts, each a string of words, a command, a film doc or the page to build. Plain JSON, so
// it crosses a process or a tool boundary whole. shellNext prints it for a person at a shell; harness/mcp/next-as-tools.mjs
// has toolNext, which prints it for an agent that has tools and no shell.

export const BIN = 'bin/vawe';

/** A command part. `args` are the argv tokens after the verb, in the order they print. */
export const cmd = (verb, args = [], extra = {}) => ({ bin: BIN, verb, args, ...extra });

/** `bin/vawe <verb> <args...>` */
export const vawe = (verb, ...args) => cmd(verb, args);

/** A film doc a step names: `mode` is what the step asks of it, write (whole), edit (a part) or read. `file` is brief.md, DESIGN.md or kit/. */
export const doc = (film, file, mode) => ({ doc: `films/${film}/${file}`, film, file, mode });

const FILM_DOC = /^films\/([a-z0-9][\w-]*)\/(brief\.md|DESIGN\.md|kit\/)$/;

/** The doc part for a relative path of a film doc, or the path as words when it is none. */
export const docAt = (relPath, mode) => {
  const m = FILM_DOC.exec(relPath);
  return m ? doc(m[1], m[2], mode) : relPath;
};

/** The page a step asks the agent to build from the kit. */
export const buildPage = (rel) => ({ build: rel });

const flat = (parts) => parts.flatMap((p) => (Array.isArray(p) ? flat(p) : p === null || p === undefined || p === false ? [] : [typeof p === 'object' ? p : String(p)]));

/** The step of these pieces (strings, numbers, parts and steps): adjacent strings join, nested steps open out. */
export function step(...pieces) {
  const out = [];
  for (const p of flat(pieces)) {
    if (typeof p === 'string' && typeof out.at(-1) === 'string') out[out.length - 1] += p;
    else out.push(p);
  }
  return out;
}

/** Template tag for a step: say`${vawe('dev', rel)} then more words` */
export const say = (strings, ...values) => step(strings.flatMap((s, i) => (i < values.length ? [s, values[i]] : [s])));

/** The shell form of one command part. */
export const commandText = (c) => [c.env, c.bin, c.verb, ...c.args].filter((t) => t !== undefined && t !== '').join(' ');

const partText = (p) => (typeof p === 'string' ? p : p.verb !== undefined ? commandText(p) : p.doc ?? p.build);

/** The text a person types and reads at a shell. A plain string is a step with no command. */
export const shellNext = (s) => (typeof s === 'string' ? s : step(s).map(partText).join(''));

/** Makes a function that returns a step or a string return text: the form bin/vawe prints. Null stays null. */
export const asText = (fn) => (...a) => { const s = fn(...a); return s === null || s === undefined ? s : shellNext(s); };
