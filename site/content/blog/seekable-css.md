---
title: "Seek CSS animations frame by frame in Puppeteer"
description: "Seek CSS animations and Web Animations forward and back in Puppeteer. Keep finished animations, drop cancelled ones, wait for fonts."
date: 2026-10-09
updated: 2026-10-16
section: rendering
topic: determinism
docs: time-and-seek, the-page
tags: "seek css animation, web animations api, css keyframes, headless chrome, rendering"
keywords: "seek css animation, web animations api currenttime, document.getanimations, puppeteer css animation screenshot, svg smil seek"
hero: /blog/seekable-css/hero.webp
heroAlt: "One animation runs from 0 to 1 second on a 5 second axis. After a seek to 5 s and back to 0.25 s the effect must apply again, and it does because the renderer keeps every animation the page made."
---

To seek a CSS animation in Puppeteer, pause it and set its `currentTime`. Forward seeks work at once. Backward seeks fail in a quiet way. `document.getAnimations()` drops a finished animation with `fill: none`. A seek back to 0.25 s then finds nothing to move.

We hit four bugs of this kind while we built [vawe](https://github.com/vawe-hq/vawe), which renders a web page to video one screenshot at a time. This post gives the fix for each. The result is one function, `seekTo(t)`, that puts every CSS keyframe, CSS transition, `element.animate()` call and SVG `<animate>` at time `t`, in any order. It lives in `core/engine/page-seek.js` and is one item on our [determinism checklist](/blog/determinism).

## What the bug looks like

This script seeks one `fill: none` animation to 0.25 s, then to 5 s, then back to 0.25 s. It runs the seek two ways:

```js
import puppeteer from 'puppeteer';

const html = `<style>
  #a { opacity: 0; animation: fade 1s linear; }
  @keyframes fade { from { opacity: 0.2 } to { opacity: 0.8 } }
</style><div id=a>x</div>`;

const seekTo = (t, remember) => {
  const seen = (window.__seen ||= new Set());
  const list = remember ? (document.getAnimations().forEach((a) => seen.add(a)), [...seen]) : document.getAnimations();
  for (const a of list) { a.pause(); a.currentTime = t * 1000; }
  return getComputedStyle(document.getElementById('a')).opacity;
};

const browser = await puppeteer.launch();
for (const remember of [false, true]) {
  const page = await browser.newPage();
  await page.goto('data:text/html,' + encodeURIComponent(html));
  await page.evaluate(() => document.getAnimations().forEach((a) => a.pause()));
  const run = (t) => page.evaluate(seekTo, t, remember);
  const first = await run(0.25);
  await run(5);
  const back = await run(0.25);
  console.log(remember ? 'remember every animation' : 'getAnimations() only   ', 'first seek', first, 'after 5 s and back', back);
}
await browser.close();
```

On our machine it printed:

```
getAnimations() only    first seek 0.35 after 5 s and back 0
remember every animation first seek 0.35 after 5 s and back 0.35
```

The first column is the bug. After the seek to 5 s, the finished animation left the list, and the element lost its effect.

## The four fixes

| # | Problem | Fix |
| --- | --- | --- |
| 1 | The document timeline runs in real time before the first seek | Set the animation playback rate to 0 |
| 2 | `getAnimations()` drops finished `fill: none` animations | Keep every animation in a set |
| 3 | A cancelled animation or a removed element comes back | Drop idle animations and animations whose target left the document |
| 4 | Text paints in a fallback font | Wait for fonts, and fail after 10 s |

### 1. Freeze the document timeline

Before the first seek paused anything, the compositor painted animated layers against real time. A first seek 1.5 s after page load painted other edge pixels than a first seek at 0.05 s. Set the playback rate to 0 through the DevTools protocol (`Animation.setPlaybackRate`). After that, only a seek moves an animation.

### 2. Remember every animation

Keep each animation the page made in a set, and seek all of them each time. Treat `getAnimations()` as the list of what is live now, not of everything the page made.

### 3. Forget idle animations and removed targets

Once you keep everything, you must forget the right things. Drop an animation from the set if it is idle or its target left the document. A cancelled animation then stays cancelled, and a removed element is never touched.

Do not add a global rule such as `* { animation: none; transition: none }`. Our early tokens file had one. It stopped CSS animations before they existed, so there was nothing to seek. We removed it, and the seek now drives SVG SMIL (`<animate>`) on its own timeline.

### 4. Wait for fonts, and fail loudly

`awaitFonts` waits until every face in `document.fonts` finishes loading, including faces that start loading during the wait. If a face is still loading after 10 seconds, the render fails and names the family. A screenshot with a fallback font is a silent wrong answer, so we make it a loud error. The wait uses the real timer, because the [virtual clock](/blog/page-clock) owns `setTimeout`.

## The order inside one seek

`seekTo(t)` does these steps in this order:

1. Wait for fonts.
2. Set the virtual clock.
3. Call `window.seek(t)` if the page defines it.
4. Wait for fonts again.
5. Pause every remembered animation and set `currentTime` to `t * 1000`.
6. Pause SVG animations and set their time.
7. Await every `vawe.onFrame` hook.

The renderer and the studio both call this one function. A scrub in the studio and a frame in the render cannot disagree about what time `t` means.

![Four fixes in order: stop killing animations, keep finished ones, drop cancelled and removed ones, freeze the document timeline. Fonts are awaited around each seek with a 10 second limit.](/blog/seekable-css/diagram.webp "The four fixes, in order.")

## Test the seek backward

Seek to the end, then to the middle. Compare the result with a fresh page that seeks once to the middle. This test found our `fill: none` bug.

Our version is `tests/media/seek-fill-none.test.mjs`. It uses a CSS animation and a Web Animations one, both with `fill: none`. On a fresh page it seeks to 0.25 s and expects opacities of 0.2 and 0.3. On a second page it seeks to 5 s, then back to 0.25 s, and expects the same two values.

## When a seeked frame still looks wrong

- An element shows its end state after a backward seek: the animation left `getAnimations()`. See fix 2.
- A cancelled animation comes back: the set still holds it. See fix 3.
- Edge pixels differ between two renders of the first frame: the timeline ran before the first seek. See fix 1.
- Text shows the wrong face: the font was not ready. Fix 4 turns that into an error that names the family.
- An SVG filter outline flips by 1.5 px between frames on a still shape. This came from the gooey filter, one of our [video components](/video-components/gooey-filter). The default filter region is 10 percent of the box, and it cuts the blur. We gave the filter a wide region (`x="-30%" y="-30%" width="160%" height="160%"`) and put `will-change: transform` on its wrapper.

<figure>

<video src="/blog/seekable-css/gooey-filter.mp4" poster="/blog/seekable-css/gooey-filter-poster.webp" muted loop playsinline autoplay width="680"></video>

<figcaption>The gooey filter video component after the fix, rendered from a page that seeks to each frame.</figcaption>

</figure>

We have no aggregate number for this work. The concrete figures are the 10-second font deadline and the 1.5 px flip.

## Next steps

The other causes of pixel drift, from GPU compositing to tab focus, are in the [determinism checklist](/blog/determinism). For the step-by-step render, see [render HTML to MP4 with headless Chrome](/blog/render-html-to-mp4). For curves to use in these animations, see the [easing pages](/easing) and the [motion docs](/docs/motion).

## FAQ

**How do I seek a CSS animation to a specific time?**
Call `animation.pause()` and set `animation.currentTime` in milliseconds. Do this for every animation that `document.getAnimations()` returns, and for every one you kept from earlier seeks.

**Why does my CSS animation vanish after a backward seek?**
`document.getAnimations()` drops a finished animation with `fill: none`. Keep each animation in a set when you first see it, and seek the whole set.

**How do I seek SVG SMIL animations?**
Call `svg.pauseAnimations()` and then `svg.setCurrentTime(t)` with the time in seconds. SMIL runs on its own timeline, so the Web Animations seek does not move it.

**Does a seek wait for web fonts?**
It should. Await `document.fonts` before each screenshot, and fail after a fixed time. We fail after 10 seconds and name the font family.
