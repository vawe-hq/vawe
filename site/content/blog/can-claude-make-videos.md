---
title: "Can Claude make videos? Yes, if the video is code"
description: "Can Claude make videos? Yes: Claude Code writes one HTML page and a renderer films it into an MP4. The commands, a page that rendered, and the limits."
date: 2026-11-03
updated: 2026-11-03
section: how-to
topic: agents
docs: html-to-mp4-with-claude-code, agents, quickstart
tags: "can claude make videos, claude code, ai video, html to mp4, vawe"
keywords: "can claude make videos, can claude create videos, can ai make videos from code, claude code video, claude make mp4"
hero: /blog/make-video-claude-code/colour-sting.webp
heroAlt: "A frame from colour-sting, a 5 second film that Claude Code made from one HTML page."
---

Yes, Claude can make a video, but it does not paint the frames. Claude writes text and code, so it writes an HTML page that describes the film, and a renderer opens the page in headless Chrome and records every frame into an MP4. The film is code that a person can read, change and render again.

![A frame from colour-sting, a 5 second film that Claude Code made from one HTML page.](/blog/make-video-claude-code/colour-sting.webp)

## What "make a video" means here

There are two ways an AI can make a video. A video model generates pixels from a prompt. You cannot edit one number in the result, and the same prompt gives a different clip each time. The other way is to write code, and the code draws the frames.

Claude does the second. Ask Claude for a chart and it writes the code that draws the bars. A film works the same way, with a clock added.

Both ways make real MP4 files. They suit different jobs. Code suits motion graphics: titles, product screens, charts, logos, captions, launch films and explainers. A video model suits footage of a person walking down a street. This post covers the first kind.

## What you need

Claude in a chat window cannot render a film by itself, because it has no shell. You need an agent that can write files and run commands. Claude Code does both. You also need a renderer.

We use [vawe](https://github.com/vawe-hq/vawe), a framework that renders one HTML page into one film. You need Node 22 or later, git, ffmpeg and the Chrome that puppeteer downloads. The check is one command:

```bash
npm install
bin/vawe doctor
```

Claude Code reads `CLAUDE.md` when it starts in the repository, and that file imports `AGENTS.md`, so it already knows the page contract. To use the skills outside the repository, run `npx skills add vawe-hq/skills` or read [use vawe with an agent](/docs/agents).

## The page Claude writes

You ask in one sentence: "make a 4 second title card that says Hello, video". Claude writes a page like this one. We rendered it, so the code below ran:

```html
<!doctype html>
<html data-aspect="16:9">
<head>
<meta charset="utf-8">
<meta name="duration" content="4">
<meta name="message" content="Claude can write the video, a renderer films it">
<title>Hello</title>
<style>
  html, body { margin: 0; height: 100%; background: #0b0d12; overflow: clip; }
  .world { position: absolute; inset: 0; display: grid; place-content: center; gap: 2vh; justify-items: center; font-family: system-ui, sans-serif; color: #f4f6fb; }
  h1 { margin: 0; font-size: 12vh; letter-spacing: -0.03em; animation: rise 1s cubic-bezier(.2,.8,.2,1) both; }
  p { margin: 0; font-size: 4vh; color: #8fa3c8; animation: rise 1s 0.5s cubic-bezier(.2,.8,.2,1) both; }
  @keyframes rise { from { opacity: 0; transform: translateY(6vh); } to { opacity: 1; transform: none; } }
</style>
</head>
<body>
<div class="world" data-world="hello">
  <h1>Hello, video</h1>
  <p>one HTML page, one film</p>
</div>
</body>
</html>
```

There is no video format to learn. The motion is a CSS `@keyframes` rule, which Claude has written many times before. The vawe parts are a `duration` meta tag and one `data-world` element per beat. The renderer sets the animation clock for each frame, so the page needs no timer.

## The commands

The loop has five commands. Claude runs them, and you can run them too:

```bash
bin/vawe new hello --request "4 second title card that says Hello, video"
bin/vawe dev films/hello/page.html --whole --small
bin/vawe frame films/hello/page.html --at 2
bin/vawe critique films/hello/page.html
bin/vawe ship films/hello/page.html
```

`new` asks for the facts the request leaves out, such as the subject and the ending, then writes `page.html` and `brief.md`. Add `--defaults` for an unattended run that guesses them. We cover those questions in [make a video with Claude Code](/blog/make-video-claude-code).

`dev` renders a draft at half size and 30 fps. On our test page above, a 4 second draft took 9.6 seconds, with 120 frames at 960 by 540 pixels. `frame` prints one still so Claude can look at the result. `critique` is for a fresh session that did not write the page, because the writer misses faults the reader sees. `ship` renders the 60 fps final.

## Limits

- A person approves the final. `ship` refuses until a fresh review is done and the person types `/vawe-approve`. Claude cannot approve its own film.
- The first draft is plain. Our test page works but makes a weak film. Looking at frames, fixing and critiquing improves it.
- It does not cut camera footage. It makes motion graphics from web code.
- Sound is limited. A page can mix your audio files with `<audio>` tags. Claude does not record a voice for you.
- It runs on your machine. There is no cloud rendering, so a long film takes the time your laptop needs.
- It needs an agent with a shell. A chat window without one can write the page, and you then render it yourself.

## Does the same page give the same video?

Yes. The renderer seeks the page to each frame time and does not play it, so a busy machine does not drop frames. A virtual clock replaces `Date`, timers and `Math.random`. [Why the same page gives the same frames](/blog/determinism) lists the six sources of drift we fixed. For the capture pipeline, see [render HTML to MP4 with headless Chrome](/blog/render-html-to-mp4).

If you want to know why a page and not a JSON scene file, read [JSON video format vs HTML: a blind test](/blog/html-over-json). The short format of the page is in [the page contract](/blog/page-contract).

## FAQ

**Can Claude make a video from a prompt?**
Yes, through code. Claude Code writes an HTML page from your prompt and a renderer turns the page into an MP4. Claude does not generate the pixels itself.

**Can the Claude chat app make an MP4?**
Not on its own. It can write the page, but rendering needs a shell with Node, ffmpeg and puppeteer's Chrome. Claude Code has the shell.

**Can ChatGPT or another model do the same?**
Any agent that writes files and runs commands can follow the same loop. The page is plain HTML, so no model needs to learn a private format.

**How long does a draft take?**
Our 4 second test page rendered in 9.6 seconds on a laptop. A film with video, blur and many layers takes longer.

**Is it free?**
vawe is open source and runs on your machine. See the [quickstart](/docs/quickstart) to install it.
