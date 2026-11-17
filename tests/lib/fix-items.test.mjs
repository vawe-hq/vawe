// node --test tests/lib/fix-items.test.mjs
// The { kind, at, measured, fix } items a draft writes to out/<film>.checks.json say the same as the advice lines.
import test from 'node:test';
import assert from 'node:assert/strict';
import { textProblems, textItems } from '../../harness/lib/draft-check.mjs';
import { draftContrastLines, draftLowContrast, contrastItems } from '../../harness/lib/text-contrast.mjs';
import { stillText, stillItem } from '../../harness/lib/still-limit.mjs';
import { boardChecks, boardFindings } from '../../harness/lib/board.mjs';

test('textItems: the text textProblems names, as a cap-height item', () => {
  const samples = [3.25, 3.75].map((t) => ({ t, lines: [{ text: 'Light, after dark', fontPx: 30 }] }));
  const dim = { step: 0.5, frameH: 540 };
  assert.equal(textProblems(samples, dim).length, 1);
  assert.deepEqual(textItems(samples, dim), [{ kind: 'cap-height', at: 3.25, measured: '"Light, after dark" at 3.3 s has cap height 3.9% of frame (needs 6%)', fix: 'raise the font size until the cap height reaches 6%' }]);
});

test('contrastItems: the fix is the end of the contrast line', () => {
  const W = 40, H = 40;
  const fill = (c, glyph = null) => {
    const data = Buffer.alloc(W * H * 3);
    for (let i = 0; i < W * H; i++) data.set(glyph && (i % W) < W / 4 && i < (W * H) / 4 ? glyph : c, i * 3);
    return data;
  };
  const shots = { shown: fill([255, 154, 38], [179, 36, 10]), raw: fill([255, 154, 38]), scale: 1, width: W, height: H };
  const samples = [4, 4.5].map((t) => ({ t, lines: [{ text: 'through', fontPx: 30, box: [0, 0, W, H], color: 'rgb(179, 36, 10)', opacity: 1 }], shots }));
  const [item] = contrastItems(draftLowContrast(samples));
  assert.equal(item.kind, 'contrast');
  assert.equal(item.measured, '"through" at 4.0 s reads 3.1:1 (needs 4.5:1)');
  assert.ok(draftContrastLines(samples)[0].endsWith(`: ${item.fix}`));
});

test('stillItem words the same run as stillText', () => {
  const r = { a: 2, b: 5, len: 3 };
  const item = stillItem(r, 1.2);
  assert.equal(stillText(r, 1.2), `${item.measured}: nothing moves; ${item.fix}`);
  assert.equal(item.at, 2);
});

const BOARD = `## Board

| beat | in s | hold s | cut out s (length) |
|---|---|---|---|
| s1 | 0 | 1.5 | 0.6 |
| s2 | 1 | 1.5 | 0.6 |
| s3 | 2 | 1.5 | 0.6 |

Spectacle: the one big moment at 7.2 (also \`<meta name="spectacle">\`).

| cut | move (prompts/moves) | what carries the eye | what leaves first | overlap s |
|---|---|---|---|---|
| s1 to s2 | whip | logo | card | 0.2 |
| s2 to s3 | push | logo | card | 0.2 |
| s3 to s4 | overlap | logo | card | 0.2 |

Sound is part of every film.

| at s | sound | gain |
|---|---|---|
| 1 | tick | -12 |
`;

test('boardFindings: a spectacle mismatch carries its numbers, every other line is a plan item, boardChecks is the same lines', () => {
  const found = boardFindings(BOARD, 5);
  const spectacle = found.find((f) => f.item.kind === 'spectacle');
  assert.equal(spectacle.item.measured, "the Board's Spectacle is at 7.2 s, the page's spectacle meta says 5 s");
  assert.match(spectacle.item.fix, /^Put the big move at 7\.2 s/);
  assert.ok(found.some((f) => f.item.kind === 'plan' && /all 3 cuts/.test(f.item.measured)));
  assert.deepEqual(boardChecks(BOARD, 5), found.map((f) => `board: ${f.text}`));
});
