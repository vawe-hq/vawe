import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { planFindings, planLines, ruleDoc } from '../../harness/lib/plan-findings.mjs';
import { tightStagger } from '../../harness/lib/motion-lint.mjs';
import { briefLengthLine } from '../../harness/lib/board.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

const rec = (target, delay, o = {}) => ({ target, label: `win${target}`, id: '', props: ['opacity'], delay, duration: 0.4, easing: 'linear', kfEasings: ['ease', 'ease'], opacity: [0, 1], from: '', fullFrame: false, ...o });
const stillTail = { samples: [], step: 0.5, frameH: 1080, whole: true, tail: [[], [], []] };
const IDEAS = '## Ideas\n\n| at | meaning | i1 | i2 | i3 | i4 | chosen | why |\n|---|---|---|---|---|---|---|---|\n| s1 | m | metaphor: a, 0.3 | transformation: b, 0.2 | collision: c, 0.1 | literal: d, 0.9 | 2 | because it fits |\n';
const quiet = { brief: IDEAS, duration: 8, probe: null, worlds: ['s1'] };

test('entrances 22 to 27 ms apart are one stagger-gap finding at the first start; 30 ms and wider are not', () => {
  const tight = [rec(0, 1), rec(1, 1.022), rec(2, 1.049)];
  const [f] = tightStagger(tight);
  assert.equal(f.rule, 'stagger');
  assert.equal(f.at, 1);
  assert.match(f.what, /3 elements start 22 to 27 ms apart, under the 30 ms floor/);
  assert.deepEqual(tightStagger([rec(0, 1), rec(1, 1.03), rec(2, 1.06)]), []);
  assert.deepEqual(tightStagger([rec(0, 1), rec(1, 1)]), []);
  assert.deepEqual(tightStagger([rec(0, 1), rec(1, 1.01, { step: 0.05 })]), []);
});

test('a brief length more than half a second off the page is named; a match and a missing length are not', () => {
  assert.equal(briefLengthLine('- Length: 22.8 s\n', 8.15), 'the brief says 22.8 s and the page is 8.15 s');
  assert.equal(briefLengthLine('- length: 8 s\n', 8.15), null);
  assert.equal(briefLengthLine('## Look\n', 8.15), null);
});

test('a quiet page with a good brief has no finding', () => {
  assert.deepEqual(planFindings(quiet), []);
});

test('a brief with no Ideas section gets the exact IDEATE ask and the brief findings come first', () => {
  const found = planFindings({ ...quiet, brief: '- Length: 22.8 s\n\n## Look\n', probe: stillTail });
  assert.deepEqual(found.map((f) => f.code), ['brief-stale', 'ideas-missing', 'tail-static']);
  assert.equal(found[1].doc, 'guides/IDEATE.md');
  assert.match(found[1].fix, /4 ideas from 4 different devices with a typicality number/);
});

test('a title held under its read time is a read-hold finding with the measured hold', () => {
  const lines = [{ text: 'RENAISSANCE', box: [0, 0, 900, 120], block: 'h1' }];
  const probe = { samples: [{ t: 0, lines: [] }, { t: 1, lines }, { t: 1.5, lines }, { t: 2, lines: [] }], step: 0.5, frameH: 1080, whole: true, tail: null };
  const [f] = planFindings({ ...quiet, probe });
  assert.equal(f.rule, 'readable-hold');
  assert.match(f.value, /"RENAISSANCE" holds 1\.0 s, its text needs 1\.2 s/);
});

test('a static last second is a moving-tail finding; a running part animation clears it', () => {
  const probe = (tail) => ({ samples: [], step: 0.5, frameH: 1080, whole: true, tail });
  assert.equal(planFindings({ ...quiet, probe: probe([[], [], []]) })[0].rule, 'moving-tail');
  const running = [{ id: 'caret', duration: 1, props: ['opacity'], fullFrame: false, decorative: false }];
  assert.deepEqual(planFindings({ ...quiet, probe: probe([running, running, running]) }), []);
  assert.deepEqual(planFindings({ ...quiet, probe: { ...probe([[], [], []]), canvasFilm: true } }), []);
});

test('a waiver with a reason silences its finding', () => {
  const authoring = { _worlds: ['s1'], allow: ['tail-static'], _why: { 'tail-static': 'world s1, the last 1.0 s: the wordmark holds still as the end card' } };
  assert.deepEqual(planFindings({ ...quiet, probe: stillTail, authoring }), []);
});

test('a line names its second, value, rule, doc line and fix; the doc line is the rule file limit line', () => {
  assert.equal(ruleDoc('stagger', ROOT), 'taste/rules/stagger.md:5');
  assert.equal(ruleDoc('stagger', ROOT, 'range'), 'taste/rules/stagger.md:6');
  assert.equal(ruleDoc('no-such-rule', ROOT), 'taste/rules/no-such-rule.md');
  const [line] = planLines(planFindings({ ...quiet, probe: stillTail }), ROOT);
  assert.equal(line, `no part of the held lockup moves in the last second (rule moving-tail, ${ruleDoc('moving-tail', ROOT)}); fix: give one part of the last lockup its own last key (a caret, a value that ticks, a highlight that moves on)`);
});
