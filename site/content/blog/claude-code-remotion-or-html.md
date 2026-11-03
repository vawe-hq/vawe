---
title: "Claude Code with Remotion or plain HTML for video?"
description: "Should Claude Code write Remotion or plain HTML to make a video? What our blind test measured (5.9 vs 10.75 minutes), what it did not, and how to choose."
date: 2026-11-03
updated: 2026-11-03
section: agents
topic: agents
docs: html-to-mp4-with-claude-code, video-from-code, agents
tags: "claude code remotion, remotion alternative, html to video, ai agent video, vawe"
keywords: "claude code remotion, remotion vs html, remotion skill alternative, ai agent video framework, claude code video framework"
hero: /blog/html-over-json/hero.webp
heroAlt: "Bar chart. The JSON arm took 10.75 minutes and scored 5 and 4.5 from two judges. The HTML arm took 5.9 minutes and scored 8 and 7.5."
---

If you ask Claude Code for a video, pick Remotion when your team already writes React and wants the video in the same codebase. Pick plain HTML when you want the agent to write what it has always written and keep the page free of a framework. We have no test of Remotion against HTML, so this post says what we did measure, and what that does not show.

![Bar chart. The JSON arm took 10.75 minutes and scored 5 and 4.5 from two judges. The HTML arm took 5.9 minutes and scored 8 and 7.5.](/blog/html-over-json/hero.webp)

## What we measured

On 2026-09-27 we gave one brief, a 6 second kinetic sting, to two fresh agents. One wrote our own JSON scene format. The other wrote one HTML page. Each had 45 minutes and 5 renders. The full test is in [JSON video format vs HTML: a blind test](/blog/html-over-json).

| | JSON scene format | One HTML page |
| --- | --- | --- |
| Time to a film | 10.75 min | 5.9 min |
| Renders used (limit 5) | 4 | 3 |
| Blind judge scores | 5 and 4.5 | 8 and 7.5 |

It was one run per arm. It is a strong signal about where to look and not a rate. About 8 of the 10.75 minutes in the JSON arm went into finding preset names for ideas the agent could already say in words.

## What the test does not show

Remotion was not in the test. The loser was a private format that no model had seen in training. Remotion is not that. It is React, and a model has seen a lot of React. So the numbers above say that a language the agent already knows beats a language it must look up. They do not say that HTML beats React.

We also did not run an agent on Remotion. What we know about it comes from its own repo and docs, which we read on 2026-10-16 for our [comparison of six JavaScript video tools](/blog/programmatic-video-javascript):

- You write React components. A component reads the frame number from `useCurrentFrame()`, so each frame is a function of that number.
- It has Agent Skills, which you add with `npx skills add remotion-dev/skills`.
- It is free for an individual, a non-profit, evaluation, and a for-profit company with up to 3 employees. A larger company needs a Company License.
- It can split a render across AWS Lambda functions.

Check those facts on its site before you rely on them. They are a dated reading and not a promise.

## What the HTML route looks like

The page below is the whole film. It is a 3 second sting: a title that pops in, then a number that counts up. We rendered it with vawe:

```html
<!doctype html>
<html data-aspect="16:9">
<head>
<meta charset="utf-8">
<meta name="duration" content="3">
<meta name="message" content="a title and a count, no framework">
<title>Sting</title>
<style>
  html, body { margin: 0; height: 100%; background: #0b0d12; overflow: clip; }
  .world { position: absolute; inset: 0; display: grid; place-content: center; justify-items: center; font-family: system-ui, sans-serif; color: #f4f6fb; }
  h1 { margin: 0; font-size: 14vh; animation: pop 0.8s cubic-bezier(.2,.9,.3,1.4) both; }
  .n { font-size: 7vh; color: #3291ff; font-variant-numeric: tabular-nums; }
  @keyframes pop { from { opacity: 0; transform: scale(0.8); } to { opacity: 1; transform: none; } }
</style>
</head>
<body>
<div class="world" data-world="sting">
  <h1>Version 2.0</h1>
  <div class="n" id="n">0</div>
</div>
<script>
  window.seek = (t) => {
    const p = Math.min(1, Math.max(0, (t - 0.6) / 1.5));
    document.getElementById("n").textContent = Math.round(2400 * (1 - (1 - p) ** 3)).toLocaleString("en-US") + " commits";
  };
  window.seek(0);
</script>
</body>
</html>
```

The title moves on a CSS keyframe. The number moves in `window.seek(t)`, which paints frame `t` as a function of `t`. The render took 10.3 seconds for the 3 second draft, 90 frames at 960 by 540 pixels:

```bash
bin/vawe dev films/sting/page.html --whole --small
```

An agent needs no new vocabulary for this. It writes CSS it has written before. When something fails, the bug is a web bug, and the agent can search the web for it. The one trap in our blind test was a Web Animations fill rule. It cost 8 minutes, and the answer was ordinary web knowledge.

## How to choose

Choose Remotion if:

- Your team writes React and wants video components next to app components.
- You need many renders in parallel on AWS Lambda.
- You already have Remotion projects and want the agent to continue them.

Choose plain HTML if:

- You want one file that you can open in a browser and read.
- You want no company-size licence question. See the licence note above for Remotion, [vawe vs Remotion](/vs/remotion), and [Remotion alternatives](/remotion-alternatives) for the longer table.
- You want the agent to use CSS, SVG, canvas or three.js directly.

Choose neither if you cut camera footage. That is an editor's job.

HyperFrames is the other tool that writes HTML. Its page uses data attributes for timing, and it has a block catalog. See [vawe vs HyperFrames](/vs/hyperframes) and [HyperFrames alternatives](/hyperframes-alternatives).

## Where the framework still matters

The agent writes the page. The harness around it decides if the film is good: the renderer, the checks and the loop of looking at frames and fixing. We cover the loop in [make a video with Claude Code](/blog/make-video-claude-code). A framework that treats the agent as the author needs defaults and checks at each step. That holds for any tool, Remotion included. Our experience with a weaker model is in [design for the weaker model](/blog/weaker-model).

The page format is small. See [the page contract](/blog/page-contract), and the guide to [HTML to MP4 with Claude Code](/docs/html-to-mp4-with-claude-code).

## FAQ

**Can Claude Code use Remotion?**
Yes. Remotion publishes Agent Skills for it, and a model writes React well. We did not run it, so we have no result for it.

**Is HTML better than Remotion for an AI agent?**
We cannot say. Our test beat a private JSON format with HTML: 5.9 minutes against 10.75, and scores of 8 and 7.5 against 5 and 4.5. Remotion was not in the test.

**Which is better for a team that uses React?**
Remotion. The video lives in the same model as the rest of the app.

**Does plain HTML need a framework to render?**
It needs a renderer that seeks the page frame by frame. vawe is one, and it runs on your machine.

**Is there a Remotion skill alternative for plain HTML?**
Yes: the vawe skills. Add them with `npx skills add vawe-hq/skills`, or read the skill files in the repository. See [use vawe with an agent](/docs/agents).
