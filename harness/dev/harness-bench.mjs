#!/usr/bin/env node
// How well an agent follows the harness on its first draft: one headless session per fixed prompt, counted from
// the files vawe already writes. `node harness/dev/harness-bench.mjs --help` lists the flags.
import fs from 'node:fs';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { foldRows } from '../lib/trace/fold.mjs';
import { verbEvents } from '../lib/trace/verbs.mjs';
import { stageFirstUse, stageOrder } from '../lib/trace/stages.mjs';
import { readRuns, runsDir } from '../lib/runlog.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const BASELINE = path.join(ROOT, 'quality/baselines/harness-bench.json');
export const PROMPTS = path.join(ROOT, 'harness/dev/harness-bench-prompts.json');

const SESSION_LIMIT_MS = 30 * 60 * 1000;
const BEFORE_FIRST_DRAFT = ['new', 'study', 'design', 'page', 'frames', 'ideas', 'storyboard'];
const RAW_MEDIA = new Set(['ffmpeg', 'ffprobe', 'browser']);
const FILM_WRITERS = new Set(['Write', 'Edit', 'MultiEdit', 'Bash']);
const ACCEPTANCE_LINE = /(\d+) of (\d+) measured green/;
const isFirstDraftVerb = (e) => e.verb === 'dev' && !e.help && e.ok && !/--(studio|animatic)\b/.test(e.args);

/** The rows of a `claude -p --output-format stream-json` log. A row without a timestamp gets one second per row after `startMs`, so a recorded stream folds the same way twice. */
export function parseStream(text, startMs = 0) {
  return text.split('\n').filter(Boolean)
    .map((l) => { try { return JSON.parse(l); } catch { return null; } })
    .filter(Boolean)
    .map((row, i) => (row.timestamp ? row : { ...row, timestamp: new Date(startMs + i * 1000).toISOString() }));
}

/** The green and measured counts of a dev report: its "N of M measured green" line, else its Acceptance table (ok rows over the measured ones), else null. */
export function acceptanceOf(devMd) {
  const line = ACCEPTANCE_LINE.exec(devMd ?? '');
  if (line) return { green: Number(line[1]), measured: Number(line[2]) };
  const rows = String(devMd ?? '').split('\n').filter((l) => /^\| (ok|advice|red|fail|not measured) \|/.test(l)).map((l) => l.split('|')[1].trim());
  const measured = rows.filter((s) => s !== 'not measured');
  return rows.length ? { green: measured.filter((s) => s === 'ok').length, measured: measured.length } : null;
}

const linesOf = (devMd, re) => String(devMd ?? '').split('\n').filter((l) => re.test(l));

const MCP_TOOL = /^mcp__(?:plugin_vawe-agent_)?vawe__(vawe_[a-z_]+)$/;
const VERB_OF_TOOL = { vawe_new_film: 'new', vawe_render_draft: 'dev', vawe_frame: 'frame', vawe_look: 'frame', vawe_critique: 'critique', vawe_ship: 'ship', vawe_wait: 'wait', vawe_refs: 'refs' };
const FRAME_FLAGS = { world: () => '--world all', board: () => '--board', cuts: () => '--cuts', moment: (t) => `--moment ${t}`, directions: () => '--directions' };

/** The shell-shaped call a vawe MCP tool stands for, or null for a tool that stands for no stage (status, read_rules): the trace analysers then count the plugin like the shell path. */
export function mcpCall(tool, input = {}) {
  const page = `films/${input.film}/page.html`;
  const doc = `films/${input.film}/${input.file}`;
  const bash = (command) => ({ name: 'Bash', input: { command }, verb: VERB_OF_TOOL[tool] });
  switch (tool) {
    case 'vawe_new_film': return bash(`bin/vawe new ${input.name} --request "${input.request ?? ''}"`);
    case 'vawe_render_draft': return bash(`bin/vawe dev ${page}${input.from !== undefined ? ` --from ${input.from}` : ''}${input.to !== undefined ? ` --to ${input.to}` : ''}`);
    case 'vawe_frame': return bash(`bin/vawe frame ${page} ${(FRAME_FLAGS[input.mode] ?? (() => ''))(input.t)}`.trim());
    case 'vawe_look': return bash(`bin/vawe frame ${page} --at ${[].concat(input.t ?? 0)[0]}`);
    case 'vawe_critique': return bash(`bin/vawe critique ${page} --fresh`);
    case 'vawe_ship': return bash(`bin/vawe ship ${page}`);
    case 'vawe_wait': return bash(`bin/vawe wait ${page}`);
    case 'vawe_refs': return bash(`bin/vawe refs ${input.action}${input.id ? ` ${input.id}` : ''}`);
    case 'vawe_write_page': return { name: 'Write', input: { file_path: page, content: input.html } };
    case 'vawe_edit_page': return { name: 'Edit', input: { file_path: page, old_string: input.old, new_string: input.new } };
    case 'vawe_write_doc': return { name: 'Write', input: { file_path: doc, content: input.text } };
    case 'vawe_edit_doc': return { name: 'Edit', input: { file_path: doc, old_string: input.old, new_string: input.new } };
    default: return null;
  }
}

const resultText = (content) => (typeof content === 'string' ? content : [].concat(content ?? []).find((c) => c.type === 'text')?.text ?? '');

/** What the verb printed, as far as the folder reads it: its footer line, from the tool's { ok, findings } reply. */
function footerOf(verb, content) {
  let reply = null;
  try { reply = JSON.parse(resultText(content)); } catch { /* an error text: the verb did not succeed */ }
  if (reply?.ok === true) return `vawe: ${verb} ok in 1.0s`;
  return `vawe: ${verb} FAILED (${String(reply?.findings?.[0]?.message ?? resultText(content).slice(0, 80)).replace(/\s+/g, ' ')}) in 1.0s`;
}

/**
 * Rewrites the calls of the vawe MCP tools, in the main agent and in a subagent (a row with parent_tool_use_id), into the shell or
 * file calls they stand for, so one fold counts both setups. Returns { rows, mcpIds }: mcpIds are the tool_use ids rewritten, which
 * are not raw film writes. A verb tool's result becomes the footer the verb would print.
 */
export function mcpRows(rows) {
  const mapped = new Map();
  const mcpIds = new Set();
  const out = rows.map((row) => {
    const content = row.message?.content;
    if (!Array.isArray(content)) return row;
    const next = content.map((block) => {
      if (block.type === 'tool_use') {
        const tool = MCP_TOOL.exec(block.name)?.[1];
        const call = tool && mcpCall(tool, block.input);
        if (!call) return block;
        mapped.set(block.id, call.verb ?? null);
        mcpIds.add(block.id);
        return { ...block, name: call.name, input: call.input };
      }
      if (block.type === 'tool_result' && mapped.get(block.tool_use_id)) return { ...block, content: footerOf(mapped.get(block.tool_use_id), block.content) };
      return block;
    });
    return { ...row, message: { ...row.message, content: next } };
  });
  return { rows: out, mcpIds };
}

/** Per-model totals of the whole session, subagents included: the result row's modelUsage (older streams: model_usage_since_last_result). Its usage field and the streamed assistant rows are not used: usage is the main thread only, and a streamed row holds a partial output_tokens (3 to 46). */
function modelTotals(result) {
  const models = Object.values(result?.modelUsage ?? result?.model_usage_since_last_result ?? {});
  if (!models.length) return null;
  const sum = (key) => models.reduce((n, m) => n + (m[key] ?? 0), 0);
  return { input_tokens: sum('inputTokens'), output_tokens: sum('outputTokens'), cache_read_input_tokens: sum('cacheReadInputTokens'), cache_creation_input_tokens: sum('cacheCreationInputTokens') };
}

/** Tokens, cost, turns and wall time of the session, read from the result row. */
function tokensOf(rows) {
  const result = rows.findLast((r) => r.type === 'result');
  const usage = modelTotals(result) ?? result?.usage ?? {};
  const wallS = result?.duration_ms != null ? result.duration_ms / 1000 : (Date.parse(rows.at(-1)?.timestamp) - Date.parse(rows[0]?.timestamp)) / 1000 || 0;
  return {
    input: usage.input_tokens ?? 0, output: usage.output_tokens ?? 0,
    cacheRead: usage.cache_read_input_tokens ?? 0, cacheWrite: usage.cache_creation_input_tokens ?? 0,
    wallS: Math.round(wallS * 10) / 10, turns: result?.num_turns ?? null, costUsd: result?.total_cost_usd ?? null,
  };
}

/** The loop stages before the first draft that no call reached: the transcript's calls and the run log's verb rows both count. */
function skippedBefore(calls, cutIndex, runs, startMs) {
  const first = stageFirstUse(calls.filter((c) => c.index <= cutIndex), [], startMs);
  const firstDev = runs.findIndex((r) => r.cmd === 'dev' && !r.failed);
  for (const r of runs.slice(0, firstDev < 0 ? runs.length : firstDev)) {
    if (r.cmd === 'verb' && r.exitCode === 0 && r.stage) first[r.stage] ??= 0;
  }
  const { skipped, inversions } = stageOrder(first);
  return { skipped: skipped.filter((s) => BEFORE_FIRST_DRAFT.includes(s)), inversions, reached: Object.keys(first) };
}

/** The counts of one first draft. `rows` is the stream, `runs` the film's out/<film>.runs.jsonl records, `devMd` its out/<film>.dev.md or null. */
export async function countFirstDraft({ rows: streamRows, runs = [], devMd = null }) {
  const { rows, mcpIds } = mcpRows(streamRows);
  const fold = await foldRows(rows);
  const startMs = fold.meta.startMs ?? 0;
  const events = verbEvents(fold.calls, startMs, runs.filter((r) => r.cmd === 'verb'));
  const draft = events.find(isFirstDraftVerb);
  const cutIndex = draft ? draft.call : Infinity;
  const calls = fold.calls.filter((c) => c.index <= cutIndex);
  const { skipped, inversions, reached } = skippedBefore(fold.calls, cutIndex, runs, startMs);

  const firstGood = runs.findIndex((r) => r.cmd === 'dev' && !r.failed);
  const failedDrafts = runs.slice(0, firstGood < 0 ? runs.length : firstGood).filter((r) => r.cmd === 'dev' && r.failed).length;
  const refusals = runs.filter((r) => r.cmd === 'verb' && r.refused).length;
  const errorLines = linesOf(devMd, /^error: /).length;
  const devRun = runs.findLast((r) => r.cmd === 'dev' && !r.failed);
  const filmWrites = calls.filter((c) => FILM_WRITERS.has(c.name) && !mcpIds.has(c.id)).flatMap((c) => c.writes.map((w) => `${c.name}:${w.film}/${w.what}`));

  return {
    draft: Boolean(draft),
    contractFindings: failedDrafts + refusals + errorLines,
    contractDetail: { failedDrafts, refusals, errorLines },
    stagesSkipped: skipped.length, skippedStages: skipped, stagesReached: reached.map((s) => (s === 'dev' ? 'draft' : s)), inversions,
    advice: linesOf(devMd, /^advice: (?!\(advice only)/).length,
    rulesFired: Array.isArray(devRun?.rules_fired) ? devRun.rules_fired.length : null,
    acceptance: acceptanceOf(devMd) ?? devRun?.acceptance ?? null,
    rawFilmWrites: filmWrites.length, rawFilmWriteList: filmWrites,
    rawMedia: calls.flatMap((c) => c.raw.filter((id) => RAW_MEDIA.has(id))).length,
    verbCalls: events.filter((e) => !e.help && e.call <= cutIndex).length,
    toolCalls: calls.length,
    ...tokensOf(rows),
  };
}

export const loadPrompts = (file = PROMPTS) => JSON.parse(fs.readFileSync(file, 'utf8'));

export const filmNameFor = (prompt, stamp = Date.now()) => `bench-${prompt.id}-${stamp.toString(36)}`;

export const agentPrompt = (prompt, film) => `Make this film with vawe, in a film called ${film}: ${prompt.request} Stop after the first draft.`;

/** The `claude` argv of one session. The plugin variant adds the plugin folder (--plugin-dir) or the MCP config (--mcp-config). */
export function claudeArgs({ prompt, film, variant, plugin, mcpConfig, model }) {
  const allowed = ['Bash', 'Read', 'Write', 'Edit', 'MultiEdit', 'Glob', 'Grep', 'Skill', 'Agent'];
  if (variant === 'plugin') {
    if (!plugin && !mcpConfig) throw new Error('--variant plugin needs --plugin <dir> or --mcp-config <file>');
    // A headless session denies an MCP tool that --allowedTools does not name; a plugin server's tools are mcp__plugin_<plugin>_<server>__*.
    allowed.push(plugin ? 'mcp__plugin_vawe-agent_vawe' : 'mcp__vawe');
  }
  const args = ['-p', agentPrompt(prompt, film), '--output-format', 'stream-json', '--verbose',
    '--permission-mode', 'acceptEdits', '--allowedTools', allowed.join(',')];
  if (model) args.push('--model', model);
  if (plugin && variant === 'plugin') args.push('--plugin-dir', plugin);
  if (mcpConfig && variant === 'plugin') args.push('--mcp-config', mcpConfig);
  return args;
}

function runClaude(args, { cwd, env }) {
  return new Promise((resolve, reject) => {
    const child = spawn('claude', args, { cwd, env, stdio: ['ignore', 'pipe', 'inherit'] });
    let out = '';
    const timer = setTimeout(() => child.kill('SIGTERM'), SESSION_LIMIT_MS);
    child.stdout.on('data', (d) => { out += d; });
    child.on('error', reject);
    child.on('close', () => { clearTimeout(timer); resolve(out); });
  });
}

const readIf = (file) => { try { return fs.readFileSync(file, 'utf8'); } catch { return null; } };

/** One session, alone, in a fresh film name; its stream is kept at out/<film>.bench-stream.jsonl. */
export async function runOne(prompt, { variant, plugin, mcpConfig, model, root = ROOT }) {
  const film = filmNameFor(prompt);
  const startMs = Date.now();
  const env = { ...process.env, VAWE_AGENT: film, VAWE_MODEL: model ?? process.env.VAWE_MODEL ?? '' };
  const text = await runClaude(claudeArgs({ prompt, film, variant, plugin, mcpConfig, model }), { cwd: root, env });
  fs.mkdirSync(path.join(root, 'out'), { recursive: true });
  fs.writeFileSync(path.join(root, 'out', `${film}.bench-stream.jsonl`), text);
  const counts = await countFirstDraft({
    rows: parseStream(text, startMs), runs: readRuns(film, root), devMd: readIf(path.join(runsDir(root), `${film}.dev.md`)),
  });
  return { prompt: prompt.id, film, ...counts };
}

const COUNTS = [
  ['first draft made', (r) => (r.draft ? 1 : 0)],
  ['contract findings', (r) => r.contractFindings],
  ['stages skipped', (r) => r.stagesSkipped],
  ['advice findings', (r) => r.advice],
  ['rules fired', (r) => r.rulesFired],
  ['acceptance green', (r) => r.acceptance?.green ?? null],
  ['acceptance measured', (r) => r.acceptance?.measured ?? null],
  ['raw film writes', (r) => r.rawFilmWrites],
  ['raw ffmpeg or chrome', (r) => r.rawMedia],
  ['vawe verb calls', (r) => r.verbCalls],
  ['tool calls', (r) => r.toolCalls],
  ['output tokens', (r) => r.output],
  ['cost USD', (r) => (r.costUsd == null ? null : Math.round(r.costUsd * 1000) / 1000)],
  ['turns', (r) => r.turns],
  ['wall seconds', (r) => r.wallS],
];

/** The mean of each count over the runs; null when no run has it. */
export function summarise(runs) {
  return Object.fromEntries(COUNTS.map(([name, get]) => {
    const v = runs.map(get).filter((x) => x != null);
    return [name, v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null];
  }));
}

export function readBaseline(file = BASELINE) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return {}; }
}

/** Adds one result under baseline[variant][commit]; the same commit again replaces its entry. */
export function record(baseline, { variant, commit, runs, at }) {
  return { ...baseline, [variant]: { ...(baseline[variant] ?? {}), [commit]: { at, summary: summarise(runs), runs } } };
}

const latest = (entries) => Object.entries(entries ?? {}).sort((a, b) => String(a[1].at).localeCompare(String(b[1].at))).at(-1);

/** Base and plugin side by side, each at its newest commit; one line when a variant is missing. */
export function sideBySide(baseline) {
  const [bc, base] = latest(baseline.base) ?? [];
  const [pc, plugin] = latest(baseline.plugin) ?? [];
  if (!base || !plugin) return `side by side needs both variants; recorded: ${Object.keys(baseline).join(', ') || 'none'}`;
  const rows = [['count (mean per first draft)', `base ${bc}`, `plugin ${pc}`], ...COUNTS.map(([name]) => [name, base.summary[name] ?? '-', plugin.summary[name] ?? '-'])];
  const w = [0, 1, 2].map((i) => Math.max(...rows.map((r) => String(r[i]).length)));
  return rows.map((r) => r.map((c, i) => String(c).padEnd(w[i])).join('  ').trimEnd()).join('\n');
}

const gitHead = () => execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();

const OPTIONS = {
  variant: { type: 'string', default: 'base' },
  plugin: { type: 'string' },
  'mcp-config': { type: 'string' },
  model: { type: 'string' },
  only: { type: 'string' },
  'from-stream': { type: 'string' },
  film: { type: 'string' },
  report: { type: 'boolean' },
  'dry-run': { type: 'boolean' },
  'no-save': { type: 'boolean' },
  json: { type: 'boolean' },
  help: { type: 'boolean', short: 'h' },
};

const HELP = `usage: node harness/dev/harness-bench.mjs [--variant base|plugin] [options]

Runs each prompt of harness/dev/harness-bench-prompts.json in its own headless claude session, one at a time,
counts the first draft and writes quality/baselines/harness-bench.json (variant, then commit).

  --variant base|plugin   base: today's setup. plugin: needs --plugin or --mcp-config
  --plugin <dir>          passed to claude as --plugin-dir
  --mcp-config <file>     passed to claude as --mcp-config
  --model <name>          passed to claude as --model, and VAWE_MODEL
  --only <id>             one prompt
  --dry-run               print each claude command and stop
  --from-stream <file>    count a recorded stream-json file (with --film <name>) instead of running an agent
  --report                print base and plugin side by side from the baseline file and stop
  --no-save, --json`;

async function main(argv) {
  const { values: v } = parseArgs({ args: argv, options: OPTIONS, allowPositionals: false });
  if (v.help) return console.log(HELP);
  if (!['base', 'plugin'].includes(v.variant)) throw new Error(`--variant is base or plugin, got "${v.variant}"`);
  if (v.report) return console.log(sideBySide(readBaseline()));
  if (v['from-stream']) {
    const film = v.film ?? 'unknown';
    const counts = await countFirstDraft({ rows: parseStream(fs.readFileSync(v['from-stream'], 'utf8')), runs: readRuns(film, ROOT), devMd: readIf(path.join(runsDir(ROOT), `${film}.dev.md`)) });
    return console.log(JSON.stringify(counts, null, 1));
  }
  const prompts = loadPrompts().filter((p) => !v.only || p.id === v.only);
  if (!prompts.length) throw new Error(`no prompt "${v.only}"`);
  const opts = { variant: v.variant, plugin: v.plugin, mcpConfig: v['mcp-config'], model: v.model };
  if (v['dry-run']) {
    for (const p of prompts) console.log(['claude', ...claudeArgs({ prompt: p, film: filmNameFor(p), ...opts })].map((a) => (/\s/.test(a) ? JSON.stringify(a) : a)).join(' '));
    return;
  }
  const runs = [];
  for (const p of prompts) {
    console.log(`bench: ${v.variant} ${p.id} ...`);
    runs.push(await runOne(p, opts));
  }
  const next = record(readBaseline(), { variant: v.variant, commit: gitHead(), runs, at: new Date().toISOString() });
  if (!v['no-save']) {
    fs.mkdirSync(path.dirname(BASELINE), { recursive: true });
    fs.writeFileSync(BASELINE, `${JSON.stringify(next, null, 1)}\n`);
  }
  console.log(v.json ? JSON.stringify(next[v.variant], null, 1) : sideBySide(next));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch((e) => { console.error(`harness-bench: ${e.message}`); process.exit(1); });
}
