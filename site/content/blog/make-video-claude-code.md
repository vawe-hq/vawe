---
title: "Claude Code video generation: make an MP4 from HTML"
description: "Ask Claude Code for a film, let it write one HTML page, and render it. The prompt, the five questions it asks, and what it gets wrong."
date: 2026-10-16
updated: 2026-10-16
section: how-to
topic: agents
docs: html-to-mp4-with-claude-code, quickstart, agents
featured: true
featuredOrder: 2
tags: "claude code, ai agent video, html to mp4, vawe, agents"
keywords: "make a video with claude code, claude code generate video, ai agent makes videos, coding agent video skill, html to video"
---

You can make a video with Claude Code if the video is one HTML page. Claude Code writes the page, a renderer opens it in headless Chrome, and ffmpeg encodes an MP4. This post shows the prompt, the five questions the tool asks first, and the mistakes an agent makes on its own.

The film below is a 5-second film that an agent made this way. The draft is half size and has no sound.

<figure>
<video src="/blog/make-video-claude-code/colour-sting.mp4" poster="/blog/make-video-claude-code/colour-sting.webp" muted loop playsinline controls></video>
<figcaption>The repo example colour-sting, as a 5 s draft.</figcaption>
</figure>

## Why an agent needs a different tool

A video editor needs a person with a mouse. A coding agent has files and a shell. So we gave it the thing it already writes well: a web page.

The page uses CSS, Web Animations, SVG, canvas or three.js. The agent does not learn a private format. A command called `vawe` renders the page frame by frame. It seeks each frame instead of playing the page, so the same page gives the same frames on every run. The reason is in [how to render HTML to MP4](/blog/render-html-to-mp4).

## Start with the request

Install vawe, then start Claude Code in the repository. Claude Code reads `AGENTS.md` when it starts, so it already knows the page contract. Give it one sentence:

```text
Make a 6 second film that announces version 2.0 of my CLI tool.
Dark background, one big number, a short caption.
```

The agent runs `bin/vawe new <name> --request "<your sentence>"`. We ran that command with this request. It wrote nothing and printed five questions instead.

## The five questions

1. Subject. What is the product, and who is it for?
2. Message. What is the one thing to remember, and what is the one big moment?
3. Show. What must the viewer see working: the product screen, a number or a process?
4. Assets (optional). Which real captures, logo or photos exist?
5. Ending (optional). How does the film end: the brand, a call to action, a URL?

Each question prints a reason and an example. The agent writes the answers to a file and runs the command again with `--answers <file>`. For an unattended run, add `--defaults` and the tool guesses. We explain why we built this gate in [make an AI agent ask questions before it acts](/blog/new-asks).

## From brief to MP4

After the answers, the command writes `films/<name>/page.html` (a valid starter page) and `brief.md`. Then the loop is:

1. `bin/vawe dev films/<name>/page.html` renders a draft at half size and 30 fps, without sound.
2. The agent looks at the frames with `bin/vawe strip` and fixes what reads flat.
3. A fresh Claude Code session runs `bin/vawe critique films/<name>/page.html`. A session that did not write the page sees faults the writer does not.
4. You approve the draft. Then `bin/vawe ship films/<name>/page.html` renders the final at 60 fps with sound.

The step list is in the [HTML to MP4 with Claude Code guide](/docs/html-to-mp4-with-claude-code). The blog does not copy it.

## What the agent gets wrong

We ran a weaker model and a stronger model on the same loop. These are the faults we measured. Each one led to a change in the tools, not in the prompt.

| What happened | Number | Post |
| --- | --- | --- |
| Six films from the weaker model: drafts per film, median | 13 drafts; 0 of 6 passed the review | [AI agent harness: design for the weaker model](/blog/weaker-model) |
| Films that hid a missing hold behind a slow camera drift | 18 of 36 | [Reward hacking in AI agents](/blog/loophole-audit) |
| Flash length in the agent film against the reference | 0.20 s against 0.07 to 0.10 s | [Can AI agents watch video?](/blog/watch-a-film) |

Three habits follow from this table. First, put the rule in the tool and print the fix in the same line. Second, check the result with a number, because an agent that reads five frames cannot judge timing. Third, never let the session that wrote the page also approve it.

## FAQ

**Can Claude Code make a video?**
Yes, if the video is an HTML page. Claude Code writes the page and runs a renderer such as vawe to turn it into an MP4. It cannot edit video on a timeline.

**Which tools does Claude Code need?**
Node 22 or newer, git and ffmpeg. Run `bin/vawe doctor` and it names each missing tool.

**Does the agent need a special skill file?**
No. The repo ships `AGENTS.md`, which Claude Code reads on start. It holds the page contract and the commands.

**Why does the tool ask questions first?**
A thin request gives a generic film. The five questions collect the subject, message, proof and ending before the agent writes anything.

**Can I use another agent?**
Probably. The commands are plain shell, and `AGENTS.md` is a plain file. We ran a weaker and a stronger model through the same commands.
