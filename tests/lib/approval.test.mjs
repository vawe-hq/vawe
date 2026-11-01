import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { pageDigest, shipProblem, approveProblem, writeApproval, writePlanApproval, planProblem, planState, approveStep, selfApproved, referencedFiles, recordOwnerVerdict, approvalPath } from '../../harness/lib/approval.mjs';
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
  assert.match(shipProblem(page, { root, env: {} }), /^waiting for your OK on the plan of f: show the person the directions board .*"If you like it, type \/vawe-approve"/);
});

test('with the plan approved the next message names the draft', () => {
  const { root, page } = film();
  writePlanApproval(page, { root });
  assert.match(shipProblem(page, { root, env: {} }), /^waiting for your OK on the draft of f: show the person the draft .*\/vawe-approve/);
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
  assert.match(shipProblem(page, { root, env: {} }), /^the page changed after your OK on the draft/);
  assert.equal(referencedFiles(page).length, 3);
});

test('a draft rendered again after the OK expires the draft approval', () => {
  const { root, page, draft } = film();
  fs.writeFileSync(draft, 'mp4');
  writePlanApproval(page, { root });
  writeApproval(page, { root });
  fs.writeFileSync(draft, 'mp4 again');
  assert.match(shipProblem(page, { root, env: {} }), /^the draft was rendered again after your OK on the draft/);
});

test('an edit to the Directions or the Board expires the plan approval, and the draft cannot ship', () => {
  const { root, page, draft } = film();
  fs.writeFileSync(draft, 'mp4');
  writePlanApproval(page, { root });
  writeApproval(page, { root });
  assert.equal(planState(page, { root }), 'fresh');
  fs.writeFileSync(briefOf(root), BRIEF.replace('| s1 | 0 |', '| s1 | 2 |'));
  assert.equal(planState(page, { root }), 'stale');
  assert.match(shipProblem(page, { root, env: {} }), /^the plan of f changed after your OK .*\/vawe-approve/);
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

test('node harness/live/approve.mjs records the plan, then the draft, in one command', () => {
  const dir = path.join(REPO, 'films', 'zz-approve-test');
  fs.mkdirSync(dir, { recursive: true });
  try {
    fs.writeFileSync(path.join(dir, 'page.html'), '<p>x</p>');
    fs.writeFileSync(path.join(dir, 'brief.md'), BRIEF);
    const run = () => spawnSync('node', ['harness/live/approve.mjs', 'zz-approve-test'], { cwd: REPO, encoding: 'utf8' });
    assert.match(run().stdout, /OK on the plan of/);
    assert.match(run().stderr, /approve refused: no full draft/);
    fs.writeFileSync(path.join(REPO, 'out', 'zz-approve-test-draft.mp4'), 'mp4');
    assert.match(run().stdout, /OK on the draft/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    for (const f of ['.plan-approved', '.approved', '.runs.jsonl', '-draft.mp4']) fs.rmSync(path.join(REPO, 'out', `zz-approve-test${f}`), { force: true });
  }
});

test('an unattended run needs no approval', () => {
  const { root, page } = film();
  assert.equal(shipProblem(page, { root, env: { VAWE_UNATTENDED: '1' } }), null);
  const base = { verb: 'ship', args: [], startMs: 0, endMs: 1000, exitCode: 0 };
  assert.equal(verbEvent({ ...base, env: { VAWE_UNATTENDED: '1' } }).unattended, true);
  assert.equal('unattended' in verbEvent({ ...base, env: {} }), false);
});

test('bin/vawe ship refuses with exit 1 and no render when nothing is approved', () => {
  const r = spawnSync('node', ['harness/live/ship-approval.mjs', 'films/examples/colour-sting/page.html'], { cwd: REPO, encoding: 'utf8', env: { ...process.env, VAWE_UNATTENDED: '' } });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /ship refused: waiting for your OK on the plan of colour-sting/);
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
