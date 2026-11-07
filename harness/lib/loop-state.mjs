// The one owner of where a film stands in the loop (AGENTS.md, The loop). Every fact is a content digest: the page's now, the digest each render's sidecar
// recorded (harness/lib/render-meta.mjs), the digest each critique logged, and the digests the person's two approvals hold. No reader compares mtimes itself.
import fs from 'node:fs';
import path from 'node:path';
import { pageDigest, planDigest, planState, draftState, editedMs } from './approval.mjs';
import { readRuns } from './runlog.mjs';
import { renderState } from './render-meta.mjs';
import { paramsFilm } from './page-params.mjs';
import { isEditFilm, cutListFilled } from './plan-parts.mjs';

/** Every stage name of the loop, in order. `trace` is the name the trace review logs it under (harness/lib/trace/stages.mjs), only for the stages a verb call can show. */
export const LOOP_STAGES = [
  { name: 'new', trace: 'new' },
  { name: 'brief' },
  { name: 'study', trace: 'study' },
  { name: 'moves' },
  { name: 'design', trace: 'design' },
  { name: 'skills' },
  { name: 'page', trace: 'page' },
  { name: 'states', trace: 'frames' },
  { name: 'cut' },
  { name: 'ideas', trace: 'ideas' },
  { name: 'board', trace: 'storyboard' },
  { name: 'animatic', trace: 'board' },
  { name: 'plan' },
  { name: 'draft', trace: 'dev' },
  { name: 'motion', trace: 'motion' },
  { name: 'critique', trace: 'critique' },
  { name: 'judge', trace: 'judge', optional: true },
  { name: 'fix', trace: 'fix', optional: true },
  { name: 'approve', trace: 'approve', optional: true },
  { name: 'ship', trace: 'ship', optional: true },
];

/** The folder of the film a page belongs to: a long-form chapter page (films/<name>/ch/<nn>-x.html) belongs to the film above ch/. */
export const filmDirOf = (page) => {
  const dir = path.dirname(path.resolve(page));
  return path.basename(dir) === 'ch' ? path.dirname(dir) : dir;
};

const ranJudge = (r, digest) => r.cmd === 'judge' && r.pageHash === digest;
const ranCritique = (r, digest) => r.cmd === 'verb' && r.verb === 'critique' && r.exitCode === 0 && r.pageHash === digest;

/** The review of the page at `digest` from the run log: { digest, fresh, judged, records } or null when none ran on exactly this page. `fresh`: a critique that started its own session; `judged`: a judge verdict. */
export function critiqueAt(runs, digest) {
  const records = runs.filter((r) => ranCritique(r, digest));
  const judged = runs.some((r) => ranJudge(r, digest));
  return records.length || judged ? { digest, fresh: records.some((r) => r.fresh), judged, records } : null;
}

/** The facts of the film's loop for `page`, from digests only: { pageDigest, draft, final, critique, plan: { digest, cutList }, approval: { plan, draft } }. draft and final are { digest, path, current } or null. */
export function loopState(page, root = '.') {
  const digest = pageDigest(page);
  const film = paramsFilm(path.basename(filmDirOf(page)));
  const edited = () => editedMs(page);
  const brief = (() => { try { return fs.readFileSync(path.join(filmDirOf(page), 'brief.md'), 'utf8'); } catch { return ''; } })();
  return {
    pageDigest: digest,
    draft: renderState(path.join(root, 'out', `${film}-draft.mp4`), digest, edited),
    final: renderState(path.join(root, 'out', `${film}.mp4`), digest, edited),
    critique: critiqueAt(readRuns(path.basename(filmDirOf(page)), root), digest),
    plan: { digest: planDigest(page), cutList: isEditFilm(brief) ? cutListFilled(brief) : null },
    approval: { plan: planState(page, { root }), draft: draftState(page, { root }) },
  };
}
