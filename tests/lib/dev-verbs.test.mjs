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
const MOVED = ['land', 'claim', 'e2e', 'test', 'runs', 'moves', 'doctor'];
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
  const rows = (name) => (fs.existsSync(path.join(ROOT, 'out', '_unfiled.runs.jsonl')) ? fs.readFileSync(path.join(ROOT, 'out', '_unfiled.runs.jsonl'), 'utf8').split('\n').filter((l) => l.includes(session)) : []).map((l) => JSON.parse(l)).filter((r) => r.cmd === name);
  try {
    assert.match(first.stderr, /vawe: `vawe doctor` is now `vawe-dev doctor --quiet`/);
    assert.match(first.stdout, /vawe: doctor (ok|FAILED)/);
    assert.doesNotMatch(first.stdout, /vawe-dev: doctor/);
    assert.doesNotMatch(run('vawe', ['doctor', '--quiet'], env).stderr, /is now/);
    assert.deepEqual(rows('alias-shown').map((r) => r.alias), ['doctor->vawe-dev doctor']);
    assert.deepEqual(rows('verb').map((r) => [r.verb, r.alias]), [['doctor', 'doctor'], ['doctor', 'doctor']]);
  } finally {
    const file = path.join(ROOT, 'out', '_unfiled.runs.jsonl');
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8').split('\n').filter((l) => l && !l.includes(session)).map((l) => `${l}\n`).join(''));
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
