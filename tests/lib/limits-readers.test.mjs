import test from 'node:test';
import assert from 'node:assert/strict';
import { RULES } from '../../harness/lib/draft-check.mjs';
import { PEAK_DBFS, peakLine } from '../../harness/lib/peak-limit.mjs';
import { SHEET_FPS, RUN_TILES, TAIL_TILES, NEAR_IDENTICAL } from '../../harness/lib/sheet-tiles.mjs';
import { STILL_SEC } from '../../harness/lib/still-limit.mjs';
import { LIMITS } from '../../harness/lib/ship-status.mjs';
import { DRAFT_MIN_RATIO } from '../../harness/lib/text-contrast.mjs';
import { readHoldProblems } from '../../harness/lib/read-hold.mjs';
import { groupLanding, linearMove } from '../../harness/lib/motion-lint.mjs';
import { BANDS, bandOf, leaveSpecs, staggerTimes } from '../../core/motion/presets.js';

// Phase 4 moved these numbers into taste/build/limits.json. Each value below is the literal the module held before the move.

test('the draft check, the peak limit, the sheet and the ship status hold the numbers they hold now (the world limit is 7 s)', () => {
  assert.deepEqual({ ...RULES }, { capFrac: 0.06, chromeCapFrac: 0.025, uiCapFrac: 0.03, capOfFont: 0.7, holdSec: 0.5, maxProblems: 4, lufsTarget: -20, lufsLow: -24, lufsHigh: -16 });
  assert.equal(PEAK_DBFS, -3);
  assert.equal(peakLine(-2.5), 'sound: true peak -2.5 dBFS (limit -3 dBFS); lower data-gain on the loudest cue by 1 dB');
  assert.deepEqual([SHEET_FPS, RUN_TILES, TAIL_TILES, NEAR_IDENTICAL], [5, 8, 4, 4.5]);
  assert.equal(STILL_SEC, 0.5);
  assert.deepEqual({ ...LIMITS }, { staticSec: 0.5, worldSec: 7, blankSec: 0.3, blankEdgeSec: 0.5, maxProblems: 3 });
  assert.equal(DRAFT_MIN_RATIO, 4.5);
});

test('the read hold needs 0.6 s per word for four words or more, and at least 1.2 s for fewer (a line passes at 0.9 of that)', () => {
  const track = (text, tIn, tSettled, tOut) => ({ text, block: 0, sizeSettled: 0.1, tIn, tSettled, tOut });
  const words = (n, hold) => Array.from({ length: n }, (_, i) => track(`w${i}`, 0, 0.2, 0.2 + hold));
  assert.equal(readHoldProblems(words(5, 2.6)).length, 1);
  assert.equal(readHoldProblems(words(5, 2.8)).length, 0);
  assert.equal(readHoldProblems(words(1, 1.0)).length, 1);
  assert.equal(readHoldProblems(words(1, 1.1)).length, 0);
});

test('the lint reads the linear limit and the same-frame group as before', () => {
  const rec = (target, over = {}) => ({ target, label: `e${target}`, id: 'enter', props: ['translate'], delay: 0, duration: 0.5, easing: 'ease-out', kfEasings: [], opacity: [0, 1], from: '', fullFrame: false, decorative: false, ...over });
  assert.equal(groupLanding([rec(0), rec(1)]).length, 0);
  assert.equal(groupLanding([rec(0), rec(1), rec(2)]).length, 1);
  assert.equal(linearMove([rec(0, { duration: 0.3 })]).length, 0);
  assert.equal(linearMove([rec(0, { duration: 0.31 })]).length, 1);
});

test('the presets read the speed bands, the leave share and the stagger gaps as before', () => {
  assert.deepEqual(BANDS, { energy: [0.15, 0.3], professional: [0.3, 0.5], gravity: [0.5, 0.8], cinematic: [0.8, 2] });
  assert.equal(bandOf(0.4), 'professional');
  assert.equal(leaveSpecs({ at: 0, entrance: 1 })[0].timing.duration, 600);
  const gaps = staggerTimes(5, {}).map((t, i, all) => (i ? t - all[i - 1] : 0)).slice(1);
  assert.ok(gaps.every((g) => g > 0.03 * 0.7 && g < 0.08 * 1.3));
});
