#!/usr/bin/env node
// Builds everything generated in taste/ from taste/rules/*.md, taste/attractors.json and taste/anti-patterns/*.md:
//   node harness/dev/taste-build.mjs          write taste/build/* and taste/README.md
//   node harness/dev/taste-build.mjs --check  exit 1 and name each file that differs from a fresh build
// A rule file is front matter (one `key: value` per line) and a short body; see taste/README.md.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DIALS } from '../../core/motion/signature.js';
import { JOBS, easeRef, jobsOf } from '../../core/motion/ease-jobs.js';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const STEPS = ['concept', 'look', 'motion', 'transitions', 'finish', 'sound', 'preship'];
// The owner's process steps: each command prints the rules of its own step (a rule's `print-<step>` line); a `more-<step>` line is sent only by topic, on a write, so the printed card stays short.
export const PRINT_STEPS = { explore: 'explore', frames: 'frames', storyboard: 'storyboard', motion: 'motion', check: 'check' };

// Every check a rule may name: the id the draft check, the lint or the judge prints. `judge` and `none` are not checks.
export const CHECK_IDS = ['judge', 'none', 'world-held', 'static-window', 'sheet-tiles', 'text-cap-height', 'text-contrast', 'read-hold',
  'exit-length', 'group-landing', 'linear-move', 'default-ease', 'seam-repeat', 'one-band', 'dead-stop', 'sound-peak', 'sound-loudness',
  'attractors', 'range', 'no-emdash', 'type-sizes', 'font-families', 'display-tracking', 'left-edges', 'text-margin', 'accent-flood',
  'entrance-direction', 'ease-count', 'lockstep', 'repeat-run', 'pure-black-white', 'template-chrome', 'coloured-word',
  'follow-through', 'no-overlap', 'staging', 'anticipation', 'duration-size', 'speed-ceiling', 'spectacle-weak', 'overshoot-share', 'text-breathing', 'text-lingers', 'living-ground', 'ground-hue', 'cut-off-beat', 'constant-camera'];

const REQUIRED = ['id', 'step', 'principle', 'limit', 'range', 'break-when', 'instead', 'check', 'judge', 'prevents', 'status', 'scored', 'numbers'];
const KEBAB = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const CONTENTS_OVER = 100;
export const DIGEST_WORDS_MAX = 400;

const FOOTER = ['The judge varies about 1 point per axis: after 3 rounds that flip one note, keep the value you measured.'];

/** { fields, body } of a front-matter file. Pure. */
export function parseMarkdown(text) {
  const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(text);
  if (!m) throw new Error('no front matter');
  const fields = {};
  for (const line of m[1].split('\n')) {
    const kv = /^([a-z0-9-]+):[ ]?(.*)$/.exec(line);
    if (!kv) throw new Error(`front matter line is not "key: value": ${line.slice(0, 60)}`);
    if (kv[1] in fields) throw new Error(`front matter key "${kv[1]}" twice`);
    fields[kv[1]] = kv[2].trim();
  }
  return { fields, body: m[2].trim() };
}

/** One rule from its file text and file name (the id must equal the name). Pure; throws on a malformed file. */
export function parseRule(text, file) {
  const { fields, body } = parseMarkdown(text);
  let numbers;
  try { numbers = JSON.parse(fields.numbers || '{}'); } catch { throw new Error(`${file}: numbers is not JSON`); }
  const lines = (prefix) => Object.fromEntries(Object.entries(fields).filter(([k]) => k.startsWith(prefix)).map(([k, v]) => [k.slice(prefix.length), v]));
  return { ...fields, file, numbers, prints: lines('print-'), mores: lines('more-'), body };
}

const missingFields = (r) => REQUIRED.filter((k) => !r[k]).map((k) => `${r.file}: no "${k}"`);

function idProblems(r) {
  const out = [];
  if (r.id && !KEBAB.test(r.id)) out.push(`${r.file}: id "${r.id}" is not kebab-case`);
  if (r.id && `${r.id}.md` !== r.file) out.push(`${r.file}: id "${r.id}" differs from the file name`);
  return out;
}

function valueProblems(r) {
  const out = [];
  if (r.step && !STEPS.includes(r.step)) out.push(`${r.file}: step "${r.step}" is not one of ${STEPS.join(' ')}`);
  if (r.status && r.status !== 'active') out.push(`${r.file}: status "${r.status}" is not active`);
  if (r.dial && !DIALS.includes(r.dial)) out.push(`${r.file}: dial "${r.dial}" is not one of ${DIALS.join(' ')}`);
  if (r.scored && !['yes', 'no'].includes(r.scored)) out.push(`${r.file}: scored must be yes or no`);
  if (r.numbers === null || typeof r.numbers !== 'object' || Array.isArray(r.numbers)) out.push(`${r.file}: numbers must be a JSON object`);
  for (const c of String(r.check || '').split(',').map((x) => x.trim()).filter(Boolean)) {
    if (!CHECK_IDS.includes(c)) out.push(`${r.file}: check "${c}" is not a known check id (${CHECK_IDS.join(' ')})`);
  }
  return out;
}

function printProblems(r) {
  const out = [];
  for (const [kind, lines] of [['print', r.prints], ['more', r.mores ?? {}]]) {
    for (const [s, text] of Object.entries(lines)) {
      if (!PRINT_STEPS[s]) out.push(`${r.file}: ${kind}-${s} is not a printed step (${Object.keys(PRINT_STEPS).join(' ')})`);
      if (!/, not /.test(text)) out.push(`${r.file}: ${kind}-${s} is not a "do X, not Y" pair`);
    }
  }
  if (r.scored === 'yes' && !r.digest && !Object.keys(r.prints).length && !Object.keys(r.mores ?? {}).length) out.push(`${r.file}: a scored rule needs a digest, a print-<step> or a more-<step> line, or the author never sees what the judge scores`);
  if (!/^## Example\n\n\S/m.test(r.body)) out.push(`${r.file}: the body has no "## Example" section`);
  return out;
}

/** The problems of one parsed rule, as lines. Pure. */
export const ruleProblems = (r) => [...missingFields(r), ...idProblems(r), ...valueProblems(r), ...printProblems(r)];

const rank = (r) => [STEPS.indexOf(r.step), r.id];
const byStep = (a, b) => (rank(a)[0] - rank(b)[0]) || a.id.localeCompare(b.id);

/** Rules read from a directory, validated, in step then id order. Throws with every problem when any rule is malformed. */
export function loadRules(dir) {
  const rules = [];
  const problems = [];
  for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.md')).sort()) {
    try {
      const r = parseRule(fs.readFileSync(path.join(dir, f), 'utf8'), f);
      problems.push(...ruleProblems(r));
      rules.push(r);
    } catch (e) { problems.push(`${f}: ${e.message}`); }
  }
  const seen = new Set();
  const dials = new Set();
  for (const r of rules) {
    if (seen.has(r.id)) problems.push(`${r.file}: id "${r.id}" is used twice`);
    seen.add(r.id);
    if (r.dial && dials.has(r.dial)) problems.push(`${r.file}: dial "${r.dial}" is set by another rule`);
    if (r.dial) dials.add(r.dial);
  }
  if (problems.length) throw new Error(`taste rules: ${problems.length} problem(s)\n${problems.join('\n')}`);
  return rules.sort(byStep);
}

/** The anti-pattern files of a directory, sorted by id. */
export function loadAntiPatterns(dir) {
  return fs.readdirSync(dir).filter((n) => n.endsWith('.md')).sort().map((f) => {
    const { fields, body } = parseMarkdown(fs.readFileSync(path.join(dir, f), 'utf8'));
    return { ...fields, body };
  });
}

const anchor = (h) => h.toLowerCase().replace(/[^a-z0-9 -]/g, '').trim().replace(/ /g, '-');

/** A text over 100 lines with a contents list of its `## ` headings after the title. Pure. */
export function withContents(text) {
  const lines = text.split('\n');
  if (lines.length <= CONTENTS_OVER) return text;
  const heads = lines.filter((l) => l.startsWith('## ')).map((l) => l.slice(3));
  const at = lines.findIndex((l) => l.startsWith('# '));
  const list = ['', 'Contents:', ...heads.map((h) => `- [${h}](#${anchor(h)})`)];
  return [...lines.slice(0, at + 1), ...list, ...lines.slice(at + 1)].join('\n');
}

const GENERATED = '<!-- generated by harness/dev/taste-build.mjs from taste/rules: do not edit -->';
const lineOf = (label, v) => (v && v !== 'none' ? `- ${label}: ${v}` : null);

/** taste/build/CARD.md: the scored rules by step, the attractors and the five anti-pattern frames. Pure. */
export function cardText(rules, attractors, anti) {
  const scored = rules.filter((r) => r.scored === 'yes');
  const out = [GENERATED, '# vawe taste card: short motion-graphics films', '',
    `One page, CSS and WAAPI, 5 to 40 s. The author reads taste/build/DIGEST.md at the brief. The judge scores against these ${scored.length} rules and the ${anti.length} anti-patterns below.`,
    'Every rule is observable from frames or from an ffmpeg measurement. Name the rule id in each fix.',
    'Where the frames and the measurements disagree with a rule, the frames and the measurements decide.', ''];
  for (const step of STEPS) {
    const rs = scored.filter((r) => r.step === step);
    if (!rs.length) continue;
    out.push(`## ${step}`, '');
    for (const r of rs) {
      out.push(`### ${r.id}`, '', r.principle, '', ...[lineOf('Limit', r.limit), lineOf('Range', r.range), lineOf('Judge', r.judge)].filter(Boolean), '');
    }
  }
  out.push('## attractors', '',
    'First drafts fall into these. Each is fine only when the direction chose it on purpose and says why; as a default it is the tell (rule attractors). The range check in `bin/vawe dev` reads the names and shapes it flags from `taste/attractors.json`.', '',
    ...attractors.list.map((l) => `- ${l}`), '', '## anti-patterns', '',
    'Frames from our private films. Each text names the film and the time.', '');
  for (const a of anti) {
    out.push(`### ${a.id.slice(0, 1)}. ${a.title}`, '', `![${a.id}](../anti-patterns/${a.image}) ${a.where}. ${a.body.replace(/\n/g, ' ')} Breaks ${a.breaks}.`, `Fix: ${a.fix}`, '');
  }
  return withContents(`${out.join('\n').trimEnd()}\n`);
}

/** taste/build/DIGEST.md: the first read of an author. Pure. */
export function digestText(rules, attractors) {
  const lines = rules.filter((r) => r.digest).map((r) => `- ${r.digest} (${r.id})`);
  const text = `${[GENERATED, '# Taste digest (authors)', '',
    'Every command prints the lines of its step again. All rules: `taste/README.md`. The judge scores `taste/build/CARD.md`.', '',
    '## Every film', '', ...lines, '',
    '## Attractors', '', `Fine only if the direction chose them on purpose: ${attractors.digest}. A disc needs a light source and a surface.`, '',
    '## Also', '', ...FOOTER.map((l) => `- ${l}`)].join('\n')}\n`;
  const words = text.split(/\s+/).filter(Boolean).length;
  if (words > DIGEST_WORDS_MAX) throw new Error(`taste digest is ${words} words, ${words - DIGEST_WORDS_MAX} over the ${DIGEST_WORDS_MAX} cap: remove the \`digest:\` line of a low-frequency rule (it stays in taste/README.md)`);
  return text;
}

/** taste/build/steps.json: what each command prints at its step, every line keyed by rule id. Pure. */
export function stepsJson(rules) {
  const steps = {};
  for (const [step, title] of Object.entries(PRINT_STEPS)) {
    const line = (r, text) => ({ rule: r.id, text, ...(r.craft ? { craft: r.craft } : {}) });
    const lines = rules.filter((r) => r.prints[step]).map((r) => line(r, r.prints[step]));
    const more = rules.filter((r) => r.mores?.[step]).map((r) => line(r, r.mores[step]));
    steps[step] = { title, lines, more };
  }
  return `${JSON.stringify(steps, null, 1)}\n`;
}

/** taste/build/rules.json: rule id to its file, its `instead` text and, for a signature dial, the dial and its range. Pure. */
export function rulesJson(rules) {
  const out = {};
  for (const r of rules) out[r.id] = { file: `taste/rules/${r.file}`, instead: r.instead, ...(r.dial ? { dial: r.dial, range: r.range } : {}) };
  return `${JSON.stringify(out, null, 1)}\n`;
}

const limitsOf = (rules) => Object.fromEntries(rules.filter((r) => Object.keys(r.numbers).length).map((r) => [r.id, r.numbers]));

/** taste/build/limits.json: rule id to the numbers its check or its range uses. Pure. */
export function limitsJson(rules) {
  return `${JSON.stringify(limitsOf(rules), null, 1)}\n`;
}

const PAGE_RULES = ['speed-bands', 'stagger', 'exits-shorter'];

/** core/motion/taste-limits.js: the numbers of the rules the motion presets read. A page imports presets from a served folder that has no taste/, so they cannot read limits.json. Pure. */
export function pageLimitsJs(rules) {
  const picked = Object.fromEntries(PAGE_RULES.map((id) => [id, rules.find((r) => r.id === id).numbers]));
  return `// generated by harness/dev/taste-build.mjs from taste/rules: do not edit\nexport default ${JSON.stringify(picked, null, 2)};\n`;
}

/** taste/README.md: the index, one line per rule grouped by step, with its check id. Pure. */
export function readmeText(rules, craft) {
  const out = [GENERATED, '# taste: the rules of vawe films', '',
    'One rule per file in `taste/rules/<id>.md`. Ids never change. Everything else here is generated from them: do not edit `taste/build/` or this index by hand.', '',
    '- Add or change a rule: edit its file, then run `node harness/dev/taste-build.mjs`. A test fails when the build is stale.',
    '- Author first read: `taste/build/DIGEST.md` (at most ' + DIGEST_WORDS_MAX + ' words: the build fails above it; a rule without a `digest:` line stays in this index). Judge: `taste/build/CARD.md` (the rules marked scored). Commands print `taste/build/steps.json` lines.',
    '- A rule that owns a signature dial has `dial: <name>` (core/motion/signature.js): `vawe new` offers its `range`, `vawe dev` names the dial while the page leaves it unchosen. `taste/build/rules.json` holds each rule file and its `instead` text.',
    '- Every threshold a check reads: `taste/build/limits.json`. Page code that cannot import it (the motion presets) reads `core/motion/taste-limits.js`, generated from the same numbers. Long reasons, sources and examples: `taste/craft/`.',
    '- Data: `taste/attractors.json`, `taste/anti-patterns/`, `taste/brand/`.',
    '', `${rules.length} rules, ${rules.filter((r) => r.scored === 'yes').length} scored by the judge.`, ''];
  for (const step of STEPS) {
    const rs = rules.filter((r) => r.step === step);
    if (!rs.length) continue;
    out.push(`## ${step}`, '');
    for (const r of rs) out.push(`- [${r.id}](rules/${r.id}.md): ${r.principle.split(/(?<=\.) /)[0]} Check: ${r.check}.`);
    out.push('');
  }
  out.push('## craft', '', ...craft.map((c) => `- [${c}](craft/${c})`), '');
  return withContents(`${out.join('\n').trimEnd()}\n`);
}

export const JOBS_BEGIN = '<!-- jobs table: written by harness/dev/taste-build.mjs from core/motion/ease-jobs.js: do not edit -->';
export const JOBS_END = '<!-- end jobs table -->';

/** The ease-per-job table as markdown, one row per job of `jobs`. Pure. */
export function jobsTable(jobs = JOBS) {
  const rows = jobs.map((j) => `| ${j.job} | ${[j.ease, ...(j.also ?? [])].map(easeRef).join(', ')} | ${j.time} | ${j.avoid} |`);
  return ['| Job | Ease | Time | Avoid |', '|---|---|---|---|', ...rows].join('\n');
}

/** `text` with the part between the jobs markers replaced by a fresh table; an error when a marker is missing. Pure. */
export function withJobsTable(text, jobs = JOBS) {
  const a = text.indexOf(JOBS_BEGIN);
  const b = text.indexOf(JOBS_END);
  const once = a === text.lastIndexOf(JOBS_BEGIN) && b === text.lastIndexOf(JOBS_END);
  if (a < 0 || b < a || !once) throw new Error(`taste/craft/motion-craft.md needs the lines ${JOBS_BEGIN} and ${JOBS_END}, once each and in that order`);
  return `${text.slice(0, a + JOBS_BEGIN.length)}\n${jobsTable(jobs)}\n${text.slice(b)}`;
}

/** Every generated file as { path relative to the repo root: text }. Pure over its inputs. */
export function buildFiles({ rules, attractors, anti, craft, motionCraft }) {
  return {
    'taste/build/CARD.md': cardText(rules, attractors, anti),
    'taste/build/DIGEST.md': digestText(rules, attractors),
    'taste/build/steps.json': stepsJson(rules),
    'taste/build/limits.json': limitsJson(rules),
    'taste/build/rules.json': rulesJson(rules),
    'taste/README.md': readmeText(rules, craft),
    'core/motion/taste-limits.js': pageLimitsJs(rules),
    'taste/craft/motion-craft.md': withJobsTable(motionCraft, jobsOf(limitsOf(rules))),
  };
}

/** The inputs read from a repo root. */
export function readInputs(root = ROOT) {
  const dir = path.join(root, 'taste');
  const craftDir = path.join(dir, 'craft');
  return {
    rules: loadRules(path.join(dir, 'rules')),
    attractors: JSON.parse(fs.readFileSync(path.join(dir, 'attractors.json'), 'utf8')),
    anti: loadAntiPatterns(path.join(dir, 'anti-patterns')),
    craft: fs.existsSync(craftDir) ? fs.readdirSync(craftDir).filter((n) => n.endsWith('.md')).sort() : [],
    motionCraft: fs.readFileSync(path.join(craftDir, 'motion-craft.md'), 'utf8'),
  };
}

/** The generated files whose text on disk differs from a fresh build. */
export function staleFiles(root = ROOT) {
  const files = buildFiles(readInputs(root));
  return Object.entries(files).filter(([rel, text]) => !fs.existsSync(path.join(root, rel)) || fs.readFileSync(path.join(root, rel), 'utf8') !== text).map(([rel]) => rel);
}

function main() {
  const files = buildFiles(readInputs());
  if (process.argv.includes('--check')) {
    const stale = staleFiles();
    if (stale.length) { console.error(`taste build is stale: ${stale.join(', ')}; run node harness/dev/taste-build.mjs`); process.exit(1); }
    console.log('taste build is fresh');
    return;
  }
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(ROOT, rel)), { recursive: true });
    fs.writeFileSync(path.join(ROOT, rel), text);
  }
  console.log(`wrote ${Object.keys(files).length} files from ${readInputs().rules.length} rules`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
