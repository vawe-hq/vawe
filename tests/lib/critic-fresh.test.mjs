import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { criticTemplate, criticPrompt, verdictLine, critiqueFiles } from '../../harness/lib/critic-prompt.mjs';
import { critiqueProblem } from '../../harness/lib/critique-gate.mjs';
import { verbEvent } from '../../harness/lib/verb-log.mjs';
import { VERBS } from '../../harness/cli/verbs.mjs';
import { SAY } from '../../harness/live/stage-say.mjs';
import { outcomeLines } from '../../harness/lib/runs-report.mjs';

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const SKILL = fs.readFileSync(path.join(REPO, 'skills/vawe-critique/SKILL.md'), 'utf8');

test('the critic prompt is read from the skill, not copied', () => {
  const t = criticTemplate(SKILL);
  assert.match(t, /^You are the critic\./);
  assert.match(t, /end with the REJECT or PASS line\.$/);
  assert.equal(criticTemplate('no prompt here'), null);
});

test('the prompt names every input, and "none" for a missing one', () => {
  const p = criticPrompt('T', { page: '/f/page.html', mp4: null, ref: null, brief: '/f/brief.md', previous: '/o/f.critique-1.md', images: ['/s/a.png'] });
  assert.match(p, /Film page: \/f\/page\.html/);
  assert.match(p, /Rendered draft: none/);
  assert.match(p, /Previous critique: \/o\/f\.critique-1\.md \(check each finding was fixed, not moved\)/);
  assert.match(p, /\n {2}\/s\/a\.png/);
});

test('the verdict is the last line, REJECT or PASS', () => {
  assert.equal(verdictLine('1. x\n\nREJECT: 1 findings, the top five first.\n'), 'REJECT: 1 findings, the top five first.');
  assert.equal(verdictLine('`PASS: none`'), 'PASS: none');
  assert.equal(verdictLine('**REJECT: 2 findings**'), 'REJECT: 2 findings');
  assert.equal(verdictLine('REJECT: 1\nand then more'), null);
  assert.equal(verdictLine(''), null);
});

test('critique files count up and the newest is the previous one', () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'vawe-crit-'));
  assert.deepEqual(critiqueFiles(out, 'f'), { next: path.join(out, 'f.critique-1.md'), previous: null });
  for (const n of ['f.critique-1.md', 'f.critique-2.md', 'g.critique-9.md']) fs.writeFileSync(path.join(out, n), 'x');
  assert.deepEqual(critiqueFiles(out, 'f'), { next: path.join(out, 'f.critique-3.md'), previous: path.join(out, 'f.critique-2.md') });
});

test('the ship gate accepts a fresh critique logged from the author session, and still refuses a plain one', () => {
  const page = fs.mkdtempSync(path.join(os.tmpdir(), 'vawe-gate-'));
  const file = path.join(page, 'page.html');
  fs.writeFileSync(file, '<p>x</p>');
  const digest = 'd1';
  const dev = { cmd: 'dev', session: 's1', agent: 'a' };
  const crit = (over) => ({ cmd: 'verb', verb: 'critique', exitCode: 0, session: 's1', agent: 'a', pageHash: digest, ...over });
  const gate = (runs) => critiqueProblem(file, { root: page, env: {}, runs, digest });
  assert.match(gate([dev, crit({})]), /ran in the session that rendered the draft.*critique .* --fresh/);
  assert.equal(gate([dev, crit({ fresh: true })]), null);
});

test('verbEvent records fresh and the verdict only when set', () => {
  const base = { verb: 'critique', args: [], startMs: 0, endMs: 1000, exitCode: 0 };
  assert.equal(verbEvent({ ...base, fresh: true, verdict: 'PASS' }).verdict, 'PASS');
  assert.equal('verdict' in verbEvent(base), false);
  assert.equal(verbEvent({ ...base, fresh: true }).fresh, true);
  assert.equal('fresh' in verbEvent(base), false);
});

test('the critique verb takes --fresh and --model, adds the critic step only with --fresh, and names --fresh in next', () => {
  const v = VERBS.find((x) => x.name === 'critique');
  assert.ok(v.flags.some((f) => f.name === 'fresh') && v.flags.some((f) => f.name === 'model'));
  assert.match(v.example, /--fresh/);
  assert.match(v.summary, /--fresh/);
  assert.equal(v.flags.find((f) => f.name === 'model').help.includes('default'), false);
  const scripts = (vals) => v.build(vals, ['films/f/page.html']).map((s) => s.script);
  assert.ok(!scripts({}).includes('harness/media/critic-fresh.mjs'));
  const steps = v.build({ fresh: true, model: 'sonnet' }, ['films/f/page.html']);
  assert.deepEqual(steps.at(-1).args.slice(-2), ['--model', 'sonnet']);
  assert.throws(() => v.build({ model: 'sonnet' }, ['films/f/page.html']), /--model needs --fresh/);
  assert.match(v.next({}, ['films/f/page.html']), /critique films\/f\/page\.html --fresh/);
  assert.match(SAY.critique('f', 'films/f/page.html'), / --fresh$/);
});

function run(page, env) {
  return spawnSync(process.execPath, [path.join(REPO, 'harness/media/critic-fresh.mjs'), page, '--since', '0', ...(env.MODEL ? ['--model', env.MODEL] : [])], { cwd: env.CWD, encoding: 'utf8', env: { ...process.env, ...env, VAWE_VERB_NOTES: env.NOTES } });
}

test('critic-fresh writes the next critique file, prints the verdict, notes fresh; no claude CLI exits 2', () => {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'vawe-critic-'));
  fs.mkdirSync(path.join(work, 'films', 'f'), { recursive: true });
  fs.mkdirSync(path.join(work, 'bin'));
  fs.writeFileSync(path.join(work, 'films', 'f', 'page.html'), '<p>x</p>');
  const argsLog = path.join(work, 'args.txt');
  fs.writeFileSync(path.join(work, 'bin', 'claude'), `#!/bin/sh\nif [ "$1" = "--version" ]; then echo 1; exit 0; fi\necho "$@" > ${argsLog}\ncat > ${path.join(work, 'prompt.txt')}\nprintf '%s\\n' '{"result":"1. [3.2s] flat. fix: page.html:1\\n\\nREJECT: 1 findings, the top five first.","total_cost_usd":0.01}'\n`, { mode: 0o755 });
  const notes = path.join(work, 'notes.jsonl');
  const page = path.join('films', 'f', 'page.html');
  const env = { CWD: work, PATH: `${path.join(work, 'bin')}:${process.env.PATH}`, NOTES: notes, CLAUDE_JOB_DIR: work };
  const noImages = run(page, env);
  assert.equal(noImages.status, 2, noImages.stderr);
  assert.match(noImages.stderr, /no view images/);
  assert.equal(fs.existsSync(notes), false);
  assert.equal(fs.existsSync(argsLog), false);
  fs.rmSync(path.join(work, 'out'), { recursive: true, force: true });
  fs.mkdirSync(path.join(work, 'tmp', 'see', 'f'), { recursive: true });
  fs.writeFileSync(path.join(work, 'tmp', 'see', 'f', 'a.png'), '');
  const r = run(page, env);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /critique: out\/f\.critique-1\.md\nREJECT: 1 findings/);
  assert.match(fs.readFileSync(path.join(work, 'out', 'f.critique-1.md'), 'utf8'), /REJECT: 1 findings/);
  assert.match(fs.readFileSync(notes, 'utf8'), /"fresh":true,"verdict":"REJECT"/);
  assert.match(fs.readFileSync(argsLog, 'utf8'), /--settings \{"disableAllHooks":true\}/);
  assert.doesNotMatch(fs.readFileSync(argsLog, 'utf8'), /--model/);
  assert.match(fs.readFileSync(path.join(work, 'prompt.txt'), 'utf8'), /You are the critic\./);
  run(page, { ...env, MODEL: 'haiku' });
  assert.match(fs.readFileSync(argsLog, 'utf8'), /--model haiku/);
  assert.ok(fs.existsSync(path.join(work, 'out', 'f.critique-2.md')));
  fs.writeFileSync(path.join(work, 'bin', 'claude'), `#!/bin/sh\nif [ "$1" = "--version" ]; then echo 1; exit 0; fi\ncat > /dev/null\nprintf '%s\\n' '{"result":"1. flat. fix: page.html:1"}'\n`, { mode: 0o755 });
  fs.rmSync(notes);
  const unsure = run(page, env);
  assert.equal(unsure.status, 1);
  assert.match(fs.readFileSync(path.join(work, 'out', 'f.critique-3.md'), 'utf8'), /flat/);
  assert.equal(fs.existsSync(notes), false);
  const none = spawnSync(process.execPath, [path.join(REPO, 'harness/media/critic-fresh.mjs'), page], { cwd: work, encoding: 'utf8', env: { ...process.env, PATH: path.dirname(process.execPath) } });
  assert.equal(none.status, 2);
  assert.equal(none.stderr.trim().split('\n').length, 1);
});

test('vawe-dev runs lists a fresh critique with its verdict; AGENTS.md row 8 names --fresh', () => {
  const at = '2026-11-01T10:00:00.000Z';
  const lines = outcomeLines([{ cmd: 'verb', verb: 'critique', fresh: true, verdict: 'PASS', at }, { cmd: 'verb', verb: 'critique', at }]);
  assert.equal(lines.length, 1);
  assert.match(lines[0], /^critique .* fresh PASS$/);
  assert.match(fs.readFileSync(path.join(REPO, 'AGENTS.md'), 'utf8'), /\| 8 \| critique \| `bin\/vawe critique <page> --fresh`/);
});
