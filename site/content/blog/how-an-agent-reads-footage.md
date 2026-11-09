---
title: "How an AI agent edits video it cannot watch"
description: "An agent edits video by reading a text log of each clip: length, shots, loudness and a transcript with word times. Here is that log, field by field."
date: 2026-11-09
updated: 2026-11-09
section: agents
topic: agents
docs: time-and-seek, the-page
tags: "agentic video editing, ai video editing, footage log, whisper.cpp, coding agent"
keywords: "how does an ai agent edit video, ai agent edit video it cannot watch, agentic video editing, transcript word timestamps video editing, edit video with claude code"
---

An AI agent edits video it cannot watch by reading a text description of each clip instead: how long it is, where its shots change, how loud it is, and every spoken word with a start and end time. It then writes the cut as a table of numbers. This post shows that description, field by field, as [vawe](https://github.com/vawe-hq/vawe) writes it.

For the whole workflow, see [agentic video editing](/agentic-video-editing). For the steps in Claude Code, see [edit video with Claude Code](/edit-video-with-claude-code).

## Start with one command

```bash
bin/vawe new my-edit --footage ~/clips
```

This copies each clip into `films/my-edit/footage/` as an MP4 that a page can seek exactly. It writes `films/my-edit/footage.md`, and it fills a Cut list in the brief. Everything runs on your machine. The transcript comes from whisper.cpp, so it needs no API key.

## What footage.md holds

The file opens with one table row per clip:

```
| slug | seconds | fps | size | audio | loudness |
| --- | --- | --- | --- | --- | --- |
| intro | 14.20 | 30 | 1920x1080 | yes | -19.4 LUFS, peak -2.1 dBFS |
| street | 8.50 | 29.97 | 1080x1920 | no | - |
```

Then each clip gets its own section:

```
## intro

Shots (hard cuts only): 1. 0.00-6.30 s; 2. 6.30-14.20 s

Contact sheet: out/my-edit-footage-intro.png

Transcript (word times in footage/intro.words.json): so today I want to show you how fast this is it takes under a minute
```

The numbers in these examples are made up. The fields are the real ones. Here is what each one gives the agent.

- **slug, seconds, fps, size.** The clip’s name in the page (`footage/intro.mp4`), its length, its frame rate and its pixel size. A clip taller than wide is a portrait clip, and the page keeps it uncropped.
- **audio and loudness.** Whether the clip has sound, and how loud it is in LUFS. The agent can read it when it sets `data-gain` to bring two clips to one level.
- **Shots.** The seconds where a hard cut happens inside the clip. A dissolve is not listed, and the file says so: "hard cuts only". The agent learns where the footage already changes scene.
- **Contact sheet.** A picture of eight frames, evenly spaced. This is the one place the agent looks at pixels.
- **Transcript.** The spoken words, in order, with no times.

The times are in a second file. Next to each clip, `footage/intro.words.json` lists every word with its start and end in seconds:

```json
[
  { "word": "so", "start": 0.42, "end": 0.58 },
  { "word": "today", "start": 0.58, "end": 0.96 }
]
```

whisper.cpp writes these times for the clip’s sound. Sounds it labels as music or silence, such as `[MUSIC]`, are dropped. A clip with no sound gets no transcript section. If whisper.cpp or its model is missing, `footage.md` says what to install, and the rest of the file still works.

## Why text beats frames

A model can read a picture, but one clip at 30 frames per second is 900 pictures every 30 seconds. Looking at all of them costs a lot and tells the agent little about timing. A cut needs a second, to the hundredth.

Text gives the agent that second directly. "minute" ends at 5.50 is a fact it can use. "Somewhere near the middle of the picture" is not. The transcript also says where a sentence ends, so the agent never cuts a word in half. That is the first thing a viewer hears.

The contact sheet still earns its place. The agent reads eight frames to learn what the clip shows, then uses the text to decide where to cut.

## How the Cut list follows

The brief has a table with one row per beat of the film:

```
| world | clip | in | out | rate | why |
| --- | --- | --- | --- | --- | --- |
| s2 | intro | 0.42 | 2.62 | 1 | the hook, ends on the word "is" |
```

`in` and `out` are source seconds, and `rate` is speed. The agent fills `why` with the reason for the cut, so a person can read the plan before any render. The default is to cut on an action or on a word end, and to hold each clip for 1.2 seconds or more.

The page then repeats the row as attributes on a `<video>` inside its `data-world` beat:

```html
<section data-world="s2">
  <video src="footage/intro.mp4" data-at="0" data-trim="0.42" data-trim-end="2.62" data-rate="1"></video>
</section>
```

`data-at` is the second the clip starts in the film. `data-trim` and `data-trim-end` are the source seconds to keep. At film time t, the page shows source second `trim + (t - at) * rate`, held at the first or last frame outside the range. The engine seeks the video on every frame, and the page never plays it.

So the agent never needs to watch anything. It reads text, writes numbers, and renders the result. Then it looks at frames from the render to check the cuts, as in any vawe film.

## What this cannot do

Footage processing is out of scope. There is no tracking, no rotoscoping, no depth cut and no generated video. A clip is moved whole: trimmed, ordered, sped up or slowed, framed with titles and captions, graded and joined with transitions. Music comes only from a file you give. The full list is on the [hub page](/agentic-video-editing).

For one job that this log makes easy, see [cutting silences with an agent](/blog/cut-silences-with-an-agent).

## FAQ

**Can an AI watch video?**
Some models can look at frames. vawe does not depend on that. It gives the agent text and one contact sheet per clip.

**Does it need an API key?**
No. The transcript comes from whisper.cpp on your machine. You install `whisper-cpp` and download one model file.

**Which clip formats work?**
`.mp4`, `.mov`, `.m4v`, `.webm` and `.mkv`. Each is re-encoded to an MP4 proxy that seeks exactly.

**Are the word times exact?**
They are whisper.cpp’s own times. The agent cuts on a word end, and you check the cut on the draft.
