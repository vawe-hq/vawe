import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, STEPS, readInputs, staleFiles, parseRule, ruleProblems, withContents, buildFiles, jobsTable, withJobsTable, JOBS_BEGIN, JOBS_END } from '../../harness/dev/taste-build.mjs';
import { JOBS, jobsOf } from '../../core/motion/ease-jobs.js';
import TASTE_LIMITS from '../../core/motion/taste-limits.js';
import { TASTE_CARD_REL } from '../../harness/lib/judge-prompt.mjs';
import { PEAK_DBFS } from '../../harness/lib/peak-limit.mjs';
import { RUN_TILES, TAIL_TILES } from '../../harness/lib/sheet-tiles.mjs';
import { RULES as DRAFT } from '../../harness/lib/draft-check.mjs';
import { BANDS } from '../../core/motion/presets.js';
import { LIMITS } from '../../harness/lib/ship-status.mjs';
import { STILL_SEC } from '../../harness/lib/still-limit.mjs';

const { rules } = readInputs();
const taste = (...p) => path.join(ROOT, 'taste', ...p);
const ids = new Set(rules.map((r) => r.id));

const mdFilesUnder = (dir) => fs.readdirSync(dir, { withFileTypes: true })
  .flatMap((e) => (e.isDirectory() ? mdFilesUnder(path.join(dir, e.name)) : e.name.endsWith('.md') ? [path.join(dir, e.name)] : []));

test('taste/build and taste/README.md equal a fresh build', () => {
  assert.deepEqual(staleFiles(), [], 'run node harness/dev/taste-build.mjs and commit the result');
});

test('every rule file has every field, a kebab-case id equal to its file name, and a known step and check', () => {
  assert.ok(rules.length >= 60, `${rules.length} rules`);
  assert.equal(ids.size, rules.length);
  for (const r of rules) assert.deepEqual(ruleProblems(r), [], r.file);
  assert.ok(rules.every((r) => STEPS.includes(r.step)));
});

test('a rule with a missing field, a bad id, an unknown check or a printed line that is not a pair is reported', () => {
  const good = fs.readFileSync(taste('rules', 'stagger.md'), 'utf8');
  assert.deepEqual(ruleProblems(parseRule(good, 'stagger.md')), []);
  assert.match(ruleProblems(parseRule(good.replace(/^prevents: .*\n/m, ''), 'stagger.md')).join('\n'), /no "prevents"/);
  assert.match(ruleProblems(parseRule(good, 'other.md')).join('\n'), /differs from the file name/);
  assert.match(ruleProblems(parseRule(good.replace('check: group-landing', 'check: made-up'), 'stagger.md')).join('\n'), /not a known check id/);
  assert.match(ruleProblems(parseRule(good.replace(/^print-motion: .*$/m, 'print-motion: stagger everything'), 'stagger.md')).join('\n'), /do X, not Y/);
});

test('a scored rule with neither a digest line nor a print line is reported, and none exists', () => {
  const good = fs.readFileSync(taste('rules', 'stagger.md'), 'utf8');
  const bare = good.replace(/^print-motion: .*\n/m, '').replace(/^digest: .*\n/m, '');
  assert.match(ruleProblems(parseRule(bare, 'stagger.md')).join('\n'), /scored rule needs a digest, a print-<step> or a more-<step> line/);
  assert.deepEqual(rules.filter((r) => r.scored === 'yes' && !r.digest && !Object.keys(r.prints).length && !Object.keys(r.mores).length).map((r) => r.id), []);
});

test('the five most-fired checks print one fix sentence with a number and the craft doc to read', () => {
  for (const id of ['live-hold', 'readable-hold', 'world-turns', 'readable-text-size', 'named-eases']) {
    const first = rules.find((r) => r.id === id).instead.split(/(?<=\.) /)[0];
    assert.match(first, /\d/, id);
    const doc = /\((taste\/craft\/[a-z-]+\.md)\)/.exec(first)?.[1];
    assert.ok(doc && fs.existsSync(path.join(ROOT, doc)), `${id} names a real craft doc`);
  }
});

test('every rule file is reachable from the index and every rule link in taste/ points at a real rule', () => {
  const readme = fs.readFileSync(taste('README.md'), 'utf8');
  for (const id of ids) assert.ok(readme.includes(`(rules/${id}.md)`), id);
  for (const file of mdFilesUnder(taste())) {
    for (const m of fs.readFileSync(file, 'utf8').matchAll(/\(\.\.\/rules\/([a-z0-9-]+)\.md\)|\(rules\/([a-z0-9-]+)\.md\)/g)) {
      assert.ok(ids.has(m[1] || m[2]), `${path.relative(ROOT, file)} links rule ${m[1] || m[2]}`);
    }
  }
});

test('a markdown file in taste/ over 100 lines starts with a contents list', () => {
  for (const file of mdFilesUnder(taste()).filter((f) => !f.includes(`${path.sep}rules${path.sep}`))) {
    const text = fs.readFileSync(file, 'utf8');
    if (text.split('\n').length > 100) assert.match(text, /\nContents:\n- \[/, path.relative(ROOT, file));
  }
  assert.match(withContents(`# t\n${Array.from({ length: 101 }, (_, i) => (i % 50 ? 'x' : `## Head ${i}`)).join('\n')}`), /Contents:\n- \[Head 0\]\(#head-0\)/);
});

test('the judge reads taste/build/CARD.md, which holds every scored rule and the five anti-pattern frames', () => {
  const card = fs.readFileSync(path.join(ROOT, TASTE_CARD_REL), 'utf8');
  for (const r of rules.filter((x) => x.scored === 'yes')) assert.ok(card.includes(`### ${r.id}\n`), r.id);
  assert.equal((card.match(/!\[[A-E]-/g) || []).length, 5);
  for (const m of card.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)) assert.ok(fs.existsSync(path.join(taste('build'), m[1])), m[1]);
});

test('limits.json agrees with the numbers the checks hold today', () => {
  const limits = JSON.parse(buildFiles(readInputs())['taste/build/limits.json']);
  assert.equal(limits['sound-level'].peak_dbfs, PEAK_DBFS);
  assert.equal(limits['sound-level'].lufs_low, DRAFT.lufsLow);
  assert.equal(limits['sound-level'].lufs_high, DRAFT.lufsHigh);
  assert.equal(limits['world-turns'].run_tiles_max, RUN_TILES);
  assert.equal(limits['world-turns'].tail_tiles_max, TAIL_TILES);
  assert.equal(limits['world-turns'].turn_seconds_max, LIMITS.worldSec);
  assert.equal(limits['live-hold'].still_limit_s, STILL_SEC);
  assert.equal(limits['readable-text-size'].cap_height_pct, DRAFT.capFrac * 100);
  assert.equal(limits['readable-text-size'].chrome_cap_height_pct, DRAFT.chromeCapFrac * 100);
  assert.deepEqual([BANDS.energy[0], BANDS.energy[1], BANDS.professional[1], BANDS.gravity[1], BANDS.cinematic[1]],
    ['energy_min_s', 'energy_max_s', 'professional_max_s', 'gravity_max_s', 'cinematic_max_s'].map((k) => limits['speed-bands'][k]));
});

test('the jobs table has one row per job, names each ease as EASE.<name>, and fills only the marked part', () => {
  const table = jobsTable();
  assert.equal(table.split('\n').length, JOBS.length + 2);
  assert.match(table, /\| List stagger \| EASE\.landSoft, EASE\.nudge \|/);
  const doc = `top\n${JOBS_BEGIN}\nold row\n${JOBS_END}\nbottom\n`;
  assert.equal(withJobsTable(doc), `top\n${JOBS_BEGIN}\n${table}\n${JOBS_END}\nbottom\n`);
  assert.throws(() => withJobsTable('no markers'), /needs the lines/);
  assert.throws(() => withJobsTable(`${doc}${JOBS_END}\n`), /once each/);
  assert.match(jobsTable(jobsOf({ ...TASTE_LIMITS, 'exits-shorter': { ...TASTE_LIMITS['exits-shorter'], exit_share_min: 0.4 } })), /\| Exit \| EASE\.launch, EASE\.leave \| 0\.4 to /);
});
