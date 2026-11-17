#!/usr/bin/env node
// Runs before `vawe ship`: refuses a final render without a fresh review of the current page (a judge verdict, or a critique from another session) and without the owner's
// approval of it. Each refusal line ends with the command to run. An unattended run skips both and says so.
//   node harness/live/ship-approval.mjs <page.html>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { shipProblems } from '../guards/stage-gate.mjs';
import { EXIT } from '../lib/exit-codes.mjs';
import { runAsMain } from '../lib/step.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export async function run(args, { env, out, err }) {
  const [page] = args.filter((a) => !a.startsWith('--'));
  if (page && !fs.existsSync(page)) {
    err(`vawe: ship: no such page: ${page}\n`);
    return EXIT.IO;
  }
  const problems = page ? shipProblems(page, { root: ROOT, env }) : [];
  if (problems.length) {
    for (const problem of problems) err(`vawe: ship refused: ${problem}\n`);
    return EXIT.REFUSED;
  }
  if (env.VAWE_UNATTENDED === '1') out('vawe: ship runs unattended: no fresh review and no OK from the person checked\n');
  return 0;
}

await runAsMain(import.meta.url, run);
