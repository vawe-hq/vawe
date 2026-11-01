// The person's two approvals of a film: the plan (out/<film>.plan-approved) and the full draft (out/<film>.approved). A final render needs both, each matching what was approved.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { filmKeyOf, agentId, namedAgent, appendRun } from './runlog.mjs';
import { approveEvent } from './run-events.mjs';
import { paramsFilm } from './page-params.mjs';
import { sectionOf } from './board.mjs';
import { parseDirections } from './directions.mjs';

const TEXT_FILE = /\.(html|css|m?js|svg)$/i;
const FILE_TOKEN = /[\w@./-]+\.[a-z0-9]{2,5}\b/gi;

export const ASK_OK = 'end your message with one line, "If you like it, type /vawe-approve", and stop';
export const SHOW_PLAN = `show the person the directions board (bin/vawe frame <page> --directions) and the Board, then ${ASK_OK}`;
export const SHOW_OWNER = `show the person the draft (storyboard: bin/vawe frame <draft>), then ${ASK_OK}`;

export const approvalPath = (film, root = '.') => path.join(root, 'out', `${paramsFilm(filmKeyOf(film))}.approved`);
export const planApprovalPath = (film, root = '.') => path.join(root, 'out', `${paramsFilm(filmKeyOf(film))}.plan-approved`);
export const fullDraftPath = (film, root = '.') => path.join(root, 'out', `${paramsFilm(filmKeyOf(film))}-draft.mp4`);

/** The page and every file it names inside its folder, followed through css, js and svg, sorted. */
export function referencedFiles(pagePath) {
  const dir = path.dirname(path.resolve(pagePath));
  const seen = new Set();
  const visit = (file) => {
    if (seen.has(file)) return;
    seen.add(file);
    if (!TEXT_FILE.test(file)) return;
    for (const token of fs.readFileSync(file, 'utf8').match(FILE_TOKEN) ?? []) {
      const target = path.resolve(path.dirname(file), token.replace(/^\//, ''));
      if (target.startsWith(dir + path.sep) && fs.existsSync(target) && fs.statSync(target).isFile()) visit(target);
    }
  };
  visit(path.resolve(pagePath));
  return [...seen].sort();
}

/** One sha over the bytes of the page and the files it references: a touch or a rebase keeps it, an edit changes it. */
export function pageDigest(pagePath) {
  const dir = path.dirname(path.resolve(pagePath));
  const h = createHash('sha1');
  for (const file of referencedFiles(pagePath)) h.update(`${path.relative(dir, file)}:`).update(fs.readFileSync(file)).update(';');
  return h.digest('hex');
}

export function readApproval(film, root = '.') {
  try { return JSON.parse(fs.readFileSync(approvalPath(film, root), 'utf8')); } catch { return null; }
}

export function readPlanApproval(film, root = '.') {
  try { return JSON.parse(fs.readFileSync(planApprovalPath(film, root), 'utf8')); } catch { return null; }
}

const briefPath = (pagePath) => path.join(path.dirname(path.resolve(pagePath)), 'brief.md');
const readBrief = (pagePath) => { try { return fs.readFileSync(briefPath(pagePath), 'utf8'); } catch { return null; } };

/** One sha over the Directions (with the picked line) and the Board of brief.md, or null when it has neither. The rest of the brief fills in while the film is made, so it stays out. */
export function planDigest(pagePath) {
  const brief = readBrief(pagePath);
  const parts = brief == null ? [] : ['Directions', 'Board'].map((title) => sectionOf(brief, title)).filter((s) => s !== undefined);
  return parts.length ? createHash('sha1').update(parts.map((s) => s.trim()).join('\n;\n')).digest('hex') : null;
}

/** 'none' when the person has not approved the plan, 'stale' when the Directions or the Board changed since, else 'fresh'. */
export function planState(pagePath, { root = '.' } = {}) {
  const approval = readPlanApproval(pagePath, root);
  if (!approval) return 'none';
  return approval.plan && approval.plan === planDigest(pagePath) ? 'fresh' : 'stale';
}

/** The step the person's next /vawe-approve records: the plan until it is fresh, then the draft. */
export const approveStep = (pagePath, { root = '.' } = {}) => (planState(pagePath, { root }) === 'fresh' ? 'draft' : 'plan');

/** The reason a draft stands unchanged since the person approved it, or null: the page digest and the draft file (size, mtime) must both match. */
const draftChange = (approval, pagePath, root) => {
  if (approval.page !== pageDigest(pagePath)) return 'the page changed';
  const draft = fullDraftPath(pagePath, root);
  const now = fs.existsSync(draft) ? fs.statSync(draft) : null;
  return now && (now.size !== approval.draftBytes || now.mtimeMs !== approval.draftMtimeMs) ? 'the draft was rendered again' : null;
};

/** The reason a final render may not start, or null when it may. VAWE_UNATTENDED=1 (hill-climb, CI, the A/B test) needs no approval. */
export function shipProblem(pagePath, { root = '.', env = process.env } = {}) {
  if (env.VAWE_UNATTENDED === '1') return null;
  const film = filmKeyOf(pagePath);
  const plan = planState(pagePath, { root });
  if (plan === 'none') return `waiting for your OK on the plan of ${film}: ${SHOW_PLAN}`;
  if (plan === 'stale') return `the plan of ${film} changed after your OK (${readPlanApproval(pagePath, root).at}): ${SHOW_PLAN}`;
  const approval = readApproval(pagePath, root);
  if (!approval) return `waiting for your OK on the draft of ${film}: ${SHOW_OWNER}`;
  const change = draftChange(approval, pagePath, root);
  return change ? `${change} after your OK on the draft (${approval.at}): ${SHOW_OWNER}` : null;
}

/** The reason the plan cannot be approved, or null: it needs a Directions section (with a picked line) or a Board. */
export function planProblem(pagePath) {
  const brief = readBrief(pagePath);
  if (planDigest(pagePath) === null) return `no plan to approve: write the Directions and the Board in ${path.relative('.', briefPath(pagePath))}`;
  const directions = parseDirections(brief);
  return directions.found && !directions.picked?.id ? `the plan has no picked direction: show the directions board, ask the person to pick one, write the picked line in ${path.relative('.', briefPath(pagePath))}` : null;
}

/** The reason a draft cannot be approved, or null: a full draft (no --from, --to) newer than the page and its files. */
export function approveProblem(pagePath, { root = '.' } = {}) {
  const draft = fullDraftPath(pagePath, root);
  if (!fs.existsSync(draft)) return `no full draft: run bin/vawe dev ${pagePath} without --from and --to first`;
  const edited = Math.max(...referencedFiles(pagePath).map((f) => fs.statSync(f).mtimeMs));
  return fs.statSync(draft).mtimeMs >= edited ? null : `the draft is older than the page: run bin/vawe dev ${pagePath} first`;
}

/** Writes the approval for the page as it is now and returns the record. */
export function writeApproval(pagePath, { root = '.', now = new Date() } = {}) {
  const draft = fullDraftPath(pagePath, root);
  const stat = fs.statSync(draft);
  const record = { page: pageDigest(pagePath), draft: path.relative(root, draft), draftBytes: stat.size, draftMtimeMs: stat.mtimeMs, by: agentId(), at: now.toISOString() };
  fs.mkdirSync(path.dirname(approvalPath(pagePath, root)), { recursive: true });
  fs.writeFileSync(approvalPath(pagePath, root), `${JSON.stringify(record, null, 2)}\n`);
  return record;
}

/** Writes the plan approval for the Directions and Board as they are now and returns the record. */
export function writePlanApproval(pagePath, { root = '.', now = new Date() } = {}) {
  const record = { plan: planDigest(pagePath), by: agentId(), at: now.toISOString() };
  fs.mkdirSync(path.dirname(planApprovalPath(pagePath, root)), { recursive: true });
  fs.writeFileSync(planApprovalPath(pagePath, root), `${JSON.stringify(record, null, 2)}\n`);
  return record;
}

/** The draft the owner judged: { draft, draftMtime } as relative path and ISO mtime, nulls when there is no draft. */
export function draftStamp(pagePath, { root = '.' } = {}) {
  const draft = fullDraftPath(pagePath, root);
  if (!fs.existsSync(draft)) return { draft: null, draftMtime: null };
  return { draft: path.relative(root, draft), draftMtime: fs.statSync(draft).mtime.toISOString() };
}

/** Records the owner's verdict in the run log. A reject also removes both approvals, so the film cannot ship until the person approves again. */
export function recordOwnerVerdict(pagePath, { verdict, note = null, step = 'draft', root = '.' }) {
  if (verdict === 'reject') for (const file of [approvalPath(pagePath, root), planApprovalPath(pagePath, root)]) fs.rmSync(file, { force: true });
  return appendRun(pagePath, approveEvent({ verdict, note, step, ...draftStamp(pagePath, { root }), pageHash: pageDigest(pagePath) }), { root });
}

/** True when the approver is a named agent (VAWE_AGENT) that also ran other verbs on the film: the author approved its own draft. */
export function selfApproved(approval, runs) {
  const by = namedAgent(approval?.by);
  return Boolean(by) && runs.some((r) => r.agent === by && r.verb !== 'approve' && r.cmd !== 'approve');
}
