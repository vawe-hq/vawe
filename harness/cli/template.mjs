import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { UsageError } from './parse.mjs';
import { EXIT, ExitError } from '../lib/exit-codes.mjs';
import { STEP } from '../live/stage-say.mjs';
import { say } from '../lib/next-step.mjs';
import { nextLine } from '../lib/verb-log.mjs';
import { parseSlotArgs, planSlots, placeholderLines } from '../lib/template-slots.mjs';
import { templateImportProblems } from '../lib/template-imports.mjs';
import { fillSlot } from '../media/template-slot.mjs';

const SITE = 'https://vawe.dev';
const SKIP = new Set(['template.json', 'preview.mp4', 'poster.webp']);
const ID = /^[a-z0-9][a-z0-9-]*$/;
const LIST_TIMEOUT_MS = 5000;
const FETCH_TIMEOUT_MS = 30000;

const apiBase = (env) => (env.VAWE_TEMPLATES_API ?? SITE).replace(/\/$/, '');
const templatesDir = (engine, env) => env.VAWE_TEMPLATES_DIR ?? path.join(engine, 'templates');

function readCard(dir) {
  try {
    return JSON.parse(fs.readFileSync(path.join(dir, 'template.json'), 'utf8'));
  } catch {
    return null;
  }
}

function freeCards(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => readCard(path.join(dir, e.name)) ?? { id: e.name, tier: 'free', category: '-', summary: '' })
    .sort((a, b) => a.id.localeCompare(b.id));
}

async function proCards(env, free) {
  const res = await fetch(`${apiBase(env)}/templates.json`, { signal: AbortSignal.timeout(LIST_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = await res.json();
  const all = Array.isArray(body) ? body : body.templates ?? [];
  const known = new Set(free.map((c) => c.id));
  return all.filter((c) => c.tier !== 'free' && !known.has(c.id));
}

const row = (c) => `${c.id}  ${c.tier}  ${c.category}  ${c.summary}`;

export async function listLines({ engine, env = process.env }) {
  const free = freeCards(templatesDir(engine, env));
  const lines = ['id  tier  category  summary', ...free.map(row)];
  try {
    lines.push(...(await proCards(env, free)).map(row));
  } catch {
    lines.push(`Pro templates could not be listed (${apiBase(env)}/templates.json is not reachable); the free ones are above`);
  }
  return lines;
}

const isSafePath = (p) => typeof p === 'string' && p !== '' && !path.isAbsolute(p) && !/^[a-zA-Z]:/.test(p) && !p.includes('\\') && !p.split('/').includes('..');

function proKey({ key, env, home }) {
  if (key) return key;
  if (env.VAWE_KEY) return env.VAWE_KEY;
  try {
    return fs.readFileSync(path.join(home, '.vawe', 'key'), 'utf8').trim() || null;
  } catch {
    return null;
  }
}

const buyLine = (id, name) => `buy it at ${SITE}/templates/${id}, then npx vawe new ${name} --template ${id} --key <key>`;

async function fetchPro({ id, name, key, env }) {
  if (!key) throw new ExitError(EXIT.REFUSED, `template "${id}" is not free and no key was given: ${buyLine(id, name)}`);
  let res;
  try {
    res = await fetch(`${apiBase(env)}/api/templates/${id}`, { headers: { authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  } catch (e) {
    throw new ExitError(EXIT.IO, `could not reach ${apiBase(env)} for template "${id}": ${e.message}`);
  }
  if (res.status === 401 || res.status === 403) throw new ExitError(EXIT.REFUSED, `the key was refused for template "${id}": ${buyLine(id, name)}`);
  if (res.status === 404) throw new UsageError(`no template "${id}": vawe new --template list shows the ids`);
  if (!res.ok) throw new ExitError(EXIT.IO, `template "${id}": HTTP ${res.status} from ${apiBase(env)}`);
  const { files } = await res.json();
  if (!Array.isArray(files)) throw new ExitError(EXIT.IO, `template "${id}": the reply has no files list`);
  return files;
}

function writeFiles(dest, files) {
  const bad = files.find((f) => !isSafePath(f?.path));
  if (bad) throw new ExitError(EXIT.IO, `template file path is not allowed: ${JSON.stringify(bad?.path)}`);
  for (const f of files) {
    if (SKIP.has(f.path)) continue;
    const target = path.join(dest, f.path);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, Buffer.from(f.base64, 'base64'));
  }
}

function copyLocal(src, dest) {
  fs.cpSync(src, dest, { recursive: true, filter: (from) => !(path.dirname(from) === src && SKIP.has(path.basename(from))) });
}

function cardOf(files) {
  const file = files.find((f) => f?.path === 'template.json');
  try {
    return file ? JSON.parse(Buffer.from(file.base64, 'base64').toString('utf8')) : null;
  } catch {
    return null;
  }
}

function inputLines(card) {
  const inputs = card?.inputs ?? [];
  if (!inputs.length) return [];
  return ['', 'change these in page.html:', ...inputs.map((i) => `  ${i.label ?? i.key}: "${i.default}" (${i.where})`)];
}

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The brief of a copied template names the template's own folders: in the copy they name the new film. */
export function renameInBrief(text, id, name) {
  const own = escapeRegExp(id);
  return text
    .replace(new RegExp(`\\b(?:films|templates)/${own}(?![a-z0-9-])`, 'g'), `films/${name}`)
    .replace(new RegExp(`\\bout/${own}(?![a-z0-9])`, 'g'), `out/${name}`);
}

function rewriteBrief(dest, id, name) {
  const file = path.join(dest, 'brief.md');
  if (id === name || !fs.existsSync(file)) return;
  fs.writeFileSync(file, renameInBrief(fs.readFileSync(file, 'utf8'), id, name));
}

function slotPlan(card, slots, home) {
  try {
    const planned = planSlots(card, parseSlotArgs(slots, home));
    const missing = planned.find((p) => !fs.existsSync(p.path));
    if (missing) throw new Error(`slot ${missing.slot.key}: no such file ${missing.path}`);
    return planned;
  } catch (e) {
    throw new UsageError(e.message);
  }
}

function fillSlots(dest, planned) {
  try {
    return planned.map((p) => {
      fillSlot(dest, p);
      return `slot ${p.slot.key}: ${path.basename(p.path)} fitted to ${p.slot.size} at ${p.slot.file}`;
    });
  } catch (e) {
    fs.rmSync(dest, { recursive: true, force: true });
    throw new ExitError(EXIT.IO, e.message);
  }
}

const importWarnings = (dest) => templateImportProblems(dest).map((p) => `warning: ${p}`);

/** `vawe new <name> --template <id>`: writes films/<name>/ from a free template in templates/ or a Pro one from vawe.dev; returns the lines to print. `slots`: the `--slot key=path` values. */
export async function templateFilm({ id, name, key, slots = [], work, engine, env = process.env, home = os.homedir() }) {
  if (id === 'list') return listLines({ engine, env });
  if (!name) throw new UsageError('missing <name>; usage: vawe new <name> --template <id>');
  if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) throw new UsageError(`film name "${name}" must be lowercase letters, digits and dashes`);
  if (!ID.test(id)) throw new UsageError(`template id "${id}" must be lowercase letters, digits and dashes`);
  const dest = path.join(work, 'films', name);
  if (fs.existsSync(path.join(dest, 'page.html'))) throw new UsageError(`${path.relative(work, dest)}/page.html already exists`);
  const src = path.join(templatesDir(engine, env), id);
  const local = fs.existsSync(path.join(src, 'page.html'));
  const files = local ? null : await fetchPro({ id, name, key: proKey({ key, env, home }), env });
  const card = local ? readCard(src) : cardOf(files);
  const planned = slotPlan(card, slots, home);
  if (local) copyLocal(src, dest);
  else writeFiles(dest, files);
  rewriteBrief(dest, id, name);
  const filled = fillSlots(dest, planned);
  const page = `films/${name}/page.html`;
  return [`wrote ${page} and its assets from template ${id}`, ...filled, ...importWarnings(dest), ...inputLines(card), ...placeholderLines(card, planned), '', nextLine(say`${STEP.dev(name, page)}`)];
}
