---
title: "x264 preset fast vs medium: speed and size tested"
description: "On a dark ramp, x264 preset fast is 25% faster than medium for a 15% larger file. Plus dither strength and 10-bit AV1 results."
date: 2026-10-11
updated: 2026-10-16
section: rendering
topic: rendering
docs: render-flags, ship
tags: "x264, av1, ffmpeg, encoding, banding, dither"
keywords: "x264 preset comparison, x264 fast vs medium, ffmpeg dither banding, ffmpeg banding dark gradient, av1 10 bit web copy"
hero: /blog/encode/hero.webp
heroAlt: "Pipeline: captured frames are blended in one ffmpeg pass, dithered and encoded with x264 preset fast as the master, then encoded again as a 10-bit AV1 web copy."
---

x264 preset fast encoded our master 25% faster than preset medium. It made a 15% larger file and landed 49 dB PSNR away from it. Preset faster was about twice as quick again, and we rejected it because it banded: a 54 px flat run on a dark ramp.

This benchmark covers that trade. It also covers three more encode decisions from [vawe](https://github.com/vawe-hq/vawe): dither strength, a 10-bit AV1 web copy and a 2 MB size budget for gallery clips. Encoding is the last step of our headless Chrome pipeline. A final captures lossless PNG frames, blends the subframes for [motion blur](/blog/motion-blur), and encodes them.

<figure>

![Encode pipeline: lossless frames, one x264 master with dither, and a separate 10-bit AV1 web copy](/blog/encode/hero.webp)

</figure>

## Setup

- Input for banding: a dark ramp. 8-bit x264 shows visible steps on a dark ramp, so it is the worst case for this encoder. The ramp in `tests/media/render-banding.test.mjs` is 960x540, dithered as Chrome paints it.
- Input for the web copy: the ramp plus two 5-second films.
- Master settings under test: CRF 16 with `aq-mode=3`. That setting spends bits on dark flat areas, where 8-bit video bands.
- Drafts are out of scope. They use ultrafast at CRF 20 and skip the dither, so draft pixels stay comparable from run to run.

## Method: the longest flat run

One number judged banding: the longest flat run, in pixels, on the dark ramp. A flat run is a band you can see. The test averages 64 rows and finds the longest run of pixels that round to one quarter luma step. We compared presets on three axes at once: time, file size and PSNR against medium.

## What we found

| Decision | What we measured |
| --- | --- |
| x264 preset fast against medium | 25% faster, 15% larger, 49 dB PSNR apart |
| Preset faster | About 2x quicker, 54 px flat run, rejected |
| Dither strength 3 with `aq-mode=3` | 20 px longest flat run, half the size of strength 4 with `-tune film` |
| Dither strength 2 | Did not survive x264's smoothing on a test gradient |
| AV1 10-bit web copy | 1.7 and 3.6 MB for two 5 s films, 20 px flat run |
| x264 8-bit at the same size (CRF 22) | 121 px flat run |
| Undithered 8-bit | 98 px flat run |
| Lossless source | 14 px flat run |
| Clip budget | 2 MB, CRF raised in steps of 3 from 16, capped at 31 |

![Bar chart of the longest flat run on a dark ramp in pixels: lossless 14, AV1 10-bit 20, x264 dithered 20, preset faster 54, undithered 8-bit 98, x264 CRF 22 121](/blog/encode/flat-run.webp "Longest flat run on a dark ramp, in pixels. Lower is better.")

We took the values from the comments in `render-page.mjs` and from the banding test.

## The master: preset fast with seeded dither

The master uses preset fast. Before the encode, the final adds noise with `noise=alls=3:allf=t:all_seed=7`, which is dithering. The seed never changes. So the same frames always give the same master.

## The web copy: 10-bit AV1 instead of dither

For the copy that the site serves, we skipped dither and used a 10-bit encode, which does not band. After the master, a second pass encodes an AV1 web copy with SVT-AV1 at CRF 30, preset 8, in 10-bit `yuv420p10le`, with no dither.

The extra encode does not add to the wait. The render reports the mp4 as soon as the mux of the master ends. The ship job then starts the reviewer on it while the web copy encodes.

## The gallery: a 2 MB budget per clip

Every video component on the [video components gallery](/video-components) has a clip. Each clip has a budget of 2 MB. The render encodes at CRF 16. If the file is over budget, the render encodes again at CRF 19, 22, and so on up to 31. It keeps the first file that fits (`chooseCrf` in `harness/lib/clip-budget.mjs`). The winning CRF goes into `clips.lock.json` beside the source hash. A reader can then see how far the CRF rose for each clip.

## A bug the benchmark found: dropped frames

Chromium saves some frames as RGBA, for example when the page uses `mix-blend-mode`. When the pixel format changes in the middle of a frame sequence, ffmpeg rebuilds its filter graph. That resets the trims and drops frames with no error. The encode now keeps one pixel format through the whole sequence, so every frame survives. Count your frames after you encode.

## Run the preset comparison yourself

This script makes a 2 s dark ramp at 1080p and 60 fps. It encodes the ramp at three presets with the master settings. It prints time, size and PSNR against medium:

```js
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

const ff = (...args) => spawnSync('ffmpeg', ['-v', 'info', '-y', ...args], { encoding: 'utf8' });

ff('-f', 'lavfi', '-i', 'color=c=black:s=1920x1080:r=60:d=2',
  '-vf', "format=rgb24,geq=r='trunc(11+17*X/W+random(0))':g='trunc(16+21*X/W+random(1))':b='trunc(32+40*X/W+random(2))'",
  '-c:v', 'ffv1', 'ramp.mkv');

const rows = {};
for (const preset of ['medium', 'fast', 'faster']) {
  const start = performance.now();
  ff('-i', 'ramp.mkv', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', preset, '-crf', '16', '-x264-params', 'aq-mode=3', `${preset}.mp4`);
  rows[preset] = { seconds: (performance.now() - start) / 1000, bytes: fs.statSync(`${preset}.mp4`).size };
}

for (const [preset, r] of Object.entries(rows)) {
  const psnr = ff('-i', `${preset}.mp4`, '-i', 'medium.mp4', '-lavfi', 'psnr', '-f', 'null', '-').stderr.match(/average:(\S+)/)[1];
  console.log(preset.padEnd(7), r.seconds.toFixed(2) + ' s', (r.bytes / 1e6).toFixed(2) + ' MB', 'PSNR against medium', psnr);
}
```

On one run on our machine (ffmpeg 8.0) it printed:

```
medium  3.94 s 0.31 MB PSNR against medium inf
fast    3.68 s 0.44 MB PSNR against medium 58.942306
faster  3.51 s 0.45 MB PSNR against medium 57.586709
```

These numbers do not match the table. Fast was 7% faster and 42% larger here, and faster was not twice as quick. The reason is the content: this ramp is pure noise over 120 frames, and our films are not. The ratios depend on your frames, so run the comparison on your own dark content before you copy ours.

## What these numbers do not show

We did not measure absolute encode seconds for the preset change, only the ratio. The banding numbers come from one synthetic ramp and two short films.

## Reproduce the banding test

- The encoder arguments are in `harness/media/render-page.mjs`: `x264Args`, `WEB_ARGS`, `DITHER` and `ffmpegWebEncode`.
- Run `node --test tests/media/render-banding.test.mjs`. On our machine it passed in 3.0 s.

Capture time, which comes before all of this, is in [speed up Puppeteer screenshots](/blog/fast-drafts). For a comparison with other render tools, see [Remotion alternatives](/remotion-alternatives).

## FAQ

**Is x264 preset fast or medium better for video from code?**
In our test, fast encoded 25% faster than medium and made a 15% larger file, 49 dB PSNR apart. Pick fast when render time matters more than file size.

**How do I stop banding in dark gradients with ffmpeg?**
Add seeded noise before the encode, such as `noise=alls=3:allf=t:all_seed=7`, and use x264 with `aq-mode=3`. On a dark ramp this cut the longest flat run from 98 px to 20 px.

**Does 10-bit AV1 fix banding without dither?**
In our test, yes. A 10-bit AV1 copy had a 20 px flat run with no dither, against 121 px for 8-bit x264 at the same size.

**Why do my ffmpeg frame counts come out short?**
A pixel format change in the middle of a sequence makes ffmpeg rebuild its filter graph and drop frames with no error. Keep one pixel format through the whole encode.
