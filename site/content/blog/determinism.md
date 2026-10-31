---
title: "Headless Chrome screenshots differ between runs: 6 fixes"
description: "Two renders of one page gave 70 of 216 different frames. Six causes of pixel drift in headless Chrome, the fix for each, and a test."
date: 2026-10-10
updated: 2026-10-16
section: rendering
topic: determinism
docs: determinism, time-and-seek
featured: true
featuredOrder: 3
tags: "determinism, headless chrome, puppeteer, svg filter, gpu compositing"
keywords: "deterministic rendering, headless chrome screenshots differ, puppeteer screenshot different each time, repeatable rendering, svg filter gpu"
hero: /blog/determinism/hero.webp
heroAlt: "Bar chart of frames that differed between two renders: 70 of 216 in a shared Chrome, 1 of 1296 with a Chrome per lane, 0 of 648 with software compositing, 117 of 154 for a downscaled WebGL page."
---

Render one web page twice and compare the frames. They should match. In headless Chrome they often do not. We rendered one page with an SVG filter twice, with no change to the page or the machine. In a shared Chrome, 70 of 216 frames came out different.

This matters for two reasons. A person who sees a wrong frame cannot tell if the page or the renderer is at fault. An AI agent cannot tell either. A renderer that gives the same frame every time removes one of the two causes.

We built [vawe](https://github.com/vawe-hq/vawe), a renderer that turns an HTML page into an MP4. While we did, we found six sources of drift and one bug that looked like drift. Each section gives the cause, the fix and the test. The first two causes are in the page. The other four are in the browser.

![Bar chart of frames that differed between two renders, by cause.](/blog/determinism/hero.webp)

## What we found

| Case | Frames that differed |
| --- | --- |
| SVG filter, one shared draft Chrome | 70 of 216 |
| SVG filter, one Chrome per worker | 1 of 1,296 |
| SVG filter, software compositing | 0 of 648 |
| WebGL draft, browser downscale | 117 of 154 captures |

Every row renders one page twice and counts the frames that differ.

## 1. Replace the page clock before the page scripts run

The renderer seeks the page to a time, takes a screenshot and moves on. So each frame must depend only on its time. But pages call `Date.now()`, `setTimeout` and `Math.random()`, and those depend on when the page runs.

We do not ban these calls. Agents write them without thinking, and a ban would break the pages they write. A virtual clock of 75 lines runs before any page script. It makes the calls follow the seek time, and it seeds `Math.random` from that time. The full list is in [freeze Date.now and seed Math.random](/blog/page-clock).

To test it, render a page that reads `Date.now`, `performance.now` and `Math.random` twice. Compare the frame hashes.

## 2. Freeze the document timeline, then seek every animation

The document timeline runs in real time from page load. Chrome paints animated layers against that time before the first seek pauses them. In our test, a first seek 1.5 seconds after load painted different edge pixels than a first seek at 0.05 seconds. A slow tab start changed the frame.

The fix is to set the animation playback rate to 0 through the DevTools protocol. After that, only a seek moves an animation. Seeking backward has its own traps, and [how to seek CSS animations frame by frame](/blog/seekable-css) lists them.

To test it, seek to the end, then back to the middle. Compare the result with a fresh page that seeks once to the middle.

## 3. Give each render worker its own Chrome, and composite SVG filters in software

The "gooey filter" video component draws a tab bar through an SVG filter. In a shared draft browser, GPU compositing painted that filter in two different states. We found no pattern. Two renders of the same page differed in 70 of 216 frames.

![The gooey filter video component: shapes merge into one soft outline](/blog/determinism/gooey-filter.webp "The gooey filter video component, the page that showed the drift.")

We made two changes. Each draft worker now has its own Chrome, and the difference fell to 1 of 1,296 frames. A page that draws an SVG filter also composites in software, and the difference fell to 0 of 648.

Software compositing makes a draft about 2.5 times slower. So only pages that need it pay the cost. The renderer scans the page source and its imported modules for a `<filter>` element, an `fe*` primitive or a `filter: url(...)` rule. A Chrome per worker also made renders faster. We measured that in [a Chrome for each parallel render](/blog/fast-drafts).

To test it, render a filter page twice and compare the hashes.

## 4. Emulate focus on every page

The tab that holds focus paints sub-pixel edges differently from the other tabs. The difference was small (SSIM 0.9994), but with several workers the frontmost slice changed the pixels. We turn on focus emulation for every page, so all pages paint as the focused one.

To test it, render with two workers and with four. Compare the hashes.

## 5. Start each final slice on a fresh page, with fixed slice boundaries

A page keeps raster state between seeks. The first frame on a fresh page differs from the same frame reached by seeking on. On gradient text the difference was small but real (SSIM 0.99997).

A final render therefore uses fixed slices of 60 frames, and each slice starts on a fresh page. The slice size is a constant. It never depends on the number of workers. A render with 2 workers and a render with 4 give the same pixels. Drafts give up this guarantee for speed.

To test it, render with different worker counts and compare the hashes.

## 6. Keep WebGL capture out of the Chrome downscale

A half-size draft of a WebGL page used the Chrome downscale, and 117 of 154 captures differed between runs. Now the renderer captures at full size and lets ffmpeg shrink the frames with `flags=area`. The reason is in [lay out big, capture small](/blog/drafts-lie).

The WebGL lens, which films the page as a flat screen, also draws its SVG screen into a software canvas. The draft pixels now match from run to run.

To test it, render a window of one film twice at half size. Compare the hash of each frame.

## 7. Own every tab you touch in a shared browser

This bug is not drift, but it gave wrong frames that looked like drift. A call to `browser.pages()` attached to the tab of a running render and reset it to the Puppeteer default viewport of 800 by 600 pixels. Our reviewing agent saw a shrinking box. The full story is in [the 800 by 600 viewport bug](/blog/drafts-lie).

To test it, render while another process opens and lists pages in the same browser.

## How to use this list

Run the seven tests in order. Each one renders twice and compares. We keep all of them in the test suite.

In vawe, most checks only advise. Determinism is one of the few that refuse a render. A render that cannot repeat is not a render you can debug.

Two rules sit under the whole list. First, name the cause before you pick a fix. For the filter case the cause was the compositor, and no change to the page would have helped. Second, never take a value that affects pixels from the machine. The number of workers is one example.

For when byte-identical output decides which tool you pick, read [when determinism matters](/when-determinism-matters). For the tool comparison, read [Remotion alternatives](/remotion-alternatives).

## FAQ

**Why does my Puppeteer screenshot differ between runs?**
The usual causes are a real clock, a running animation, GPU compositing and tab focus. Pause the animations, set the time yourself and use one tab per browser.

**How do I make headless Chrome deterministic?**
Replace `Date`, timers and `Math.random` before the page loads. Set the animation playback rate to 0 and seek each animation. Composite SVG filters in software. Emulate focus on every page.

**Does software compositing cost much?**
In our drafts it made a render about 2.5 times slower. We use it only for pages that draw an SVG filter, and always for finals.

**Will two machines give the same pixels?**
Not always. A different GPU or Chrome version can change the pixels. On one machine, with the fixes above, the same page gives the same frames.

**Do I need vawe to use these fixes?**
No. The fixes are Chrome settings and a few lines of page code. vawe applies them for you.
