import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { DEV_VERBS } from '../../harness/dev/verbs.mjs';
import { applyRenderEnv } from '../../harness/cli/helpers.mjs';
import { parseArgs, UsageError } from '../../harness/cli/parse.mjs';

const ROOT = path.resolve(import.meta.dirname, '../..');
const P = 'films/examples/colour-sting/page.html';
const run = (bin, args, env = {}) => spawnSync(process.execPath, [path.join(ROOT, 'bin', bin), ...args], { cwd: ROOT, encoding: 'utf8', env: { ...process.env, ...env } });

const logRows = (session) => fs.readdirSync(path.join(ROOT, 'out')).filter((f) => f.endsWith('.runs.jsonl'))
  .flatMap((f) => fs.readFileSync(path.join(ROOT, 'out', f), 'utf8').split('\n').filter((l) => l.includes(session))).map((l) => JSON.parse(l));

const cleanLogs = (session) => {
  for (const f of fs.readdirSync(path.join(ROOT, 'out')).filter((x) => x.endsWith('.runs.jsonl'))) {
    const file = path.join(ROOT, 'out', f);
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8').split('\n').filter((l) => l && !l.includes(session)).map((l) => `${l}\n`).join(''));
  }
};

test('a moved verb that takes --param or --aspect carries them into the step env, and a bad value is a usage error', () => {
  const owner = DEV_VERBS.find((v) => v.name.startsWith('appr'));
  const steps = (...args) => { const { values, positional } = parseArgs(owner, args); const s = owner.build(values, positional); applyRenderEnv(owner, values, s); return s; };
  const [step] = steps(P, '--param', 'look=riso', '--aspect', '1:1');
  assert.match(step.env.VAWE_PARAMS ?? Object.values(step.env).join(' '), /look=riso/);
  assert.equal(Object.keys(step.env).length, 2);
  assert.throws(() => steps(P, '--param', 'novalue'), (e) => e instanceof UsageError && /--param needs key=value/.test(e.message));
  const cli = run('vawe-dev', [owner.name, P, '--param', 'novalue']);
  assert.equal(cli.status, 2);
  assert.match(cli.stderr, /--param needs key=value/);
});

test('an old name that runs in vawe-dev logs its cause, usage flag and help, like any verb', () => {
  const session = `dev-alias-log-${process.pid}`;
  const env = { CLAUDE_CODE_SESSION_ID: session, VAWE_AGENT: session };
  try {
    const usage = run('vawe', ['runs'], env);
    assert.equal(usage.status, 2);
    const help = run('vawe', ['runs', '--help'], env);
    assert.equal(help.status, 0);
    const [fail, ok] = logRows(session).filter((r) => r.cmd === 'verb');
    assert.equal(fail.usage, true);
    assert.match(fail.error, /^exit 2: .*missing <film>/);
    assert.equal(ok.help, true);
  } finally { cleanLogs(session); }
});
