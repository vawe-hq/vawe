import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { INDEX_PATH, indexText } from '../../harness/dev/api-index.mjs';

test('skills/vawe-page/API.md matches the code: run node harness/dev/api-index.mjs --write', () => {
  assert.equal(fs.readFileSync(INDEX_PATH, 'utf8'), indexText());
});
