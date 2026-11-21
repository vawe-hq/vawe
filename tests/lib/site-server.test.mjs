import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { reachable, siteDir, withSite } from '../../harness/lib/site-server.mjs';

const BASE = 'http://localhost:3187';
const tree = () => execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: siteDir() ?? process.cwd(), encoding: 'utf8' });

test('withSite starts the site server without rewriting a tracked file, and stops it', { timeout: 170000, skip: process.env.VAWE_CI || !siteDir() ? 'needs a vawe-site checkout with its dependencies installed' : false }, async () => {
  assert.equal(await reachable(BASE), false, 'port 3187 is in use: free it to run this test');
  const before = tree();
  await withSite(BASE, async () => {
    assert.equal(await reachable(BASE), true);
    await fetch(`${BASE}/`);
  });
  assert.equal(tree(), before);
  assert.equal(await reachable(BASE), false);
});
