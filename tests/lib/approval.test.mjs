import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { pageDigest, shipProblem, approveProblem, writeApproval, writePlanApproval, planProblem, planState, approveStep, selfApproved, referencedFiles, recordOwnerVerdict, approvalPath, planApprovalPath } from '../../harness/lib/approval.mjs';
import { readRuns } from '../../harness/lib/runlog.mjs';
import { selfApprovedTricks } from '../../harness/lib/judge-tricks.mjs';
import { verbEvent } from '../../harness/lib/verb-log.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const BRIEF = '## Directions\n\n### A\n- sentence: x\n\n- picked: A, because bold\n\n## Board\n\n| beat | in s |\n|---|---|\n| s1 | 0 |\n\n## Motion pass\n\nnotes a.css\n';
const briefOf = (root) => path.join(root, 'films', 'f', 'brief.md');

function film() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vawe-approval-'));
  const dir = path.join(root, 'films', 'f');
  fs.mkdirSync(path.join(dir, 'assets'), { recursive: true });
  fs.mkdirSync(path.join(root, 'out'));
  const page = path.join(dir, 'page.html');
  fs.writeFileSync(page, '<link rel="stylesheet" href="assets/a.css"><p>x</p>');
  fs.writeFileSync(path.join(dir, 'assets', 'a.css'), '@font-face{src:url("f.woff2")} p{color:red}');
  fs.writeFileSync(path.join(dir, 'assets', 'f.woff2'), 'font');
  fs.writeFileSync(path.join(dir, 'brief.md'), BRIEF);
  const old = new Date(Date.now() - 60000);
  for (const f of [page, path.join(dir, 'assets', 'a.css'), path.join(dir, 'assets', 'f.woff2')]) fs.utimesSync(f, old, old);
  return { root, page, draft: path.join(root, 'out', 'f-draft.mp4') };
}

test('a page with no approval refuses a final render and names the owner step', () => {
  const { root, page } = film();
  assert.match(shipProblem(page, { root, env: {} }), /^waiting for the person's OK on the plan of f: show the person the directions board \(bin\/vawe frame <page> --directions\) .*"If you like it, type \/vawe-approve"/);
});

test('with the plan approved the next message names the draft', () => {
  const { root, page } = film();
  writePlanApproval(page, { root });
  assert.match(shipProblem(page, { root, env: {} }), /^waiting for the person's OK on the draft of f: show the person the draft .*\/vawe-approve/);
});

test('approve needs a full draft newer than the page, then ship passes', () => {
  const { root, page, draft } = film();
  assert.match(approveProblem(page, { root }), /no full draft/);
  fs.writeFileSync(draft, 'mp4');
  assert.equal(approveProblem(page, { root }), null);
  writePlanApproval(page, { root });
  const record = writeApproval(page, { root });
  assert.equal(record.page, pageDigest(page));
  assert.equal(shipProblem(page, { root, env: {} }), null);
});

test('an older draft cannot be approved after a page edit', () => {
  const { root, page, draft } = film();
  fs.writeFileSync(draft, 'mp4');
  const old = new Date(Date.now() - 30000);
  fs.utimesSync(draft, old, old);
  fs.appendFileSync(page, '<!-- edit -->');
  assert.match(approveProblem(page, { root }), /draft is older than the page/);
});

test('an edit to the page or to a file it references expires the draft approval; the Motion pass of the brief does not', () => {
  const { root, page, draft } = film();
  fs.writeFileSync(draft, 'mp4');
  writePlanApproval(page, { root });
  writeApproval(page, { root });
  fs.appendFileSync(briefOf(root), 'one more row\n');
  assert.equal(shipProblem(page, { root, env: {} }), null);
  fs.appendFileSync(path.join(root, 'films', 'f', 'assets', 'f.woff2'), 'x');
  assert.match(shipProblem(page, { root, env: {} }), /^the page changed after the person's OK on the draft/);
  assert.equal(referencedFiles(page).length, 3);
});

test('a deleted draft file does not pass ship, and a draft touched or rendered again for the same page keeps the OK', () => {
  const { root, page, draft } = film();
  fs.writeFileSync(draft, 'mp4');
  writePlanApproval(page, { root });
  writeApproval(page, { root });
  const later = new Date(Date.now() + 5000);
  fs.utimesSync(draft, later, later);
  assert.equal(shipProblem(page, { root, env: {} }), null);
  fs.writeFileSync(draft, 'mp4 rendered again');
  assert.equal(shipProblem(page, { root, env: {} }), null);
  fs.rmSync(draft);
  assert.match(shipProblem(page, { root, env: {} }), /^the draft file is gone after the person's OK on the draft/);
});

test('the plan approval file carries no param or aspect slug; the draft approval does', () => {
  const { root, page } = film();
  const env = { VAWE_PARAMS: 'look=riso', VAWE_ASPECT: '1:1' };
  const was = { ...process.env };
  Object.assign(process.env, env);
  try {
    assert.equal(path.basename(planApprovalPath(page, root)), 'f.plan-approved');
    assert.match(path.basename(approvalPath(page, root)), /^f-look-riso_1x1\.approved$/);
  } finally {
    for (const k of Object.keys(env)) k in was ? (process.env[k] = was[k]) : delete process.env[k];
  }
});

test('an edit to the Directions or the Board expires the plan approval, and the draft cannot ship', () => {
  const { root, page, draft } = film();
  fs.writeFileSync(draft, 'mp4');
  writePlanApproval(page, { root });
  writeApproval(page, { root });
  assert.equal(planState(page, { root }), 'fresh');
  fs.writeFileSync(briefOf(root), BRIEF.replace('| s1 | 0 |', '| s1 | 2 |'));
  assert.equal(planState(page, { root }), 'stale');
  assert.match(shipProblem(page, { root, env: {} }), /^the plan of f changed after the person's OK: .*\/vawe-approve/);
  fs.writeFileSync(briefOf(root), BRIEF.replace('picked: A', 'picked: B'));
  assert.equal(planState(page, { root }), 'stale');
});

test('the step to record is the plan until it is fresh, then the draft', () => {
  const { root, page } = film();
  assert.equal(approveStep(page, { root }), 'plan');
  writePlanApproval(page, { root });
  assert.equal(approveStep(page, { root }), 'draft');
  fs.writeFileSync(briefOf(root), BRIEF.replace('| s1 | 0 |', '| s1 | 3 |'));
  assert.equal(approveStep(page, { root }), 'plan');
});

test('a plan needs a Directions or a Board, and a picked direction when Directions exists', () => {
  const { root, page } = film();
  assert.equal(planProblem(page), null);
  fs.writeFileSync(briefOf(root), '## Directions\n\n- picked: [A, B or C], because [one reason]\n');
  assert.match(planProblem(page), /no picked direction/);
  fs.writeFileSync(briefOf(root), '## Motion pass\n\nx\n');
  assert.match(planProblem(page), /no plan to approve/);
});

test('a reject withdraws the plan approval too', () => {
  const { root, page, draft } = film();
  fs.writeFileSync(draft, 'mp4');
  writePlanApproval(page, { root });
  recordOwnerVerdict(page, { verdict: 'reject', root });
  assert.equal(planState(page, { root }), 'none');
});

const approveCli = (root, ...args) => spawnSync('node', [path.join(REPO, 'harness/live/approve.mjs'), ...args], { cwd: root, encoding: 'utf8', env: { ...process.env, VAWE_ROOT: root, VAWE_PARAMS: '', VAWE_ASPECT: '' } });

test('approve.mjs records the plan, then the draft, in a temp root; a refusal prints its reason on stdout and exits 0', () => {
  const { root, draft } = film();
  const first = approveCli(root, 'f');
  assert.equal(first.status, 0);
  assert.match(first.stdout, /OK on the plan of/);
  const refused = approveCli(root, 'f');
  assert.equal(refused.status, 0);
  assert.match(refused.stdout, /^vawe: approve refused: no full draft/);
  assert.equal(refused.stderr, '');
  fs.writeFileSync(draft, 'mp4');
  assert.match(approveCli(root, 'f').stdout, /OK on the draft/);
  assert.equal(approveCli(root, 'nope').stdout.includes('approve refused: no film found for nope'), true);
});

test('approve.mjs passes --param and --aspect through: the draft OK lands on the param file, the plan OK on the bare one', () => {
  const { root, draft } = film();
  approveCli(root, 'f');
  fs.writeFileSync(path.join(root, 'out', 'f-look-riso-draft.mp4'), 'mp4');
  const r = approveCli(root, 'f', '--param', 'look=riso');
  assert.match(r.stdout, /OK on the draft out\/f-look-riso-draft\.mp4/);
  assert.ok(fs.existsSync(path.join(root, 'out', 'f-look-riso.approved')));
  assert.ok(fs.existsSync(path.join(root, 'out', 'f.plan-approved')));
  assert.equal(fs.existsSync(path.join(root, 'out', 'f.approved')), false);
});

test('the /vawe-approve skill stays out of the model\'s reach and carries its own tool allowance and project path', () => {
  const skill = fs.readFileSync(path.join(REPO, 'skills/vawe-approve/SKILL.md'), 'utf8');
  const head = skill.split('---')[1];
  assert.match(head, /^disable-model-invocation: true$/m);
  assert.match(head, /^allowed-tools: Bash\(node \$\{CLAUDE_PROJECT_DIR\}\/harness\/live\/approve\.mjs \*\)$/m);
  assert.match(skill, /^!`node \$\{CLAUDE_PROJECT_DIR\}\/harness\/live\/approve\.mjs \$ARGUMENTS`$/m);
});

test('an unattended run needs no approval', () => {
  const { root, page } = film();
  assert.equal(shipProblem(page, { root, env: { VAWE_UNATTENDED: '1' } }), null);
  const base = { verb: 'ship', args: [], startMs: 0, endMs: 1000, exitCode: 0 };
  assert.equal(verbEvent({ ...base, env: { VAWE_UNATTENDED: '1' } }).unattended, true);
  assert.equal('unattended' in verbEvent({ ...base, env: {} }), false);
});

test('bin/vawe ship refuses with exit 6 and no render when nothing is approved', () => {
  const r = spawnSync('node', ['harness/live/ship-approval.mjs', 'films/examples/colour-sting/page.html'], { cwd: REPO, encoding: 'utf8', env: { ...process.env, VAWE_UNATTENDED: '' } });
  assert.equal(r.status, 6);
  assert.match(r.stderr, /ship refused: waiting for the person's OK on the plan of colour-sting/);
});

test('an approval by the agent that ran the film is self-approved and reaches the judge', () => {
  const runs = [{ agent: 'crave', verb: 'dev' }, { agent: 'crave', verb: 'approve' }];
  assert.equal(selfApproved({ by: 'crave' }, runs), true);
  assert.equal(selfApproved({ by: 'owner#ab12' }, runs), false);
  assert.equal(selfApproved({ by: 'other' }, runs), false);
  const [t] = selfApprovedTricks({ by: 'crave' }, runs);
  assert.equal(t.trick, 'self-approved');
  assert.deepEqual(selfApprovedTricks(null, runs), []);
});

test('an approve record is not other work by the approving agent', () => {
  assert.equal(selfApproved({ by: 'crave' }, [{ agent: 'crave', cmd: 'approve', verdict: 'approve' }]), false);
});

test('approve and reject append an owner record with note, draft and page hash; reject withdraws the approval', () => {
  const { root, page, draft } = film();
  fs.writeFileSync(draft, 'mp4');
  writeApproval(page, { root });
  recordOwnerVerdict(page, { verdict: 'approve', note: 'good', root });
  assert.ok(fs.existsSync(approvalPath(page, root)));
  recordOwnerVerdict(page, { verdict: 'reject', note: 'too slow', root });
  assert.equal(fs.existsSync(approvalPath(page, root)), false);
  const [a, r] = readRuns('f', root);
  assert.deepEqual([a.cmd, a.verdict, a.note, a.draft, a.pageHash], ['approve', 'approve', 'good', path.join('out', 'f-draft.mp4'), pageDigest(page)]);
  assert.deepEqual([r.verdict, r.note], ['reject', 'too slow']);
  assert.match(a.draftMtime, /^\d{4}-\d\d-\d\dT/);
});
