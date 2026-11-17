#!/usr/bin/env node
// UserPromptSubmit hook: says when the checkout lags origin/main, then names the one next command for the page film edited most recently.
// With --after-tool, a PostToolUse hook on Bash: the same stage line after a vawe verb, only when it changed.
// The stage line is silent when no films/*/page.html changed in the last RECENT_MS, so a framework session sees nothing of it.
//   node harness/live/stage-say.mjs [--reset | --after-tool]
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { isClipDemo } from '../lib/clip-demo.mjs';
import { movesTaken, boardFilled, motionFilled, boardChecks, spectacleOf, moveRows, briefLengthLine } from '../lib/board.mjs';
import { handoffAdvice } from '../lib/handoffs.mjs';
import { ideasFilled, IDEATE_ASK } from '../lib/ideas.mjs';
import { ASK_LINE, shipProblemStep, planProblemStep } from '../lib/approval.mjs';
import { say, vawe, doc, cmd, buildPage, shellNext, asText } from '../lib/next-step.mjs';
import { loopState, filmDirOf } from '../lib/loop-state.mjs';
import { statedLength } from '../media/page-duration.mjs';
import { staleCheckoutLine, mainCheckoutLine } from '../lib/stale-checkout.mjs';
import { readRuns, appendRun, looksSince, readHookSeen } from '../lib/runlog.mjs';
import { tasteLines } from '../lib/taste-steps.mjs';
import { isEditFilm, emptyPlanParts } from '../lib/plan-parts.mjs';
import { nextSeen, resetShown, sinceReset, NEXT_UNCHANGED } from '../lib/next-once.mjs';
import { stepOf } from '../guards/taste.mjs';

export { boardFilled };

const RECENT_MS = 3 * 60 * 60 * 1000;
const mtime = (p) => { try { return fs.statSync(p).mtimeMs; } catch { return 0; } };

// A checkout rewrites mtimes, so only a page git sees as changed or new counts as being worked on.
// A test page in a film's own folder (films/<name>/variations/<id>/page.html) is not a film.
export const FILM_PAGE = /^films\/(examples\/)?[^/]+\/(page\.html|ch\/[^/]+\.html)$/;

export { filmDirOf };

/** True for a page inside films/ that is not a film's own page.html: a direction, variation or kit page, which has no brief of its own. */
export const isTestPage = (page, root = process.cwd()) => {
  const rel = path.relative(root, path.resolve(page)).split(path.sep).join('/');
  return rel.startsWith('films/') && !FILM_PAGE.test(rel);
};

function pages(root) {
  const r = spawnSync('git', ['status', '--porcelain', '--untracked-files=all', '--', 'films'], { cwd: root, encoding: 'utf8' });
  return (r.stdout || '').split('\n').map((l) => l.slice(3).trim())
    .filter((p) => FILM_PAGE.test(p)).map((p) => path.join(root, p));
}

const hasWorlds = (page) => { try { return /\bdata-world=/.test(fs.readFileSync(page, 'utf8')); } catch { return false; } };

// A film folder with a brief and no page.html yet: nothing rendered, nothing approved.
const NO_PAGE_STATE = { pageDigest: null, draft: null, final: null, critique: null, plan: { digest: null, cutList: null }, approval: { plan: 'none', draft: 'none' } };

const TAKEN_FROM_MIN = 4;
const FRAME_PATH = /\.(png|jpe?g|webp)\b/i;

/** How many frames the brief's "Taken from" table names; null when the brief has no such section (an older film). */
export function takenFromCount(brief) {
  const section = brief.split(/^## /m).find((s) => s.startsWith('Taken from'));
  if (section === undefined) return null;
  return section.split('\n').filter((l) => l.startsWith('|') && FRAME_PATH.test(l.split('|')[1]) && !l.split('|')[1].trim().startsWith('[')).length;
}

const MOVES_MIN = 3;

/** How many moves the "Taken from" study names (rows of the "Moves taken" table past its header); null when the brief has no such table. */
export function movesTakenCount(brief) {
  return brief.includes('| move taken') ? movesTaken(brief).length : null;
}

const read = (p) => { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } };

export const RUNGS = ['builder', 'type', 'colour', 'depth', 'frame'];

export function missingRungs(design) {
  return RUNGS.filter((rung) => {
    const name = rung === 'colour' ? 'colou?r' : rung;
    return !new RegExp(`^\\W*(skill[ \\t]+${name}[ \\t]*:[ \\t]*\\S+.*:[ \\t]*\\S|skipped[ \\t]+${name}[ \\t]*:[ \\t]*\\S)`, 'im').test(design);
  });
}

export const WAIT_STEP = say`while it renders, fill the brief's Board and Motion pass rows if empty, Read the ${vawe('frame', '<page>', '--cuts')} grids, or prepare the critique notes`;
export const WAIT_WORK = shellNext(WAIT_STEP);

export const CRITIQUE_ASK = 'ask: what reads flat, and what is a trick (an effect with no job)?';
export const BRIEF_ASK = 'ask: what is the one thing to remember, who watches it, and where (platform, sound on or off)?';

const UI_SKILLS_LIST = cmd('list', [], { bin: 'command npx -y ui-skills' });

/**
 * The one owner of the stage order (AGENTS.md, The loop). Each entry is one next step as data (harness/lib/next-step.mjs); the verbs in
 * harness/cli/verbs.mjs print these after they run, so a verb and this hook never name different next steps.
 */
export const STEP = {
  study: (name) => say`${vawe('refs', 'list')}, ${vawe('refs', 'frames', '<id>')}, Read the frames at full size, then fill "Taken from" in ${doc(name, 'brief.md', 'edit')}: ${TAKEN_FROM_MIN} to 6 frames, exact path and what you take; ask: what does this ref do that a simple film does not?`,
  moves: () => say`${vawe('frame', '<ref-id>', '--cuts')} on 2 reference films, Read every strip, then name ${MOVES_MIN} moves in "Taken from" (ref id, cut second) and which of the ten patterns in taste/craft/film-structure.md (The motion grammar) each ref uses; ask: what does the cut do to the eye?`,
  design: (name) => say`write ${doc(name, 'DESIGN.md', 'write')} and ${doc(name, 'kit/', 'write')} (format: skills/vawe-page/SKILL.md, example: films/examples/colour-sting/kit/; type: taste/craft/typography.md, colour: taste/craft/color.md); ask: which type scale and colour roles still read at this screen size?`,
  skills: (name, rungs) => say`add to ${doc(name, 'DESIGN.md', 'edit')} one line per rung (${rungs.join(', ')}): "Skill <rung>: <slug>: what it decided", or "Skipped <rung>: <reason>"; list the skills with ${UI_SKILLS_LIST}`,
  states: (name, rel) => say`build one static state per world in ${buildPage(rel)} from the kit, no motion yet (layout: taste/craft/layout.md), then ${vawe('frame', rel, '--world', 'all')}; ask: where is the eye in each frame, and what does it see first?`,
  frames: (name, rel) => say`${vawe('frame', rel, '--world', 'all')}`,
  ideas: (name, rel) => say`fill "Ideas" in ${doc(name, 'brief.md', 'edit')} (guides/IDEATE.md): ${IDEATE_ASK}; then ${vawe('frame', rel, '--board')} lists what the taste docs say about the plan`,
  board: (name, rel) => say`${vawe('frame', rel, '--board')} lists what the taste docs say about the plan (stagger gaps, read holds, the last second); then fill "Board" in ${doc(name, 'brief.md', 'edit')}: rhythm, spectacle, a move per cut and its handoff (load skills/vawe-transitions/SKILL.md: the cut's row in the Ideas ledger (guides/IDEATE.md), the less typical pick, the ledger; families: taste/craft/transitions.md; feeling: taste/craft/selection.md), sound (effects on actions, a real recording first, no bed: taste/craft/sound.md); ask: what carries the eye across each cut, what is the rhythm, where is the one big moment, what sound sits on each action?`,
  cut: (name) => say`Read films/${name}/footage.md and its contact sheets, then fill the "why" cell of each row in "Cut list" in ${doc(name, 'brief.md', 'edit')} (in and out seconds, rate, and the message line); ask: which action or word ends each clip, and what does the cut keep?`,
  dev: (name, rel) => say`${vawe('dev', rel)}`,
  motion: (name, rel) => say`${vawe('frame', rel, '--cuts')} and Read every cut at full size; for the spectacle second also ${vawe('frame', rel, '--moment', '<s>', '--onion')} and ${vawe('frame', rel, '--moment', '<s>', '--velocity')}; check each cut against taste/craft/motion-craft.md and the principles in core/motion/README.md: anticipation on the hero, follow-through and overlap, eased spacing, arcs on travelling elements, secondary action, exits faster than entrances, holds alive through element motion, camera still unless the spectacle; fix what reads flat`,
  cutCheck: (name, rel) => say`${vawe('frame', rel, '--cuts')} and Read every cut at full size; check that each cut lands on an action or a word end (films/${name}/footage/<clip>.words.json has the word times) and each clip holds 1.2 s or more; move the in and out points in the Cut list and the page`,
  motionRows: (name) => say`write one row per cut in "Motion pass" in ${doc(name, 'brief.md', 'write')}: each principle checked, what read flat, what you fixed`,
  critique: (name, rel) => say`${vawe('critique', rel, '--fresh')}`,
  plan: (page, rel) => say`${planProblemStep(page) ?? say`show the plan to the person: the directions board (${vawe('frame', rel, '--directions')}) and the Board`}, then go on with ${STEP.dev('', rel)} and ${ASK_LINE}`,
  ship: (name, rel) => say`${vawe('ship', rel)}, then ${vawe('wait', rel)} (one call waits up to 100 seconds, then says STILL RUNNING: call it again; run it alone, not in parallel); ${WAIT_STEP}`,
};

/** The stage steps as the text a person reads at a shell, the form the hooks and verbs print. */
export const SAY = Object.fromEntries(Object.entries(STEP).map(([k, fn]) => [k, asText(fn)]));

/** True when `out/strip/<name>` or `out/strip/<name>-*` changed after `sinceMs`: an agent's own --out folders count. */
function stripsSince(root, name, sinceMs) {
  const dir = path.join(root, 'out', 'strip');
  try { return fs.readdirSync(dir).some((f) => (f === name || f.startsWith(`${name}-`)) && mtime(path.join(dir, f)) > sinceMs); } catch { return false; }
}

/** The part of a brief the design stages read: `plan` is null for an edit film, whose plan is its Cut list. */
function designPlan(brief) {
  const edit = isEditFilm(brief);
  const plan = edit ? null : brief;
  return { edit, plan, taken: plan ? takenFromCount(plan) : null, moves: plan ? movesTakenCount(plan) : null };
}

/** A stage and its next step: `step` and `whyStep` are data, `next` and `why` the shell text of them. */
const at = (name, stage, step, why) => ({ name, stage, next: shellNext(step), step, why: shellNext(why), whyStep: why });

/** The step of a film with no brief.md. */
export const briefStep = (name) => at(name, 'brief', say`create ${doc(name, 'brief.md', 'write')}: the ask, the message, the spectacle second, "Taken from", "Board" (${vawe('new', '<other-name>')} writes the template to copy); ${BRIEF_ASK}`, `films/${name} has no brief.md`);

export function nextStep(page, root = process.cwd()) {
  if (isClipDemo(page)) {
    const clip = path.basename(page, '.html');
    return at(clip, 'clip', cmd('moves', ['--only', clip], { bin: 'bin/vawe-dev' }), 'a page under prompts/moves/demo/ is a clip: it has no brief, and bin/vawe-dev moves renders it');
  }
  const name = path.basename(filmDirOf(page));
  const rel = path.relative(root, page);
  if (isTestPage(page, root)) {
    return at(name, 'test', vawe('frame', rel, '--moment', '<the second to check>'), 'a test page inside a film folder has no brief of its own');
  }
  const dir = filmDirOf(page);
  const t = mtime(page);
  const state = fs.existsSync(page) ? loopState(page, root) : NO_PAGE_STATE;
  const { draft, final } = state;
  const framed = mtime(path.join(root, 'out', `${name}-frames.png`)) > t;
  const brief = read(path.join(dir, 'brief.md'));
  const design = path.join(dir, 'DESIGN.md');
  const { edit, plan, taken, moves } = designPlan(brief);
  const early = !draft && !final && !framed;
  if (early && !brief) return briefStep(name);
  if (early && taken !== null && taken < TAKEN_FROM_MIN) {
    return at(name, 'study', STEP.study(name), `Taken from not filled (${taken} named frames); it comes before the design files`);
  }
  if (early && moves !== null && moves < MOVES_MIN) {
    return at(name, 'moves', STEP.moves(), `${moves} moves named; motion is studied before the board`);
  }
  if (early && taken !== null && !mtime(design)) {
    return at(name, 'design', STEP.design(name), 'the design system and the asset kit come before the states');
  }
  const rungs = early && taken !== null ? missingRungs(read(design)) : [];
  if (rungs.length) {
    return at(name, 'skills', STEP.skills(name, rungs), `DESIGN.md has no Skill line for ${rungs.join(', ')}; one skill per rung is applied before the states (advice: a rung you skip needs a "Skipped <rung>: <reason>" line that cites a reference frame path or a SPEC.md line)`);
  }
  if (early && taken !== null && t <= mtime(design)) {
    return at(name, 'states', STEP.states(name, rel), 'DESIGN.md is newer than the page; the states come before the frames and the motion');
  }
  if (edit && !draft && !final && emptyPlanParts(brief).length) return at(name, 'cut', STEP.cut(name), 'the Cut list is the plan of an edit film: fill it from the footage log');
  if (early && !edit && hasWorlds(page)) return at(name, 'states', STEP.frames(name, rel), 'the frames come before the motion');
  const stated = statedLength(read(page));
  const stale = !draft && !final && plan && typeof stated === 'number' ? briefLengthLine(brief, stated) : null;
  if (stale) {
    return at(name, 'board', say`bring Length, Board and Spec in ${doc(name, 'brief.md', 'edit')} to the page, then ${vawe('frame', rel, '--board')}`, `${stale}; a plan for another film length is stale`);
  }
  if (!draft && !final && plan && ideasFilled(plan) !== true) {
    return at(name, 'ideas', STEP.ideas(name, rel), 'the Ideas ledger is empty; the ideas come before the board, so each cut carries a chosen idea');
  }
  if (!draft && !final && plan && boardFilled(plan) === false) {
    return at(name, 'board', STEP.board(name, rel), 'the board is a plan for time and comes after the states, before the motion');
  }
  const boardAdvice = !draft && !final && plan && boardFilled(plan) ? [...boardChecks(brief, spectacleOf(read(page))), ...handoffAdvice(moveRows(brief))] : [];
  if (boardAdvice.length) {
    return at(name, 'board', say`check "Board" in ${doc(name, 'brief.md', 'edit')} (advice; a plan you keep on purpose needs no change), then ${STEP.dev(name, rel)}`, boardAdvice.map((l) => l.replace(/^board: /, '')).join('; '));
  }
  if (!draft && !final && plan && boardFilled(plan) && process.env.VAWE_UNATTENDED !== '1' && state.approval.plan !== 'fresh') {
    return at(name, 'plan', STEP.plan(page, rel), `the person has not given an OK on the plan (${state.approval.plan === 'stale' ? 'the Directions or the Board changed after the last OK' : 'no OK yet'}); the draft does not wait for it, only the final render does`);
  }
  return afterDraft({ page, root, name, rel, state, brief, plan });
}

/** The step once a draft or a final exists: the plan it was made from, the motion pass, the critique, the approvals, the ship. */
function afterDraft({ page, root, name, rel, state, brief, plan }) {
  const { draft, final } = state;
  const draftOld = !draft?.current;
  const finalOld = !final?.current;
  const draftMs = draft ? mtime(draft.path) : 0;
  const stripped = stripsSince(root, name, draftMs);
  if (draft && finalOld && plan && (ideasFilled(plan) === false || boardFilled(plan) === false)) {
    return ideasFilled(brief) === false
      ? at(name, 'ideas', STEP.ideas(name, rel), 'the draft was made without a plan: the Ideas ledger is empty; fill it, then the board, before the next draft')
      : at(name, 'board', STEP.board(name, rel), 'the draft was made without a plan: the Board is empty; fill it before the next draft');
  }
  if (draftOld && finalOld) return at(name, 'draft', STEP.dev(name, rel), 'the page changed after its last draft');
  if (finalOld && !stripped) return at(name, 'motion', (isEditFilm(brief) ? STEP.cutCheck : STEP.motion)(name, rel), 'a draft exists; the motion pass comes before the critique (dev: overshoot-share, live-hold and seam-variety clean or waived with a reason)');
  const looks = finalOld ? looksSince(name, draftMs, root) : { printed: [], unread: [] };
  if (looks.unread.length && readHookSeen(root, undefined, draftMs)) {
    const n = looks.printed.length;
    return at(name, 'motion', `Read the ${n} cut strips of this draft (${n - looks.unread.length} of ${n} read): ${looks.unread[0]}`, 'the strips are rendered; the motion pass starts with looking at them');
  }
  if (finalOld && motionFilled(brief) === false) return at(name, 'motion', STEP.motionRows(name), 'the cuts are stripped; the Motion pass section is empty');
  return afterMotion({ page, root, name, rel, state });
}

/** The step once the motion pass is done: the critique of this page, the person's OKs, the final render, then the judge. */
function afterMotion({ page, root, name, rel, state }) {
  const finalOld = !state.final?.current;
  if (finalOld && !state.critique) {
    return at(name, 'critique', STEP.critique(name, rel), say`the motion pass is done; critique the draft in a fresh session, fix the named seconds, then ${vawe('ship')}; ${CRITIQUE_ASK}`);
  }
  const waiting = finalOld ? shipProblemStep(page, { root }) : null;
  if (waiting) return at(name, 'approve', waiting, 'the critique ran on this draft; the final render needs the person\'s OK on the plan and on the draft');
  if (finalOld) return at(name, 'ship', STEP.ship(name, rel), 'the critique ran on this draft; fix the seconds it named, then render the final');
  return at(name, 'judge', STEP.critique(name, rel), 'the final is rendered; a fresh session judges it');
}

/** The page film git sees as changed and edited most recently (within RECENT_MS), or null. */
export function recentPage(root) {
  const recent = pages(root).map((p) => ({ p, t: mtime(p) })).filter((x) => Date.now() - x.t < RECENT_MS).sort((a, b) => b.t - a.t);
  return recent.length ? recent[0].p : null;
}

/** The rule lines of the stage's taste step the first time the film's stage is named in a session (`sessionId` from the hook's stdin; null counts all sessions as one); [] after that, or for a stage with no step. */
export function tasteOnce(stage, name, root, sessionId = null) {
  const step = stepOf(stage);
  if (!step || sinceReset(readRuns(name, root), sessionId).some((r) => r.cmd === 'taste-shown' && r.stage === stage && r.shownTo === sessionId)) return [];
  appendRun(name, { cmd: 'taste-shown', stage, shownTo: sessionId }, { root });
  return tasteLines(step);
}

/** The session id in the hook's stdin JSON, or null when stdin is empty, a terminal or not JSON. */
export function sessionOf(input) {
  try { return JSON.parse(input).session_id ?? null; } catch { return null; }
}

const VAWE_VERB = /(?:^|[;&|(])\s*(?:\w+=\S*\s+)*(?:\S*\/)?vawe\s+[a-z]/;
const HELP_ONLY = /\s(?:--help|-h)(?:\s|$)/;

const COMMAND_FILM = /films\/(?:examples\/)?[^/\s'"]+\/(?:page\.html|ch\/[^/\s'"]+\.html)/;

/** The page a vawe command names (films/<name>/page.html, relative or absolute) when it exists under `root`, else null. */
export function commandPage(cmd, root) {
  const rel = COMMAND_FILM.exec(cmd)?.[0];
  return rel && fs.existsSync(path.join(root, rel)) ? path.join(root, rel) : null;
}

/** What the PostToolUse hook says after a Bash call that ran a vawe verb: the stage line of the film the command names (else the film edited most recently) when it changed since this agent last saw it, else null. A subagent gets no UserPromptSubmit, so this is how its stage reaches it. */
export function afterToolSay(input, page, root) {
  const cmd = input.tool_input?.command ?? '';
  const target = commandPage(cmd, root) ?? page;
  if (!target || !VAWE_VERB.test(cmd) || HELP_ONLY.test(cmd)) return null;
  const s = nextStep(target, root);
  const sessionId = input.session_id ?? null;
  const agent = input.agent_id ?? null;
  if (nextSeen(s.name, { next: s.next, why: s.why }, { root, sessionId, agent })) return null;
  return [`vawe: ${s.name}: ${s.why}.\n  next: ${s.next}`, ...tasteOnce(s.stage, s.name, root, sessionId)].join('\n');
}

function afterTool() {
  let input;
  try { input = JSON.parse(read(0)); } catch { return; }
  const root = input.cwd && fs.existsSync(path.join(input.cwd, 'films')) ? input.cwd : process.cwd();
  const text = afterToolSay(input, recentPage(root), root);
  if (text) console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: text } }));
}

function main() {
  const root = process.cwd();
  if (process.argv.includes('--after-tool')) return afterTool();
  if (process.argv.includes('--reset')) return resetShown(root, sessionOf(process.stdin.isTTY ? '' : read(0)));
  const stale = staleCheckoutLine(root);
  if (stale) console.log(`vawe: ${stale}`);
  const mainLine = mainCheckoutLine(root);
  if (mainLine) console.log(`vawe: ${mainLine}`);
  const page = recentPage(root);
  if (!page) return;
  const s = nextStep(page, root);
  const sessionId = sessionOf(process.stdin.isTTY ? '' : read(0));
  const said = nextSeen(s.name, { next: s.next, why: s.why }, { root, sessionId }) ? `vawe: ${s.name} [${s.stage}]: ${NEXT_UNCHANGED}` : `vawe: ${s.name}: ${s.why}.\n  next: ${s.next}`;
  console.log([said, ...tasteOnce(s.stage, s.name, root, sessionId)].join('\n'));
}

if (import.meta.url === `file://${process.argv[1]}`) main();
