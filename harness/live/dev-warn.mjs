#!/usr/bin/env node
// Runs before `vawe dev` renders: prints the plan status (what is empty or stale, the plan findings, the bans the page itself shows, the ban
// lines, one next command), at most 8 lines, nothing when the plan is filled and the page is clean. Advice only: the exit code is always 0.
//   node harness/live/dev-warn.mjs <page.html>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readBrief } from '../lib/brief-tables.mjs';
import { planFindings, planLines } from '../lib/plan-findings.mjs';
import { attractorProblems } from '../lib/directions.mjs';
import { pageAuthoring } from '../lib/motion-stamp.mjs';
import { ideasFilled } from '../lib/ideas.mjs';
import { statedLength } from '../media/page-duration.mjs';
import { readRuns, looksSince, isBoardRun, readHookSeen } from '../lib/runlog.mjs';
import { isClipDemo } from '../lib/clip-demo.mjs';
import { nextStep, isTestPage } from './stage-say.mjs';
import { planStatusLines } from './plan-status.mjs';
import { readPlan } from '../media/plan-read.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (p) => { try { return fs.readFileSync(p, 'utf8'); } catch { return null; } };
const mtime = (p) => { try { return fs.statSync(p).mtimeMs; } catch { return 0; } };

const worldIds = (html) => [...html.matchAll(/\bdata-world="([^"]+)"/g)].flatMap((m) => m[1].split('+'));

/** The facts planStatusLines needs, read from the page's files and the run log. `opened` is the opened page's plan (plan-read.mjs readPlan), or null for the files alone. */
export function readPlanState(pagePath, root = ROOT, opened = null) {
  const abs = path.resolve(pagePath);
  const name = path.basename(path.dirname(abs));
  const rel = path.relative(root, abs);
  const html = read(abs) ?? '';
  const brief = read(path.join(path.dirname(abs), 'brief.md'));
  const frames = mtime(path.join(root, 'out', `${name}-frames.png`));
  const found = opened?.findings ?? (brief === null ? [] : planFindings({ brief: readBrief(abs), duration: Number(statedLength(html)), probe: null, worlds: worldIds(html), authoring: pageAuthoring(abs) }));
  const covered = ideasFilled(brief ?? '') === false ? 'ideas-missing' : null;
  const findings = [...(brief === null ? [] : attractorProblems(brief)), ...planLines(found.filter((f) => f.code !== covered), root)];
  const step = nextStep(abs, root);
  const draft = mtime(path.join(root, 'out', `${name}-draft.mp4`));
  const looked = draft ? { ...looksSince(name, draft, root), hook: readHookSeen(root, undefined, draft) } : null;
  return {
    name, rel, brief, findings, looked, page: opened?.advice ?? [],
    design: read(path.join(path.dirname(abs), 'DESIGN.md')),
    early: !mtime(path.join(root, 'out', `${name}-draft.mp4`)) && !mtime(path.join(root, 'out', `${name}.mp4`)),
    frames: !frames ? 'none' : frames < mtime(abs) ? 'stale' : 'ok',
    storyboardRan: readRuns(name, root).some((r) => isBoardRun(r) && r.exitCode === 0),
    digest: read(path.join(root, 'taste', 'build', 'DIGEST.md')) ?? '',
    next: step.stage === 'draft' ? `bin/vawe frame ${rel} --board` : step.next,
  };
}

/** The opened page's plan, or null with one line on stderr when the page cannot be read: the render that follows names the real error. */
/** The note for a page whose length is auto: the brief's length check needs a number and waits for the render, which finds it. [] for a page that states one. */
export function lengthNote(html) {
  return statedLength(html) === 'auto' ? ['length: auto (the dev render finds it; the brief length check waits for that number)'] : [];
}

async function readPage(page) {
  try { return await readPlan(path.resolve(page)); } catch (e) {
    console.error(`plan: the page was not read before the render: ${String(e.message).split('\n')[0]}`);
    return null;
  }
}

const [page] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
if (page && !isClipDemo(page) && !isTestPage(page, ROOT) && import.meta.url === `file://${process.argv[1]}`) {
  const lines = [...lengthNote(fs.readFileSync(page, 'utf8')), ...planStatusLines(readPlanState(page, ROOT, await readPage(page)))];
  if (lines.length) console.log(`${lines.join('\n')}\n`);
  process.exit(0);
}
