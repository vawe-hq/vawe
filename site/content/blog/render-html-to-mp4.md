---
title: "HTML to MP4: render a page with headless Chrome"
description: "Render an HTML page to MP4 with a 20-line Puppeteer script or with vawe. Both seek every frame, so a busy machine cannot drop one."
date: 2026-10-16
updated: 2026-10-16
section: how-to
topic: rendering
docs: video-from-code, html-to-mp4-with-claude-code, determinism
featured: true
featuredOrder: 1
tags: "html to mp4, puppeteer, headless chrome, css animation to video, ffmpeg"
keywords: "render html to mp4, css animation to video, puppeteer record animation, headless chrome video frames, html to video"
---

To render an HTML page to MP4, pause the page, set the time, take a screenshot for each frame and join the frames with ffmpeg. This post shows two ways: a Puppeteer script of 20 lines, and one `vawe` command. Both run on your machine. Neither needs a screen recorder.

## Convert HTML to MP4 without a converter site

Converter sites take a URL and record it in real time. You cannot check what they do to the frames. Here you run the script on your own machine and on your own page, and each frame is exact.

## Why a screen recorder is the wrong tool

A screen recorder films the page while it plays. The page runs in real time, so a busy machine can skip a frame. The next run then gives a different file.

The fix is to stop the page clock. You pause every animation. You move it to the time of frame 0 and take a screenshot. Then you move it to the time of frame 1, and so on. At the end, ffmpeg joins the screenshots into a video. The speed of your machine no longer matters, because the page never plays.

## Option 1: a Puppeteer script

Install Puppeteer and check that ffmpeg is on your path. Save this page as `page.html`:

```html
<!doctype html>
<style>
  body { margin: 0; background: #0b0d12; color: #f4f6fb; font: 700 64px system-ui; }
  h1 { position: absolute; left: 8%; top: 40%; margin: 0;
       animation: rise 0.6s var(--ease-land) both 0.4s; }
  @keyframes rise { from { transform: translateY(40px); opacity: 0 } to { transform: none; opacity: 1 } }
</style>
<h1>one page, one film</h1>
```

Save this script as `render.mjs`:

```js
import puppeteer from "puppeteer";
import { spawn } from "node:child_process";

const [, , file, seconds = "3", fps = "30"] = process.argv;
const frames = Math.round(Number(seconds) * Number(fps));

const browser = await puppeteer.launch();
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720 });
await page.goto(`file://${process.cwd()}/${file}`);
await page.evaluate(() => document.getAnimations().forEach((a) => a.pause()));

const ffmpeg = spawn("ffmpeg", ["-y", "-f", "image2pipe", "-framerate", fps, "-i", "-",
  "-pix_fmt", "yuv420p", "-c:v", "libx264", "out.mp4"], { stdio: ["pipe", "inherit", "inherit"] });

for (let i = 0; i < frames; i++) {
  const ms = (i / Number(fps)) * 1000;
  await page.evaluate((t) => document.getAnimations().forEach((a) => (a.currentTime = t)), ms);
  ffmpeg.stdin.write(await page.screenshot({ type: "png" }));
}
ffmpeg.stdin.end();
await new Promise((r) => ffmpeg.on("close", r));
await browser.close();
```

Run `node render.mjs page.html 3 30`. We ran it. The result was `out.mp4`: 1280 by 720 pixels, 3.0 seconds, 90 frames, 23 KB. The whole run took 6.4 seconds.

<figure>
<video src="/blog/render-html-to-mp4/script-output.mp4" poster="/blog/render-html-to-mp4/script-output.webp" muted loop playsinline controls></video>
<figcaption>The file the script wrote: the title rises into place at 0.4 s.</figcaption>
</figure>

The script moves every CSS animation and every Web Animation with `currentTime`. It does not control anything else. A `setTimeout`, a `requestAnimationFrame` loop, `Date.now()` or `Math.random()` still follows the real clock. A page that uses them gives a different video on each run.

## Option 2: vawe

vawe is an open-source renderer that does the same seek loop and also owns the clock. Before your scripts run, it replaces `Date`, `performance.now`, `requestAnimationFrame`, the timers and `Math.random`. All of them now follow the seek time.

Install it. You need Node 22 or newer, git and ffmpeg:

```bash
git clone https://github.com/vawe-hq/vawe.git
cd vawe && npm install
bin/vawe-dev doctor
```

`bin/vawe-dev doctor` names each missing tool and prints the install line for your system. Then write a page. This is the same page as above, with a duration and a `data-world` attribute on the beat (a beat is one scene of the film):

```html
<!doctype html>
<meta name="duration" content="3">
<style>
  body { margin: 0; background: #0b0d12; color: #f4f6fb; font: 700 calc(var(--vh) * 0.08) system-ui; }
  h1 { position: absolute; left: 8%; top: 40%; animation: rise 0.6s var(--ease-land) both 0.4s; }
  @keyframes rise { from { transform: translateY(40px); opacity: 0 } to { transform: none; opacity: 1 } }
</style>
<h1 data-world="title">one page, one film</h1>
```

Save it as `films/hello/page.html` and run:

```bash
bin/vawe dev films/hello/page.html
```

The draft is `out/hello-draft.mp4`. Our run made 90 frames at 30 fps, 960 by 540 pixels and 120 KB. The whole command took 5.7 seconds, and it also printed advice about the page. A draft is half size and has no sound. The command `bin/vawe ship` makes the full-size 60 fps file with sound, after you approve the draft.

## What we found

The same seek loop breaks in small ways. We rendered one page with an SVG filter twice, with no change to the page or the machine. In a shared Chrome, 70 of 216 frames came out different. We fixed the causes one at a time, and the checklist is in [headless Chrome screenshots differ between runs](/blog/determinism).

Three rules keep a page safe to render:

1. Use CSS keyframes or `element.animate()` for motion. The renderer can seek them.
2. If you draw with canvas or three.js, define `window.seek(t)` and paint frame `t` as a pure function of `t`.
3. Do not read the real clock. Do not call `Math.random()` without a seed, unless you use vawe, which seeds it for you.

The full rules are in [the vawe page format](/blog/page-contract). To add sound, read [set a loudness target in code](/blog/audio-as-written). The step list for vawe is in the [quickstart](/docs/quickstart).

## FAQ

**How do I convert HTML to MP4?**
Open the page in headless Chrome, pause its animations and set the time for each frame. Take a screenshot of each frame and give the frames to ffmpeg. The script above does this in about 20 lines.

**Can I render HTML to MP4 without a screen recorder?**
Yes. Pause the page, set the time, take a screenshot for each frame, and join the frames with ffmpeg. The script above does this.

**Does the script work with JavaScript animation?**
Only if the animation is a Web Animation, or if you drive it yourself from the frame time. A `requestAnimationFrame` loop runs on the real clock, so the script cannot seek it. vawe replaces that clock.

**Will two machines give the same file?**
Not always. Output can differ between hosts that rasterise on a different GPU or Chrome version. On one machine, the same page gives the same frames on every run.

**How long does a render take?**
Our 3-second page took 6.4 seconds with the script and 5.7 seconds with `vawe dev`. Time grows with the frame count and the size of each frame.

**Which tools do I need?**
Node, ffmpeg and Chrome. Puppeteer downloads Chrome. vawe also needs git for the install.
