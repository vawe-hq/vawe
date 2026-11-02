// Every example film is a page agents copy from: the draft-check advice that needs no video (text size,
// collisions, contrast, motion lint, brief, directions) is empty on it, or waived in its page with a _why.
// Notes and the move-doc pointers its Board earns are not advice.
// Needs Chrome.
//   node --test tests/media/examples-advice.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { openPage, resolveFrame, settle, readPageMeta, probePage, pageAdvice, NOTE_LINES } from '../../harness/media/render-page.mjs';
import { readBrief } from '../../harness/lib/brief-tables.mjs';
import { moveDocLines } from '../../harness/lib/move-docs.mjs';

const WAIVED = /^(\d+ waived: |fix first: )/;
const EXAMPLES = path.resolve('films/examples');
const pages = fs.readdirSync(EXAMPLES).map((d) => path.join(EXAMPLES, d, 'page.html')).filter((p) => fs.existsSync(p));

for (const pagePath of pages) {
  test(`${path.relative(process.cwd(), pagePath)} gives no unwaived draft advice`, async () => {
    const opened = await openPage(pagePath, resolveFrame(pagePath));
    try {
      await opened.page.goto(opened.url, { waitUntil: 'load' });
      await settle(opened.page);
      const advice = pageAdvice(pagePath, await probePage(opened.page, Number(readPageMeta(pagePath, 'duration')), pagePath));
      const pointers = new Set(moveDocLines(readBrief(pagePath)));
      const live = [...advice.text, advice.brief, ...advice.lines].filter((l) => l && !NOTE_LINES.test(l) && !WAIVED.test(l) && !pointers.has(l));
      assert.deepEqual(live, []);
    } finally { await opened.close(); }
  });
}
