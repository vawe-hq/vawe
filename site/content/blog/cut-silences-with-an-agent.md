---
title: "Remove silences from video with an AI agent"
description: "An agent finds silences from the word times in a transcript, turns each gap into a cut, and renders the result. Rows, trims and HTML included."
date: 2026-11-09
updated: 2026-11-09
section: how-to
topic: how-to
docs: time-and-seek, the-page
tags: "remove silences from video, ai video editing, cut silence, agentic video editing, jump cut"
keywords: "remove silences from video ai agent, cut silence from video automatically, remove pauses from video, ai jump cut, claude code video editing"
---

To remove silences from a video with an AI agent, the agent reads the word times in the clip’s transcript, finds each gap longer than 0.5 seconds, and keeps only the spans that hold speech. Each kept span becomes one trimmed clip in a page that [vawe](https://github.com/vawe-hq/vawe) renders to MP4. This post walks through the steps.

## Where the gaps come from

Run this once for your clips:

```bash
bin/vawe new talk --footage ~/clips/talk.mov
```

vawe writes `films/talk/footage.md` and, next to each clip, a file of word times, here `films/talk/footage/talk.words.json`. whisper.cpp makes it on your machine, with no API key. Each entry has a word and its start and end in seconds. The pieces are described in [how an agent reads footage](/blog/how-an-agent-reads-footage).

Here is a short run of it:

```json
[
  { "word": "so", "start": 0.42, "end": 0.58 },
  { "word": "today", "start": 0.58, "end": 0.96 },
  { "word": "I", "start": 1.02, "end": 1.12 },
  { "word": "show", "start": 1.38, "end": 1.62 },
  { "word": "this", "start": 2.28, "end": 2.50 },
  { "word": "is", "start": 2.50, "end": 2.62 },
  { "word": "it", "start": 4.10, "end": 4.22 },
  { "word": "takes", "start": 4.22, "end": 4.60 },
  { "word": "a", "start": 4.60, "end": 4.68 },
  { "word": "minute", "start": 4.68, "end": 5.50 }
]
```

(The words and times are an example.)

## The rule

The template for an edit sets this default: keep speech whole and cut silence over 0.5 seconds. The agent applies it to the list:

1. Take each pair of neighbouring words. The gap is the start of the next word minus the end of the first.
2. If the gap is over 0.5 seconds, it is a silence. Cut it.
3. Group the words between two silences into one span. The span starts at its first word’s start and ends at its last word’s end.

In the example, the gaps are 0.00 (so, today), 0.06 (today, I), 0.26 (I, show), 0.66 (show, this), 0.00, then 1.48 (is, it). Only two are over 0.5 s: the 0.66 s gap and the 1.48 s gap. "so", "today", "I" and "show" stay in one span, because the 0.26 s gap is shorter than the limit.

Cutting on word ends also keeps each word whole. A cut inside a word is the first thing a viewer hears.

The agent also checks the start and the end of the clip. A silence before the first word and after the last one is a gap too, and the trim drops it.

## From gaps to Cut list rows

Each span is a row in the brief’s Cut list. `in` and `out` are source seconds:

```
| world | clip | in | out | rate | why |
| --- | --- | --- | --- | --- | --- |
| s2 | talk | 0.42 | 1.62 | 1 | "so today I show", ends on the word end |
| s3 | talk | 2.28 | 2.62 | 1 | "this is", gap before it was 0.66 s |
| s4 | talk | 4.10 | 5.50 | 1 | "it takes a minute", gap before it was 1.48 s |
```

The agent can also merge spans that the rule split too finely. The second row holds a clip for 0.34 seconds, and the template says a clip held under 1.2 seconds reads as a flash. So the agent joins the first two rows into one span from 0.42 to 2.62, and keeps the 0.66 s gap inside it. The rule is a default, and the Cut list’s `why` column is where the agent writes the reason for each choice.

## From rows to trimmed clips

In the page, each row becomes a `<video>` in its own `data-world` beat. `data-at` is where the clip starts in the film, and each start is the sum of the lengths before it:

```html
<section data-world="s2">
  <video src="footage/talk.mp4" data-at="0" data-trim="0.42" data-trim-end="2.62" data-rate="1"></video>
</section>
<section data-world="s3">
  <video src="footage/talk.mp4" data-at="2.2" data-trim="4.10" data-trim-end="5.50" data-rate="1"></video>
</section>
```

The first clip is 2.20 seconds long, so the second one starts at 2.2. The film is 3.6 seconds long, from 5.5 seconds of source, and the long silence is gone. Both clips use the same file. The engine seeks the video to `trim + (t - at) * rate` on every frame, so a cut lands on an exact frame.

The sound follows the picture. A clip’s own audio joins the mix between its trim points, so the speech stays in sync with the face.

## Check the cut

Render a draft:

```bash
bin/vawe dev films/talk/page.html
```

Then look at the cuts, since a number can be right and a cut can still feel wrong. `bin/vawe frame films/talk/page.html --cuts` writes a frame at each cut. Move the `in` and `out` seconds in the Cut list and in the page, and render again. To keep a breath at the start of a span, move `data-trim` earlier by a few hundredths of a second.

## What vawe does not do

vawe has no filler-word detector. It will not find "um" or "you know" for you. The agent can read a filler in the transcript and cut it on its word times, as any other span, but the choice is the agent’s and yours. The same goes for a bad take: nothing scores it.

Other parts of an edit work on the same word times: [captions](/blog/animated-captions-html), titles and the order of clips. See [agentic video editing](/agentic-video-editing) for the scope, and [edit video with Claude Code](/edit-video-with-claude-code) for the steps in your agent.

## FAQ

**Can an AI agent remove silences from a video?**
Yes. It reads the word times, finds gaps over a limit and trims each span of speech into its own clip.

**What is the silence limit?**
The edit template’s default is to cut silence over 0.5 seconds. The agent can change it for a slow talk or a fast one.

**Does it cut inside words?**
No. A span starts at a word start and ends at a word end.

**Does it send my video to an API?**
No. The transcript comes from whisper.cpp on your machine.
