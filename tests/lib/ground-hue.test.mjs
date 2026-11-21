import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { hueArc, hueFamily, refTurns, groundHueLines } from '../../harness/lib/ground-hue.mjs';
import { refGround } from '../../harness/lib/refs.mjs';

const shot = (i, t0, hue, L, chroma = 20) => ({ shot: i, t0, start: [L, 0, 0], end: [L, 0, 0], L, chroma, hue });
const blueRamp = [shot(1, 0, 220, 20), shot(2, 2.5, 228, 35), shot(3, 5, 215, 50), shot(4, 7.5, 232, 62)];

test('hueArc finds the smallest arc, also across 0 degrees', () => {
  assert.deepEqual(hueArc([220, 230, 215]), [215, 230]);
  assert.deepEqual(hueArc([350, 10, 5]), [350, 370]);
  assert.deepEqual(hueArc([40]), [40, 40]);
});

test('hueFamily names one tinted hue family of three or more worlds and gives its light range', () => {
  assert.deepEqual(hueFamily(blueRamp, 10), { shots: 4, from: 0, to: 10, hue: [215, 232], light: [20, 62] });
});

test('hueFamily is null when the ground turns, has a neutral world, or has too few worlds', () => {
  assert.equal(hueFamily([...blueRamp, shot(5, 10, 20, 40)], 12), null, 'a warm world turns the ground');
  assert.equal(hueFamily([...blueRamp, shot(5, 10, 220, 5, 2)], 12), null, 'a neutral world breaks the family');
  assert.equal(hueFamily(blueRamp.slice(0, 2), 5), null);
  assert.equal(hueFamily([{ shot: 1, t0: 0, start: null }, ...blueRamp.slice(0, 2)], 5), null, 'a skipped short shot does not count');
});

const refGroundBlock = {
  changeDE: 6,
  perShot: [shot(1, 0, 20, 30), shot(2, 2.1, 210, 60), shot(3, 4, 212, 62), shot(4, 6.4, 90, 40)],
  cuts: [{ at: 2.1, dE: 40 }, { at: 4, dE: 2 }, { at: 6.4, dE: 25 }],
};

test('refTurns lists the reference cuts that change the ground, with the hue before and after', () => {
  assert.deepEqual(refTurns(refGroundBlock), ['2.1 s (hue 20 to 210, L 30 to 60)', '6.4 s (hue 212 to 90, L 62 to 40)']);
  assert.deepEqual(refTurns(null), []);
});

test('the advice line gives the seconds and points at the reference turns, or asks for a reference', () => {
  const withRef = groundHueLines(blueRamp, 10, { id: 'abc123', ground: refGroundBlock });
  assert.equal(withRef.length, 1);
  assert.match(withRef[0], /^ground-hue: the ground of 4 worlds stays in one hue family \(hue 215 to 232 degrees, L 20 to 62\), from 0 s to 10\.0 s/);
  assert.match(withRef[0], /reference abc123 turns its ground at 2\.1 s \(hue 20 to 210/);
  assert.deepEqual(groundHueLines(blueRamp, 10), [], 'one hue family is the default: no advice without a named reference');
  assert.deepEqual(groundHueLines([...blueRamp, shot(5, 10, 20, 40)], 12), []);
  assert.doesNotMatch(withRef[0], /—/);
});

test('refGround reads the ground block of a reference spec, and null before the spec ran', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vawe-refs-'));
  try {
    assert.equal(refGround(dir, 'abc123'), null);
    fs.mkdirSync(path.join(dir, 'spec', 'abc123'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'spec', 'abc123', 'spec.json'), JSON.stringify({ ground: refGroundBlock }));
    assert.deepEqual(refGround(dir, 'abc123'), refGroundBlock);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
