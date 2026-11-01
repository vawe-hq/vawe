#!/usr/bin/env node
// The person's OK, from /vawe-approve. Records the step that is waiting: the plan (Directions and Board in brief.md) until it is approved, then the full draft.
// A final render (`vawe ship`) needs both, each unchanged since. An agent never runs this: harness/live/no-blanket-git.mjs refuses the call.
// `--reject [--note "..."]` records the rejection and withdraws both approvals. Both append to the film's run log.
//   node harness/live/approve.mjs [<page.html> | <film name>] [--param k=v] [--aspect W:H] [--reject] [--note text]    (no page: the film edited last)
// A refusal prints its reason on stdout and exits 0, so the /vawe-approve skill text carries it to the model.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { approveStep, approveProblem, planProblem, writeApproval, writePlanApproval, recordOwnerVerdict } from '../lib/approval.mjs';
import { renderEnv } from '../lib/page-params.mjs';
import { recentPage } from './stage-say.mjs';

const ROOT = process.env.VAWE_ROOT ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
const noteAt = args.indexOf('--note');
const note = noteAt >= 0 ? args[noteAt + 1] ?? null : null;
const reject = args.includes('--reject');
const valuesOf = (flag) => args.flatMap((a, i) => (a === flag ? [args[i + 1]] : []));
const aspect = valuesOf('--aspect')[0];
const valueAt = new Set(args.flatMap((a, i) => (['--note', '--param', '--aspect'].includes(a) ? [i + 1] : [])));
const [given] = args.filter((a, i) => !a.startsWith('--') && !valueAt.has(i));
const refuse = (reason) => console.log(`vawe: approve refused: ${reason}`);
try {
  Object.assign(process.env, renderEnv({ param: valuesOf('--param'), aspect }));
} catch (e) {
  refuse(e.message);
  process.exit(0);
}

const target = given ? (given.endsWith('.html') ? given : path.join('films', given, 'page.html')) : recentPage(ROOT);
const page = target ? path.resolve(ROOT, target) : null;
if (!page || !fs.existsSync(page)) {
  refuse(`no film found for ${given ?? 'the film edited last'}: name the film, for example /vawe-approve my-launch`);
  process.exit(0);
}

const step = approveStep(page, { root: ROOT });
if (reject) {
  recordOwnerVerdict(page, { verdict: 'reject', note, step, root: ROOT });
  console.log(`rejected the ${step} of ${page}${note ? `: ${note}` : ''}`);
} else {
  const problem = step === 'plan' ? planProblem(page) : approveProblem(page, { root: ROOT });
  if (problem) {
    refuse(problem);
    process.exit(0);
  }
  if (step === 'plan') {
    writePlanApproval(page, { root: ROOT });
    recordOwnerVerdict(page, { verdict: 'approve', note, step, root: ROOT });
    console.log(`OK on the plan of ${page}. Next: the full draft, then your OK on the draft.`);
  } else {
    const record = writeApproval(page, { root: ROOT });
    recordOwnerVerdict(page, { verdict: 'approve', note, step, root: ROOT });
    console.log(`OK on the draft ${record.draft}. The final video can now be made.`);
  }
}
