// node --test tests/mcp/fix-first.test.mjs
// fix_first reads fixture dev.md, acceptance.json and checks.json files: no render.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fixFirst, fixRound, draftsDone, countDraft, FIX_NEXT } from '../../harness/mcp/fix-first.mjs';

const WAIVE = 'waive: "allow": ["static-window@2-5"], "_why": {"static-window@2-5": "<where>"} in <script id="authoring">';
const ADVICE = [
  'advice: board: the Spectacle is at 7.2 s but <meta name="spectacle"> says 5.0 s; the spectacle checks read 7.2 s, the Board\'s. Put the big move at 7.2 s, or change the Board\'s Spectacle line with the reason',
  `advice: static window 2-5 s (3 s, limit 1.2 s): nothing moves; give the hold an element motion (typing, a counter, a glint), not a camera drift; ${WAIVE}`,
  'advice: text "Zero fees" at 1.0 s reads 1.5:1 on the pixels behind it (#777777 on #888888, needs 4.5:1): use #111111, or change the ground behind it, or waive "text-low-contrast@1.00" with a _why',
  'advice: text "Pay less" at 2.0 s reads 2.1:1 on the pixels behind it (#777777 on #999999, needs 4.5:1): use #111111, or change the ground behind it',
  'advice: text "tagline" at 6.0 s: cap height 2.4% of frame (rule readable-text-size asks 6%)',
  `advice: world held hello 0-6 s (6 s, limit 4 s); ${WAIVE.replace('static-window@2-5', 'world-held@0-6')}`,
  'advice: sound: -30 LUFS integrated (subtle target about -20; raise the one cue that carries the moment)',
];

function fixture(over = {}) {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'fix-first-'));
  const dev = over.dev ?? `# f draft\n\n## Draft check\n\ndraft check:\n${ADVICE.join('\n')}\n(advice only: the render continued)\n\n## Signature\n\nx\n`;
  fs.writeFileSync(path.join(out, 'f.dev.md'), dev);
  if (over.rows) fs.writeFileSync(path.join(out, 'f.acceptance.json'), JSON.stringify({ history: [{ stage: 'draft', rows: over.rows }] }));
  if (over.checks) fs.writeFileSync(path.join(out, 'f.checks.json'), JSON.stringify(over.checks));
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

test('each item carries the measured value and the fix the advice gives', () => {
  const [contrast, cap, still] = fixFirst(fixture(), 'f');
  assert.equal(contrast.measured, '"Zero fees" at 1.0 s reads 1.5:1 (needs 4.5:1)');
  assert.match(contrast.fix, /^use #111111, or change the ground/);
  assert.equal(contrast.more, 1);
  assert.equal(cap.measured, '"tagline" at 6.0 s has cap height 2.4% of frame (needs 6%)');
  assert.match(cap.fix, /raise the font size until the cap height reaches 6%/);
  assert.equal(still.measured, 'static window 2-5 s (3 s, limit 1.2 s)');
  assert.match(still.fix, /^give the hold an element motion.*waive: /);
});

test('the spectacle mismatch and the held world read from their lines', () => {
  const items = fixFirst(fixture(), 'f', 10);
  const world = items.find((i) => i.kind === 'world-held');
  assert.equal(world.measured, 'world hello held 0-6 s (6 s, limit 4 s)');
  assert.match(world.fix, /^cut the world where the content changes, or waive: /);
  const spectacle = items.find((i) => i.kind === 'spectacle');
  assert.equal(spectacle.measured, "the Board's Spectacle is at 7.2 s, the page's spectacle meta says 5.0 s");
  assert.match(spectacle.fix, /^Put the big move at 7\.2 s/);
});

test('a red acceptance row fills in when no advice line covers it, and loses to the advice line when one does', () => {
  const rows = [
    { metric: 'text contrast', target: '4.5:1 or more', status: 'advice', measured: '1.5:1', detail: ['"Zero fees" at 1.00 s: 1.5:1'] },
    { metric: 'jerky steps', target: 'under 5', status: 'advice', measured: '9', detail: ['0.50 s: speed changes 3.0x in one frame', 'ease the start and the stop of the move instead of a sudden speed change'] },
    { metric: 'peak', target: '-10 dBFS or lower', status: 'ok', measured: '-12.0 dBFS', detail: [] },
  ];
  const dev = '# f draft\n\n## Draft check\n\nadvice: text "Zero fees" at 1.0 s reads 1.5:1 on the pixels behind it (#777777 on #888888, needs 4.5:1): use #111111\n';
  const items = fixFirst(fixture({ dev, rows }), 'f');
  assert.deepEqual(items.map((i) => i.kind), ['contrast', 'row:jerky steps']);
  assert.match(items[0].measured, /reads 1\.5:1/);
  assert.equal(items[1].measured, 'jerky steps: 9 (target under 5)');
  assert.equal(items[1].fix, 'ease the start and the stop of the move instead of a sudden speed change');
});

test('a row alone gives the measured value of its kind', () => {
  const rows = [{ metric: 'still windows over 0.5 s outside a declared hold', target: '0', status: 'advice', measured: '2', detail: ['3-5 s held still', 'give the hold an element motion'] }];
  const [item] = fixFirst(fixture({ dev: '# f draft\n\n## Draft check\n\ndraft check: no problems found\n', rows }), 'f');
  assert.equal(item.kind, 'static-window');
  assert.equal(item.measured, 'still windows over 0.5 s outside a declared hold: 2 (target 0)');
});

test('video problems in checks.json count as advice lines', () => {
  const problem = 'static window 1-4 s (3 s, limit 1.2 s): nothing moves; give the hold an element motion; waive: x';
  const items = fixFirst(fixture({ dev: '## Draft check\n\ndraft check: no problems found\n', checks: { video: { key: 'k', value: { problems: [problem], measures: {} } } } }), 'f');
  assert.equal(items[0].kind, 'static-window');
});

test('a clean draft, and a folder with no files, give nothing', () => {
  assert.deepEqual(fixFirst(fixture({ dev: '## Draft check\n\ndraft check: no problems found\n' }), 'f'), []);
  assert.deepEqual(fixFirst(path.join(os.tmpdir(), 'no-such-out-folder'), 'f'), []);
});

test('note lines are not problems', () => {
  const dev = '## Draft check\n\nadvice: waive: static-window@1-2 held by the page\nadvice: motion lint read element boxes\n';
  assert.deepEqual(fixFirst(fixture({ dev }), 'f'), []);
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
