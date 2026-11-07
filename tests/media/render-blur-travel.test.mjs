// A fast move needs enough subframes that neighbours sit a few px apart, or it renders as ghost copies.
import test from 'node:test';
import assert from 'node:assert/strict';
import { subframesForTravel, SHUTTER, subframeRulesKey, prepassCacheFile } from '../../harness/media/render-page.mjs';

test('the cached subframe counts are keyed by the rules that made them, so a change to a band is not served old counts', () => {
  const rules = subframeRulesKey();
  assert.equal(subframeRulesKey(), rules);
  assert.ok(prepassCacheFile('abc').endsWith(`abc-${rules}.json`));
  const bucket = (s, top) => (s < 0.15 ? 1 : top);
  assert.notEqual(subframeRulesKey([(s) => bucket(s, 16)]), subframeRulesKey([(s) => bucket(s, 8)]));
  assert.notEqual(subframeRulesKey(['{"PIXEL_BANDS":[0.15,1.5]}']), subframeRulesKey(['{"PIXEL_BANDS":[0.15,2]}']));
});

test('a still or slow frame keeps one subframe', () => {
  assert.equal(subframesForTravel(0, 16), 1);
  assert.equal(subframesForTravel(5, 16), 1);
});

test('subframes grow in powers of two with travel', () => {
  assert.equal(subframesForTravel(12, 16), 2);
  assert.equal(subframesForTravel(40, 16), 8);
});

test('the step between subframes stays small until the cap', () => {
  for (const px of [10, 30, 90]) assert.ok((px * SHUTTER) / subframesForTravel(px, 16) <= 3);
  assert.equal(subframesForTravel(400, 16), 16);
  assert.equal(subframesForTravel(400, 3), 3);
});

test('an edge at 181 px a frame gets 32 subframes when the cap allows it', () => {
  assert.equal(subframesForTravel(181, 16), 16);
  assert.equal(subframesForTravel(181, 32), 32);
  assert.ok((181 * SHUTTER) / 32 <= 3);
});
