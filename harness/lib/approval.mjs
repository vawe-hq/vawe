// The owner's approval of a film's draft: out/<film>.approved. A final render needs one that matches the page now.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { filmKeyOf, agentId, namedAgent, appendRun } from './runlog.mjs';
import { approveEvent } from './run-events.mjs';
import { paramsFilm } from './page-params.mjs';

const TEXT_FILE = /\.(html|css|m?js|svg)$/i;
const FILE_TOKEN = /[\w@./-]+\.[a-z0-9]{2,5}\b/gi;

export const SHOW_OWNER = 'show the draft to the owner (storyboard: bin/vawe frame <draft>) and stop';

export const approvalPath = (film, root = '.') => path.join(root, 'out', `${paramsFilm(filmKeyOf(film))}.approved`);
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

/** The reason a final render may not start, or null when it may. VAWE_UNATTENDED=1 (hill-climb, CI, the A/B test) needs no approval. */
export function shipProblem(pagePath, { root = '.', env = process.env } = {}) {
  if (env.VAWE_UNATTENDED === '1') return null;
  const approval = readApproval(pagePath, root);
  if (!approval) return `no approval for ${filmKeyOf(pagePath)}: ${SHOW_OWNER}; the owner then runs bin/vawe approve ${pagePath}`;
  if (approval.page !== pageDigest(pagePath)) return `the page changed after the approval (${approval.at}): ${SHOW_OWNER}; the owner then runs bin/vawe approve ${pagePath}`;
  return null;
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
  const record = { page: pageDigest(pagePath), draft: path.relative(root, draft), draftBytes: fs.statSync(draft).size, by: agentId(), at: now.toISOString() };
  fs.mkdirSync(path.dirname(approvalPath(pagePath, root)), { recursive: true });
  fs.writeFileSync(approvalPath(pagePath, root), `${JSON.stringify(record, null, 2)}\n`);
  return record;
}

/** The draft the owner judged: { draft, draftMtime } as relative path and ISO mtime, nulls when there is no draft. */
export function draftStamp(pagePath, { root = '.' } = {}) {
  const draft = fullDraftPath(pagePath, root);
  if (!fs.existsSync(draft)) return { draft: null, draftMtime: null };
  return { draft: path.relative(root, draft), draftMtime: fs.statSync(draft).mtime.toISOString() };
}

/** Records the owner's verdict in the run log. A reject also removes the approval, so the draft cannot ship until the owner approves again. */
export function recordOwnerVerdict(pagePath, { verdict, note = null, root = '.' }) {
  if (verdict === 'reject') fs.rmSync(approvalPath(pagePath, root), { force: true });
  return appendRun(pagePath, approveEvent({ verdict, note, ...draftStamp(pagePath, { root }), pageHash: pageDigest(pagePath) }), { root });
}

/** True when the approver is a named agent (VAWE_AGENT) that also ran other verbs on the film: the author approved its own draft. */
export function selfApproved(approval, runs) {
  const by = namedAgent(approval?.by);
  return Boolean(by) && runs.some((r) => r.agent === by && r.verb !== 'approve' && r.cmd !== 'approve');
}
