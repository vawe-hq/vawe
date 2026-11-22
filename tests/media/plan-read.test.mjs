// The plan read before any render (harness/media/plan-read.mjs): a 4-card slideshow lists its tells from the page alone, and the `vawe new`
// starter lists none, so a new film starts clean. The same holds for each film type's starter, at the shortest length that routes to it and at its default.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readPlan } from '../../harness/media/plan-read.mjs';
import { starterPage, starterFace } from '../../harness/cli/new.mjs';
import { STARTERS, starterMin } from '../../harness/cli/route.mjs';

const ROOT = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));

test('a 4-card slideshow page lists the slideshow tells before any render', async () => {
  const { advice } = await readPlan(path.join(ROOT, 'tests/fixtures/pages/slideshow-classic.html'));
  assert.match(advice.join('\n'), /^slideshow: score [1-9]\/10$/m);
  for (const code of ['same-entrance', 'swap-no-carry', 'equal-shots']) assert.match(advice.join('\n'), new RegExp(`^slideshow: ${code} at `, 'm'), code);
});

test('the vawe new starter lists no page ban before any render', async () => {
  const dir = path.join(ROOT, 'films', `zz-plan-read-${process.pid}`);
  const face = starterFace('zz-plan-read');
  fs.mkdirSync(path.join(dir, 'assets'), { recursive: true });
  try {
    fs.copyFileSync(path.join(ROOT, 'assets', 'fonts', face.font), path.join(dir, 'assets', face.font));
    fs.writeFileSync(path.join(dir, 'page.html'), starterPage({ length: 10, face }));
    const { advice } = await readPlan(path.join(dir, 'page.html'));
    assert.deepEqual(advice, []);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('the starter of each film type lists no page ban before any render', async () => {
  const dir = path.join(ROOT, 'films', `zz-plan-read-types-${process.pid}`);
  const face = starterFace('zz-plan-read');
  fs.mkdirSync(path.join(dir, 'assets'), { recursive: true });
  try {
    fs.copyFileSync(path.join(ROOT, 'assets', 'fonts', face.font), path.join(dir, 'assets', face.font));
    for (const [type, length] of [['sting', 5], ...[[starterMin('brand launch'), 12, 15].map((l) => ['brand launch', l])].flat(), ...[starterMin('story or explainer'), 12, 20, 28, 29, 30].map((l) => ['story or explainer', l])]) {
      assert.ok(type in STARTERS, type);
      fs.writeFileSync(path.join(dir, 'page.html'), starterPage({ type, length, title: 'Northwind', face }));
      const { advice } = await readPlan(path.join(dir, 'page.html'));
      assert.deepEqual(advice, [], type + ' ' + length);
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
