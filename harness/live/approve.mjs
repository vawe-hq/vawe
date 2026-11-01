#!/usr/bin/env node
// The person's OK, from /vawe-approve. Records the step that is waiting: the plan (Directions and Board in brief.md) until it is approved, then the full draft.
// A final render (`vawe ship`) needs both, each unchanged since. An agent never runs this: harness/live/no-blanket-git.mjs refuses the call.
// `--reject [--note "..."]` records the rejection and withdraws both approvals. Both append to the film's run log.
//   node harness/live/approve.mjs [<page.html> | <film name>] [--reject] [--note text]    (no page: the film edited last)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { approveStep, approveProblem, planProblem, writeApproval, writePlanApproval, recordOwnerVerdict } from '../lib/approval.mjs';
import { recentPage } from './stage-say.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
const noteAt = args.indexOf('--note');
const note = noteAt >= 0 ? args[noteAt + 1] ?? null : null;
const reject = args.includes('--reject');
const [given] = args.filter((a, i) => !a.startsWith('--') && i !== noteAt + 1);

const target = given ? (given.endsWith('.html') ? given : path.join('films', given, 'page.html')) : recentPage(ROOT);
const page = target ? path.resolve(ROOT, target) : null;
if (!page || !fs.existsSync(page)) {
  console.error(`vawe: approve refused: no film found for ${given ?? 'the film edited last'}: name the film, for example /vawe-approve my-launch`);
  process.exit(1);
}

const step = approveStep(page, { root: ROOT });
if (reject) {
  recordOwnerVerdict(page, { verdict: 'reject', note, step, root: ROOT });
  console.log(`rejected the ${step} of ${page}${note ? `: ${note}` : ''}`);
} else {
  const problem = step === 'plan' ? planProblem(page) : approveProblem(page, { root: ROOT });
  if (problem) {
    console.error(`vawe: approve refused: ${problem}`);
    process.exit(1);
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
