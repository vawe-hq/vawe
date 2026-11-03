---
title: "CSS motion blur for video: blend 1 to 32 subframes"
description: "Add motion blur to an HTML animation by blending 1 to 32 subframes per frame, set by measured travel. A 5 s film took 4,017 subframes."
date: 2026-10-09
updated: 2026-10-16
section: motion-sound
topic: motion
docs: motion-blur, lens-and-effects
tags: "motion blur, subframes, ffmpeg, headless chrome, rendering"
keywords: "css motion blur video, motion blur html animation, subframe motion blur, 180 degree shutter, ffmpeg frame blend"
hero: /blog/motion-blur/hero.webp
heroAlt: "Schematic: three subframes of a fast circle show as three separate ghosts, eight subframes overlap into one streak."
---

A browser has no shutter, so CSS cannot give an animation real motion blur in a video. To get it, capture several subframes for each output frame and blend them. We pick the count for each frame from how far things move in that frame. Neighbouring subframes sit at most 3 px apart, so a fast frame gets up to 32 subframes and a still frame gets one.

This post covers how we choose the count, how the blend works and what it costs. It also covers one encode bug that dropped frames. The renderer is [vawe](https://github.com/vawe-hq/vawe), where every subframe is a screenshot.

<figure>

![Schematic of 3 subframes showing ghost copies against 8 subframes forming a streak](/blog/motion-blur/hero.webp)

<figcaption>A schematic of the failure and the fix. Positions are drawn for clarity, not taken from a render.</figcaption>

</figure>

## Why a fixed subframe count fails

Our first blur used one count for every frame. On a fast move, 3 subframes show 3 separate objects, because neighbouring copies sit far apart. On a slow move or a held frame, the same count wastes capture time, because the copies are identical.

Capture is the expensive part of a render. Each subframe is a seek, a settle (fonts, image decode, two paints) and a screenshot. Each frame should get what its own motion needs.

## How many subframes a frame needs

The rule is `subframesForTravel` in `harness/media/render-page.mjs`:

- The blur spans half the frame interval, a 180 degree shutter (`SHUTTER = 0.5`).
- Neighbouring subframes sit at most 3 px apart (`STEP_PX = 3`).
- Start at one subframe. Double the count while `travel * 0.5 / k` is above 3, up to a cap.

A target in pixels reads better than "16 samples", because it does not depend on the scene. This table shows the count for 48 px of travel in one frame, a swept distance of 24 px:

| Subframes | Gap between neighbours |
|---|---|
| 1 | 24 px |
| 2 | 12 px |
| 4 | 6 px |
| 8 | 3 px (chosen) |

A frame with 4 px of travel stays at one subframe, with a 2 px gap.

You can run the rule yourself. Call the function from a checkout of vawe:

```js
import { subframesForTravel, SHUTTER } from './harness/media/render-page.mjs';

for (const travel of [4, 12, 48, 200]) {
  const k = subframesForTravel(travel, 32);
  console.log(`travel ${travel} px: ${k} subframes, gap ${(travel * SHUTTER / k).toFixed(1)} px`);
}
```

On our machine it printed:

```
travel 4 px: 1 subframes, gap 2.0 px
travel 12 px: 2 subframes, gap 3.0 px
travel 48 px: 8 subframes, gap 3.0 px
travel 200 px: 32 subframes, gap 3.1 px
```

## Where the travel number comes from

It comes from the page, before any screenshot. A pre-pass reads the bounding boxes of paused animations at consecutive frame times. It takes the largest move or resize over all animated elements.

If the page cannot give boxes, a cheaper pixel estimate sorts frames into bands by mean luma difference. A still frame gets 1 subframe, a medium frame gets up to 4, and a fast frame gets up to 16.

## How the subframes blend

Counts are powers of two, and the renderer run-length encodes them before capture. The ffmpeg filter graph then has one trim, tmix and select chain for each run of equal counts, all in one ffmpeg process. If the counts alternate so often that the graph would pass 200 segments, the renderer falls back to one uniform count.

## When a subframe skips its screenshot

After a seek, the page reports whether anything still pending can change the pixels: timers, animation frame callbacks, canvas, video or SMIL. If nothing can, two subframes with the same animation state paint the same pixels. The second one reuses the first capture. A held frame costs one screenshot, however many subframes it asks for. The pending count comes from the [virtual clock](/blog/page-clock), which owns timers and `requestAnimationFrame`.

## What a cap of 16 or 32 costs

The pixel estimate cannot tell a frame that needs 32 subframes from one that needs 16, so its fast band stops at 16. A code comment records the measurement for a 5 s three.js film: 4,017 subframes at a cap of 16 and 7,805 at 32. That is a drop of about 49%.

![Bar chart: 4,017 subframes with the fast band capped at 16 and 7,805 with a cap of 32](/blog/motion-blur/subframes.webp "Subframes of one 5 s film, cap 16 against cap 32.")

We have not compared the two renders side by side for quality. We cannot claim that the cap of 16 looks the same on every film.

A final that asks for more than 8,000 subframes prints advice. It gives the count, an estimate in minutes (1,000 subframes a minute) and the `--blur` option that lowers the cap. One measurement stands behind the estimate: 19,200 subframes took 15 to 23 minutes.

## Try it on a short window

Render half a second of the example film with a blur cap of 16 and print the cost table:

```bash
node harness/media/render-page.mjs films/examples/colour-sting/page.html blur.mp4 --from 2.5 --dur 0.5 --blur 16 --profile
```

On our machine this made 15 frames from 216 subframes and 216 screenshots, with 0 reused. Capture took 19.3 s, which is 89 ms a screenshot. The `--profile` table lists frames, subframes, screenshots and capture seconds for each second of film. It shows which second of a film is expensive.

## What can go wrong in the encode

Frames can vanish. The renderer encodes the blended frames as segments, and each segment restarts its timestamps. A one-frame segment carries no duration, so the next segment overlaps it. With `-r` set to the frame rate, ffmpeg rate-converted the stream and dropped the overlapped frames: 7 to 24 frames in 6 seconds. Films came out short and drifted away from their audio, which is how we noticed.

The fix re-stamps the timestamps after the concat with `setpts=N/fps/TB` and uses `-fps_mode passthrough`, so ffmpeg never rate-converts. A pixel-format change in the middle of a sequence caused a similar loss. It is in the [x264 preset benchmark](/blog/fast-drafts). Count your frames after you encode.

## Limits

We have not measured the quality cost of the cap of 16. The minutes estimate comes from one measurement. The tests are `tests/media/render-blur-travel.test.mjs` and `tests/media/render-reuse.test.mjs`.

The [smear stretch](/video-components/smear-stretch) video component is a fast motion to try this on. For the command-line options, see the [CLI docs](/docs/cli). The loop that spends these subframes is in [speed up Puppeteer screenshots](/blog/fast-drafts).

## FAQ

**Can CSS do real motion blur on a video?**
No. A browser has no shutter. You capture several subframes for each output frame and blend them, which is what a camera shutter does.

**How many subframes does motion blur need?**
Enough that neighbouring subframes sit at most 3 px apart across half the frame interval. A 48 px move needs 8 subframes. A 4 px move needs 1.

**What shutter angle does vawe use?**
180 degrees. The blur spans half of the frame interval (`SHUTTER = 0.5`).

**Why does my blurred video lose frames?**
Segment timestamps can overlap, and ffmpeg then rate-converts and drops frames. Re-stamp the timestamps after the concat and use `-fps_mode passthrough`.
