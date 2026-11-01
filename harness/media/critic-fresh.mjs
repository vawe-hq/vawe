#!/usr/bin/env node
// The last step of `vawe critique --fresh`: a separate headless claude session (Read tool only) critiques the draft and the views the earlier steps wrote.
//   node harness/media/critic-fresh.mjs <page.html> --since <ms> [--ref ref.mp4] [--model name]
// Writes out/<film>.critique-<n>.md and prints its path and the REJECT or PASS line. Exit 2 when the claude CLI is missing.
// Tells bin/vawe the critique was fresh (noteVerb), so the ship gate (harness/lib/critique-gate.mjs) accepts it from the author's own session.
// Env: VAWE_CRITIC_TIMEOUT (seconds, default 900).
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runFreshSession, requireClaude } from '../lib/fresh-session.mjs';
import { criticTemplate, criticPrompt, verdictLine, critiqueFiles } from '../lib/critic-prompt.mjs';
import { filmKey, freshImages, pngsSince } from '../lib/critique-summary.mjs';
import { fullDraftPath } from '../lib/approval.mjs';
import { writeDraftSheet } from './draft-sheet.mjs';
import { scratch, scratchBase } from '../lib/scratch.mjs';
import { noteVerb } from '../lib/verb-log.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const die = (m, code = 1) => { console.error(`vawe critique --fresh: ${m}`); process.exit(code); };
const arg = (k) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : null; };
const existing = (file) => (file && fs.existsSync(file) ? path.resolve(file) : null);

const page = process.argv[2];
if (!page || page.startsWith('--')) die('usage: node harness/media/critic-fresh.mjs <page.html> --since <ms> [--ref ref.mp4] [--model name]', 2);
try { requireClaude(); } catch (e) { die(e.message, e.exitCode); }

const skill = path.join(repoRoot, 'skills/vawe-critique/SKILL.md');
const template = criticTemplate(fs.readFileSync(skill, 'utf8'));
if (!template) die(`${skill} no longer holds the quoted critic prompt in "The critic prompt, and the panel"`);

const film = filmKey(page);
const files = critiqueFiles(path.resolve('out'), film);
const inputs = {
  page: path.resolve(page),
  mp4: existing(fullDraftPath(film)),
  ref: existing(arg('--ref')),
  brief: existing(path.join(path.dirname(page), 'brief.md')),
  previous: files.previous,
  images: freshImages(scratch('see', film), Number(arg('--since') || 0)),
};
const draftMp4 = inputs.mp4;
const stripDir = path.resolve('out', 'strip', film);
if (draftMp4 && !pngsSince(stripDir, draftMp4).length) spawnSync('node', [path.join(repoRoot, 'harness/media/see.mjs'), page, '--cuts'], { encoding: 'utf8' });
const sheet = draftMp4 ? draftMp4.replace(/\.mp4$/, '.png') : null;
if (sheet && !(fs.existsSync(sheet) && fs.statSync(sheet).mtimeMs >= fs.statSync(draftMp4).mtimeMs)) {
  try { writeDraftSheet({ video: draftMp4, out: sheet, fps: 30 }); } catch { /* the critic still gets the other views */ }
}
inputs.images = [...new Set([...inputs.images, ...(sheet && fs.existsSync(sheet) ? [sheet] : []), ...pngsSince(stripDir, draftMp4)])];
if (!inputs.images.some((f) => f.endsWith('.png'))) die('no view images of the draft were written: run bin/vawe dev <page> first, then critique --fresh again; the critic needs to see the frames', 2);
const dirs = [...new Set([path.dirname(inputs.page), path.resolve('out'), scratchBase(), repoRoot, ...(inputs.ref ? [path.dirname(inputs.ref)] : [])])];

let text;
try { ({ text } = runFreshSession({ prompt: criticPrompt(template, inputs), dirs, cwd: repoRoot, timeoutS: Number(process.env.VAWE_CRITIC_TIMEOUT || 900), timeoutVar: 'VAWE_CRITIC_TIMEOUT', model: arg('--model'), name: 'critic' })); } catch (e) { die(e.message, e.exitCode ?? 1); }
const verdict = verdictLine(text);

fs.mkdirSync(path.dirname(files.next), { recursive: true });
fs.writeFileSync(files.next, `${text.trim()}\n`);
if (!verdict) die(`the critic reply did not end with a REJECT or PASS line; it is saved as ${path.relative('.', files.next)}: ${text.slice(-300)}`);
noteVerb({ fresh: true, verdict: verdict.split(/\b/)[0] });
console.log(`critique: ${path.relative('.', files.next)}\n${verdict}`);
