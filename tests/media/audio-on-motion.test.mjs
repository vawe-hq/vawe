// data-on="start|land|leave:<selector>": a cue follows its element's motion. The pure parts, then one Chrome page. Launches Chrome.
//   node --test tests/media/audio-on-motion.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer';
import { pageArgs } from '../../harness/lib/render-harness.mjs';
import { seekTo, installPageFrame } from '../../core/engine/page-seek.js';
import { arrivalSecond, firstMove, startOnMotion } from '../../harness/media/audio-on-motion.mjs';

test('arrivalSecond is the first frame the box is at its rest box, so an overshoot lands on first contact, not on the settle', () => {
  const times = [0, 0.1, 0.2, 0.3, 0.4];
  const slide = [[-600, 0, 100, 100], [-200, 0, 100, 100], [40, 0, 100, 100], [10, 0, 100, 100], [0, 0, 100, 100]];
  assert.equal(arrivalSecond(times, slide), 0.2, 'passing the rest pose between frames is arrival');
  const pop = [[45, 45, 10, 10], [20, 20, 60, 60], [3, 3, 94, 94], [-10, -10, 120, 120], [0, 0, 100, 100]];
  assert.equal(arrivalSecond(times, pop), 0.2, 'a scale pop arrives at 92% of its growth');
  assert.equal(arrivalSecond([0, 1], [[0, 0, 100, 100], [0, 0, 100, 100]]), 0, 'a box that never moves is there from the start');
});

test('firstMove joins the animations that start with the earliest one and ignores later ones', () => {
  assert.deepEqual(firstMove([{ start: 1, end: 1.2 }, { start: 0.5, end: 0.7 }, { start: 0.5, end: 0.9 }]), { start: 0.5, end: 0.9 });
});

const html = `<!doctype html><style>body{margin:0}#a,#b{position:absolute;width:100px;height:100px;left:200px;top:200px}</style>
<div id="a"></div><div id="b"></div><div id="c"></div><script>
const a = document.querySelector('#a'), b = document.querySelector('#b');
a.animate([{ transform: 'translateX(-600px)' }, { transform: 'translateX(40px)', offset: 0.4 }, { transform: 'none' }], { delay: 1000, duration: 500, fill: 'both' });
a.animate([{ transform: 'none' }, { transform: 'translateY(600px)' }], { delay: 3000, duration: 300, fill: 'forwards', composite: 'add' });
b.animate([{ visibility: 'visible' }, { visibility: 'visible' }], { delay: 500, duration: 500 });
a.animate([{ fontFamily: 'serif' }, { fontFamily: 'monospace' }], { delay: 0, duration: 4000, fill: 'both' });
</script>`;

test('start, land and leave read the element motion in a real page; data-at adds; a font swap is not a move; a bad selector or a still element is named', async () => {
  const browser = await puppeteer.launch({ headless: true, args: pageArgs(true) });
  try {
    const page = await browser.newPage();
    await page.evaluateOnNewDocument(`window.__pageSeek = ${seekTo}; (${installPageFrame})(${JSON.stringify({ aspect: '16:9', width: 1920, height: 1080 })});`);
    await page.goto(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    const specs = [{ on: 'start:#a', at: 0 }, { on: 'land:#a', at: 0 }, { on: 'leave:#a', at: -0.1 }, { on: 'land:#zz', at: 0 }, { on: 'start:#b', at: 0 }, { on: 'world:x', at: 0 }];
    const problems = await startOnMotion(page, specs);
    assert.equal(specs[0].at, 1);
    assert.ok(specs[1].at > 1 && specs[1].at <= 1.2, `land at ${specs[1].at}: the first contact at 40% of 0.5 s, before the 1.5 s settle`);
    assert.equal(specs[2].at, 2.9);
    assert.equal(specs[5].at, 0, 'a world cue is left to the world resolver');
    assert.equal(problems.length, 2);
    assert.match(problems[0], /land:#zz.*no element matches #zz/);
    assert.match(problems[1], /start:#b.*no animation that moves it \(only visibility, font/);
  } finally { await browser.close(); }
});
