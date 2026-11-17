// The one place that still reads a next step from text: what a bin/vawe child process printed (its `next:` line and its output)
// reaches the MCP server as a string, because the verb footer has no structured form until `bin/vawe` writes a result object.
// Everything the stage logic builds itself is a step and goes through toolNext. Delete this file with that result object.
import { SPECS as TOOL_SPECS, mapCommand, docTag, BUILD_TAG, uiSkillsCall } from './next-as-tools.mjs';

const COMMAND = /(?:\bVAWE_AGENT=\S+\s+)?(?<![\w/-])((?:bin\/)?)vawe[ \t]+([a-z][a-z0-9-]*)/g;
const TOKEN = /[ \t]+(<[^>]*>|"[^"]*"|[^\s,;:)]+)([,;:.)]?)/y;
const PLACEHOLDER = /^<[^>]*>$/;
const PAGE_WORD = /^(?:films\/|[^/\s]*\.html$)/;
const page = (t) => PAGE_WORD.test(t) || PLACEHOLDER.test(t);
const id = (t) => /^[A-Za-z0-9_-]{6,}$/.test(t);

const POSITIONAL = {
  frame: (t) => page(t) || id(t),
  dev: page,
  critique: page,
  ship: page,
  wait: page,
  refs: (t, n) => (n === 0 ? /^(?:list|frames|add|index)$/.test(t) : PLACEHOLDER.test(t) || id(t)),
  new: (t) => PLACEHOLDER.test(t) || /^[a-z0-9][\w-]*$/.test(t),
  other: (t) => page(t) || /^(?:log|add|list|links)$/.test(t),
};

const specOf = (verb, bin) => {
  const tool = TOOL_SPECS[verb];
  if (tool) return { pos: tool.pos, valueFlags: new Set(tool.valueFlags), positional: POSITIONAL[verb] };
  return bin === 'bin/' ? { pos: 2, valueFlags: new Set(['at', 'vs', 'out', 'type', 'title', 'from', 'to']), positional: POSITIONAL.other } : null;
};

/** The verb's positionals and flags, read from the text after `vawe <verb>`; `end` is where the command stops, so the words after it stay. */
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
    return `${whole} ${docTag(tool, film, file)}`;
  });
}

const UI_SKILLS = /(?:\bcommand\s+)?\bnpx\s+-y\s+ui-skills\s+(start|categories|list|get)\b(?:\s+--category\s+([a-z0-9-]+)|\s+([\w.-]+\/[\w.-]+))?/g;
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
    const spec = specOf(verb, m[1]);
    const after = m.index + m[0].length;
    const parsed = spec ? parseArgs(source, after, spec) : null;
    const replacement = parsed ? mapCommand(verb, parsed, film) : null;
    const end = parsed ? parsed.end : after;
    if (replacement) {
      out += source.slice(last, m.index) + replacement;
      last = end;
    } else if (spec) unmapped.push(source.slice(m.index, end).trim());
  }
  out += source.slice(last);
  return { text: tagDocs(out).replace(STATES, `$1$2 ${BUILD_TAG}`).replace(UI_SKILLS, (_w, action, category, slug) => uiSkillsCall(action, category, slug)), unmapped };
}

/** The `next` text of a child process for a tool-only agent. */
export const nextAsTools = (text, options) => translateNext(text, options).text;
