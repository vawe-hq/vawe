// The vawe MCP server (stdio): the fifteen tools: the ten of the harness plan, vawe_write_doc, vawe_edit_doc, vawe_wait, vawe_refs and vawe_ui_skills. The guard core (harness/guards) decides every refusal;
// the work is done by bin/vawe verbs run as child processes (run-verb.mjs). Each tool returns JSON text { ok, findings, next, taste? }
// and, for the frame tools, the images.
import fs from 'node:fs';
import path from 'node:path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import * as z from 'zod/v4';
import { stageGate, contractCheck, tasteFor, TASTE_TOPICS, changedTopics } from '../guards/index.mjs';
import { nextStep, missingRungs } from '../live/stage-say.mjs';
import { tableRows } from '../lib/brief-tables.mjs';
import { ACCEPTANCE } from '../lib/measured-brief.mjs';
import { ideaFindings } from '../lib/ideas.mjs';
import { boardVerify } from '../lib/board-verify.mjs';
import { writeFileAtomic } from '../lib/atomic-write.mjs';
import { WORK } from '../lib/workspace.mjs';
import { isRunning } from '../lib/running-work.mjs';
import { runVerb } from './run-verb.mjs';
import { toolNext } from './next-as-tools.mjs';
import { fixRound, FIX_NEXT } from './fix-first.mjs';
import { uiSkillsArgs, runUiSkills as spawnUiSkills, logFetched, fetchedSlugs, unfetchedClaims, clipText, UI_SKILLS_ACTIONS } from './ui-skills.mjs';

const FILM = z.string().regex(/^[a-z0-9][a-z0-9-]*$/, 'film name: lowercase letters, digits and dashes').describe('film name, as in films/<name>');
const MAX_IMAGES = 6;
const MAX_IMAGE_BYTES = 4_000_000;
const MAX_LOOKS = 4;
const MAX_TASTE = 8;
const MODES = ['world', 'board', 'cuts', 'moment', 'directions'];
const REF_ACTIONS = ['list', 'frames', 'cuts'];
// A reference can have 24 or more cuts: each grid costs about 1,600 image tokens and 2 s of ffmpeg.
const REF_CUTS_LIMIT = 8;
const SPEC_TABLES = ['Shots', 'Words', 'Objects'];

const paths = (name, work) => ({ dir: path.join(work, 'films', name), page: path.join(work, 'films', name, 'page.html'), rel: `films/${name}/page.html` });

const finding = (code, message, fix = null, line = null) => ({ code, line, message, fix });
const fromContract = (f) => ({ code: f.code, line: f.line, message: f.message, fix: f.fix });

function reply(body, images = []) {
  const content = [{ type: 'text', text: JSON.stringify(body, null, 2) }];
  for (const file of images.slice(0, MAX_IMAGES)) {
    try {
      if (fs.statSync(file).size > MAX_IMAGE_BYTES) continue;
      content.push({ type: 'image', data: fs.readFileSync(file).toString('base64'), mimeType: file.endsWith('.png') ? 'image/png' : 'image/jpeg' });
    } catch { /* a path the verb printed that is not a file: the text still names it */ }
  }
  return { content, isError: body.ok === false };
}

const refused = (gate) => reply({ ok: false, findings: [finding('refused', gate.reason, gate.step)], next: gate.step });

/** The taste lines for the beats a write changed: the topics each beat holds, at most MAX_TASTE lines, none already sent for this film in this session. */
function beatTaste(p, work, before, after, sent) {
  return tasteLines(p, work, changedTopics(before, after), sent);
}

/** At most MAX_TASTE taste lines over `topics` for the film's stage, none already sent for this film in this session. */
function tasteLines(p, work, topics, sent) {
  if (!topics.length) return [];
  const seen = sent.get(p.rel) ?? new Set();
  const quota = Math.max(1, Math.floor(MAX_TASTE / topics.length));
  const stage = nextStep(p.page, work).stage;
  const lines = topics.flatMap((topic) => {
    const fresh = tasteFor(stage, topic).filter((l) => !seen.has(l));
    const read = fresh.filter((l) => l.startsWith('read '));
    return [...fresh.filter((l) => !l.startsWith('read ')).slice(0, quota - 1), ...read];
  });
  const picked = [...new Set(lines)].slice(0, MAX_TASTE);
  sent.set(p.rel, new Set([...seen, ...picked]));
  return picked;
}

async function viaVerb(args, work) {
  const r = await runVerb(args, { work });
  const findings = r.ok ? [] : [finding('verb-failed', r.reason ?? 'the verb failed')];
  return reply({ ok: r.ok, findings, next: r.next, output: r.output }, r.images);
}

/** Gate, then run: the guard core decides; a refusal runs nothing. */
async function gated(tool, name, work, run, opts = {}) {
  const p = paths(name, work);
  const gate = stageGate(p.dir, tool, { root: work, ...opts });
  return gate.allow ? run(p) : refused(gate);
}

function checkedWrite(p, html, work, sent, before) {
  const findings = contractCheck(html, { filmDir: p.dir });
  const blocks = findings.filter((f) => f.severity === 'block').map(fromContract);
  if (blocks.length) return reply({ ok: false, findings: blocks, next: 'fix the blocking findings and write the page again; nothing was written' });
  writeFileAtomic(p.page, html);
  const next = stageGate(p.dir, 'vawe_write_page', { root: work }).step;
  return reply({ ok: true, findings: findings.map(fromContract), next, taste: beatTaste(p, work, before, html, sent) });
}

function writePage({ film, html }, work, sent) {
  const p = paths(film, work);
  if (!fs.existsSync(p.dir)) return refused(stageGate(p.dir, 'vawe_write_page', { root: work }));
  return checkedWrite(p, html, work, sent, fs.existsSync(p.page) ? fs.readFileSync(p.page, 'utf8') : '');
}

function editPage({ film, old, new: replacement }, work, sent) {
  const p = paths(film, work);
  if (!fs.existsSync(p.page)) return refused(stageGate(p.dir, 'vawe_edit_page', { root: work }));
  const html = fs.readFileSync(p.page, 'utf8');
  const count = old === '' ? 0 : html.split(old).length - 1;
  if (count !== 1) {
    const why = count === 0 ? 'the old text is not in page.html' : `the old text is in page.html ${count} times`;
    return reply({ ok: false, findings: [finding('edit-not-unique', why, 'send more surrounding text in old so it matches once')], next: 'edit again with an exact, unique old text' });
  }
  return checkedWrite(p, html.replace(old, () => replacement), work, sent, html);
}

const DOC_FILES = /^(?:brief\.md|DESIGN\.md|kit\/[^\0]+)$/;

/** The absolute path of a film doc the agent may write (brief.md, DESIGN.md, kit/...), or null for any other file or a path that leaves the film folder. */
function docPath(p, file) {
  if (!DOC_FILES.test(file) || file.split('/').includes('..')) return null;
  const full = path.resolve(p.dir, file);
  return full.startsWith(path.join(p.dir, path.sep)) ? full : null;
}

const norm = (s) => String(s).toLowerCase().replace(/\s+/g, ' ').trim();

/** The standard Acceptance rows `vawe new` ships (measured-brief.mjs) that the brief lacks, and the spec tables with no row. A fact: the draft measures a row by its exact metric name. */
function measuredBriefFindings(text) {
  const lines = text.split('\n');
  const have = new Set(tableRows(lines, 'Acceptance').map((r) => norm(r.row.metric)));
  const missing = ACCEPTANCE.filter(([metric]) => !have.has(norm(metric)));
  const out = [];
  if (missing.length) {
    out.push(finding('brief-acceptance', `the Acceptance table has ${ACCEPTANCE.length - missing.length} of the ${ACCEPTANCE.length} standard rows; missing: ${missing.map(([m, t]) => `${m} (${t})`).join('; ')}`,
      'add each missing row with its exact metric name and target; the draft measures a row by that name'));
  }
  const bare = SPEC_TABLES.filter((name) => !tableRows(lines, name).length);
  if (bare.length) out.push(finding('brief-spec', `the Spec has no rows in: ${bare.join(', ')}`, 'add a "### Shots", "### Words" and "### Objects" table with a row for each beat, word and object'));
  return out;
}

function designFindings(p, text, work) {
  const film = path.basename(p.dir);
  const rungs = missingRungs(text).map((rung) => finding('design-rung', `DESIGN.md has no "Skill ${rung}: <slug>: what it decided" or "Skipped ${rung}: <reason>" line`,
    rung === 'frame' ? 'the frame rung is vawe\'s own rules: write "Skill frame: vawe: <what you decided>"' : `vawe_ui_skills list with the category for ${rung}, get at least two candidates, read each in full, then write the line`));
  const claims = unfetchedClaims(text, fetchedSlugs(path.join(work, 'out'), film)).map((c) => finding('design-skill-unread', `"Skill ${c.rung}: ${c.slug}" names a skill this film never fetched with vawe_ui_skills`,
    `vawe_ui_skills get {"slug":"${c.slug}","film":"${film}"} and read it, or name the skill you did read`));
  return [...rungs, ...claims];
}

function docFindings(p, file, text, work) {
  if (file === 'DESIGN.md') return designFindings(p, text, work);
  if (file !== 'brief.md') return [];
  const worlds = fs.existsSync(p.page) ? [...fs.readFileSync(p.page, 'utf8').matchAll(/\bdata-world\s*=\s*["']([^"']*)["']/g)].map((m) => m[1]) : null;
  const ideas = ideaFindings(text, worlds).map((f) => finding(f.code, f.text, f.at));
  const board = boardVerify(text).map((l) => finding('board', l));
  return [...ideas, ...board, ...measuredBriefFindings(text)];
}

// The decisions each doc holds: DESIGN.md and the kit set the look, the brief's Board plans the cuts.
const DOC_TOPICS = (file) => (file === 'brief.md' ? ['cuts'] : ['type', 'colour', 'layout']);

function docReply(p, file, text, work, sent) {
  const bad = (why) => reply({ ok: false, findings: [finding('bad-path', why, 'file is brief.md, DESIGN.md or a path under kit/')], next: 'call again with an allowed file' });
  const full = docPath(p, file);
  if (!full) return bad(`${file} is not a film doc this tool writes`);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  writeFileAtomic(full, text);
  return reply({ ok: true, findings: docFindings(p, file, text, work), next: nextStep(p.page, work).step, taste: tasteLines(p, work, DOC_TOPICS(file), sent) });
}

function writeDoc({ film, file, text }, work, sent) {
  const p = paths(film, work);
  if (!fs.existsSync(p.dir)) return refused(stageGate(p.dir, 'vawe_write_doc', { root: work }));
  return docReply(p, file, text, work, sent);
}

function editDoc({ film, file, old, new: replacement }, work, sent) {
  const p = paths(film, work);
  if (!fs.existsSync(p.dir)) return refused(stageGate(p.dir, 'vawe_edit_doc', { root: work }));
  const full = docPath(p, file);
  if (!full || !fs.existsSync(full)) return reply({ ok: false, findings: [finding('bad-path', `${file} is not an existing film doc`, 'file is brief.md, DESIGN.md or a path under kit/')], next: 'use vawe_write_doc to create it' });
  const text = fs.readFileSync(full, 'utf8');
  const count = old === '' ? 0 : text.split(old).length - 1;
  if (count !== 1) return reply({ ok: false, findings: [finding('edit-not-unique', count === 0 ? `the old text is not in ${file}` : `the old text is in ${file} ${count} times`, 'send more surrounding text in old so it matches once')], next: 'edit again with an exact, unique old text' });
  return docReply(p, file, text.replace(old, () => replacement), work, sent);
}

function kitLines(p) {
  const kitDir = path.join(p.dir, 'kit');
  const parts = fs.existsSync(kitDir) ? fs.readdirSync(kitDir, { recursive: true }).filter((f) => fs.statSync(path.join(kitDir, f)).isFile()).sort() : [];
  return [
    ...(parts.length ? parts.map((f) => `kit part: films/${path.basename(p.dir)}/kit/${f}`) : [`no kit yet: write films/${path.basename(p.dir)}/kit/ with vawe_write_doc (DESIGN.md first)`]),
    'moves, picked by job: prompts/moves/README.md (copy the snippet; every curve is an EASE name)',
    'moves joined into whole films: prompts/moves/RECIPES.md',
    'ease per job: core/motion/README.md',
  ];
}

function readRules({ film, topic }, work) {
  const p = paths(film, work);
  const stage = fs.existsSync(p.dir) ? nextStep(p.page, work).stage : 'brief';
  if (topic === 'kit') return reply({ ok: true, findings: [], next: nextStep(p.page, work).step, kit: kitLines(p) });
  if (topic && !TASTE_TOPICS.includes(topic)) {
    return reply({ ok: false, findings: [finding('unknown-topic', `no topic "${topic}"`, `use one of: ${[...TASTE_TOPICS, 'kit'].join(', ')}`)], next: 'call vawe_read_rules again with a valid topic' });
  }
  const contract = ['a film is films/<name>/page.html with <meta name="duration"> and one data-world element per beat', 'relative asset paths only'];
  return reply({ ok: true, findings: [], next: nextStep(p.page, work).step, taste: tasteFor(stage, topic ?? null), contract });
}

async function wait({ film }, work) {
  const p = paths(film, work);
  if (!fs.existsSync(p.dir)) return refused(stageGate(p.dir, 'vawe_wait', { root: work }));
  if (!isRunning(p.rel, work)) {
    const step = nextStep(p.page, work);
    return reply({ ok: false, findings: [finding('nothing-running', 'no render, critique or ship of this film is running', step.step)], next: step.step });
  }
  return viaVerb(['wait', p.rel], work);
}

function status({ film }, work) {
  const p = paths(film, work);
  const gate = stageGate(p.dir, 'vawe_status', { root: work });
  if (!gate.allow) return refused(gate);
  const step = nextStep(p.page, work);
  return reply({ ok: true, findings: [], stage: step.stage, why: step.whyStep, next: step.step });
}

const FRAME_FLAGS = { world: () => ['--world', 'all'], board: () => ['--board'], cuts: () => ['--cuts'], moment: (t) => ['--moment', String(t)], directions: () => ['--directions'] };

async function frame({ film, mode, t }, work) {
  if (mode === 'moment' && t === undefined) return reply({ ok: false, findings: [finding('missing-t', 'mode moment needs t, the second to show')], next: 'call again with t' });
  return gated('vawe_frame', film, work, (p) => viaVerb(['frame', p.rel, ...FRAME_FLAGS[mode](t)], work), { mode });
}

async function look({ film, t }, work) {
  return gated('vawe_look', film, work, async (p) => {
    const runs = [];
    for (const s of t.slice(0, MAX_LOOKS)) runs.push(await runVerb(['frame', p.rel, '--at', String(s)], { work }));
    const failed = runs.filter((r) => !r.ok);
    const findings = failed.map((r) => finding('verb-failed', r.reason ?? 'frame failed'));
    return reply({ ok: !failed.length, findings, next: runs.at(-1)?.next ?? null, output: runs.map((r) => r.output).join('\n').slice(-3000) }, runs.flatMap((r) => r.images));
  });
}

async function refs({ action, id }, work) {
  if (action === 'cuts' && !id) return reply({ ok: false, findings: [finding('missing-id', 'action cuts needs id, the reference film id')], next: 'call again with id, from vawe_refs list' });
  const args = action === 'cuts' ? ['frame', id, '--cuts', '--limit', String(REF_CUTS_LIMIT)] : ['refs', action, ...(id ? [id] : [])];
  return viaVerb(args, work);
}

/** The reply with its shell commands swapped for the tool calls that do the same (the agent has no shell). */
function asTools(result, film) {
  const body = JSON.parse(result.content[0].text);
  const swap = (next) => (Array.isArray(next) ? toolNext(next, film) : next);
  const next = { ...body, next: swap(body.next), why: swap(body.why), findings: (body.findings ?? []).map((f) => ({ ...f, fix: swap(f.fix) })) };
  if (body.fix_first) next.fix_first = body.fix_first.map((f) => ({ ...f, fix: swap(f.fix) }));
  return { ...result, content: [{ type: 'text', text: JSON.stringify(next, null, 2) }, ...result.content.slice(1)] };
}

async function renderDraft({ film, from, to }, work) {
  const result = await gated('vawe_render_draft', film, work, (p) => viaVerb(['dev', p.rel, ...(from !== undefined ? ['--from', String(from)] : []), ...(to !== undefined ? ['--to', String(to)] : [])], work));
  const body = JSON.parse(result.content[0].text);
  if (!body.ok) return result;
  const problems = fixRound(path.join(work, 'out'), film);
  if (!problems.length) return result;
  return { ...result, content: [{ type: 'text', text: JSON.stringify({ ...body, fix_first: problems, next: FIX_NEXT }, null, 2) }, ...result.content.slice(1)] };
}

async function uiSkills({ action, category, slug, film }, work, _sent, run) {
  const call = uiSkillsArgs({ action, category, slug });
  if (call.error) return reply({ ok: false, findings: [finding('bad-input', call.error)], next: 'call vawe_ui_skills again with valid input' });
  const r = await run(call.args, { cwd: work });
  if (!r.ok) return reply({ ok: false, findings: [finding('ui-skills-failed', r.reason ?? 'ui-skills failed')], next: 'call vawe_ui_skills again', output: clipText(r.text) });
  if (action === 'get' && film) logFetched(path.join(work, 'out'), film, slug);
  return reply({ ok: true, findings: [], next: null, output: clipText(r.text) });
}

function register(server, work, runUi) {
  const sent = new Map();
  const tool = (name, description, inputSchema, run) => server.registerTool(name, { description, inputSchema }, async (input) => asTools(await run(input, work, sent), input.film ?? input.name));
  tool('vawe_status', 'Use first, and after every step: the stage the film is at, why, and the one next step.', { film: FILM }, status);
  tool('vawe_new_film', 'Use once to start a film: writes films/<name>/brief.md and a starter page.html. Refuses when the name exists.', {
    name: FILM, request: z.string().describe('the ask in its own words'), aspect: z.enum(['16:9', '9:16', '1:1', '4:5', '4:3']).optional(),
  }, ({ name, request, aspect }, w) => gated('vawe_new_film', name, w, (p) => viaVerb(['new', name, '--request', request, '--defaults', ...(aspect ? ['--aspect', aspect] : [])], w)));
  tool('vawe_write_doc', 'Use to write a film doc whole: file is brief.md (Ideas, Board, Motion pass), DESIGN.md or a path under kit/. No other file. Returns the plan findings as advice.', {
    film: FILM, file: z.string().describe('brief.md | DESIGN.md | kit/<path>'), text: z.string(),
  }, writeDoc);
  tool('vawe_edit_doc', 'Use for a small change to brief.md, DESIGN.md or a kit/ file: one exact replace of old by new. Refuses when old is missing or not unique.', {
    film: FILM, file: z.string().describe('brief.md | DESIGN.md | kit/<path>'), old: z.string(), new: z.string(),
  }, editDoc);
  tool('vawe_read_rules', 'Use before you write a beat: the taste and contract lines for this film stage; topic narrows to type, colour, motion, cuts, sound or layout; kit lists the kit parts and moves to build from.', {
    film: FILM, topic: z.string().optional().describe(TASTE_TOPICS.join(' | ')),
  }, readRules);
  tool('vawe_write_page', 'Use to write the whole films/<name>/page.html. Refuses (writes nothing) when the page contract breaks: no duration meta, no data-world, an absolute path. Other findings advise.', {
    film: FILM, html: z.string().describe('the full page'),
  }, writePage);
  tool('vawe_edit_page', 'Use for a small change: one exact replace of old by new in page.html. Refuses when old is missing or not unique, or the result breaks the page contract.', {
    film: FILM, old: z.string(), new: z.string(),
  }, editPage);
  tool('vawe_frame', 'Use to see the film as pictures: world (a key state per beat, after the page exists), board (the plan board), directions (the directions board to show the person), cuts or moment (read from a draft; moment needs t).', {
    film: FILM, mode: z.enum(MODES), t: z.number().min(0).optional(),
  }, frame);
  tool('vawe_render_draft', 'Use to render a half-size draft with sound; from and to render only those seconds. Refused until the brief Ideas and Board are filled. The first draft replies with fix_first: the top problems to fix in one round.', {
    film: FILM, from: z.number().min(0).optional(), to: z.number().min(0).optional(),
  }, renderDraft);
  tool('vawe_ui_skills', 'Use at the design step: start prints the routing skill, categories and list (with category) show the registry, get (slug owner/name) prints one skill in full. film logs each get.', {
    action: z.enum(UI_SKILLS_ACTIONS), category: z.string().optional().describe('with list: a name from categories'), slug: z.string().optional().describe('with get: owner/name'), film: FILM.optional(),
  }, (input, w, s) => uiSkills(input, w, s, runUi));
  tool('vawe_look', 'Use to read a draft at full size: one still at each second in t (at most 4). Needs a draft.', {
    film: FILM, t: z.array(z.number().min(0)).min(1),
  }, look);
  tool('vawe_refs', 'Use for the reference study, before the design: list shows the reference films, frames prints and shows the settled frame of each shot of one film (id), cuts shows how a reference film moves through each cut (id). Needs no film.', {
    action: z.enum(REF_ACTIONS), id: z.string().regex(/^[\w-]+$/).optional().describe('the reference film id from list; frames without it covers every film'),
  }, refs);
  tool('vawe_critique', 'Use after the motion pass: starts a fresh critic session (not this one) that writes out/<film>.critique-<n>.md. Takes 1 to 15 minutes.', { film: FILM },
    ({ film }, w) => gated('vawe_critique', film, w, (p) => viaVerb(['critique', p.rel, '--fresh'], w)));
  tool('vawe_wait', 'Use after vawe_ship, vawe_critique or a long draft: waits up to 100 seconds for the running job. On STILL RUNNING call it again. Refused when nothing runs.', { film: FILM }, wait);
  tool('vawe_ship', 'Use only when the person has approved: starts the final render. Refused without a fresh critique and the person\'s OK; never approve for them.', { film: FILM },
    ({ film }, w) => gated('vawe_ship', film, w, (p) => viaVerb(['ship', p.rel], w)));
}

const registeredNames = () => {
  const names = [];
  register({ registerTool: (name) => names.push(name) }, WORK, spawnUiSkills);
  return names;
};

/** The registered tool names, in registration order: the one list pi, the plugin agent file and the tests read. */
export const TOOL_NAMES = registeredNames();

/** A server with the fifteen tools on the workspace `work`. `runUiSkills` replaces the npx call (a test). */
export function createServer({ work = WORK, runUiSkills = spawnUiSkills } = {}) {
  const server = new McpServer({ name: 'vawe', version: '1.0.0' });
  register(server, work, runUiSkills);
  return server;
}

/** Serves MCP over stdio until the client closes it. */
export async function serve(options) {
  for (const signal of ['SIGTERM', 'SIGINT', 'SIGHUP']) process.on(signal, () => process.exit(0));
  process.stdin.on('end', () => process.exit(0));
  await createServer(options).connect(new StdioServerTransport());
}

if (import.meta.url === `file://${process.argv[1]}`) await serve();
