---
title: "CSS text animation: 5 kinetic typography effects"
description: "Five kinetic text effects in plain CSS, each with code and a 2 s clip: stagger, wave, scale punch, mask reveal and tracking."
date: 2026-10-19
updated: 2026-10-19
section: how-to
topic: motion
docs: kinetic-type, text-and-fonts
tags: "kinetic typography, css animation, text animation, motion graphics"
keywords: "kinetic typography css, kinetic typography javascript, text animation css, css letter animation, text animation video"
---

CSS text animation needs no library, and kinetic typography is the same thing: text that moves with the beat. Split the text into one `<span>` for each letter, set a delay with a custom property, and let `@keyframes` do the rest. This post gives five effects as plain HTML and CSS: stagger, wave, scale punch, mask reveal and tracking. Each one has a clip we rendered from the code shown.

Every example uses the same setup. A dark page, white bold text, centred. The setup is the first block. Each section after it shows only the lines that make the effect.

```css
body { margin: 0; height: 100vh; display: grid; place-items: center;
       background: #0b0d12; color: #f4f6fb; font: 800 140px/1 system-ui, sans-serif; }
```

## 1. Stagger: letters rise one by one

Each letter starts 45 ms after the one before it. That gap is short enough to read as one word and long enough to see each letter land.

```html
<h1 aria-label="staggered"><span style="--i:0">s</span><span style="--i:1">t</span>…</h1>
```

```css
h1 span { display: inline-block; animation: rise 0.55s var(--ease-land) both;
          animation-delay: calc(0.1s + var(--i) * 45ms); }
@keyframes rise { from { transform: translateY(0.6em); opacity: 0 } to { transform: none; opacity: 1 } }
```

<figure>
<video src="/blog/kinetic-typography-css/stagger.mp4" poster="/blog/kinetic-typography-css/stagger.webp" muted loop playsinline controls></video>
<figcaption>Stagger: 45 ms between letters.</figcaption>
</figure>

Use `inline-block`: a transform does not move an inline box. The `--i` values come from your build step or from a script that splits the text.

## 2. Wave: a ripple that does not stop

Every letter moves up and down on the same curve. A negative delay spreads the letters across the cycle, so the loop starts mid-wave and no letter waits.

```css
h1 span { display: inline-block; animation: wave 0.9s ease-in-out infinite alternate;
          animation-delay: calc(var(--i) * -90ms); }
@keyframes wave { from { transform: translateY(-0.12em) } to { transform: translateY(0.12em) } }
```

<figure>
<video src="/blog/kinetic-typography-css/wave.mp4" poster="/blog/kinetic-typography-css/wave.webp" muted loop playsinline controls></video>
<figcaption>Wave: 90 ms of phase between letters.</figcaption>
</figure>

## 3. Scale punch: one word hits the screen

The word starts at 1.4 times its size and settles to 1. The curve `cubic-bezier(.3,1.5,.5,1)` goes past 1 on the way, so the word recoils.

```css
h1 { font-size: 220px; animation: punch 0.7s cubic-bezier(.3,1.5,.5,1) 0.2s both; }
@keyframes punch { from { transform: scale(1.4); opacity: 0 } 25% { opacity: 1 } to { transform: scale(1) } }
```

<figure>
<video src="/blog/kinetic-typography-css/punch.mp4" poster="/blog/kinetic-typography-css/punch.webp" muted loop playsinline controls></video>
<figcaption>Scale punch: 1.4 times down to 1 in 0.7 s.</figcaption>
</figure>

## 4. Mask reveal: a line rises from under an edge

A box with `overflow: hidden` hides the line. The text moves up from below the box edge. Give the box padding at the top and bottom, or it will cut the tails of letters like g and y.

```html
<div class="line"><span>masked reveal</span></div>
```

```css
.line { overflow: hidden; padding: 0.1em 0.2em 0.2em; }
.line span { display: block; animation: up 0.7s var(--ease-land) 0.2s both; }
@keyframes up { from { transform: translateY(110%) } to { transform: none } }
```

<figure>
<video src="/blog/kinetic-typography-css/mask.mp4" poster="/blog/kinetic-typography-css/mask.webp" muted loop playsinline controls></video>
<figcaption>Mask reveal: the line rises into view.</figcaption>
</figure>

## 5. Tracking: letters close in from wide spacing

The letters start far apart and blurred. They close up to normal spacing and sharpen. Tight final spacing (here -0.02 em) suits large text.

```css
h1 { font-size: 120px; animation: collapse 1.1s var(--ease-land) 0.2s both; }
@keyframes collapse {
  from { letter-spacing: 0.5em; opacity: 0; filter: blur(12px) }
  to   { letter-spacing: -0.02em; opacity: 1; filter: blur(0) }
}
```

<figure>
<video src="/blog/kinetic-typography-css/tracking.mp4" poster="/blog/kinetic-typography-css/tracking.webp" muted loop playsinline controls></video>
<figcaption>Tracking: 0.5 em down to -0.02 em.</figcaption>
</figure>

## From a CSS effect to a video file

We rendered the five clips with the script from [export a CSS animation as a video file](/blog/css-animation-to-video). Each is 2 seconds at 30 fps, 1280 by 720 pixels, and 17 to 32 KB. We looked at the frames of each clip before we wrote the text above.

vawe ships the same effects as copyable files in the [video components library](/video-components): [per-letter stagger](/video-components/letter-stagger), [scale punch](/video-components/scale-punch), [mask rise](/video-components/mask-rise), [tracking collapse](/video-components/tracking-collapse) and [variable weight wave](/video-components/variable-weight-wave). Each video component file has the snippet, the notes and a sound cue. To see how a page becomes a film, read [render HTML to MP4 with headless Chrome](/blog/render-html-to-mp4).

## FAQ

**How do I animate text letter by letter in CSS?**
Wrap each letter in a `<span>` with `display: inline-block`. Give each span a custom property such as `--i`, and set `animation-delay: calc(var(--i) * 45ms)`.

**Do I need JavaScript for kinetic typography?**
Not to animate. You need something to split the text into spans: a build step, a template or a few lines of script. The animation itself is CSS.

**Why does my masked text lose the bottom of its letters?**
The mask box is too tight. Add padding at the top and bottom of the box. The tails of g, j, p, q and y reach below the baseline.

**What delay between letters looks right?**
We use 45 ms for a stagger. Below about 30 ms the letters seem to land together. Above about 80 ms the word reads as slow typing.

**Can I export these effects as a video?**
Yes. Pause the animations, set the time for each frame and encode the screenshots. The linked post has a script that does this.
