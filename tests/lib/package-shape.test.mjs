import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ENGINE } from '../../harness/lib/workspace.mjs';

const pkg = JSON.parse(fs.readFileSync(path.join(ENGINE, 'package.json'), 'utf8'));

test('the package can be published: not private, node 22, a bin that exists', () => {
  assert.notEqual(pkg.private, true);
  assert.equal(pkg.engines.node, '>=22');
  assert.ok(fs.existsSync(path.join(ENGINE, pkg.bin.vawe)));
});

test('an install fetches no Chrome: the renderer ships as puppeteer-core, full puppeteer stays dev only', () => {
  assert.ok(pkg.dependencies['puppeteer-core']);
  assert.ok(pkg.dependencies['@puppeteer/browsers']);
  assert.equal(pkg.dependencies.puppeteer, undefined);
});

test('the pinned Chrome resolves to the build in .puppeteerrc.cjs', async () => {
  const { pinnedChrome } = await import('../../harness/lib/render-harness.mjs');
  const pin = (await import('../../.puppeteerrc.cjs')).default;
  const { buildId, executablePath } = pinnedChrome({});
  assert.equal(buildId, pin.chrome.version);
  assert.ok(executablePath.includes(buildId));
});

test('the files list ships the engine and keeps font binaries and captured brand assets out', () => {
  for (const dir of ['bin/vawe', 'core', 'harness', 'prompts', 'taste', 'skills', 'guides', '.puppeteerrc.cjs']) assert.ok(pkg.files.includes(dir), `${dir} missing from files`);
  assert.ok(pkg.files.includes('!assets/fonts/**/*.woff2'));
  assert.ok(!pkg.files.some((f) => f === 'assets' || f.startsWith('assets/brands')));
  for (const entry of pkg.files.filter((f) => !f.startsWith('!') && !f.includes('*'))) assert.ok(fs.existsSync(path.join(ENGINE, entry)), `${entry} is in files but not in the repo`);
});
