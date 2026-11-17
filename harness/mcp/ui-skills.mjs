// vawe_ui_skills: the ui-skills registry CLI for an agent with no shell. `command npx -y ui-skills <action>` is how the repo calls it
// (prompts/skill-combos.md); a child process here has no shell hook to rewrite npx, so it runs npx directly. Each skill fetched for a
// film is logged to out/<film>.ui-skills.jsonl, so DESIGN.md can be checked against what was actually read.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export const UI_SKILLS_ACTIONS = ['start', 'categories', 'list', 'get'];
export const SLUG = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
export const CATEGORY = /^[a-z0-9][a-z0-9-]*$/;
const LIMIT_MS = 90_000;
const MAX_TEXT = 60_000;

/** The npx arguments for a call, or { error } when the input is wrong. Pure. */
export function uiSkillsArgs({ action, category, slug }) {
  if (action === 'get') {
    if (!slug || !SLUG.test(slug)) return { error: 'action get needs slug as owner/name, from vawe_ui_skills list' };
    return { args: ['get', slug] };
  }
  if (category !== undefined && (action !== 'list' || !CATEGORY.test(category))) {
    return { error: action === 'list' ? `category "${category}" is not a category name; vawe_ui_skills categories lists them` : 'category only goes with action list' };
  }
  return { args: action === 'list' && category ? ['list', '--category', category] : [action] };
}

/** Runs `npx -y ui-skills <args>`: { ok, text, reason }. Kills the child at LIMIT_MS. */
export function runUiSkills(args, { cwd = process.cwd(), limitMs = LIMIT_MS } = {}) {
  return new Promise((resolve) => {
    const child = spawn('npx', ['-y', 'ui-skills', ...args], { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let text = '';
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; child.kill('SIGTERM'); }, limitMs);
    child.stdout.on('data', (d) => { text += d; });
    child.stderr.on('data', (d) => { text += d; });
    child.on('error', (e) => { clearTimeout(timer); resolve({ ok: false, text, reason: `could not start npx: ${e.message}` }); });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (timedOut) resolve({ ok: false, text, reason: `ui-skills did not answer in ${limitMs / 1000} s; call again` });
      else resolve({ ok: code === 0, text, reason: code === 0 ? null : `ui-skills exited with ${code}` });
    });
  });
}

const logFile = (outDir, film) => path.join(outDir, `${film}.ui-skills.jsonl`);

export function logFetched(outDir, film, slug, at = new Date().toISOString()) {
  fs.mkdirSync(outDir, { recursive: true });
  fs.appendFileSync(logFile(outDir, film), `${JSON.stringify({ at, slug })}\n`);
}

/** The slugs fetched with action get for a film, lower case. */
export function fetchedSlugs(outDir, film) {
  let text = '';
  try { text = fs.readFileSync(logFile(outDir, film), 'utf8'); } catch { return new Set(); }
  const slugs = text.split('\n').flatMap((l) => { try { return [JSON.parse(l).slug.toLowerCase()]; } catch { return []; } });
  return new Set(slugs);
}

export const clipText = (text) => (text.length > MAX_TEXT ? `${text.slice(0, MAX_TEXT)}\n...cut at ${MAX_TEXT} characters` : text);

const CLAIM = /^\W*skill[ \t]+(builder|type|colou?r|depth|frame)[ \t]*:[ \t]*([^\s:]+)/gim;

/** The `Skill <rung>: <owner/name>` lines of a DESIGN.md whose slug the film never fetched: [{ rung, slug }]. A slug that is not owner/name (vawe's own frame rules) is not checked. */
export function unfetchedClaims(design, fetched) {
  return [...String(design).matchAll(CLAIM)]
    .map((m) => ({ rung: m[1].toLowerCase(), slug: m[2].replace(/^`|`$/g, '') }))
    .filter((c) => SLUG.test(c.slug) && !fetched.has(c.slug.toLowerCase()));
}
