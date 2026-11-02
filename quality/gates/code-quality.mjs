// quality/gates/code-quality.mjs: the codebase may get simpler, never more tangled.
//
//   node quality/gates/code-quality.mjs           # check
//   node quality/gates/code-quality.mjs --write   # accept the current state as the new baseline
//   node quality/gates/code-quality.mjs --top     # what is worst right now
//
// WHY A RATCHET AND NOT A THRESHOLD. This repo has 5615 functions and 333 of them break one of the
// size rules today. Turning that into a blocking threshold would fail every build on day one, and
// CLAUDE.md already records what happens next: a rule waived by reflex has been repealed and nobody
// wrote it down. So the rule here is not "be under 20". It is "do not make it worse than it is", which
// is enforceable from the first minute and cannot be satisfied by adding a waiver.
//
// The baseline holds a COUNT per file per rule. Adding a tangled function to a file fails. Fixing one
// and running --write lowers the number permanently, and the gate then holds the new, better line. The
// debt can only be paid down, never re-borrowed.
//
// WHAT THIS CANNOT DO. Cyclomatic complexity counts branches. It cannot see a bad name, a wrong
// abstraction, or a function that is short and still does four jobs. A 30-case switch scores 31 and
// reads fine. Treat a number here as a question, never a verdict, and read CLAUDE.md's rule: when
// satisfying a gate requires making the code worse, suspect the gate.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { gateFindings } from '../../harness/lib/findings.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const BASELINE = path.join(ROOT, 'quality/baselines/code-quality-baseline.json');
const SCAN = ['core', 'blocks', 'scripts', 'harness', 'quality', 'generators', 'research', 'films', 'scene', 'cli', 'tools', 'studio'];
const write = process.argv.includes('--write');
const top = process.argv.includes('--top');

const bin = path.join(ROOT, 'node_modules/.bin/oxlint');
if (!fs.existsSync(bin)) {
  console.error('✗ oxlint is not installed. Run `npm install` at the repo root.');
  process.exit(2);
}

export function lint(paths = SCAN) {
  const r = spawnSync(bin, ['-c', path.join(ROOT, '.oxlintrc.json'), '--format=json', ...paths],
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  let out;
  try { out = JSON.parse(r.stdout); } catch {
    console.error('✗ oxlint produced no readable JSON:\n' + String(r.stderr).slice(0, 400));
    process.exit(2);
  }
  return (out.diagnostics || []).map((d) => ({
    file: d.filename,
    rule: (/eslint\(([^)]+)\)/.exec(d.code) || [, d.code])[1],
    line: d.labels && d.labels[0] ? d.labels[0].span.line : 0,
    message: d.message,
  }));
}

const tally = (rows) => {
  const t = {};
  for (const r of rows) { const k = `${r.file}::${r.rule}`; t[k] = (t[k] || 0) + 1; }
  return t;
};

const rows = lint();
const now = tally(rows);

if (top) {
  // The message carries the measured number, so rank on it rather than storing a second copy.
  const scored = rows.map((r) => ({ ...r, n: Number((/of (\d+)|\((\d+)\)/.exec(r.message) || [])[1]
    || (/\((\d+)\)/.exec(r.message) || [])[1] || 0) }));
  scored.sort((a, b) => b.n - a.n);
  for (const r of scored.slice(0, 25)) console.log(`  ${String(r.n).padStart(4)}  ${r.file}:${r.line}  ${r.rule}`);
  process.exit(0);
}

const base = fs.existsSync(BASELINE) ? JSON.parse(fs.readFileSync(BASELINE, 'utf8')) : null;

if (!base || write) {
  fs.writeFileSync(BASELINE, JSON.stringify(now, null, 1) + '\n');
  const total = Object.values(now).reduce((a, b) => a + b, 0);
  const files = new Set(rows.map((r) => r.file)).size;
  console.log(`✓ baseline written: ${total} finding(s) across ${files} file(s), ${Object.keys(now).length} file/rule pair(s)`);
  if (base) {
    const was = Object.values(base).reduce((a, b) => a + b, 0);
    const d = was - total;
    console.log(d > 0 ? `  ${d} fewer than the previous baseline. The line just moved down and cannot move back.`
      : d < 0 ? `  ⚠ ${-d} MORE than before. You have accepted new debt on purpose.` : '  no change');
  }
  process.exit(0);
}

const worse = [];
for (const [k, n] of Object.entries(now)) {
  const had = base[k] || 0;
  if (n > had) worse.push([k, had, n]);
}
const better = [];
for (const [k, n] of Object.entries(base)) {
  const has = now[k] || 0;
  if (has < n) better.push([k, n, has]);
}

if (better.length) {
  console.log(`  ${better.length} file/rule pair(s) improved since the baseline:`);
  for (const [k, was, has] of better.slice(0, 10)) console.log(`    ${k.replace('::', '  ')}  ${was} -> ${has}`);
  if (better.length > 10) console.log(`    and ${better.length - 10} more`);
  console.log(`  Lock it in: vawe-dev check code-quality WRITE=1\n`);
}

if (!worse.length) {
  const total = Object.values(now).reduce((a, b) => a + b, 0);
  console.log(`✓ code-quality: nothing got more tangled (${total} known finding(s) held at the baseline)`);
  process.exit(0);
}

const f = gateFindings({ line: (r) => r.summary });
console.error(`✗ code-quality: ${worse.length} file/rule pair(s) got WORSE than the baseline.\n`);
for (const [k, had, n] of worse) {
  const [file, rule] = k.split('::');
  const lines = rows.filter((x) => x.file === file && x.rule === rule)
    .map((r) => `      :${r.line}  ${r.message}`).join('\n');
  f.fail('code-quality-worse', `  ${file}  ${rule}: ${had} -> ${n}\n${lines}`, { at: `${file}::${rule}` });
}
f.emit();
console.error(`\n  Split the function so it does one job. The rules and their limits are in .oxlintrc.json.`);
console.error(`  If the new shape is genuinely right and the rule is wrong, say so and run: vawe-dev check code-quality WRITE=1`);
process.exit(f.records.some((r) => r.severity === 'error') ? 1 : 0);
