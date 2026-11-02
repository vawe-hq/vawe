import test from 'node:test';
import assert from 'node:assert/strict';
import { draftSheetPath } from '../../harness/media/draft-sheet.mjs';

test('the default draft keeps its <name>.png sheet', () => {
  assert.equal(draftSheetPath('out/film-draft.mp4'), 'out/film-draft.png');
  assert.equal(draftSheetPath('out/film-draft-2-4.mp4'), 'out/film-draft-2-4.png');
});

test('a draft written to a named --out never takes the author png beside it', () => {
  assert.equal(draftSheetPath('x.mp4'), 'x-sheet.png');
  assert.equal(draftSheetPath('/tmp/a/b.mp4'), '/tmp/a/b-sheet.png');
});
