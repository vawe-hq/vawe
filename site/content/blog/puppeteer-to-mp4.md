---
title: "Puppeteer video: screenshots to MP4 with ffmpeg"
description: "Capture frames with Puppeteer, pipe them into ffmpeg and get an MP4. The frame loop, the pixel format flag and the traps."
date: 2026-10-19
updated: 2026-10-19
section: how-to
nav: "Puppeteer to MP4"
topic: rendering
docs: video-from-code, determinism
tags: "puppeteer, ffmpeg, screenshots to video, headless chrome, mp4"
keywords: "puppeteer screenshots to mp4, puppeteer record animation to mp4, headless chrome render video frames, ffmpeg image2pipe, ffmpeg width not divisible by 2"
---

To turn Puppeteer screenshots into an MP4, take one screenshot for each frame and give the frames to ffmpeg. You can write the frames to PNG files or pipe them into ffmpeg directly. This post shows both, and the two flags that most often fail: the pixel format and the even frame size.

## The frame loop

The loop has three steps for every frame: set the page to a time, take a screenshot, move on. The page must not play in real time. Pause the animations first, then set the time yourself.

Save this page as `page.html`:

```html
<!doctype html>
<style>
  body { margin: 0; background: #0b0d12; color: #f4f6fb; font: 700 64px system-ui; }
  h1 { position: absolute; left: 8%; top: 40%; margin: 0;
       animation: rise 0.6s cubic-bezier(.2,.9,.2,1) both 0.4s; }
  @keyframes rise { from { transform: translateY(40px); opacity: 0 } to { transform: none; opacity: 1 } }
</style>
<h1>one page, one film</h1>
```

## Way 1: ffmpeg images to video from PNG files

This way keeps every frame on disk. You can look at a frame, or re-encode without a new capture. Save this as `frames.mjs`:

```js
import puppeteer from "puppeteer";
import { mkdirSync } from "node:fs";

const [, , file, seconds = "3", fps = "30", w = "1280", h = "720"] = process.argv;
const frames = Math.round(Number(seconds) * Number(fps));
mkdirSync("frames", { recursive: true });

const browser = await puppeteer.launch();
const page = await browser.newPage();
await page.setViewport({ width: Number(w), height: Number(h) });
await page.goto(`file://${process.cwd()}/${file}`);
await page.evaluate(() => document.getAnimations().forEach((a) => a.pause()));

for (let i = 0; i < frames; i++) {
  const ms = (i / Number(fps)) * 1000;
  await page.evaluate((t) => document.getAnimations().forEach((a) => (a.currentTime = t)), ms);
  await page.screenshot({ path: `frames/frame-${String(i).padStart(4, "0")}.png` });
}
await browser.close();
```

Then encode the frames:

```bash
node frames.mjs page.html 3 30
ffmpeg -framerate 30 -i frames/frame-%04d.png -pix_fmt yuv420p -c:v libx264 out.mp4
```

We ran both commands. Capture wrote 90 PNG files (1.9 MB) in 5.7 seconds. ffmpeg encoded them in 0.35 seconds into a 23 KB MP4.

## Way 2: pipe the frames into ffmpeg

The pipe way writes no files. Puppeteer sends each PNG to ffmpeg through `image2pipe`. Save this as `render.mjs`:

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

Run `node render.mjs page.html 3 30`. The result is the same 90 frames, 1280 by 720 pixels, in 6.4 seconds in total. Use the pipe for long films, because 60 seconds at 60 fps would be 3,600 files.

## Trap 1: the pixel format

PNG frames are RGB. If you leave out `-pix_fmt yuv420p`, ffmpeg keeps full colour resolution and writes `yuv444p`. We checked: the same frames gave `yuv444p` without the flag and `yuv420p` with it. Many players, including some phone and browser players, cannot open `yuv444p` H.264. Always set the flag.

## Trap 2: an odd frame size

The H.264 encoder needs an even width and height. We set the viewport to 1281 by 721 and ran the command. ffmpeg stopped with this line and exit code 187:

```text
width not divisible by 2 (1281x721)
```

There are two fixes. Use an even viewport, or add a filter that rounds each side down to an even number:

```bash
ffmpeg -framerate 30 -i frames/frame-%04d.png \
  -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" -pix_fmt yuv420p -c:v libx264 out.mp4
```

With the filter, the 1281 by 721 frames gave a 1280 by 720 file.

## Trap 3: the page still plays on the real clock

The loop above moves CSS animations and Web Animations only. A `setTimeout`, a `requestAnimationFrame` loop, `Date.now()` or `Math.random()` follows the real clock. Two runs then give different frames. The causes and the fixes are in [headless Chrome screenshots differ between runs](/blog/determinism). If you also draw with canvas or SVG, read [export a CSS animation as a video file](/blog/css-animation-to-video).

For a renderer that already handles these traps, see [render HTML to MP4 with headless Chrome](/blog/render-html-to-mp4).

## FAQ

**How do I record a Puppeteer animation to MP4?**
Do not record. Pause the animations, set the time for each frame, take a screenshot and give the frames to ffmpeg. The two scripts above do this.

**Why does ffmpeg say "width not divisible by 2"?**
The H.264 encoder needs even sizes. Make the viewport even, or add the filter `scale=trunc(iw/2)*2:trunc(ih/2)*2`.

**Why does my MP4 not play in some players?**
You probably left out `-pix_fmt yuv420p`. Without it, PNG input becomes `yuv444p`, which many players cannot decode.

**Should I pipe the frames or write PNG files?**
Write files while you build the page, because you can open any frame. Pipe the frames for long renders, because it avoids thousands of files.

**How fast is it?**
Our 90-frame test at 1280 by 720 took 5.7 seconds to capture and 0.35 seconds to encode. Time grows with the frame count and the frame size.
