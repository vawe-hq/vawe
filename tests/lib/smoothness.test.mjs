import test from 'node:test';
import assert from 'node:assert/strict';
import { smoothness, hardJumps } from '../../harness/lib/smoothness.mjs';

const steady = (n, v) => Array(n).fill(v);

test('a run of 3 or more still frames between moves is frozen; 2 is not', () => {
  const long = smoothness([...steady(5, 3), 0, 0, 0, 0, ...steady(5, 3)]);
  assert.deepEqual(long.frozen, [{ t: 5 / 30, frames: 4 }]);
  assert.deepEqual(smoothness([...steady(5, 3), 0, 0, ...steady(5, 3)]).frozen, []);
});

test('a hold at the start or end is not a freeze', () => {
  assert.deepEqual(smoothness([0, 0, 0, 0, ...steady(5, 3), 0, 0, 0, 0]).frozen, []);
});

test('jerky steps: moving frames whose differences jump by over 2.2x', () => {
  const r = smoothness([2, 2.1, 2, 6, 6.1, 6, 2.5]);
  assert.deepEqual(r.jerky.map((j) => +(j.t * 30).toFixed(0)), [4, 7]);
  assert.equal(smoothness([2, 3, 4, 5, 4, 3]).jerky.length, 0);
});

test('a still frame or a jump is not a jerky step', () => {
  assert.equal(smoothness([0.5, 3, 0.5]).jerky.length, 0);
  assert.equal(smoothness([3, 40, 3]).jerky.length, 0);
});

test('a jump at a declared cut, within one frame, is a cut; elsewhere it is a jump', () => {
  const diffs = [...steady(9, 2), 60, ...steady(9, 2), 60, ...steady(4, 2)];
  assert.deepEqual(smoothness(diffs, { cuts: [10 / 30] }).jumps.map((j) => +(j.t * 30).toFixed(0)), [20]);
  assert.equal(smoothness(diffs, { cuts: [11 / 30, 21 / 30] }).jumps.length, 0);
  assert.equal(smoothness(diffs, { cuts: [13 / 30] }).jumps.length, 2);
});

test('a jump at a detected hard cut is excused within the sampling tolerance', () => {
  const diffs = [...steady(9, 2), 60, ...steady(9, 2)];
  assert.equal(smoothness(diffs, { turns: [0.4] }).jumps.length, 0);
  assert.equal(smoothness(diffs, { turns: [0.8] }).jumps.length, 1);
});

test('hardJumps lists the seconds over the jump size', () => {
  assert.deepEqual(hardJumps([1, 30, 1, 26]), [2 / 30, 4 / 30]);
});

test('the first frames of a fast move from rest are not a jerky step; a spike inside a moving run is', () => {
  assert.equal(smoothness([0.2, 0.2, 1.5, 6, 6, 6, 0.4]).jerky.length, 0);
  assert.equal(smoothness([0.2, 1.5, 6, 6, 6]).jerky.length, 0);
  assert.equal(smoothness([3, 3.2, 3.1, 9, 9]).jerky.length, 1);
});

test('a hard cut between worlds is not a speed change inside a move; a spike elsewhere still is', () => {
  const diffs = [2, 2, 2, 2, 2, 8, 1.2, 1.2, 1.2, 1.2, 1.2, 1.2, 1.2, 5, 5];
  assert.deepEqual(smoothness(diffs).jerky.map((j) => +(j.t * 30).toFixed(0)), [6, 7, 14]);
  assert.deepEqual(smoothness(diffs, { worldCuts: [6 / 30] }).jerky.map((j) => +(j.t * 30).toFixed(0)), [14]);
  assert.deepEqual(smoothness(diffs, { worldCuts: [5 / 30] }).jerky.map((j) => +(j.t * 30).toFixed(0)), [14]);
  assert.equal(smoothness(diffs, { worldCuts: [10 / 30] }).jerky.length, 3);
});

test('a jump inside a declared wipe span is a cut; just past it is a jump', () => {
  const diffs = [...steady(9, 2), 60, ...steady(9, 2)];
  assert.equal(smoothness(diffs, { cutSpans: [[0.2, 0.5]] }).jumps.length, 0);
  assert.equal(smoothness(diffs, { cutSpans: [[0.0, 0.2]] }).jumps.length, 1);
});
