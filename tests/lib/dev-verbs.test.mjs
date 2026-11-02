import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { VERBS } from '../../harness/cli/verbs.mjs';
import { topHelp } from '../../harness/cli/parse.mjs';
import { DEV_ALIASES, OLD_NAMES } from '../../harness/cli/aliases.mjs';
import { DEV_VERBS } from '../../harness/dev/verbs.mjs';
import { GATES } from '../../harness/lib/check-gate.mjs';

const ROOT = path.resolve(import.meta.dirname, '../..');
const MOVED = ['land', 'claim', 'e2e', 'test', 'runs', 'moves', 'doctor', 'judge', 'approve'];
const run = (bin, args, env = {}) => spawnSync(process.execPath, [path.join(ROOT, 'bin', bin), ...args], { cwd: ROOT, encoding: 'utf8', env: { ...process.env, ...env } });

test('the maintainer verbs live in vawe-dev, not in the vawe verb table or its --help', () => {
  const all = topHelp(VERBS, { all: true });
  const dev = run('vawe-dev', ['--help']).stdout;
  for (const name of MOVED) {
    assert.equal(VERBS.some((v) => v.name === name), false, `${name} in VERBS`);
    assert.doesNotMatch(all, new RegExp(`^  ${name}\\s`, 'm'), `${name} in vawe --help --all`);
    assert.match(dev, new RegExp(`^  ${name}\\s`, 'm'), `${name} in vawe-dev --help`);
  }
  assert.match(dev, /^  check\s/m);
});

test('every vawe-dev verb has a unique name and a one-line summary, and every moved name keeps an alias', () => {
  assert.equal(new Set(DEV_VERBS.map((v) => v.name)).size, DEV_VERBS.length);
  for (const v of DEV_VERBS) assert.ok(v.summary && !v.summary.includes('\n'), v.name);
  for (const name of MOVED) {
    assert.ok(DEV_ALIASES.includes(name), name);
    assert.ok(OLD_NAMES.includes(name), name);
    assert.ok(DEV_VERBS.some((v) => v.name === name), name);
  }
});

test('vawe-dev answers an unknown verb and a usage error with exit 2 and its own name', () => {
  const unknown = run('vawe-dev', ['lnd']);
  assert.equal(unknown.status, 2);
  assert.match(unknown.stderr, /^vawe-dev: unknown verb "lnd"; did you mean land\?/);
  const usage = run('vawe-dev', ['runs']);
  assert.equal(usage.status, 2);
  assert.match(usage.stderr, /vawe-dev: missing <film>; usage: vawe-dev runs <film>/);
});

test('vawe-dev help is the verb help under the new name', () => {
  assert.match(run('vawe-dev', ['moves', '--help']).stdout, /^vawe-dev moves \[flags\]$/m);
  assert.match(run('vawe-dev', ['check', '--help']).stdout, /example: vawe-dev check doc-refs/);
});

test('an old name runs the vawe-dev verb, names it once per session and agent, and logs the alias', () => {
  const session = `dev-alias-test-${process.pid}`;
  const env = { CLAUDE_CODE_SESSION_ID: session, VAWE_AGENT: session };
  const first = run('vawe', ['doctor', '--quiet'], env);
  const logs = () => fs.readdirSync(path.join(ROOT, 'out')).filter((f) => f.endsWith('.runs.jsonl')).map((f) => path.join(ROOT, 'out', f));
  const rows = (name) => logs().flatMap((f) => fs.readFileSync(f, 'utf8').split('\n').filter((l) => l.includes(session))).map((l) => JSON.parse(l)).filter((r) => r.cmd === name);
  try {
    assert.match(first.stderr, /vawe: `vawe doctor` is now `vawe-dev doctor --quiet`/);
    assert.match(first.stdout, /vawe: doctor (ok|FAILED)/);
    assert.doesNotMatch(first.stdout, /vawe-dev: doctor/);
    assert.doesNotMatch(run('vawe', ['doctor', '--quiet'], env).stderr, /is now/);
    assert.deepEqual(rows('alias-shown').map((r) => r.alias), ['doctor->vawe-dev doctor']);
    assert.deepEqual(rows('verb').map((r) => [r.verb, r.alias]), [['doctor', 'doctor'], ['doctor', 'doctor']]);
  } finally {
    for (const file of logs()) fs.writeFileSync(file, fs.readFileSync(file, 'utf8').split('\n').filter((l) => l && !l.includes(session)).map((l) => `${l}\n`).join(''));
  }
});

test('no workflow, Makefile target or git hook calls a verb that its binary lacks', () => {
  const files = [...fs.readdirSync(path.join(ROOT, '.github/workflows')).map((f) => `.github/workflows/${f}`), 'Makefile', ...fs.readdirSync(path.join(ROOT, '.githooks')).map((f) => `.githooks/${f}`)];
  const tables = { vawe: VERBS, 'vawe-dev': DEV_VERBS };
  const seen = [];
  for (const file of files) {
    for (const m of fs.readFileSync(path.join(ROOT, file), 'utf8').matchAll(/\bbin\/(vawe(?:-dev)?)\s+([a-z][a-z0-9-]*)(?:\s+"?([a-z][a-z0-9-]*))?/g)) {
      seen.push(`${m[1]} ${m[2]}`);
      assert.ok(tables[m[1]].some((v) => v.name === m[2]), `${file}: ${m[1]} ${m[2]} does not exist`);
      if (m[2] === 'check' && m[3] && /^[a-z]/.test(m[3])) assert.ok(GATES[m[3]], `${file}: no gate ${m[3]}`);
    }
  }
  assert.ok(seen.includes('vawe-dev e2e') && seen.includes('vawe-dev test') && seen.includes('vawe-dev check'), seen.join(', '));
});

test('judge lives in vawe-dev, keeps its flags and defaults the reference like critique does', () => {
  assert.equal(VERBS.some((v) => v.name === 'judge'), false);
  const judge = DEV_VERBS.find((v) => v.name === 'judge');
  assert.deepEqual(judge.flags.map((f) => f.name), ['ref', 'struct', 'runs', 'verdict', 'at', 'top-fix', 'fresh', 'brief', 'stage']);
  assert.equal(judge.defaultRef({}, ['films/x/page.html']), 'films/x/page.html');
  assert.equal(judge.defaultRef({ fresh: true }, ['films/x/page.html']), null);
  assert.ok(DEV_ALIASES.includes('judge'));
});

test('no maker-facing text sends the maker to judge: the ship gate, ship and critique name critique --fresh', async () => {
  const { critiqueProblem } = await import('../../harness/lib/critique-gate.mjs');
  const problem = critiqueProblem('films/none/page.html', { root: ROOT, env: {}, runs: [], digest: 'x' });
  assert.match(problem, /^no fresh review of the current page .*run bin\/vawe critique films\/none\/page\.html --fresh /);
  assert.doesNotMatch(problem, /judge/);
  const critique = VERBS.find((v) => v.name === 'critique');
  assert.match(critique.next({ fresh: true }, ['films/x/page.html']), /^Read the critique file/);
  assert.doesNotMatch(critique.next({ fresh: true }, ['films/x/page.html']), /judge/);
  assert.doesNotMatch(critique.next({}, ['films/x/page.html']), /judge/);
});

test('approve lives in vawe-dev and keeps the page, the flags and the script the /vawe-approve skill calls', () => {
  const approve = DEV_VERBS.find((v) => v.name === 'approve');
  assert.deepEqual(approve.flags.map((f) => f.name), ['aspect', 'param', 'reject', 'note']);
  const [step] = approve.build({ reject: true, note: 'no' }, ['films/x/page.html']);
  assert.deepEqual([step.script, step.args], ['harness/live/approve.mjs', ['films/x/page.html', '--reject', '--note', 'no']]);
  assert.match(approve.next({}, ['films/x/page.html']), /^bin\/vawe ship films\/x\/page\.html/);
  assert.match(fs.readFileSync(path.join(ROOT, 'skills/vawe-approve/SKILL.md'), 'utf8'), /!`node \$\{CLAUDE_PROJECT_DIR\}\/harness\/live\/approve\.mjs \$ARGUMENTS`/);
  assert.equal(OLD_NAMES.includes('approve'), true);
});
