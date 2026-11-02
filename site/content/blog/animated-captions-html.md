---
title: "Animated captions in HTML: word by word, rendered to MP4"
description: "Make animated word-by-word captions with plain HTML and CSS, then render them to an MP4 with vawe. One table of times, no React, code that ran."
date: 2026-11-03
updated: 2026-11-03
section: how-to
topic: motion
docs: kinetic-type, text-and-fonts, time-and-seek
tags: "animated captions html, word by word captions, karaoke captions css, tiktok captions, html to mp4"
keywords: "animated captions html, word by word captions css, tiktok style captions code, karaoke text animation css, captions to mp4"
hero: /moves/caption-karaoke.hd.webp
heroAlt: "A caption frame from the caption-karaoke move: white words, with the word being spoken in solid yellow."
---

You can make animated captions with plain HTML and CSS: wrap each word in a `<span>`, give each span a start time, and animate the colour with one `@keyframes` rule. A renderer then seeks the page frame by frame and writes an MP4. This post has a page that we rendered, so every line of it ran.

![A caption frame from the caption-karaoke move: white words, with the word being spoken in solid yellow.](/moves/caption-karaoke.hd.webp)

## Why plain HTML

Word-by-word captions, the TikTok and Reels kind, are a timing table and a text effect. A framework is more than the job needs. The browser already lays out text, wraps lines and loads fonts. CSS already animates colour, scale and position.

The one thing missing is a renderer that moves time by hand. A browser plays an animation against the wall clock, so a screen recording follows how fast the machine ran that day. [vawe](https://github.com/vawe-hq/vawe) seeks each animation to the exact frame time. The page needs no JavaScript at all.

## The page

This is a 9:16 page, 5 seconds long, with nine words. Each span has a `--at` value, the second the word is spoken:

```html
<!doctype html>
<html data-aspect="9:16">
<head>
<meta charset="utf-8">
<meta name="duration" content="5">
<meta name="aspect" content="9:16">
<meta name="message" content="captions are spans with a delay">
<title>Captions</title>
<style>
  html, body { margin: 0; height: 100%; background: #10131a; overflow: clip; }
  .world { position: absolute; inset: 0; display: grid; place-content: center; padding: 0 8vw; font-family: system-ui, sans-serif; }
  .line { display: flex; flex-wrap: wrap; gap: 0 0.3em; justify-content: center; font-size: 9vw; font-weight: 800; line-height: 1.25; color: #f4f6fb; }
  .w { display: inline-block; animation: say 0.4s var(--at) both cubic-bezier(.2,.9,.3,1.3); }
  @keyframes say {
    0%   { color: #5b6578; opacity: 0.4; transform: translateY(0.25em) scale(0.9); }
    35%  { color: #ffd23f; opacity: 1; transform: none; }
    75%  { color: #ffd23f; }
    100% { color: #f4f6fb; opacity: 1; transform: none; }
  }
</style>
</head>
<body>
<div class="world" data-world="caption">
  <p class="line">
    <span class="w" style="--at:0.3s">Plain</span>
    <span class="w" style="--at:0.8s">HTML</span>
    <span class="w" style="--at:1.3s">makes</span>
    <span class="w" style="--at:1.8s">every</span>
    <span class="w" style="--at:2.3s">word</span>
    <span class="w" style="--at:2.8s">land</span>
    <span class="w" style="--at:3.3s">on</span>
    <span class="w" style="--at:3.6s">its</span>
    <span class="w" style="--at:4.0s">beat</span>
  </p>
</div>
</body>
</html>
```

Save it as `films/captions/page.html` and render a draft:

```bash
bin/vawe dev films/captions/page.html --whole --small
```

We ran this and got a 5 second MP4 with 150 frames at 540 by 960 pixels. The draft is half size. Run `bin/vawe ship` for the full size at 60 fps.

## How the effect works

The `say` keyframes have four stops. Before its start time, a word waits at the first stop: grey, small and low. This is the `both` fill mode, which holds the first keyframe during the delay. The word then pops up and turns yellow. At 75% it holds yellow, and at 100% it settles to white.

That gives the karaoke look with one rule. The spoken word is the bright one, and the words already said stay white. The words still to come stay dim, so the viewer can read ahead.

We looked at nine frames of the render, from 0 to 4.97 s. At 1.33 s only "makes" is yellow, "Plain" and "HTML" are white, and the other six are dim. At 2.83 s "land" is yellow and the first five are white. At 4.97 s all nine are white.

## Change the timing

Every number is a literal in the page. To retime a word, change its `--at`. To change the look, edit the keyframes. You can read the times from a transcript file: one line of a script turns `word start` pairs into spans. The renderer does not care how the spans were made.

For a voice track, put an `<audio>` tag in the page with a `src` and a `data-at`. The mix is rendered offline with the film, so the words and the voice share one clock. See [audio in the page](/blog/audio-as-written) for the tag.

Two tips from this page:

- Let the spans wrap. The `flex-wrap` line breaks by itself, and no word moves when another word animates, because each span keeps its box. The transform does not change layout.
- Keep the text large. The vertical formats have a small safe area. Our caption is 9vw, which is 97 pixels on a 1080 pixel wide frame.

## A ready-made move

The vawe moves library has two caption clips. [Caption karaoke](/video-components/caption-karaoke) turns the spoken word solid yellow on its second. [Caption editorial](/video-components/caption-editorial) is a quieter style. Caption karaoke uses one table of `[word, second]` pairs and a `vawe.onFrame` hook, and you can copy it. The page above uses only CSS. Pick CSS for a short line, and the hook when you want to compute the state from a table.

For text that moves as an effect and not as a subtitle, read [kinetic typography in CSS](/blog/kinetic-typography-css). For the vertical format, see [9:16 video from HTML](/docs/vertical-social). To post it, check [video specs by platform](/docs/platforms).

## FAQ

**How do I make animated captions in HTML?**
Wrap each word in a span with a start time as a CSS variable. Animate colour and transform with one `@keyframes` rule that uses `animation-delay: var(--at)`.

**Can I make TikTok style captions without React?**
Yes. The page above has no framework and no script. The renderer does the timing.

**How do I get the word times?**
From the transcript of your audio, with any speech-to-text tool that gives word timestamps. Paste them in as `--at` values. We do not produce the transcript for you.

**Do captions follow a voice track?**
They follow the times you write. Put the voice in an `<audio>` tag, and the film mixes it on the same clock.

**Can I burn in captions on an existing video?**
This post covers captions in a page that vawe films. It does not burn subtitles into camera footage.
