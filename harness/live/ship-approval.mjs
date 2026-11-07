#!/usr/bin/env node
// Runs before `vawe ship`: refuses a final render without a fresh review of the current page (a judge verdict, or a critique from another session) and without the owner's
// approval of it. Each refusal line ends with the command to run. An unattended run skips both and says so.
//   node harness/live/ship-approval.mjs <page.html>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { shipProblem } from '../lib/approval.mjs';
import { critiqueProblem } from '../lib/critique-gate.mjs';
import { EXIT, fail } from '../lib/exit-codes.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const [page] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
if (page && !fs.existsSync(page)) fail(EXIT.IO, `vawe: ship: no such page: ${page}`);
const problems = page ? [critiqueProblem(page, { root: ROOT }), shipProblem(page, { root: ROOT })].filter(Boolean) : [];
if (problems.length) {
  for (const problem of problems) console.error(`vawe: ship refused: ${problem}`);
  process.exit(EXIT.REFUSED);
}
if (process.env.VAWE_UNATTENDED === '1') console.log('vawe: ship runs unattended: no fresh review and no OK from the person checked');
