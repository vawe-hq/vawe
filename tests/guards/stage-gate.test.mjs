import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { stageGate, rootOf } from '../../harness/guards/index.mjs';
import { pageDigest, writeApproval, writePlanApproval } from '../../harness/lib/approval.mjs';

process.env.HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'vawe-home-'));

const IDEAS = '## Ideas\n\n| at | meaning | i1 | i2 | i3 | i4 | chosen | why |\n|---|---|---|---|---|---|---|---|\n| s1 | m | a: x, 0.1 | b: y, 0.2 | c: z, 0.3 | d: w, 0.4 | 1 | because |\n\n';
const BOARD_EMPTY = '## Board\n\n| beat | in s | hold s | cut out s (length) |\n|---|---|---|---|\n| [s1] | [0] | [1] | [0.6] |\n';
const BOARD_FILLED = '## Board\n\n| beat | in s | hold s | cut out s (length) |\n|---|---|---|---|\n| s1 | 0 | 1.6 | 0.6 |\n| s2 | 1.6 | 1.6 | 0.6 |\n\n| cut | move |\n|---|---|\n| s1 to s2 | whip left |\n\n| at s | voice | gain dB | for |\n|---|---|---|---|\n| 0.2 | tick | -20 | s1 |\n';
const NO_ENV = {};

function film({ brief = null, html = '<p>x</p>' } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vawe-guard-'));
  const dir = path.join(root, 'films', 'f');
  fs.mkdirSync(dir, { recursive: true });
  fs.mkdirSync(path.join(root, 'out'));
  const page = path.join(dir, 'page.html');
  if (html !== null) fs.writeFileSync(page, html);
  if (brief !== null) fs.writeFileSync(path.join(dir, 'brief.md'), brief);
  const old = new Date(Date.now() - 60000);
  if (html !== null) fs.utimesSync(page, old, old);
  return { root, dir, page };
}

const gate = (f, tool, opts = {}) => stageGate(f.dir, tool, { root: f.root, env: NO_ENV, ...opts });

test('rootOf finds the folder above films, also for films/examples', () => {
  assert.equal(rootOf('/a/b/films/f'), '/a/b');
  assert.equal(rootOf('/a/b/films/examples/f'), '/a/b');
});

test('a film with no page yet refuses the draft and names the brief as the next step', () => {
  const f = film({ html: null });
  const g = gate(f, 'vawe_render_draft');
  assert.equal(g.allow, false);
  assert.match(g.next, /^create films\/f\/brief\.md/);
  assert.equal(gate(f, 'vawe_status').allow, true);
  assert.equal(gate(f, 'vawe_write_page').allow, true);
});

test('a film with a brief and no page yet: no frames, no look, no ship, no throw', () => {
  const f = film({ html: null, brief: '## Look\n' });
  for (const tool of ['vawe_frame', 'vawe_look', 'vawe_ship', 'vawe_critique']) assert.equal(gate(f, tool).allow, false, tool);
});

test('a film folder that does not exist refuses everything but a new film', () => {
  const f = film({ html: null });
  const missing = path.join(f.root, 'films', 'nope');
  assert.equal(stageGate(missing, 'vawe_render_draft', { root: f.root, env: NO_ENV }).allow, false);
  assert.equal(stageGate(missing, 'vawe_new_film', { root: f.root, env: NO_ENV }).allow, true);
  assert.equal(gate(f, 'vawe_new_film').allow, false);
});

test('a board with only placeholder rows still allows the draft and names the board as the next step', () => {
  const f = film({ brief: IDEAS + BOARD_EMPTY });
  const half = gate(f, 'vawe_render_draft');
  assert.equal(half.allow, true);
  assert.match(half.next, /^bin\/vawe frame films\/f\/page\.html --board/);
  fs.writeFileSync(path.join(f.dir, 'brief.md'), IDEAS + BOARD_FILLED);
  const filled = gate(f, 'vawe_render_draft');
  assert.equal(filled.allow, true, filled.reason);
});

test('an empty Ideas ledger allows the draft and names Ideas before the board', () => {
  const f = film({ brief: BOARD_FILLED });
  const g = gate(f, 'vawe_render_draft');
  assert.equal(g.allow, true);
  assert.match(g.next, /Ideas/);
});

test('the plan awaiting the person OK does not stop a draft', () => {
  const f = film({ brief: IDEAS + BOARD_FILLED });
  assert.equal(gate(f, 'vawe_render_draft').allow, true);
});

test('cuts and moments need a draft; a world frame does not', () => {
  const f = film({ brief: IDEAS + BOARD_FILLED });
  assert.equal(gate(f, 'vawe_frame', { mode: 'world' }).allow, true);
  assert.equal(gate(f, 'vawe_frame', { mode: 'cuts' }).allow, false);
  assert.equal(gate(f, 'vawe_look').allow, false);
  const draft = path.join(f.root, 'out', 'f-draft.mp4');
  fs.writeFileSync(draft, '');
  const later = new Date(Date.now() - 1000);
  fs.utimesSync(draft, later, later);
  assert.equal(gate(f, 'vawe_frame', { mode: 'cuts' }).allow, true);
  assert.equal(gate(f, 'vawe_look').allow, true);
});

test('critique waits for the motion pass; ship waits for the critique and both approvals', () => {
  const f = film({ brief: '## Board\n\nplan\n\n## Motion pass\n\n| cut | what read flat | fixed |\n|---|---|---|\n| [cut] | [x] | [y] |\n' });
  const out = (name) => path.join(f.root, 'out', name);
  const draft = out('f-draft.mp4');
  fs.writeFileSync(draft, '');
  const now = Date.now();
  fs.utimesSync(draft, new Date(now - 30000), new Date(now - 30000));
  fs.mkdirSync(out('strip/f-cut-3.1'), { recursive: true });
  assert.equal(gate(f, 'vawe_critique').allow, false);
  assert.match(gate(f, 'vawe_critique').reason, /motion pass/);

  fs.writeFileSync(path.join(f.dir, 'brief.md'), '## Board\n\nplan\n\n## Motion pass\n\n| cut | what read flat | fixed |\n|---|---|---|\n| s1 | too slow | shortened |\n');
  assert.equal(gate(f, 'vawe_critique').allow, true);

  const noReview = gate(f, 'vawe_ship');
  assert.equal(noReview.allow, false);
  assert.match(noReview.reason, /no fresh review/);

  fs.writeFileSync(out('f.runs.jsonl'), `${JSON.stringify({ cmd: 'verb', verb: 'critique', exitCode: 0, pageHash: pageDigest(f.page), at: new Date(now).toISOString(), start: new Date(now).toISOString() })}\n`);
  const noPlan = gate(f, 'vawe_ship');
  assert.equal(noPlan.allow, false);
  assert.match(noPlan.reason, /OK on the plan/);

  writePlanApproval(f.page, { root: f.root });
  assert.match(gate(f, 'vawe_ship').reason, /OK on the draft/);

  writeApproval(f.page, { root: f.root });
  const ship = gate(f, 'vawe_ship');
  assert.equal(ship.allow, true, ship.reason);
});

test('a page edit after the approval takes the approval back', () => {
  const f = film({ brief: '## Board\n\nplan\n\n## Motion pass\n\n| cut | what read flat | fixed |\n|---|---|---|\n| s1 | too slow | shortened |\n' });
  const draft = path.join(f.root, 'out', 'f-draft.mp4');
  fs.writeFileSync(draft, '');
  const now = Date.now();
  fs.utimesSync(draft, new Date(now - 30000), new Date(now - 30000));
  writePlanApproval(f.page, { root: f.root });
  writeApproval(f.page, { root: f.root });
  fs.writeFileSync(f.page, '<p>changed</p>');
  const g = gate(f, 'vawe_ship');
  assert.equal(g.allow, false);
});

test('an unattended run needs neither review nor approval', () => {
  const f = film({ brief: '## Look\n' });
  assert.equal(gate(f, 'vawe_ship').allow, false);
  assert.equal(stageGate(f.dir, 'vawe_ship', { root: f.root, env: { VAWE_UNATTENDED: '1' } }).allow, true);
});

test('an unknown tool is refused', () => {
  const f = film({ brief: '## Look\n' });
  assert.equal(gate(f, 'vawe_nothing').allow, false);
});
