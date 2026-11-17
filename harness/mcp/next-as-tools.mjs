// A next step (harness/lib/next-step.mjs) names shell commands (bin/vawe ...) and film docs. The vawe agent has no shell and no
// file writer, so toolNext prints the step with each command as the tool call that does the same and each film doc tagged with
// the tool that writes it. The words around the command stay.
import { step, commandText } from '../lib/next-step.mjs';

const PAGE_WORD = /^(?:films\/|[^/\s]*\.html$)/;
const PLACEHOLDER = /^<[^>]*>$/;
const FILM_IN_PATH = /^films\/(examples\/)?([a-z0-9][\w-]*)\//;
const PAGE_PLACEHOLDERS = new Set(['<page>', '<draft>', '<page|mp4>', '<rel>', '<film>']);
const FLAG = /^--?[a-z][a-z-]*$/;

/** Per verb: how many positionals it takes and which flags take a value. */
export const SPECS = {
  frame: { pos: 1, valueFlags: ['world', 'moment', 'at', 'vs', 'out', 'from', 'to', 'aspect', 'box'] },
  dev: { pos: 1, valueFlags: ['from', 'to', 'aspect'] },
  critique: { pos: 1, valueFlags: [] },
  ship: { pos: 1, valueFlags: ['aspect'] },
  wait: { pos: 1, valueFlags: [] },
  refs: { pos: 2, valueFlags: ['type', 'title'] },
  new: { pos: 1, valueFlags: ['request', 'aspect', 'from-url', 'footage'] },
};

const call = (tool, args) => `${tool} ${JSON.stringify(args)}`;
const num = (v) => (/^\d+(?:\.\d+)?$/.test(v) ? Number(v) : v);
const isPage = (word) => word && (PAGE_WORD.test(word) || PAGE_PLACEHOLDERS.has(word));
const only = (flags, allowed) => Object.keys(flags).every((k) => allowed.includes(k));

function filmOf(page, film) {
  if (page && !isPage(page)) return null;
  const m = page ? FILM_IN_PATH.exec(page) : null;
  if (m?.[1]) return null;
  return m ? m[2] : (film ?? '<film>');
}

function frameCall(page, flags, film) {
  const f = filmOf(page, film);
  const modes = ['world', 'board', 'cuts', 'moment', 'directions', 'at'].filter((m) => flags[m]);
  if (f === null || modes.length !== 1 || ['vs', 'full', 'out', 'from', 'to', 'aspect', 'box'].some((k) => flags[k])) return null;
  const [mode] = modes;
  if (mode === 'world') return flags.world === 'all' ? call('vawe_frame', { film: f, mode: 'world' }) : null;
  if (mode === 'at') return flags.at === true ? null : call('vawe_look', { film: f, t: [num(flags.at)] });
  if (mode === 'moment') {
    if (flags.moment === true) return null;
    const note = flags.onion || flags.velocity ? ' (the onion and velocity views have no tool)' : '';
    return `${call('vawe_frame', { film: f, mode: 'moment', t: num(flags.moment) })}${note}`;
  }
  return call('vawe_frame', { film: f, mode });
}

const HANDLERS = {
  frame: ({ positionals: [page], flags }, film) => {
    if (flags.cuts && page && !isPage(page)) return call('vawe_refs', { action: 'cuts', id: page });
    return isPage(page) ? frameCall(page, flags, film) : null;
  },
  dev: ({ positionals: [page], flags }, film) => {
    const f = only(flags, ['from', 'to']) ? filmOf(page, film) : null;
    return f && call('vawe_render_draft', { film: f, ...(flags.from ? { from: num(flags.from) } : {}), ...(flags.to ? { to: num(flags.to) } : {}) });
  },
  critique: ({ positionals: [page], flags }, film) => {
    const f = only(flags, ['fresh']) ? filmOf(page, film) : null;
    return f && call('vawe_critique', { film: f });
  },
  wait: ({ positionals: [page], flags }, film) => {
    const f = only(flags, []) ? filmOf(page, film) : null;
    return f && call('vawe_wait', { film: f });
  },
  ship: ({ positionals: [page], flags }, film) => {
    const f = only(flags, []) ? filmOf(page, film) : null;
    return f && call('vawe_ship', { film: f });
  },
  refs: ({ positionals: [action, id], flags }) => (['list', 'frames'].includes(action) && only(flags, []) ? call('vawe_refs', { action, ...(id ? { id } : {}) }) : null),
  new: ({ positionals: [name], flags }) => (name && only(flags, ['request', 'defaults']) ? call('vawe_new_film', { name, ...(flags.request ? { request: flags.request } : {}) }) : null),
};

/** The tool call for a parsed command ({ positionals, flags }), or null when no tool does it. */
export const mapCommand = (verb, parsed, film) => HANDLERS[verb]?.(parsed, film) || null;

/** The tag after a film doc: the tool that writes it. */
export const docTag = (tool, film, file) => `(${tool} {"film":"${film}","file":"${file === 'kit/' ? 'kit/<path>' : file}"})`;

export const BUILD_TAG = '(vawe_write_page, then vawe_edit_page)';

export const uiSkillsCall = (action, category, slug) => call('vawe_ui_skills', { action, ...(category ? { category } : {}), ...(slug ? { slug } : {}) });

/** { positionals, flags } of the argv tokens of a command; null when it has more positionals than the verb takes. */
function parseTokens(args, { pos, valueFlags }) {
  const positionals = [];
  const flags = {};
  for (let i = 0; i < args.length; i += 1) {
    const flag = FLAG.test(args[i]) ? args[i].replace(/^-+/, '') : null;
    if (!flag) positionals.push(args[i]);
    else if (valueFlags.includes(flag) && args[i + 1] !== undefined && !args[i + 1].startsWith('--')) { flags[flag] = args[i + 1].replace(/^"|"$/g, ''); i += 1; } else flags[flag] = true;
  }
  return positionals.length > pos ? null : { positionals, flags };
}

function commandTool(c, film) {
  if (c.bin === 'command npx -y ui-skills') {
    const [category, slug] = [c.args[c.args.indexOf('--category') + 1], c.args.find((a) => /^[\w.-]+\/[\w.-]+$/.test(a))];
    return uiSkillsCall(c.verb, c.args.includes('--category') ? category : undefined, slug);
  }
  const spec = c.bin === 'bin/vawe' || c.bin === 'vawe' ? SPECS[c.verb] : null;
  const parsed = spec && parseTokens(c.args, spec);
  return (parsed && mapCommand(c.verb, parsed, film)) || commandText(c);
}

/**
 * The text of a next step for an agent with tools and no shell: each command a tool call, each film doc the agent writes tagged with
 * its tool after its first mention, the page to build tagged with the page tools. `film` fills a <page> placeholder.
 */
export function toolNext(next, film = null) {
  const seen = new Set();
  return step(next ?? '').map((p) => {
    if (typeof p === 'string') return p;
    if (p.verb !== undefined) return commandTool(p, film);
    if (p.build !== undefined) return `${p.build} ${BUILD_TAG}`;
    const key = `${p.film}/${p.file}`;
    if (p.mode === 'read' || seen.has(key)) return p.doc;
    seen.add(key);
    return `${p.doc} ${docTag(p.mode === 'write' ? 'vawe_write_doc' : 'vawe_edit_doc', p.film, p.file)}`;
  }).join('');
}
