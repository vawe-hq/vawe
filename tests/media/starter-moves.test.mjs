// Every move a type starter puts inside a world ends inside that world, at the shortest length that routes to the type and at the lengths between it and the whole starter (a shorter film keeps fewer worlds):
// the worlds scale with the length, so a move timed in fixed seconds would run into the next world.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openPage, resolveFrame } from '../../harness/media/render-page.mjs';
import { loadOpened } from '../../harness/media/plan-read.mjs';
import { starterPage, starterFace } from '../../harness/cli/new.mjs';
import { starterMin } from '../../harness/cli/route.mjs';

const ROOT = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));
const CASES = [['sting', [5]], ['brand launch', [starterMin('brand launch'), 12, 15]], ['story or explainer', [starterMin('story or explainer'), 12, 20, 28, 29, 30]]];

const movesPastTheirWorld = () => {
  const root = document.documentElement;
  const beat = (n) => parseFloat(getComputedStyle(root).getPropertyValue('--beat-' + n));
  const end = parseFloat(document.querySelector('meta[name="duration"]').content);
  const worlds = [...document.querySelectorAll('[data-world]')];
  const cutOf = (i) => (i + 1 < worlds.length ? beat(i + 2) - 0.03 : end);
  return document.getAnimations().flatMap((a) => {
    const target = a.effect?.target;
    const world = target?.closest?.('[data-world]');
    if (!world || target === world || target.closest('.ground') || a.effect.pseudoElement) return [];
    const stop = a.effect.getComputedTiming().endTime / 1000;
    const cut = cutOf(worlds.indexOf(world));
    return stop > cut + 0.05 ? [`${world.dataset.world} ${target.tagName.toLowerCase()}.${target.className}: ends at ${stop.toFixed(2)} s, its world at ${cut.toFixed(2)} s`] : [];
  });
};

for (const [type, lengths] of CASES) {
  test(`${type}: every move inside a world ends in that world, at ${[...new Set(lengths)].join(' s and ')} s`, async () => {
    const dir = path.join(ROOT, 'films', `zz-starter-moves-${process.pid}`);
    const page = path.join(dir, 'page.html');
    const face = starterFace('zz-moves');
    fs.mkdirSync(path.join(dir, 'assets'), { recursive: true });
    try {
      fs.copyFileSync(path.join(ROOT, 'assets', 'fonts', face.font), path.join(dir, 'assets', face.font));
      for (const length of lengths) {
        fs.writeFileSync(page, starterPage({ type, length, title: 'Northwind', face }));
        const opened = await openPage(page, resolveFrame(page), { warm: true, final: false });
        try {
          await loadOpened(opened);
          assert.deepEqual(await opened.page.evaluate(movesPastTheirWorld), [], `${length} s`);
        } finally {
          await opened.close();
        }
      }
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
}
