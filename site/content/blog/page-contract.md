---
title: "HTML to video format: the page contract"
description: "The vawe page format in one page: a duration meta, data-world beats and audio tags. Every rule, and what each tool reads from it."
date: 2026-10-07
updated: 2026-10-16
section: rendering
topic: determinism
docs: the-page, page-api, worlds
tags: "html to video, html video format, data attributes, page contract"
keywords: "html to video format, render html to video, html video format, data attribute contract, responsive video layout"
hero: /blog/page-contract/hero.webp
heroAlt: "An annotated film page: a duration meta, message and spectacle metas, data-aspect on the html element, root custom properties, one data-world element per beat, audio tags and an optional window.seek."
---

To render HTML to video with vawe, you write one web page: `page.html` plus its own assets folder. A `<meta name="duration">` gives the length, and a `data-world` attribute marks each beat. The renderer seeks the page frame by frame and encodes a film. There is no timeline file, no project file and no schema to learn.

This page is the reference for that format. Each rule says what the tools read from it. The step list is in the [page docs](/docs/the-page).

## What a renderable page looks like

This is an abridged page. The names come from our public example `films/examples/colour-sting/page.html`:

```html
<html data-aspect="16:9">
<meta name="duration" content="5">
<meta name="message" content="onsen turns up the colour">
<meta name="spectacle" content="2.75">
<style>:root { --beat-2: 0.7s; --beat-3: 2.0s; }</style>
<div class="world w1" data-world="cold"></div>
<div class="world w2" data-world="warm"></div>
```

## The rules

| Rule | What the tools get from it |
|---|---|
| A film is `films/<name>/page.html` plus its own assets folder, with relative paths only | A film moves as one folder |
| `<meta name="duration">` in seconds, and an optional `<meta name="fps">` for the frame-table rate | The length. The render rate stays separate: 60 fps for a final, 30 fps for a draft |
| Time is the seek: CSS keyframes, `element.animate`, or `window.seek(t)` that paints frame `t` as a pure function | Any frame renders in any order |
| One element per beat with `data-world="<id>"`, in lowercase | The checks and the reviewer find the beats the same way |
| Every tunable number is a literal: a `[[frame, value]]` table, a keyframe stop or a `:root` custom property | The studio edits those literals in place |
| `<meta name="message">` and `<meta name="spectacle">` | The one thing to remember, and the second the big moment lands |
| `<audio>` tags | The mix, read as written (see [audio as written](/blog/audio-as-written)) |

## Why the format is a web page

We started with a JSON scene format of our own. When we [dropped it after a blind test](/blog/html-over-json), we also lost the file that told the framework what a film held. In JSON, the scene listed layers and times. In a web page, the framework sees only a DOM and some CSS.

We still needed four answers. How long is the film? Where does each beat start and end? Which numbers can the studio edit? How does one page fit 16:9, 9:16, 1:1, 4:5 and 4:3 without a crop?

We did not add a manifest. A second file that describes the first is a second source of truth, and the two drift. We asked what an agent already writes and added the fewest conventions on top. One house rule decides the rest: if something an agent writes by habit fails, that is a framework bug.

## How the renderer turns the page into frames

The renderer never lets the page run on its own clock. It sets the time and takes a picture. CSS keyframes and Web Animations seek through their `currentTime`. A page can add `window.seek(t)` for canvas or three.js work.

A virtual clock owns `Date`, `requestAnimationFrame`, timers and `Math.random`. A page that calls them still paints the same frame twice. The [virtual clock reference](/blog/page-clock) lists what it replaces, and the [determinism checklist](/blog/determinism) covers the other causes of drift.

## How one page fits five aspect ratios

Before any page script runs, the renderer sets `data-aspect` on `<html>`. It also sets `--vw` and `--vh` (pixel lengths) on `:root` and on `window.vawe`. It sets each named ease as `--ease-<name>` on `:root` too, so plain CSS can write `var(--ease-land)`. The document element does not exist at that moment. So `installPageFrame` in `core/engine/page-seek.js` waits with a `MutationObserver` and applies the values when the element appears.

You lay out in CSS for the five aspects and never crop. The [aspect ratio guide](/docs/aspect-ratios) has the details. A brief can name a different length or aspect than the page. That gives an advice line, not a refusal, because the page owns its length.

## What the tools read

Twelve draft checks read the DOM from this contract. The list is the `CHECK_TIER` table in `harness/lib/draft-tiers.mjs`: motion, text, worlds, tail, video, sound, contrast, layout, spec, speed, box-motion and objects. The `world-held` check reads the measured `data-world` spans, so it can say that the second scene holds for 4 seconds with nothing moving.

The `vawe frame --world all` command renders one still for each `data-world` element, with a contact sheet. The `vawe new` command writes a starter page with one `data-world` per beat. It fills the metas from `--length`, `--aspect` and `--title`.

![One page.html feeds the renderer, the draft checks, the frames command, the reviewer and the studio.](/blog/page-contract/diagram.webp "One page.html, five readers.")

## Try it

From a checkout of [vawe](https://github.com/vawe-hq/vawe), render one still for each beat of the example page:

```bash
bin/vawe frame films/examples/colour-sting/page.html --world all
```

On our machine this printed `5 worlds: cold @0.383s, warm @1.383s, hot @1.899s, amber @3.566s, red @4.684s`. It then wrote a contact sheet and one PNG for each scene, in 9.9 s.

The design choices are small. `data-world` is one attribute on a `div`, so the checks, the reviewer and the stills stop disagreeing. Numbers stay literals, so an editor rewrites them with no schema. The frame facts exist before the page runs, so a page that lays out from `--vw` and `--vh` never measures the window.

We have no number for how much faster agents write a film with this format. We know what it replaced: a format with its own vocabulary and a 24-type schema.

If you compare other ways to turn a web page into video, see the [HyperFrames alternatives](/hyperframes-alternatives) and [Remotion alternatives](/remotion-alternatives) pages. Agents read the same rules first in `AGENTS.md`.

## FAQ

**What is the minimum an HTML page needs to render as video in vawe?**
One `page.html` with a `<meta name="duration">` in seconds. Add one `data-world` element per beat so the checks can find each scene.

**Does vawe need a timeline or project file?**
No. The page holds the length, the beats and the audio tags. The renderer seeks the page, so CSS keyframes and Web Animations play as written.

**How do I make one page work in 16:9, 9:16 and 1:1?**
Lay out with the `--vw` and `--vh` lengths that the renderer sets on `:root`, and set `data-aspect` on `<html>`. Never crop.

**Why not a JSON video format?**
A second file that describes the page is a second source of truth, and the two drift. Agents already know HTML and CSS, so they need no private schema.
