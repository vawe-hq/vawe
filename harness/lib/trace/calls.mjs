import { VERBS } from '../../cli/verbs.mjs';
import { ALIASES } from '../../cli/aliases.mjs';
import { RULES } from '../../live/verb-hint.mjs';
import { PS_WAIT, SLEEP, atCommand, bare, withoutHeredocs } from '../shell-match.mjs';

const VERB_NAMES = new Set([...VERBS.map((v) => v.name), ...Object.keys(ALIASES)]);
const HELP = /(?:^|\s)(?:--help|-h)(?:\s|$)/;
const SEGMENT = /&&|\|\||;|\n|\|/;
const VERB_CALL = /^\s*(?:[A-Z_][A-Z0-9_]*=\S*\s+)*(?:(?:node|rtk)\s+)?(?:\S*\/)?vawe\s+([a-z0-9-]+)(.*)$/;
const FOOTER = /^vawe: ([a-z0-9-]+) (ok|FAILED)(?: \((.*)\))? in ([\d.]+)s$/gm;
const NEXT_LINE = /^next: (.*)$/gm;
const READER = /\b(cat|head|tail|sed|grep|rg|awk|less|bat)\b/;
const DOC = /(?:^|[\s'"=/])(AGENTS\.md|taste\/build\/DIGEST\.md|taste\/rules\/[\w.-]+\.md|taste\/craft\/[\w.-]+\.md|guides\/[\w.-]+\.md|skills\/[\w-]+\/SKILL\.md|prompts\/moves\/[\w.-]+\.md)/g;
const FILM_FILE = /films\/([a-z0-9][\w-]*)\/(page\.html|brief\.md|DESIGN\.md|kit\/)/;
const FILM_FILES = /films\/([a-z0-9][\w-]*)\/(page\.html|brief\.md|DESIGN\.md|kit\/)/g;
const SHELL_WRITE = /(?:>>?|\btee\b(?: -a)?|\bcp\b|\bmv\b|\bsed -i\b)[^\n|;&<]*?(films\/[a-z0-9][\w-]*\/(?:page\.html|brief\.md|DESIGN\.md|kit\/))/g;
const WRITE_KIND = { 'page.html': 'page', 'brief.md': 'brief', 'DESIGN.md': 'design', 'kit/': 'kit' };
const PYTHON = /\bpython3?\b/;
const PY_PATH_VAR = /\b(\w+)\s*=\s*(['"])(films\/[^'"]+)\2/g;
const PY_WRITE_TARGET = /open\(\s*(?:(['"])(films\/[^'"]+)\1|(\w+))\s*,\s*['"][wa]b?['"]|(?:Path\(\s*(['"])(films\/[^'"]+)\4\s*\)|\b(\w+))\.write_text\(/g;
const PY_EDIT = /\.replace\(|open\([^)]*['"][wa]b?['"]|\.write_text\(/;

const PY_AT_COMMAND = atCommand('python3?', '\\b');
const NODE_EVAL = atCommand('node', '\\s+(?:-e|--eval|-p)\\b');

const HAND_TOOLS = {
  pyEdit: (cmd) => PYTHON.test(cmd) && PY_EDIT.test(cmd),
  pyEditNoAssert: (cmd) => PYTHON.test(cmd) && PY_EDIT.test(cmd) && !/\bassert\b/.test(cmd),
  pil: (cmd) => PY_AT_COMMAND.test(bare(cmd)) && /\b(?:PIL|numpy|cv2)\b/.test(cmd),
  nodeEval: (cmd) => NODE_EVAL.test(bare(cmd)),
  sedInPlace: (cmd) => /\bsed\s+(?:-[a-zA-Z]*i|--in-place)/.test(withoutHeredocs(cmd)),
  pkill: (cmd) => /\b(?:pkill|killall)\b|\bkill\s+-9\b|\bxargs\s+kill\b/.test(withoutHeredocs(cmd)),
};

export const RAW_TOOLS = {
  ffmpeg: atCommand('ffmpeg'),
  ffprobe: atCommand('ffprobe'),
  browser: /puppeteer|playwright|--headless|--screenshot/i,
  sleep: SLEEP,
  psPoll: PS_WAIT,
  curl: atCommand('curl', '\\b'),
};

export const BLOCKED = /^[✗!]? ?pre-(?:commit|push) blocked|hook (?:error|blocked)|blocked by (?:a |the )?hook|too complex to verify|Refusing to run|^make: \*\*\* \[[a-z-]+\] Error/im;
const BAN_LINES = {
  noTells: /No tells unless the brief asks|stock device \(sheen band/,
  attractors: /not an attractor|attractor list|Attractors:/i,
  slideshow: /slideshow/i,
  digest: /Taste digest/,
};

/** The text of a tool_result content, string or block list. */
export const textOf = (content) => (typeof content === 'string' ? content
  : Array.isArray(content) ? content.map((c) => c.text ?? '').join('\n') : '');

/** The vawe verbs a shell command calls, in order, as { verb, args }. Pure. */
export function commandVerbs(cmd) {
  const found = [];
  const script = withoutHeredocs(cmd);
  if (/^\s*(?:git|gh)\s/.test(script)) return found;
  for (const segment of script.split(SEGMENT)) {
    const m = segment.match(VERB_CALL);
    if (m && VERB_NAMES.has(m[1])) found.push({ verb: m[1], args: m[2].trim(), help: HELP.test(m[2]) });
  }
  return found;
}

/** The raw tools a command uses: every verb-hint rule that matches, the hand-rolled edit tools always, and the raw extras when the command calls no vawe verb. Pure. */
export function rawTools(cmd, hasVerb) {
  const ids = RULES.filter((r) => r.test.test(cmd)).map((r) => `hint:${r.id}`);
  if (!hasVerb) ids.push(...Object.entries(RAW_TOOLS).filter(([, re]) => re.test(re.raw ? cmd : bare(cmd))).map(([id]) => id));
  ids.push(...Object.entries(HAND_TOOLS).filter(([, test]) => test(cmd)).map(([id]) => id));
  return ids;
}

/** The footer lines of a verb result: { verb, ok, reason, secs }. Pure. */
export function footersOf(text) {
  return [...text.matchAll(FOOTER)].map((m) => ({ verb: m[1], ok: m[2] === 'ok', reason: m[3] ?? null, secs: Number(m[4]) }));
}

/** The verbs named by each `next:` line of a verb result, as arrays of verb names. Pure. */
export function nextNamed(text) {
  return [...text.matchAll(NEXT_LINE)].map((m) => namedVerbs(m[1]));
}

/** The vawe verbs a line of advice names, in order. Pure. */
export const namedVerbs = (line) => [...String(line).matchAll(/vawe ([a-z0-9-]+)/g)].map((m) => m[1]).filter((v) => VERB_NAMES.has(v));

/** The taste and guide docs a call reads, as keys like taste/build/DIGEST.md. Pure. */
export function docsRead(name, input = {}) {
  if (name === 'Skill' && input.skill) return [`skills/${input.skill}/SKILL.md`];
  const target = name === 'Read' ? String(input.file_path ?? '')
    : name === 'Bash' && READER.test(input.command ?? '') ? String(input.command) : '';
  return [...new Set([...target.matchAll(DOC)].map((m) => m[1]))];
}

const writtenText = (input) => String(input.content ?? input.new_string ?? '') + (input.edits ?? []).map((e) => e.new_string ?? '').join('\n');

/** The film files a call writes, as { film, what, text }: what is page, brief, design or kit. Pure. */
export function filmWrites(name, input = {}) {
  if (['Write', 'Edit', 'MultiEdit'].includes(name)) {
    const m = String(input.file_path ?? '').match(FILM_FILE);
    return m ? [{ film: m[1], what: WRITE_KIND[m[2]], text: writtenText(input) }] : [];
  }
  return name === 'Bash' ? shellWrites(String(input.command ?? '')) : [];
}

function pythonWrites(cmd) {
  const assigned = [...cmd.matchAll(PY_PATH_VAR)].map((m) => ({ at: m.index, name: m[1], path: m[3] }));
  const resolve = (name, at) => assigned.filter((a) => a.name === name && a.at < at).at(-1)?.path;
  return [...cmd.matchAll(PY_WRITE_TARGET)].map((m) => m[2] ?? m[5] ?? resolve(m[3] ?? m[6], m.index)).filter(Boolean);
}

function shellWrites(cmd) {
  const script = withoutHeredocs(cmd);
  const targets = [...script.matchAll(SHELL_WRITE)].map((m) => m[1]);
  if (PYTHON.test(cmd)) targets.push(...pythonWrites(cmd));
  const seen = new Map();
  for (const target of targets) {
    const m = target.match(FILM_FILE);
    if (m) seen.set(`${m[1]}/${m[2]}`, { film: m[1], what: WRITE_KIND[m[2]], text: cmd });
  }
  return [...seen.values()];
}

/** The film a `vawe new` call starts, or null. Pure. */
export const newFilm = (verbs) => verbs.find((v) => v.verb === 'new' && !v.help)?.args.split(/\s+/).find((a) => /^[a-z0-9][\w-]*$/.test(a)) ?? null;

/** What a result says about the call: flags for each failure class and each ban line. Pure. */
export function resultFlags(text, isError) {
  const exitFail = isError === true || /^Exit code [1-9]/m.test(text);
  return {
    exitFail,
    hook: BLOCKED.test(text),
    glob: /(?:zsh|eval)[^\n]*no matches found:/.test(text),
    notFound: /command not found/.test(text),
    testFail: /^# fail [1-9]|^not ok /m.test(text),
    noApproval: /no approval for /.test(text),
    ban: Object.keys(BAN_LINES).filter((k) => BAN_LINES[k].test(text)),
  };
}

const RULE_LINE = /^\s*page: rule ([\w-]+)[^\n]*$/gm;
const ADVICE_LINE = /^advice: ([^:;\n]+)/gm;
const ALLOW_BLOCK = /"allow"\s*:\s*\[([^\]]*)\]/g;

/** The rule ids and advice keys one dev result prints, or null when the text is no dev plan. A rule line may name a waiver token. Pure. */
export function adviceOf(text) {
  if (!/^plan of /m.test(text)) return null;
  const rules = [...text.matchAll(RULE_LINE)].map((m) => ({ id: m[1], token: m[0].match(/"allow": \["([\w-]+)/)?.[1] ?? null }));
  const advice = [...text.matchAll(ADVICE_LINE)].map((m) => m[1].trim().slice(0, 50));
  return { rules, advice };
}

/** The entries of the authoring allow block in a page text (rule ids, some with an @window), or null when it has no block. Pure. */
export function allowOf(text) {
  const blocks = [...String(text).matchAll(ALLOW_BLOCK)];
  return blocks.length ? blocks.flatMap((m) => [...m[1].matchAll(/"([\w-]+(?:@[^"]*)?)"/g)].map((x) => x[1])) : null;
}
