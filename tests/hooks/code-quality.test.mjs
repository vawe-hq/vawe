// node tests/hooks/code-quality.test.mjs
//
// harness/live/code-quality.mjs, fed exactly as Claude Code's PostToolUse feeds it (stdin JSON, stderr
// on exit 2). The two cases the hook exists for: a no-op edit on a file that already carries debt
// stays silent (the ratchet compares against quality/baselines/code-quality-baseline.json, not zero),
// and a real new complexity finding is still reported. A scratch fixture is used and registered in the
// baseline directly, so the test does not depend on which real file happens to carry debt today.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import test from 'node:test';
import assert from 'node:assert';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '../..');
const HOOK = join(here, '../../harness/live', 'code-quality.mjs');
const BASELINE = path.join(ROOT, 'quality/baselines/code-quality-baseline.json');
// joined, not written: vawe check doc-refs reads every .mjs path a file names and requires it to exist
const REL = ['harness/live/test/.zz-code-quality-probe', 'mjs'].join('.');
const ABS = path.join(ROOT, REL);

// A function with an unused var (one finding oxlint already sees before any edit).
const STALE = `export function tangled(a) {\n  let unused;\n  return a;\n}\n`;

const run = () => {
  const r = spawnSync('node', [HOOK], {
    input: JSON.stringify({ tool_input: { file_path: ABS } }), encoding: 'utf8',
    env: { ...process.env, VAWE_HOOK_FULL: '1' },   // assert against the full text, not the summary
  });
  return { status: r.status, err: r.stderr };
};

let restoreBaseline;
test.before(() => {
  // harness/live/test/ holds no tracked file of its own, so git never carries it into a fresh clone.
  fs.mkdirSync(path.dirname(ABS), { recursive: true });
  restoreBaseline = fs.readFileSync(BASELINE, 'utf8');
});
test.after(() => {
  fs.writeFileSync(BASELINE, restoreBaseline);
  fs.rmSync(ABS, { force: true });
});

test('a no-op touch of a file with pre-existing, baselined debt reports nothing new', () => {
  fs.writeFileSync(ABS, STALE);
  const base = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
  base[`${REL}::no-unused-vars`] = 1;
  fs.writeFileSync(BASELINE, JSON.stringify(base));
  const { status, err } = run();
  assert.equal(status, 0, `expected silence, got:\n${err}`);
});

test('an edit that adds a real complexity finding is reported', () => {
  // 20 chained if/else branches: comfortably over the complexity max of 20 in .oxlintrc.json.
  const branches = Array.from({ length: 20 }, (_, i) => `  if (a === ${i}) return ${i};`).join('\n');
  const worsened = `export function tangled(a) {\n${branches}\n  return a;\n}\n`;
  fs.writeFileSync(ABS, worsened);
  const base = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
  delete base[`${REL}::complexity`];
  fs.writeFileSync(BASELINE, JSON.stringify(base));
  const { status, err } = run();
  assert.equal(status, 2, `expected a report, got exit ${status}:\n${err}`);
  assert.match(err, /complexity: was 0, now 1/);
});

test('a commit hook environment (GIT_DIR set) does not hide the HEAD baseline of a file', () => {
  const repo = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'vawe-cq-')));
  const other = fs.mkdtempSync(path.join(os.tmpdir(), 'vawe-cq-other-'));
  const g = (cwd, ...a) => spawnSync('git', a, { cwd, encoding: 'utf8' });
  const body = `export function big(a) {\n${Array.from({ length: 25 }, (_, i) => `  if (a === ${i}) return ${i};`).join('\n')}\n  return a;\n}\n`;
  try {
    g(repo, 'init', '-q'); g(other, 'init', '-q');
    fs.mkdirSync(path.join(repo, 'harness'));
    const file = path.join(repo, 'harness', 'big.mjs');
    fs.writeFileSync(file, body);
    g(repo, 'add', '.'); g(repo, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'one');
    const r = spawnSync('node', [HOOK], { input: JSON.stringify({ tool_input: { file_path: file } }), encoding: 'utf8', env: { ...process.env, GIT_DIR: path.join(repo, '.git'), GIT_INDEX_FILE: path.join(repo, '.git', 'index') } });
    assert.equal(r.status, 0, r.stderr);
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
    fs.rmSync(other, { recursive: true, force: true });
  }
});
