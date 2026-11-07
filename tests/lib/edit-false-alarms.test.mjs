import test from 'node:test';
import assert from 'node:assert/strict';
import { worldSpans, heldWorlds } from '../../harness/lib/worlds.mjs';
import { firedFor } from '../../harness/lib/plan-parts.mjs';

const world = (clips) => ({ id: 's3', visible: true, ground: '#111111', texts: [], shape: ['video.|||x'], clips });
const samples = (clips, seconds = 4) => Array.from({ length: seconds * 10 + 1 }, (_, i) => ({ t: i / 10, worlds: [world(clips)] }));
const held = (clips) => heldWorlds(worldSpans(samples(clips), { step: 0, dur: 4 }));

test('a world that plays a video clip is not held still', () => {
  assert.equal(held([{ rate: 1, range: 4 }]).length, 0);
  assert.equal(held([{ rate: 0.5, range: 3 }]).length, 0);
  assert.equal(held([{ rate: 1, range: null }]).length, 0, 'an unknown range counts as playing');
});

test('a world with no clip, or a clip at a single frame, is still held', () => {
  assert.equal(held([]).length, 1);
  assert.equal(held([{ rate: 1, range: 0.01 }]).length, 1, 'trim range shorter than a frame');
  assert.equal(held([{ rate: 0.001, range: 5 }]).length, 1, 'rate so small no frame changes');
});

test('an edit film drops the spectacle rule from the fired rules and keeps the others', () => {
  const fired = [{ id: 'spectacle-weak', t: 7.5 }, { id: 'readable-text-size', t: 2.2 }];
  const edit = 'Template: prompts/edit-from-clips.md. Shape.\n';
  assert.deepEqual(firedFor(edit, fired).map((f) => f.id), ['readable-text-size']);
  assert.deepEqual(firedFor('Template: prompts/story-explainer.md.\n', fired).map((f) => f.id), ['spectacle-weak', 'readable-text-size']);
});
