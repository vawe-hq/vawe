---
title: "Programmatic video: 6 JavaScript tools compared"
description: "Remotion, Revideo, Motion Canvas, HyperFrames, vawe and ffmpeg scripts compared on language, determinism, agent use, license and hosting."
date: 2026-10-19
updated: 2026-10-19
section: how-to
nav: "Programmatic video"
topic: how-to
docs: video-from-code, faq
tags: "programmatic video, javascript, remotion, revideo, motion canvas, hyperframes"
keywords: "programmatic video javascript, video from code, create video in node.js, remotion vs revideo, programmatic video generation"
---

To make programmatic video in JavaScript, you write code that describes each frame, and a renderer turns the frames into an MP4. Six tools do this in different ways: Remotion, Revideo, Motion Canvas, HyperFrames, vawe, and a plain Puppeteer and ffmpeg script. This post compares them and says when each one is the better pick.

## How we compared

We read the README and the docs of each project. We list a fact only when a page states it. When we could not confirm a fact, we left it out, and the last section names those gaps.

We ran two of the six: the Puppeteer script and vawe. We did not install or run Remotion, Revideo, Motion Canvas or HyperFrames. Everything we say about them comes from their own pages, so it describes what they document, not what we measured.

## Language and how a frame is made

| Tool | What you write | How a frame is made |
| --- | --- | --- |
| Remotion | React components | A component is a function of the frame number from `useCurrentFrame()` |
| Revideo | TypeScript scenes, each a generator function | `renderVideo()` renders a project to a file |
| Motion Canvas | TypeScript generator functions, plus an editor | The editor plays the animation and saves each frame as an image |
| HyperFrames | HTML with data attributes | The engine computes `time = floor(frame) / fps` and seeks every animation in headless Chrome |
| vawe | One HTML page: CSS, Web Animations, SVG, canvas, three.js | Headless Chrome seeks the page and takes a screenshot of each frame |
| Puppeteer and ffmpeg | Any HTML page, plus a script of about 20 lines | The script sets `currentTime` on each animation and pipes screenshots to ffmpeg |

Remotion, Revideo and Motion Canvas ask you to learn their model. HyperFrames, vawe and the script keep you in HTML, and the page is the film.

## Determinism: what happens to the real clock

Determinism means the same input gives the same frames. The tools differ in how they treat `Date.now()`, timers and `Math.random()`.

- Remotion: a component reads the frame number, so the frame is a function of that number. This is how its docs define a frame.
- HyperFrames: its docs forbid `Date.now()`, `requestAnimationFrame`, system timers and unseeded `Math.random()` in a composition. It states that the same input gives the same output.
- vawe: a page may call them. A virtual clock replaces `Date`, timers, `requestAnimationFrame` and `Math.random` before any page script runs, and each follows the seek time. [The six drift sources we fixed](/blog/determinism) show how we tested it.
- Puppeteer and ffmpeg: the script moves only CSS animations and Web Animations. A `setTimeout` or `requestAnimationFrame` loop still follows the real clock, so a page that uses one can give a different video on each run.
- Revideo and Motion Canvas: the pages we read do not state a determinism rule, so we make no claim.

## Agent use, license and hosting

| Tool | Agent use | License | Hosting |
| --- | --- | --- | --- |
| Remotion | Agent Skills: `npx skills add remotion-dev/skills` | Free for an individual, a non-profit, evaluation, and a for-profit company with up to 3 employees; a Company License above that | Node, or AWS Lambda, which splits a render across functions |
| Revideo | README: "a scene is plain TypeScript, so Claude or Codex can produce one from a prompt" | MIT | Runs where Node and a headless browser run, with a Google Cloud Run example; can split a render across workers |
| Motion Canvas | No agent docs on the pages we read | MIT | Not confirmed |
| HyperFrames | 21 skills and a router skill | Apache-2.0 | Local, AWS Lambda, Google Cloud Run and HeyGen cloud rendering |
| vawe | `bin/vawe` CLI and skills | Apache-2.0 | Your own machine; no distributed rendering |
| Puppeteer and ffmpeg | Any agent can write the script | Your code; Puppeteer and ffmpeg keep their own licenses | Any machine with Node, Chrome and ffmpeg |

Read 2026-10-16 for Remotion, Revideo, Motion Canvas and HyperFrames. Sources: the repos `remotion-dev/remotion`, `redotvideo/revideo`, `motion-canvas/motion-canvas` and `heygen-com/hyperframes`. We also read the Remotion `LICENSE.md` and Lambda docs, the Motion Canvas rendering docs and the HyperFrames determinism page. The HyperFrames render targets Google Cloud Run and HeyGen cloud are from the page we read on 2026-10-03. The vawe facts come from this repo.

## When each tool is the better pick

- Remotion: pick it if your team writes React and wants video in the same model. It also fits you if you need to render many videos in parallel on AWS Lambda. Check the license first if your company has more than 3 employees. More in [vawe vs Remotion](/vs/remotion) and [Remotion alternatives](/remotion-alternatives).
- Revideo: pick it if you want TypeScript scenes and a render API you can host yourself, under MIT. More in [vawe vs Revideo](/vs/revideo).
- Motion Canvas: pick it for vector animation and diagrams with a live editor. Its docs describe it as a tool to make informative vector animations and sync them with voice-overs. Its default output is an image sequence, and an FFmpeg exporter makes a video. The docs call the exporter relatively new. More in [vawe vs Motion Canvas](/vs/motion-canvas).
- HyperFrames: pick it if you want a block catalog, a Studio editor, or cloud rendering. More in [vawe vs HyperFrames](/vs/hyperframes) and [HyperFrames alternatives](/hyperframes-alternatives).
- vawe: pick it if you want ordinary web code to keep working. It has no new model to learn and no company-size limit in its license. Pick another tool if you need cloud rendering or a timeline editor.
- Puppeteer and ffmpeg: pick it for a short, simple page that uses only CSS animation. It has no dependency beyond Chrome and ffmpeg.

## A small example you can run

Save this page as `page.html`:

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

Save this script as `render.mjs`. Install Puppeteer first, and check that ffmpeg is on your path:

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

Run `node render.mjs page.html 3 30`. We ran it on 2026-10-16. The result was `out.mp4`: 1280 by 720 pixels, 3.0 seconds, 90 frames.

For the vawe version of the same page, with the install steps and a draft command, read [render HTML to MP4 with headless Chrome](/blog/render-html-to-mp4). For the page rules, read [the vawe page format](/blog/page-contract).

## What we left out

- Render speed for any tool. No project we read publishes a number we can compare, and we did not measure the four tools we did not run.
- Revideo's way of making a frame (browser, ffmpeg or both) and its determinism rule. The pages we read did not state them.
- Motion Canvas hosting and agent support. We found no statement on the pages we read.
- Price. Remotion lists prices for company licenses, but we did not verify them today, so we give none.

For when byte-identical output decides the choice, read [when determinism matters](/when-determinism-matters).

If you are choosing a tool for an AI agent to drive, read [Claude Code with Remotion or plain HTML](/blog/claude-code-remotion-or-html).

## FAQ

**Can I make a video with JavaScript only?**
Yes. Write the frames as code, render them in headless Chrome or a canvas, and encode with ffmpeg. Each tool above does some form of this.

**Which is the best programmatic video tool for React developers?**
Remotion, because its model is React components. It is free for a for-profit company with up to 3 employees and needs a Company License above that.

**Which tools are free for a company with more than 3 employees?**
Revideo and Motion Canvas are MIT, and HyperFrames and vawe are Apache-2.0. Remotion needs a paid Company License at that size.

**How do I stop a programmatic video from changing between renders?**
Stop the page clock. Set the time of each frame yourself, and keep `Date.now()`, timers and `Math.random()` off the real clock. HyperFrames forbids those calls, and vawe replaces them.

**Can an AI agent write the video?**
Yes. An agent can write code for any of them. Remotion, HyperFrames and vawe ship agent skills, and Revideo's README says Claude or Codex can write a scene from a prompt.
