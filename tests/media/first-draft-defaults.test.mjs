// The first-draft defaults, proved on a page that uses them: a 6.5 s world on a dark ground lit by a key hue, with a slow camera push.
// None of these may draw advice: constant-camera (a slow camera is motion), living-ground (a lit vignette on near-black is a living ground), world-held (the limit is 7 s),
// overshoot-share (no spring at all is fine). Needs Chrome.
//   node --test tests/media/first-draft-defaults.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { openPage, resolveFrame, settle, readPageMeta, probePage, pageAdvice } from '../../harness/media/render-page.mjs';
import { LOOKS } from '../../core/surfaces/lens.js';

const PAGE = path.resolve('tests/fixtures/pages/first-draft-defaults.html');
const RULES = /constant-camera|living-ground|world-held|overshoot-share|ground-hue|value-dominance/;

test('a page with the first-draft defaults draws none of the default-sensitive rules', async () => {
  const opened = await openPage(PAGE, resolveFrame(PAGE));
  try {
    await opened.page.goto(opened.url, { waitUntil: 'load' });
    await settle(opened.page);
    const advice = pageAdvice(PAGE, await probePage(opened.page, Number(readPageMeta(PAGE, 'duration')), PAGE));
    const fired = [...advice.text, advice.brief, ...advice.lines].filter((l) => l && RULES.test(l));
    assert.deepEqual(fired, []);
  } finally { await opened.close(); }
});

test('the product look is a plain lens preset with no LED grid', () => {
  assert.deepEqual(Object.keys(LOOKS.product).sort(), ['aberration', 'bloom', 'dof', 'grain', 'vignette']);
});
