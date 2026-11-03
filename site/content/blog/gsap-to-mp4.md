---
title: "GSAP to MP4: export a timeline as video"
description: "Pause a GSAP timeline, call tl.time(t) for each frame and render it to MP4 with vawe or Puppeteer. Code, three traps we hit and a clip."
date: 2026-10-19
updated: 2026-10-19
section: how-to
nav: "GSAP to MP4"
topic: how-to
docs: time-and-seek, page-api, video-from-code
tags: "gsap, gsap to mp4, timeline, puppeteer, vawe"
keywords: "gsap to mp4, gsap timeline export to video, export gsap animation as video, render gsap with puppeteer, gsap tl.time seek"
---

You have a GSAP timeline and you want an MP4 file. Pause the timeline and move it to the time of each frame with `tl.time(t)`. Take a screenshot for every frame and join the frames with ffmpeg. This post shows the page, two ways to render it, and three traps we hit.

<figure>
<video src="/blog/gsap-to-mp4/clip.mp4" poster="/blog/gsap-to-mp4/poster.webp" muted loop playsinline controls></video>
<figcaption>The page below, rendered by vawe: 3 seconds, 90 frames, 960 by 540 pixels.</figcaption>
</figure>

## The page

GSAP runs on its own ticker, which follows the real clock. A renderer needs the opposite: the frame must depend only on its time. So you create the timeline paused and expose one function, `window.seek(t)`.

```html
<!doctype html>
<meta charset="utf-8">
<meta name="duration" content="3">
<style>
  html, body { margin: 0; height: 100%; background: #0b0d12; overflow: hidden; }
  body { color: #f4f6fb; font: 700 9vh system-ui, sans-serif; }
  #title { position: absolute; left: 8%; top: 28%; margin: 0; white-space: nowrap; }
  #rule { position: absolute; left: 8%; top: 54%; height: 1.2vh; width: 60%;
          background: #4f7cff; transform-origin: left; }
  #dot { position: absolute; left: 8%; top: 64%; width: 12vh; height: 12vh;
         border-radius: 50%; background: #ffcf5a; }
</style>
<h1 id="title" data-world="title">pause, seek, paint</h1>
<div id="rule"></div>
<div id="dot"></div>
<script src="gsap.min.js"></script>
<script>
  const tl = gsap.timeline({ paused: true });
  tl.from("#title", { y: 60, opacity: 0, duration: 0.7, ease: "power3.out" }, 0.3)
    .from("#rule", { scaleX: 0, duration: 0.8, ease: "expo.out" }, 0.8)
    .to("#dot", { x: () => innerWidth * 0.6, duration: 1.4, ease: "power2.inOut" }, 1.2)
    .to("#title", { opacity: 0.35, duration: 0.5 }, 2.4);

  window.seek = (t) => { tl.time(t); };
  window.seek(0);
</script>
```

Copy `gsap.min.js` from `node_modules/gsap/dist/` next to the page. We used GSAP 3.13.0. The `<meta name="duration">` line is for vawe. Puppeteer ignores it.

## Option 1: vawe

Save the page as `films/hello/page.html`, with `gsap.min.js` in the same folder. Run the draft command:

```bash
bin/vawe dev films/hello/page.html
```

Our run wrote a draft with 90 frames at 30 fps and 960 by 540 pixels. The whole command took 5.7 seconds. Capture took 3.2 seconds of that. vawe also owns `Date`, `requestAnimationFrame` and the timers, so the page cannot read the real clock. To install vawe, read [render HTML to MP4 with headless Chrome](/blog/render-html-to-mp4).

## Option 2: Puppeteer

This script calls `window.seek` for each frame and pipes the screenshots into ffmpeg:

```js
import puppeteer from "puppeteer";
import { spawn } from "node:child_process";

const [, , file, seconds = "3", fps = "30"] = process.argv;
const frames = Math.round(Number(seconds) * Number(fps));

const browser = await puppeteer.launch();
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720 });
await page.goto(`file://${process.cwd()}/${file}`);

const ffmpeg = spawn("ffmpeg", ["-y", "-f", "image2pipe", "-framerate", fps, "-i", "-",
  "-pix_fmt", "yuv420p", "-c:v", "libx264", "out.mp4"], { stdio: ["pipe", "inherit", "inherit"] });

for (let i = 0; i < frames; i++) {
  await page.evaluate((t) => window.seek(t), i / Number(fps));
  ffmpeg.stdin.write(await page.screenshot({ type: "png" }));
}
ffmpeg.stdin.end();
await new Promise((r) => ffmpeg.on("close", r));
await browser.close();
```

Run `node render.mjs page.html 3 30`. We ran it on the same page. It wrote 90 frames at 1280 by 720 pixels, and the run took 5.7 seconds. The longer story of this loop is in [Puppeteer screenshots to MP4 with ffmpeg](/blog/puppeteer-to-mp4).

## Three traps we hit

| Trap | What we saw | Fix |
| --- | --- | --- |
| `window.seek = (t) => tl.time(t)` | Puppeteer's `page.evaluate` timed out. | Use braces, so the function returns nothing. |
| Timeline not paused | 4 of 30 frames differed between two passes. | Create it with `paused: true`. |
| Two `from()` calls on one property | The second tween ended at `x: 200`. | Use `fromTo()`. |

The seek function returns the timeline. `tl.time(t)` with an argument returns the timeline itself. An arrow function without braces returns that value, and `page.evaluate` tries to copy the whole object back to Node. Puppeteer stopped with `Runtime.callFunctionOn timed out`. vawe had a related bug. It waited on the returned timeline, and a timeline has a `then()` that never settles. The draft ran 11 minutes with no output. We fixed it. vawe now waits only for a real Promise and ignores any other return value, so that page renders in vawe. In plain Puppeteer the trap remains, and the braces in the page above avoid it.

The timeline plays on its own. We removed `paused: true` and called `tl.play()`, so the GSAP ticker kept moving the timeline between our seek and the screenshot. We rendered 30 frames twice, with Puppeteer at 640 by 360 pixels, and compared the hash of each frame. With the timeline paused, 0 of 30 frames differed. With the ticker running, 4 of 30 differed.

A second `from()` reads the value the first one left. A `from()` tween takes its end value from the current value of the element. A `from()` on `x` in a timeline paints the start value at once. A second `from()` on the same element then reads that start value as its end value. We called `from("#box", { x: 200 })` at 0 s and again at 2 s, and read `x` at 0, 1, 2 and 3 seconds. We got 200, 0, 200 and 200. With `fromTo("#box", { x: 200 }, { x: 0 })` for both calls, we got 200, 0, 200 and 0.

## FAQ

**How do I export a GSAP animation as a video?**
Create the timeline with `paused: true`, expose `window.seek = (t) => { tl.time(t); }` and render each frame with a headless browser. Join the screenshots with ffmpeg. The script above does this.

**Does the ticker matter if the timeline is paused?**
A paused timeline does not move on the ticker, so only your seek call moves it. In the Puppeteer test above, 0 of 30 frames differed between two passes.

**Do ScrollTrigger and `delayedCall` work in a render?**
We did not test them. Both depend on scroll position or on the real clock, so drive the same effect from the timeline instead.

For the page rules that vawe checks, read [render HTML to video: the page contract](/blog/page-contract). To render a canvas scene the same way, read [Three.js to MP4](/blog/threejs-to-mp4).
