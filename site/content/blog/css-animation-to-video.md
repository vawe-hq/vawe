---
title: "CSS animation to video: export an MP4 or WebM"
description: "Turn a CSS keyframe or Web Animation into an MP4 or WebM. Pause, seek, capture and encode. Covers SVG and canvas too."
date: 2026-10-19
updated: 2026-10-19
section: how-to
topic: how-to
docs: time-and-seek, the-page, html-to-mp4-with-claude-code
tags: "css animation to mp4, webm, svg animation, canvas animation, puppeteer"
keywords: "export css animation as video, css animation to mp4, svg animation to video, canvas animation export mp4, css animation to webm"
---

To export a CSS animation as a video, pause the animation, set its time, take a screenshot and repeat for every frame. Then encode the screenshots with ffmpeg. The script below does this for CSS keyframes, Web Animations, SVG animation and canvas, and writes an MP4 or a WebM.

## The idea in one paragraph

A browser plays an animation against the clock. A screen recorder films that playback, so it records whatever the machine managed to draw. Seeking is different. You tell the page "it is now 0.5 seconds", and the page draws exactly that moment. You do this once for each frame, so the output does not depend on the speed of your machine.

## The script

Save it as `capture.mjs`. It needs Node, Puppeteer and ffmpeg.

```js
import puppeteer from "puppeteer";
import { spawn } from "node:child_process";

const [, , file, out = "out.mp4", seconds = "3", fps = "30"] = process.argv;
const frames = Math.round(Number(seconds) * Number(fps));
const codec = out.endsWith(".webm")
  ? ["-c:v", "libvpx-vp9", "-pix_fmt", "yuv420p", "-b:v", "0", "-crf", "32"]
  : ["-c:v", "libx264", "-pix_fmt", "yuv420p"];

const browser = await puppeteer.launch();
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720 });
await page.goto(`file://${process.cwd()}/${file}`);
await page.evaluate(() => document.fonts.ready);

const ffmpeg = spawn("ffmpeg", ["-y", "-f", "image2pipe", "-framerate", fps, "-i", "-", ...codec, out],
  { stdio: ["pipe", "inherit", "inherit"] });

for (let i = 0; i < frames; i++) {
  const t = i / Number(fps);
  await page.evaluate((t) => {
    document.getAnimations().forEach((a) => { a.pause(); a.currentTime = t * 1000; });
    document.querySelectorAll("svg").forEach((s) => { s.pauseAnimations(); s.setCurrentTime(t); });
    if (window.seek) window.seek(t);
  }, t);
  ffmpeg.stdin.write(await page.screenshot({ type: "png" }));
}
ffmpeg.stdin.end();
await new Promise((r) => ffmpeg.on("close", r));
await browser.close();
```

Run `node capture.mjs page.html out.mp4 3 30` for an MP4. Run `node capture.mjs page.html out.webm 3 30` for a WebM. The last two numbers are the length in seconds and the frame rate.

## One page with three kinds of animation

We wrote one page with three animations. A CSS keyframe moves a bar. A SMIL `<animate>` tag moves an SVG circle. A function called `window.seek(t)` draws a canvas circle:

```html
<!doctype html>
<style>
  body { margin: 0; background: #0b0d12; }
  .bar { position: absolute; left: 80px; top: 80px; width: 200px; height: 60px; background: #3291ff;
         animation: slide 2s ease-in-out infinite alternate; }
  @keyframes slide { to { transform: translateX(600px) } }
  svg { position: absolute; left: 80px; top: 200px; }
  canvas { position: absolute; left: 700px; top: 200px; }
</style>
<div class="bar"></div>
<svg width="400" height="200" viewBox="0 0 400 200">
  <circle cy="100" r="30" fill="#f4f6fb">
    <animate attributeName="cx" from="40" to="360" dur="2s" repeatCount="indefinite" />
  </circle>
</svg>
<canvas id="c" width="400" height="200"></canvas>
<script>
  const ctx = document.getElementById("c").getContext("2d");
  window.seek = (t) => {
    ctx.clearRect(0, 0, 400, 200);
    ctx.fillStyle = "#f4f6fb";
    ctx.beginPath();
    ctx.arc(200 + 120 * Math.cos(t * Math.PI), 100 + 60 * Math.sin(t * Math.PI), 24, 0, 7);
    ctx.fill();
  };
  window.seek(0);
</script>
```

We ran the script on this page. The MP4 has 90 frames, 1280 by 720 pixels, and is 20 KB. The WebM is 23 KB. The run took 5.7 seconds for the MP4 and 6.8 seconds for the WebM. We compared the bar, the SVG circle and the canvas circle at 0.5 s and at 1.5 s, and all three had moved.

<figure>
<video src="/blog/css-animation-to-video/mixed.mp4" poster="/blog/css-animation-to-video/mixed.webp" muted loop playsinline controls></video>
<figcaption>The three animations in the exported MP4.</figcaption>
</figure>

We also ran the script twice and compared the frames of both MP4 files. The hashes were the same.

## How each kind of animation is seeked

| Animation | How the script seeks it |
| --- | --- |
| CSS keyframes, CSS transitions, `element.animate()` | `document.getAnimations()` returns them. Pause each one and set `currentTime` in milliseconds. |
| SVG with SMIL (`<animate>`) | `svg.pauseAnimations()` and `svg.setCurrentTime(seconds)`. |
| Canvas, WebGL, three.js | Define `window.seek(t)` and draw frame `t` from `t` alone. |
| `requestAnimationFrame` loops, `setTimeout`, `Date.now()` | The script cannot seek them. Rewrite them as a `window.seek(t)` function. |

The last row is the one that breaks pages most often. A canvas loop that adds 1 to a counter on every frame has state. A function of `t` has none. Put the state in the formula, and the same `t` gives the same picture.

## Pick MP4 or WebM

MP4 with H.264 plays in most players and on most platforms, so it is the default. WebM with VP9 plays in Chrome, Firefox and Edge. On our test page the WebM was 23 KB and the MP4 was 20 KB, so size does not decide. Pick by where the file must play. Keep `-pix_fmt yuv420p` for both. Without it, ffmpeg writes a `yuv444p` file from PNG input, and many players cannot open it. We checked this: the same frames gave `yuv444p` without the flag and `yuv420p` with it.

For the odd-size error and the frame loop in detail, read [Puppeteer screenshots to MP4 with ffmpeg](/blog/puppeteer-to-mp4). For a renderer that also controls `Date` and `Math.random`, read [render HTML to MP4 with headless Chrome](/blog/render-html-to-mp4).

The SVG and canvas cases each have their own post: [SVG animation to MP4](/blog/svg-animation-to-mp4) and [canvas animation to video](/blog/canvas-to-video).

## FAQ

**How do I export a CSS animation as an MP4?**
Pause every animation with `document.getAnimations()`, set `currentTime` for each frame, take a screenshot and pipe the screenshots into ffmpeg. The script above does this.

**Can I export an SVG animation to video?**
Yes. CSS animation on an SVG element works with the same loop. SMIL animation needs `svg.pauseAnimations()` and `svg.setCurrentTime(t)`, which the script calls.

**Can I export a canvas animation to MP4?**
Yes, if you can draw frame `t` from `t` alone. Put that code in `window.seek(t)`. A canvas loop that keeps state between frames needs a rewrite first.

**Does it keep a transparent background?**
Not in this script. H.264 has no alpha channel. WebM with VP9 can hold alpha, but we did not test that, so we do not claim it.

**Can I export a CSS animation to GIF?**
Yes. Encode the same MP4 with a colour palette: `ffmpeg -i out.mp4 -vf "fps=15,scale=640:-1:flags=lanczos,split[a][b];[a]palettegen[p];[b][p]paletteuse" out.gif`. We ran it on our test clip and got a 640-pixel GIF of 45 frames and 98 KB.

**Why not record the screen?**
A screen recording follows the real clock, so a busy machine drops frames and each run differs. Seeking removes the clock.
