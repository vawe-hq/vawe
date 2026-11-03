---
title: "SVG animation to MP4: render SMIL and CSS from code"
description: "Turn an SVG animation into an MP4 from code. vawe pauses the SVG and seeks every frame, so SMIL and CSS animation render the same each run. A page that ran."
date: 2026-11-03
updated: 2026-11-03
section: how-to
nav: "SVG animation to MP4"
topic: how-to
docs: time-and-seek, the-page, determinism
tags: "svg animation to mp4, smil, svg to video, stroke dashoffset, headless chrome"
keywords: "svg animation to mp4, convert animated svg to video, smil to mp4, svg to mp4 code, export svg animation as video"
hero: /moves/mark-trace.hd.webp
heroAlt: "A frame from the mark-trace move: a black W mark with a red stroke tracing its last stroke."
---

To turn an SVG animation into an MP4 from code, put the SVG inline in an HTML page, then render the page with a tool that pauses the SVG and sets its time for each frame. vawe does this. It calls `pauseAnimations()` and `setCurrentTime(t)` on every `<svg>` in the page before it takes each screenshot, so SMIL animation renders correctly and the same each run.

![A frame from the mark-trace move: a black W mark with a red stroke tracing its last stroke.](/moves/mark-trace.hd.webp)

## Why a screen recording does not work for SVG

A browser plays a SMIL animation against its own clock. If you record the screen, you film whatever the machine drew, so a slow frame is a lost frame. Online SVG-to-video converters exist. This post is for the case where the SVG lives in your repository and you want a script that you can run again.

The fix is the same for all web animation: do not play it, seek it. The browser has the call for SVG: `setCurrentTime(seconds)` on the `<svg>` element, after `pauseAnimations()`. The renderer calls both for every frame.

## The page

This page has three animations in one SVG. A `<path>` draws itself with an animated `stroke-dashoffset`. A circle follows the same path with `<animateMotion>`. A square spins with a CSS `@keyframes` rule. We rendered it:

```html
<!doctype html>
<html data-aspect="16:9">
<head>
<meta charset="utf-8">
<meta name="duration" content="4">
<meta name="message" content="SMIL and CSS on SVG are seeked, not played">
<title>SVG</title>
<style>
  html, body { margin: 0; height: 100%; background: #0b0d12; overflow: clip; }
  .world { position: absolute; inset: 0; display: grid; place-items: center; }
  svg { width: 80vw; height: auto; }
  .ring { transform-origin: 300px 150px; animation: spin 4s linear both; }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
</head>
<body>
<div class="world" data-world="svg">
  <svg viewBox="0 0 600 300">
    <path d="M40 220 C 160 40, 300 260, 560 80" fill="none" stroke="#3291ff" stroke-width="8"
          pathLength="1" stroke-dasharray="1" stroke-dashoffset="1">
      <animate attributeName="stroke-dashoffset" from="1" to="0" begin="0s" dur="2.5s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines=".4 0 .2 1"/>
    </path>
    <circle r="14" fill="#f4f6fb">
      <animateMotion dur="2.5s" begin="0s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines=".4 0 .2 1"
                     path="M40 220 C 160 40, 300 260, 560 80"/>
    </circle>
    <g class="ring"><rect x="270" y="120" width="60" height="60" rx="10" fill="none" stroke="#ffd23f" stroke-width="6"/></g>
  </svg>
</div>
</body>
</html>
```

The path has `pathLength="1"`. This makes the dash length 1 unit, so the draw goes from `stroke-dashoffset="1"` (nothing) to `0` (the whole line), whatever the real length is. The `keySplines` give both the line and the circle the same ease, so the circle stays at the tip of the line.

Render a draft:

```bash
bin/vawe dev films/svg/page.html --whole --small
```

We ran it. The result is a 4 second MP4, 120 frames at 960 by 540 pixels, and the draft took 15 seconds including the checks. We read nine frames. At 0.57 s the line is a short curve and the circle sits at its tip. At 1.7 s it has passed the middle. By 2.83 s the line is whole and the circle rests at the end, because of `fill="freeze"`. The square turns through the whole 4 seconds.

## What the renderer does

The seek is in `core/engine/page-seek.js`. For each frame it does these steps in order:

1. Set the virtual clock to `t`.
2. Call `window.seek(t)` if the page defines it.
3. Pause every CSS and Web Animation and set its `currentTime` to `t * 1000`. The CSS `spin` rule on the square is handled here.
4. For every `<svg>` in the page, call `pauseAnimations()` and `setCurrentTime(t)`. The `<animate>` and `<animateMotion>` tags are handled here (lines 27 and 28).
5. Run every `vawe.onFrame` hook.

So one page can mix the three kinds, as ours does. CSS on SVG elements works with the Web Animations step, and SMIL works with the SVG step. See [time and seek](/docs/time-and-seek) for the whole order.

## What we tested, and what we did not

We tested these in the page above: `<animate>` on a presentation attribute with `begin="0s"`, `<animateMotion>` with a `path`, `fill="freeze"`, a spline ease, and CSS `@keyframes` on an SVG element.

We did not test `begin` values that depend on events such as `click`, nor `<animateTransform>`, nor SVG filters that animate. A page that works in a browser with a plain `begin` time should work. Check a frame with `bin/vawe frame films/svg/page.html --at 1.7` before you render all of it.

Two limits come from how the web works:

- The SVG must be inline, as an `<svg>` element in the page. The seek looks for `<svg>` elements in the page document, and an SVG that you load with an `<img>` tag is a separate document.
- Script that animates an SVG attribute needs the seek too. In vawe, a virtual clock owns `Date`, `setTimeout`, `requestAnimationFrame` and `Math.random`, so a script that uses them follows the seek. See [why the same page gives the same frames](/blog/determinism).

## Use an existing SVG

Most real files come from a design tool. Open the file, copy its `<svg>` element into the page, and add the `<animate>` tags or CSS classes. Give the SVG a `viewBox` and a width in `vw`, as ours does, so it scales with the film size. The page can then render in other ratios: add `--aspect 9:16` to a render to try it, and look at the frame first. See [aspect ratios](/blog/html-video-aspect-ratios). If your animation is a Lottie file, read [vawe vs Lottie](/vs/lottie).

For a logo that draws itself, the library has a move called [mark trace](/video-components/mark-trace). For a drawn underline, see [underline draw](/video-components/underline-draw). For a GSAP timeline, see [GSAP to MP4](/blog/gsap-to-mp4).

## FAQ

**How do I convert an animated SVG to MP4?**
Inline the SVG in an HTML page. Render the page with a tool that calls `svg.pauseAnimations()` and `svg.setCurrentTime(t)` for every frame, then encode the frames. vawe does both in one command.

**Does it work with SMIL?**
Yes, for the tags we tested: `<animate>` and `<animateMotion>` with plain `begin` times.

**Does it work with CSS animation on SVG?**
Yes. The renderer sets the `currentTime` of every CSS and Web Animation, and that includes the ones on SVG elements.

**Can I keep a transparent background?**
Not with the MP4 output. H.264 has no alpha channel, and the page has a solid background in the render.

**Is the output the same each time?**
The frames are a function of `t` and the page. We took the same frame of the canvas page in [canvas to video](/blog/canvas-to-video) twice and the two PNGs had the same md5. We did not run that check on this SVG page.
