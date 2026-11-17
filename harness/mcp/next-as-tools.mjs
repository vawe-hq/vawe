// The `next` text of the stage logic names shell commands (bin/vawe ...) and film files. The vawe agent has no shell and no file
// writer, so the MCP server swaps each command for the tool call that does the same, and tags each film doc with the tool that writes
// it. The wording around the command stays; stage-say's own output (the Claude Code hooks, the shell path) is not touched.

const COMMAND = /(?:\bVAWE_AGENT=\S+\s+)?(?<![\w/-])((?:bin\/)?)vawe[ \t]+([a-z][a-z0-9-]*)/g;
const TOKEN = /[ \t]+(<[^>]*>|"[^"]*"|[^\s,;:)]+)([,;:.)]?)/y;
const PLACEHOLDER = /^<[^>]*>$/;
const PAGE_WORD = /^(?:films\/|[^/\s]*\.html$)/;
const FILM_IN_PATH = /^films\/(examples\/)?([a-z0-9][\w-]*)\//;
const PAGE_PLACEHOLDERS = new Set(['<page>', '<draft>', '<page|mp4>', '<rel>', '<film>']);

const SPECS = {
  frame: { pos: 1, valueFlags: new Set(['world', 'moment', 'at', 'vs', 'out', 'from', 'to', 'aspect']), positional: (t) => PAGE_WORD.test(t) || PLACEHOLDER.test(t) || /^[A-Za-z0-9_-]{6,}$/.test(t) },
  dev: { pos: 1, valueFlags: new Set(['from', 'to', 'aspect']), positional: (t) => PAGE_WORD.test(t) || PLACEHOLDER.test(t) },
  critique: { pos: 1, valueFlags: new Set(), positional: (t) => PAGE_WORD.test(t) || PLACEHOLDER.test(t) },
  ship: { pos: 1, valueFlags: new Set(['aspect']), positional: (t) => PAGE_WORD.test(t) || PLACEHOLDER.test(t) },
  wait: { pos: 1, valueFlags: new Set(), positional: (t) => PAGE_WORD.test(t) || PLACEHOLDER.test(t) },
  refs: { pos: 2, valueFlags: new Set(['type', 'title']), positional: (t, n) => (n === 0 ? /^(?:list|frames|add|index)$/.test(t) : PLACEHOLDER.test(t) || /^[A-Za-z0-9_-]{6,}$/.test(t)) },
  other: { pos: 2, valueFlags: new Set(['at', 'vs', 'out', 'type', 'title', 'from', 'to']), positional: (t) => PAGE_WORD.test(t) || PLACEHOLDER.test(t) || /^(?:log|add|list|links)$/.test(t) },
  new: { pos: 1, valueFlags: new Set(['request', 'aspect', 'from-url', 'footage']), positional: (t) => PLACEHOLDER.test(t) || /^[a-z0-9][\w-]*$/.test(t) },
};

/** The verb, its positionals and its flags, read from the text after `vawe <verb>`; `end` is where the command stops, so the words after it stay. */
function parseArgs(text, from, spec) {
  const positionals = [];
  const flags = {};
  let end = from;
  TOKEN.lastIndex = from;
  for (let m = TOKEN.exec(text); m; TOKEN.lastIndex = end, m = TOKEN.exec(text)) {
    const [whole, token, stop] = m;
    const flag = /^--?[a-z][a-z-]*$/.exec(token) ? token.replace(/^-+/, '') : null;
    if (flag) {
      end = m.index + whole.length - stop.length;
      if (spec.valueFlags.has(flag)) {
        TOKEN.lastIndex = end;
        const value = TOKEN.exec(text);
        if (value && !value[1].startsWith('--')) { flags[flag] = value[1].replace(/^"|"$/g, ''); end = value.index + value[0].length - value[2].length; } else flags[flag] = true;
      } else flags[flag] = true;
    } else if (positionals.length < spec.pos && spec.positional(token, positionals.length)) {
      positionals.push(token);
      end = m.index + whole.length - stop.length;
    } else break;
    if (stop && text.slice(end, end + 1) === stop) break;
  }
  return { positionals, flags, end };
}

const call = (tool, args) => `${tool} ${JSON.stringify(args)}`;
const num = (v) => (/^\d+(?:\.\d+)?$/.test(v) ? Number(v) : v);

const isPage = (word) => word && (PAGE_WORD.test(word) || PAGE_PLACEHOLDERS.has(word));

function filmOf(page, film) {
  if (page && !isPage(page)) return null;
  const m = page ? FILM_IN_PATH.exec(page) : null;
  if (m?.[1]) return null;
  return m ? m[2] : (film ?? '<film>');
}


function frameCall(page, flags, film) {
  const f = filmOf(page, film);
  const modes = ['world', 'board', 'cuts', 'moment', 'directions', 'at'].filter((m) => flags[m]);
  if (f === null || modes.length !== 1 || ['vs', 'full', 'out', 'from', 'to', 'aspect'].some((k) => flags[k])) return null;
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

const only = (flags, allowed) => Object.keys(flags).every((k) => allowed.includes(k));

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

const DOC = /films\/([a-z0-9][\w-]*)\/(brief\.md|DESIGN\.md|kit\/)/g;

/** Adds the tool that writes a film doc after its first mention: vawe_write_doc after "write" or "create", vawe_edit_doc otherwise; a doc the agent only reads (after "Read") is left alone. */
function tagDocs(text) {
  const seen = new Set();
  return text.replace(DOC, (whole, film, file, at) => {
    const before = text.slice(Math.max(0, at - 12), at);
    const key = `${film}/${file}`;
    if (seen.has(key) || /Read\s+$/.test(before)) return whole;
    seen.add(key);
    const tool = /\b(?:write|create)\b[^;:]*$/i.test(text.slice(Math.max(0, at - 80), at)) ? 'vawe_write_doc' : 'vawe_edit_doc';
    return `${whole} (${tool} {"film":"${film}","file":"${file === 'kit/' ? 'kit/<path>' : file}"})`;
  });
}

const UI_SKILLS = /(?:\bcommand\s+)?\bnpx\s+-y\s+ui-skills\s+(start|categories|list|get)\b(?:\s+--category\s+([a-z0-9-]+)|\s+([\w.-]+\/[\w.-]+))?/g;

const uiSkillsCall = (_whole, action, category, slug) => call('vawe_ui_skills', { action, ...(category ? { category } : {}), ...(slug ? { slug } : {}) });

const STATES = /(build one static state per world in )(films\/[a-z0-9][\w-]*\/page\.html)/;

/**
 * `text` with each bin/vawe command replaced by the tool call that does it and each film doc tagged with its writer tool.
 * `film` fills a <page> placeholder. Returns { text, unmapped }: unmapped lists the commands no tool does, left as written.
 */
export function translateNext(text, { film = null } = {}) {
  const unmapped = [];
  let out = '';
  let last = 0;
  const source = String(text ?? '');
  for (const m of source.matchAll(COMMAND)) {
    if (m.index < last) continue;
    const verb = m[2];
    const spec = SPECS[verb] ?? (m[1] === 'bin/' ? SPECS.other : null);
    const start = m.index;
    const after = m.index + m[0].length;
    const parsed = spec ? parseArgs(source, after, spec) : null;
    const replacement = parsed && HANDLERS[verb] ? HANDLERS[verb](parsed, film) || null : null;
    const end = parsed ? parsed.end : after;
    if (replacement) {
      out += source.slice(last, start) + replacement;
      last = end;
    } else if (spec) unmapped.push(source.slice(start, end).trim());
  }
  out += source.slice(last);
  return { text: tagDocs(out).replace(STATES, '$1$2 (vawe_write_page, then vawe_edit_page)').replace(UI_SKILLS, uiSkillsCall), unmapped };
}

/** The `next` text for a tool-only agent. */
export const nextAsTools = (text, options) => translateNext(text, options).text;
