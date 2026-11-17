import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { cases } from './next-text-cases.mjs';

const FIXTURE = fileURLToPath(new URL('./fixtures/next-text.json', import.meta.url));

test('every next-step text is the same bytes as before next steps became data', () => {
  const got = cases();
  if (process.env.UPDATE_NEXT_TEXT === '1') fs.writeFileSync(FIXTURE, `${JSON.stringify(got, null, 2)}\n`);
  const want = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
  assert.deepEqual(Object.keys(got), Object.keys(want));
  for (const k of Object.keys(want)) assert.equal(got[k], want[k], k);
});
