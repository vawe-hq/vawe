// node --test tests/mcp/fix-first.test.mjs
// fix_first reads fixture acceptance.json and checks.json files: no render.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fixFirst, fixRound, draftsDone, countDraft, FIX_NEXT } from '../../harness/mcp/fix-first.mjs';

const WAIVE = 'waive: "allow": ["static-window@2-5"], "_why": {"static-window@2-5": "<where>"} in <script id="authoring">';
const ITEMS = [
  { kind: 'spectacle', at: 7.2, measured: "the Board's Spectacle is at 7.2 s, the page's spectacle meta says 5.0 s", fix: "Put the big move at 7.2 s, or change the Board's Spectacle line with the reason" },
  { kind: 'contrast', at: 1, measured: '"Zero fees" at 1.0 s reads 1.5:1 (needs 4.5:1)', fix: 'use #111111, or change the ground behind it, or waive "text-low-contrast@1.00" with a _why' },
  { kind: 'contrast', at: 2, measured: '"Pay less" at 2.0 s reads 2.1:1 (needs 4.5:1)', fix: 'use #111111, or change the ground behind it' },
  { kind: 'cap-height', at: 6, measured: '"tagline" at 6.0 s has cap height 2.4% of frame (needs 6%)', fix: 'raise the font size until the cap height reaches 6%' },
];
const VIDEO_ITEMS = [
  { kind: 'static-window', at: 2, measured: 'static window 2-5 s (3 s, limit 1.2 s)', fix: `give the hold an element motion (typing, a counter, a glint), not a camera drift; ${WAIVE}` },
  { kind: 'world-held', at: 0, measured: 'world hello held 0-6 s (6 s, limit 4 s)', fix: `cut the world where the content changes, or ${WAIVE}` },
];

function fixture(over = {}) {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'fix-first-'));
  if (over.rows) fs.writeFileSync(path.join(out, 'f.acceptance.json'), JSON.stringify({ history: [{ stage: 'draft', rows: over.rows }] }));
  const checks = over.checks ?? { 'fix-first': { key: 'derived', value: over.items ?? ITEMS }, video: { key: 'k', value: { problems: [], items: over.video ?? VIDEO_ITEMS, measures: {} } } };
  fs.writeFileSync(path.join(out, 'f.checks.json'), JSON.stringify(checks));
  return out;
}

test('ranks unreadable text first, then static windows and world held, then the spectacle mismatch', () => {
  const items = fixFirst(fixture(), 'f', 10);
  assert.deepEqual(items.map((i) => i.kind), ['contrast', 'cap-height', 'static-window', 'world-held', 'spectacle']);
});

test('the top three: contrast, cap height, then the static window', () => {
  const items = fixFirst(fixture(), 'f');
  assert.equal(items.length, 3);
  assert.deepEqual(items.map((i) => i.kind), ['contrast', 'cap-height', 'static-window']);
});

test('each item carries the measured value and the fix the check gives', () => {
  const [contrast, cap, still] = fixFirst(fixture(), 'f');
  assert.equal(contrast.measured, '"Zero fees" at 1.0 s reads 1.5:1 (needs 4.5:1)');
  assert.match(contrast.fix, /^use #111111, or change the ground/);
  assert.equal(contrast.more, 1);
  assert.equal(cap.measured, '"tagline" at 6.0 s has cap height 2.4% of frame (needs 6%)');
  assert.match(cap.fix, /raise the font size until the cap height reaches 6%/);
  assert.equal(still.measured, 'static window 2-5 s (3 s, limit 1.2 s)');
  assert.match(still.fix, /^give the hold an element motion.*waive: /);
});

test('the spectacle mismatch and the held world read from their items', () => {
  const items = fixFirst(fixture(), 'f', 10);
  const world = items.find((i) => i.kind === 'world-held');
  assert.equal(world.measured, 'world hello held 0-6 s (6 s, limit 4 s)');
  assert.match(world.fix, /^cut the world where the content changes, or waive: /);
  const spectacle = items.find((i) => i.kind === 'spectacle');
  assert.equal(spectacle.measured, "the Board's Spectacle is at 7.2 s, the page's spectacle meta says 5.0 s");
  assert.match(spectacle.fix, /^Put the big move at 7\.2 s/);
});

test('a red acceptance row fills in when no item covers it, and loses to the item when one does', () => {
  const rows = [
    { metric: 'text contrast', target: '4.5:1 or more', status: 'advice', measured: '1.5:1', detail: ['"Zero fees" at 1.00 s: 1.5:1'] },
    { metric: 'jerky steps', target: 'under 5', status: 'advice', measured: '9', detail: ['0.50 s: speed changes 3.0x in one frame', 'ease the start and the stop of the move instead of a sudden speed change'] },
    { metric: 'peak', target: '-10 dBFS or lower', status: 'ok', measured: '-12.0 dBFS', detail: [] },
  ];
  const items = fixFirst(fixture({ items: [ITEMS[1]], video: [], rows }), 'f');
  assert.deepEqual(items.map((i) => i.kind), ['contrast', 'row:jerky steps']);
  assert.match(items[0].measured, /reads 1\.5:1/);
  assert.equal(items[1].measured, 'jerky steps: 9 (target under 5)');
  assert.equal(items[1].fix, 'ease the start and the stop of the move instead of a sudden speed change');
});

test('a row alone gives the measured value of its kind', () => {
  const rows = [{ metric: 'still windows over 0.5 s outside a declared hold', target: '0', status: 'advice', measured: '2', detail: ['3-5 s held still', 'give the hold an element motion'] }];
  const [item] = fixFirst(fixture({ items: [], video: [], rows }), 'f');
  assert.equal(item.kind, 'static-window');
  assert.equal(item.measured, 'still windows over 0.5 s outside a declared hold: 2 (target 0)');
});

test('a short read hold ranks with unreadable text, ahead of a still window, and names its lines with the fix', () => {
  const rows = [{ metric: 'read hold per line', target: '0 short', status: 'advice', measured: '1 line(s) short', detail: ['"Roasted slow, poured warm." holds 1.40 s, needs 2.40 s'] }];
  const items = fixFirst(fixture({ items: [], rows }), 'f');
  assert.deepEqual(items.map((i) => i.kind), ['read-hold', 'static-window', 'world-held']);
  assert.match(items[0].fix, /^"Roasted slow, poured warm\." holds 1\.40 s, needs 2\.40 s; keep each line it names on screen/);
});

test('the static window and held world of a video read count as items', () => {
  const items = fixFirst(fixture({ items: [] }), 'f');
  assert.deepEqual(items.map((i) => i.kind), ['static-window', 'world-held']);
});

test('a clean draft, and a folder with no files, give nothing', () => {
  assert.deepEqual(fixFirst(fixture({ items: [], video: [] }), 'f'), []);
  assert.deepEqual(fixFirst(path.join(os.tmpdir(), 'no-such-out-folder'), 'f'), []);
});

test('a checks.json with no items gives nothing', () => {
  assert.deepEqual(fixFirst(fixture({ checks: { motion: { key: 'k', value: {} } } }), 'f'), []);
});

test('the round count lives in the film out folder, per film', () => {
  const out = fixture();
  assert.equal(draftsDone(out, 'f'), 0);
  assert.equal(countDraft(out, 'f'), 1);
  assert.equal(countDraft(out, 'f'), 2);
  assert.equal(draftsDone(out, 'f'), 2);
  assert.equal(draftsDone(out, 'other'), 0);
  assert.match(FIX_NEXT, /vawe_edit_page or vawe_edit_doc.*vawe_render_draft.*from and to.*motion pass/);
});

test('fixRound lists problems for the first draft only; the re-render after the fix round gets none' , () => {
  const out = fixture();
  assert.equal(fixRound(out, 'f').length, 3);
  assert.deepEqual(fixRound(out, 'f'), []);
  assert.deepEqual(fixRound(out, 'f'), []);
  assert.equal(fixRound(fixture(), 'f').length, 3);
});

test('the spec row names every miss with its CSS, not the closing generic line', () => {
  const detail = ['"LUNCH." cap height at 4.4 s: spec 30.0%, film 25.2%: set its font-size from calc(var(--vh) * 0.360) to calc(var(--vh) * 0.429)', 'set the font size and box to the Words table, or change the table'];
  const rows = [{ metric: 'word cap height and position vs spec', target: 'within 1% of frame', status: 'advice', measured: '4.8%', detail }];
  const [item] = fixFirst(fixture({ rows, items: [], video: [] }), 'f');
  assert.equal(item.fix, detail[0]);
});
