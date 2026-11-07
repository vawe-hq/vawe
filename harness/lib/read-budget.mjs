// The text an agent reads per stage of the AGENTS.md loop table: bin/vawe --help, the --help of each verb the stage names, and the files it names.
import fs from 'node:fs';
import path from 'node:path';

export const TOKENS_PER_WORD = 1.33;
export const ALLOWANCE = 0.05;
const ROOT_HELP = 'bin/vawe --help';

export const wordsIn = (text) => text.trim().split(/\s+/).filter(Boolean).length;
export const tokensOf = (words) => Math.round(words * TOKENS_PER_WORD);

/** The loop table rows of an AGENTS.md text: [{ n, stage, verbs, tokens }], where tokens are the backticked names in the command cell. Pure. */
export function parseLoop(text) {
  const lines = text.split('\n');
  const head = lines.findIndex((l) => l.includes('| # | stage |') && l.includes('the command'));
  if (head === -1) return [];
  const rows = [];
  for (let i = head + 2; i < lines.length && lines[i].trim().startsWith('|'); i++) {
    const cells = lines[i].split('|').map((c) => c.trim());
    const n = Number(cells[1]);
    const cell = cells[3] || '';
    const verbs = [...new Set([...cell.matchAll(/(?:bin\/)?vawe ([a-z][\w-]*)/g)].map((m) => m[1]))];
    const names = [...cell.matchAll(/`([^`]+)`/g)].map((m) => m[1].replace(/[.,:;]+$/, ''));
    rows.push({ n, stage: cells[2], verbs, names });
  }
  return rows;
}

/** The files a row names that exist: `skills/<name>/SKILL.md` for a bare skill name, and any named path. */
export function filesOf(row, exists) {
  const files = [];
  for (const name of row.names) {
    const skill = `skills/${name}/SKILL.md`;
    if (/^[a-z][\w-]*$/.test(name) && exists(skill)) files.push(skill);
    else if (/^[\w./-]+\.md$/.test(name) && exists(name)) files.push(name);
  }
  return files;
}

/** Per stage and for the whole loop, the words and estimated tokens of what is read. `read(rel)` and `help(verb)` return text; each item counts once in the total and at its first stage. */
export function loopBudget(agentsText, { read, exists, help }) {
  const seen = new Map();
  const count = (id, load) => {
    if (!seen.has(id)) seen.set(id, wordsIn(load()));
    return seen.get(id);
  };
  const stages = parseLoop(agentsText).map((row) => {
    const items = [];
    if (row.n === 1) items.push({ id: ROOT_HELP, words: count(ROOT_HELP, () => help(null)) });
    for (const verb of row.verbs) items.push({ id: `bin/vawe ${verb} --help`, words: count(`bin/vawe ${verb} --help`, () => help(verb)) });
    for (const rel of filesOf(row, exists)) items.push({ id: rel, words: count(rel, () => read(rel)) });
    return { n: row.n, stage: row.stage, items };
  });
  const firstStage = new Map();
  for (const s of stages) for (const it of s.items) if (!firstStage.has(it.id)) firstStage.set(it.id, s.n);
  const stageRows = stages.map((s) => {
    const words = s.items.reduce((a, it) => a + it.words, 0);
    return { ...s, words, tokens: tokensOf(words) };
  });
  const files = Object.fromEntries([...seen]);
  const words = Object.values(files).reduce((a, w) => a + w, 0);
  return { stages: stageRows, files, firstStage: Object.fromEntries(firstStage), words, tokens: tokensOf(words) };
}

/** The ratchet warning for a whole-loop budget, or null while it holds. Names the stage and the files that grew most. Pure. */
export function loopFinding(budget, prior) {
  if (!prior) return null;
  const limit = Math.floor(prior.tokens * (1 + ALLOWANCE));
  if (budget.tokens <= limit) return null;
  const grown = Object.entries(budget.files)
    .map(([id, words]) => ({ id, grew: words - (prior.files?.[id] ?? 0) }))
    .filter((g) => g.grew > 0)
    .sort((a, b) => b.grew - a.grew)
    .slice(0, 3);
  const where = grown.map((g) => `${g.id} (+${g.grew}w, stage ${budget.firstStage[g.id]})`).join(', ');
  return `whole-loop read budget grew to ~${budget.tokens} token(s), over the stamped ~${prior.tokens} plus ${Math.round(ALLOWANCE * 100)}% (${limit}). Grew most: ${where || 'no single file'}. `
    + 'If deliberate, re-stamp: node harness/dev/bench.mjs loop --stamp';
}

/** A stage|files|words|tokens table, the first stage and the whole loop. */
export function loopTable(budget) {
  const lines = ['  stage | files | words | tokens (est.)'];
  for (const s of budget.stages) lines.push(`  ${s.n} ${s.stage} | ${s.items.map((it) => it.id).join(', ') || '-'} | ${s.words} | ~${s.tokens}`);
  const first = budget.stages[0];
  if (first) lines.push(`  first stage | ${first.items.length} item(s) | ${first.words} | ~${first.tokens}`);
  lines.push(`  whole loop | ${Object.keys(budget.files).length} item(s), each once | ${budget.words} | ~${budget.tokens}`);
  return lines.join('\n');
}

/** The stamp for the ratchet: tokens and the words of each file. */
export const loopStamp = (budget) => ({ tokens: budget.tokens, words: budget.words, files: budget.files });

export function realLoopBudget(root, runHelp) {
  const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
  return loopBudget(read('AGENTS.md'), { read, exists: (rel) => fs.existsSync(path.join(root, rel)), help: runHelp });
}
