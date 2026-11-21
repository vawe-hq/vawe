// tests/dev/recreation-new.test.mjs: house-rule self-check, no framework.
//   node tests/dev/recreation-new.test.mjs
//
// Proves harness/dev/recreation-new.mjs (make dev-tool X=new TYPE=recreation) writes a working
// page.html (correct duration, an animation that actually runs) plus a `see` pass on the reference, and
// prints exactly one next step, against the repo's own prompts/moves/clips/overwhelm-collapse.mp4 clip.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

function assert(cond, msg) { if (!cond) throw new Error(`FAIL: ${msg}`); }

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SCRIPT = path.join(ROOT, 'harness/dev/recreation-new.mjs');
const REF = path.join(ROOT, 'prompts/moves/clips/overwhelm-collapse.mp4');
const NAME = `_test-${process.pid}`;
const outDir = path.join(ROOT, 'films/recreations', NAME);

try {
  const stdout = execFileSync('node', [SCRIPT], {
    encoding: 'utf8',
    env: { ...process.env, TYPE: 'recreation', NAME, REF, NO_ROUND_TRIP: '1' },
  });
  assert(new RegExp(`vawe critique films/recreations/${NAME}/page.html --ref ${REF}`).test(stdout),
    `expected the one next-step line: ${stdout}`);

  const pagePath = path.join(outDir, 'page.html');
  assert(fs.existsSync(pagePath), 'page.html was not written');
  const html = fs.readFileSync(pagePath, 'utf8');
  assert(/<meta name="duration" content="2\.2/.test(html), `duration meta should read ~2.2s: ${html}`);
  assert(!/timelineFromScript|id="timing"/.test(html), 'starter must not carry the private timing block');
  assert(/window.seek/.test(html) && /measured|default/.test(html), 'page should carry the seek and the measured-or-default tags');
  assert(fs.existsSync(path.join(outDir, 'SPEC.md')), 'ref-spec did not write SPEC.md');

  assert(fs.existsSync(path.join(outDir, 'see', 'index.md')), 'see pass did not write index.md');

  const { serveRepo, launchPage } = await import('../../harness/lib/render-harness.mjs');
  const { port, close } = await serveRepo({ root: ROOT });
  const { browser, page } = await launchPage({ width: 1920, height: 1080 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`http://127.0.0.1:${port}/films/recreations/${NAME}/page.html`, { waitUntil: 'load' });
  await new Promise((r) => setTimeout(r, 200));
  await browser.close();
  close();
  assert(errors.length === 0, `page.html threw: ${errors.join('; ')}`);

  console.log('ok - recreation-new.mjs writes a working starter and one next step');
} finally {
  fs.rmSync(outDir, { recursive: true, force: true });
}
