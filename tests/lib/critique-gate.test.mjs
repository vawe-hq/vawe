import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { critiqueProblem } from '../../harness/lib/critique-gate.mjs';
import { shipProblem, writeApproval, writePlanApproval, pageDigest } from '../../harness/lib/approval.mjs';
import { sameIdentity } from '../../harness/lib/judge-self-record.mjs';
import { verbEvent } from '../../harness/lib/verb-log.mjs';

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');

function film() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vawe-gate-'));
  fs.mkdirSync(path.join(root, 'films', 'f'), { recursive: true });
  fs.mkdirSync(path.join(root, 'out'));
  const page = path.join(root, 'films', 'f', 'page.html');
  fs.writeFileSync(page, '<p>x</p>');
  fs.writeFileSync(path.join(root, 'films', 'f', 'brief.md'), '## Board\n\nplan\n');
  return { root, page, digest: pageDigest(page) };
}

const dev = { cmd: 'dev', session: 's1', agent: 'author' };
const critique = (over = {}) => ({ cmd: 'verb', verb: 'critique', exitCode: 0, session: 's2', agent: 'critic', ...over });
const judged = (over = {}) => ({ cmd: 'judge', stage: 'draft', verdict: 'FIX', session: 's1', agent: 'author', ...over });
const gate = (f, runs, env = {}) => critiqueProblem(f.page, { root: f.root, env, runs, digest: f.digest });

test('a critique of the current page by another agent passes, and the approval then decides', () => {
  const f = film();
  assert.equal(gate(f, [dev, critique({ pageHash: f.digest })]), null);
  fs.writeFileSync(path.join(f.root, 'out', 'f-draft.mp4'), 'mp4');
  assert.match(shipProblem(f.page, { root: f.root, env: {} }), /waiting for the person's OK on the plan of f: .*type \/vawe-approve/);
  writePlanApproval(f.page, { root: f.root });
  assert.match(shipProblem(f.page, { root: f.root, env: {} }), /waiting for the person's OK on the draft of f: .*type \/vawe-approve/);
  writeApproval(f.page, { root: f.root });
  assert.equal(shipProblem(f.page, { root: f.root, env: {} }), null);
});

test('no critique, or one of an older page, refuses and names the command', () => {
  const f = film();
  const none = gate(f, [dev]);
  assert.match(none, /no fresh review of the current page/);
  assert.ok(none.endsWith(`VAWE_AGENT=critic bin/vawe critique ${f.page}`));
  assert.match(gate(f, [dev, critique({ pageHash: 'old' })]), /no fresh review of the current page/);
  assert.match(gate(f, [dev, critique({ pageHash: f.digest, exitCode: 1 })]), /no fresh review of the current page/);
});

test('a critique from the session that rendered the draft refuses, whatever its VAWE_AGENT label', () => {
  const f = film();
  const same = critique({ pageHash: f.digest, session: 's1', agent: 'author' });
  const problem = gate(f, [dev, same]);
  assert.match(problem, /ran in the session that rendered the draft/);
  assert.ok(problem.endsWith(`bin/vawe critique ${f.page}`));
  assert.match(gate(f, [dev, critique({ pageHash: f.digest, session: 's1', agent: 'critic' })]), /bin\/vawe judge .* --fresh.*separate terminal VAWE_AGENT=critic/);
  assert.equal(gate(f, [dev, critique({ pageHash: f.digest, session: null, agent: 'critic#ab' })]), null);
});

test('a fresh judge verdict on the current page passes; one on an older page refuses and names judge first', () => {
  const f = film();
  assert.equal(gate(f, [dev, judged({ pageHash: f.digest })]), null);
  const old = gate(f, [dev, judged({ pageHash: 'old' })]);
  assert.match(old, /no fresh review of the current page/);
  assert.ok(old.indexOf('bin/vawe judge') < old.indexOf('bin/vawe critique'));
  assert.match(old, /exit 2 means the claude CLI is missing, then use the critique/);
  assert.match(gate(f, [dev, judged()]), /no fresh review/);
});

test('an unattended run passes with no critique', () => {
  const f = film();
  assert.equal(gate(f, [dev], { VAWE_UNATTENDED: '1' }), null);
});

test('sameIdentity: an unnamed side matches on the session alone', () => {
  assert.equal(sameIdentity({ session: 'a', agent: 'x#1' }, { session: 'a', agent: 'y' }), true);
  assert.equal(sameIdentity({ session: 'a', agent: 'x' }, { session: 'a', agent: 'y' }), false);
  assert.equal(sameIdentity({ session: null, agent: 'x' }, { session: null, agent: 'x' }), false);
});

test('a fresh judge event records the page digest', async () => {
  const { judgeEvent } = await import('../../harness/lib/run-events.mjs');
  assert.equal(judgeEvent({ stage: 'draft', verdict: 'FIX', pageHash: 'abc' }).pageHash, 'abc');
  assert.equal('pageHash' in judgeEvent({ stage: 'manual', verdict: 'PASS' }), false);
});

test('a critique verb records the page digest; other verbs do not', () => {
  const base = { args: [], startMs: 0, endMs: 1000, exitCode: 0 };
  assert.equal(verbEvent({ ...base, verb: 'critique', pageHash: 'abc' }).pageHash, 'abc');
  assert.equal('pageHash' in verbEvent({ ...base, verb: 'dev' }), false);
});

test('the ship gate script prints every refusal with its command and exits 1', () => {
  const r = spawnSync('node', ['harness/live/ship-approval.mjs', 'films/examples/colour-sting/page.html'], { cwd: REPO, encoding: 'utf8', env: { ...process.env, VAWE_UNATTENDED: '' } });
  assert.equal(r.status, 1);
  const lines = r.stderr.trim().split('\n');
  assert.equal(lines.length, 2);
  assert.match(lines[0], /^vawe: ship refused: no fresh review of the current page.*bin\/vawe critique films\/examples\/colour-sting\/page\.html$/);
  assert.match(lines[1], /^vawe: ship refused: waiting for the person's OK on the plan of colour-sting: .*type \/vawe-approve"/);
});

test('the ship gate script says so when it lets an unattended run through', () => {
  const r = spawnSync('node', ['harness/live/ship-approval.mjs', 'films/examples/colour-sting/page.html'], { cwd: REPO, encoding: 'utf8', env: { ...process.env, VAWE_UNATTENDED: '1' } });
  assert.equal(r.status, 0);
  assert.match(r.stdout, /ship runs unattended: no fresh review and no OK from the person checked/);
});
