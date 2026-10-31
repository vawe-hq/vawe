---
title: "Seed Math.random and freeze Date.now in JavaScript"
description: "A 75-line virtual clock makes Date.now, timers, requestAnimationFrame and Math.random follow the seek time. What it replaces and why."
date: 2026-10-08
updated: 2026-10-16
section: rendering
topic: determinism
docs: time-and-seek, determinism, page-api
tags: "virtual clock, math.random seed, deterministic rendering, headless chrome, javascript"
keywords: "mock date.now puppeteer, math random seed javascript, virtual clock javascript, fake requestanimationframe, deterministic video rendering"
hero: /blog/page-clock/hero.webp
heroAlt: "A seek time t enters a virtual clock that sets Date, performance.now, requestAnimationFrame, timers and Math.random, and one identical frame comes out."
---

To freeze `Date.now` and seed `Math.random` in a page, inject a small virtual clock before any page script runs. Ours is `core/engine/page-clock.js` in [vawe](https://github.com/vawe-hq/vawe): 75 lines of JavaScript. With it, a page can call `Math.random()` and `Date.now()` and still render the same video twice.

The rule behind it: every frame is a pure function of `t`, the film time in seconds. Ask for the frame at 4.2 s twice, in any order, and get the same pixels. The clock is one item on our [determinism checklist for headless Chrome](/blog/determinism).

## What the clock replaces

| API | What the page sees |
|---|---|
| `Date`, `performance.now` | Film time in milliseconds |
| `requestAnimationFrame` | Callbacks queue up and flush once per `set(t)`, with film time |
| `setTimeout`, `setInterval` | They fire when `set(t)` passes their due time, in due order |
| `Math.random` | A mulberry32 generator, reseeded from `t` on every `set(t)` |
| `window.__pageClock.real` | The real timers, kept for the renderer |
| `pending()` | The count of animation-frame callbacks and timers that still wait |

## Run it

The renderer injects the clock with Puppeteer's `evaluateOnNewDocument`, so it runs before any page script. A script that loads later would already hold the real functions. Save this as `clock.mjs` in a checkout of vawe:

```js
import puppeteer from 'puppeteer';
import { installPageClock } from './core/engine/page-clock.js';

const browser = await puppeteer.launch();
const page = await browser.newPage();
await page.evaluateOnNewDocument(`(${installPageClock})()`);
await page.goto('data:text/html,<script>window.read=()=>JSON.stringify([Date.now(),performance.now(),Math.random().toFixed(6)])</script>');
const at = async (t) => { await page.evaluate((s) => window.__pageClock.set(s), t); return page.evaluate(() => window.read()); };
console.log(await at(4.2));
console.log(await at(1));
console.log(await at(4.2));
await browser.close();
```

On our machine it printed:

```
[4200,4200,"0.192236"]
[1000,1000,"0.813430"]
[4200,4200,"0.192236"]
```

The first and third lines match, even though a seek to 1 s came between them.

## How each API behaves

### Date and performance.now

Both report film time in milliseconds. A page that measures time with `Date.now() - start` gets the elapsed film time, whatever the render order.

### requestAnimationFrame

Callbacks queue up and flush once per `set(t)`, called with the film time. A page that draws in a rAF loop draws exactly one frame per seek.

### setTimeout and setInterval

When `t` jumps ahead, every timer whose due time has passed fires, earliest first. One seek fires at most 1,000 timers, so a tight interval cannot hang the render.

### Math.random

The seed comes from the time, so the same `t` always gives the same sequence, whatever the page rendered before. Seed from time, not from a counter. A counter depends on how many calls came before, which depends on what you rendered first. With a time seed, a page can scatter particles with `Math.random()` and they land in the same places every time.

## Fractional seconds, not frame numbers

The clock came from a clock in our old JSON engine, which counted frame numbers. A page seeks in fractional seconds, because we render subframe motion blur and 59.94 fps masters. So the clock now keys on `t`. The post on [motion blur for HTML animation](/blog/motion-blur) explains subframe blur.

## The real timers and pending()

The renderer needs a real wait to know that a frame has painted. So the real timers stay reachable as `window.__pageClock.real`.

`pending()` reports the animation-frame callbacks and timers that still wait. At zero, only animations can change the page. The renderer can then reuse a capture when the animation state repeats.

## Why we did not ban the APIs

Agents write what they know, and that includes `setTimeout` and `Math.random`. Our rule is that if something an agent writes by habit fails, that is a framework bug. A ban on common APIs breaks that rule.

The other option was to run the page in real time and record it. Every render would then take as long as the film, and the frames would depend on how busy the machine is.

## What the clock does not cover

The clock handles scripts. CSS animations and Web Animations run on the document timeline, a second clock that the browser drives. We freeze it by setting the animation playback rate to 0. Before that, the compositor painted animated layers against real time. A first seek 1.5 s after load painted different edge pixels than a first seek at 0.05 s. The seek side is in [how to seek CSS animations frame by frame](/blog/seekable-css).

![Six boxes in order: set the clock, call window.seek, seek animations, run onFrame hooks, settle, screenshot.](/blog/page-clock/diagram.webp "The order of one seek.")

## The test that holds it

We have no before-and-after number for the clock. We have a test, `tests/media/render-page-determinism.test.mjs`. It renders each fixture page twice and compares the frame hashes from ffmpeg.

One fixture is a `window.seek(t)` canvas page. The other reads `Date.now`, `performance.now` and `Math.random`. The test checks three things: the two renders match, there are five frames, and the frames are not all the same. The last check proves that the page moved with the seek time.

Determinism is also the one thing in vawe that can refuse a render. Everything else advises, as [AI agent guardrails: when a check should refuse](/blog/advise-refuse) explains. The user-facing rules are in the [determinism docs](/docs/determinism).

## Source files

| File | What it holds |
|---|---|
| `core/engine/page-clock.js` | The virtual clock (75 lines) |
| `core/engine/page-seek.js` | The in-page seek that sets the clock and seeks every animation |
| `tests/media/render-page-determinism.test.mjs` | Render twice, compare frame hashes |

## FAQ

**How do I mock Date.now in Puppeteer?**
Inject a script with `page.evaluateOnNewDocument` that replaces `Date`, `performance.now` and the timers before the page loads. Drive the clock from your own `set(t)` call, not from the real time.

**How do I seed Math.random in a page?**
Replace `Math.random` with a seeded generator such as mulberry32, and reseed it from the seek time. A time seed gives the same sequence for the same frame, whatever order you render in.

**Why not ban Math.random and setTimeout in video pages?**
Agents and developers write them by habit, and a ban breaks real pages. A virtual clock lets the page keep its code and still render the same frame twice.

**Does a virtual clock also stop CSS animations?**
No. CSS animations and Web Animations use the document timeline. Set the animation playback rate to 0 and seek them with `currentTime`.
