// The stage gate: may this tool run now? Only the stage order and the approval refuse. The stage comes from nextStep
// (harness/live/stage-say.mjs), the one owner of the loop's order; the ship check is the one the ship hook runs.
import fs from 'node:fs';
import path from 'node:path';
import { nextStep } from '../live/stage-say.mjs';
import { boardFilled } from '../lib/board.mjs';
import { loopState } from '../lib/loop-state.mjs';
import { shipProblem } from '../lib/approval.mjs';
import { critiqueProblem } from '../lib/critique-gate.mjs';

const FROM_CRITIQUE = new Set(['critique', 'approve', 'ship', 'judge']);
const ALWAYS = new Set(['vawe_status', 'vawe_read_rules', 'vawe_write_page', 'vawe_edit_page']);

/** The checkout root of a film folder: the folder above `films/`. */
export function rootOf(filmDir) {
  const parts = path.resolve(filmDir).split(path.sep);
  const at = parts.lastIndexOf('films');
  return at > 0 ? parts.slice(0, at).join(path.sep) || path.sep : path.resolve(filmDir, '..', '..');
}

/** The reasons a final render may not start (no fresh review, no OK from the person), as the ship hook prints them. */
export const shipProblems = (page, { root, env = process.env } = {}) =>
  [critiqueProblem(page, { root, env }), shipProblem(page, { root, env })].filter(Boolean);

// `next` is a stage from nextStep or plain words; `step` is the same next step as data.
const nextOf = (next) => (next !== null && typeof next === 'object' ? { next: next.next, step: next.step } : { next, step: next });
const refuse = (reason, next) => ({ allow: false, reason, ...nextOf(next) });
const allow = (next = null) => ({ allow: true, reason: null, ...nextOf(next) });
const verdict = (ok, reason, next) => (ok ? allow(next) : refuse(reason, next));

// Each rule gets { page, hasPage, stage, step, mode, root, env } and answers { allow, reason, next }.
const RULES = {
  vawe_frame: ({ hasPage, step, mode, page, root }) => {
    if (!hasPage) return refuse('no page.html yet: frames come after the page is written', step);
    const needsDraft = mode === 'cuts' || mode === 'moment';
    return verdict(!needsDraft || loopState(page, root).draft, 'no draft yet: cuts and moments are read from a draft', step);
  },
  vawe_render_draft: ({ hasPage, step }) => verdict(hasPage, 'no page.html yet: write the page, then render', step),
  vawe_look: ({ hasPage, page, root, step }) => verdict(hasPage && loopState(page, root).draft, 'no draft to look at', step),
  vawe_critique: ({ hasPage, stage, step }) => verdict(hasPage && FROM_CRITIQUE.has(stage), `the motion pass is not done: ${step.why}`, step),
  vawe_ship: ({ hasPage, page, root, env, step }) => {
    if (!hasPage) return refuse('no page.html to ship', step);
    const problems = shipProblems(page, { root, env });
    return verdict(!problems.length, problems.join('; '), step);
  },
};

/** The stage of the film for the gate: a filled board that only waits for the person's OK on the plan counts as 'plan'. */
function gateStage(step, dir) {
  const filled = step.stage === 'board' && boardFilled(fs.readFileSync(path.join(dir, 'brief.md'), 'utf8'));
  return filled ? 'plan' : step.stage;
}

/**
 * { allow, reason, next } for a tool of the plan's tool contract on the film in filmDir. next is the one next step of the film.
 * opts.mode is the vawe_frame mode (world, board, cuts, moment, directions); opts.root the checkout root; opts.env for VAWE_UNATTENDED.
 */
export function stageGate(filmDir, tool, { mode = null, root = rootOf(filmDir), env = process.env } = {}) {
  const dir = path.resolve(filmDir);
  const page = path.join(dir, 'page.html');
  if (tool === 'vawe_new_film') return verdict(!fs.existsSync(dir), `${path.relative(root, dir)} exists`, 'pick another name, or work on the film that exists');
  if (!fs.existsSync(dir)) return refuse(`no film folder ${path.relative(root, dir)}`, 'vawe_new_film');
  const step = nextStep(page, root);
  if (ALWAYS.has(tool)) return allow(step);
  const rule = RULES[tool];
  if (!rule) return refuse(`unknown tool ${tool}`, step);
  return rule({ page, hasPage: fs.existsSync(page), stage: gateStage(step, dir), step, mode, root, env });
}
