import test from 'node:test';
import assert from 'node:assert/strict';
import { writesSidecars } from '../../harness/lib/out-target.mjs';

test('a draft in out/ gets its sheet and meta, whatever the name', () => {
  for (const out of ['out/film-draft.mp4', './out/film-draft.mp4', 'out/other.mp4', '/repo/out/x.mp4']) assert.equal(writesSidecars(out, '/repo'), true, out);
});

test('a draft anywhere else gets the mp4 alone', () => {
  for (const out of ['templates/title-sting/preview.mp4', 'preview.mp4', 'out/deep/preview.mp4', '/tmp/out/preview.mp4', 'films/x/out/a.mp4', '../out/a.mp4']) assert.equal(writesSidecars(out, '/repo'), false, out);
});
