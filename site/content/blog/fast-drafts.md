---
title: "Puppeteer screenshot slow? Speed up headless Chrome"
description: "JPEG quality 92, GPU compositing, one Chrome per lane (140 s to 47 s) and a reaper for orphan processes. What helped and what we undid."
date: 2026-10-10
updated: 2026-10-16
section: rendering
topic: rendering
docs: draft, render-flags
tags: "headless chrome, puppeteer, screenshots, jpeg, gpu compositing, performance"
keywords: "puppeteer screenshot speed, speed up puppeteer screenshots, headless chrome parallel screenshots, too many chrome processes, puppeteer concurrency"
hero: /blog/fast-drafts/hero.webp
heroAlt: "Table comparing the draft path and the final path: JPEG against lossless PNG, GPU against software compositing, slices sized to the work against fixed 60-frame slices, x264 ultrafast against preset fast."
---

A video render that takes one Puppeteer screenshot per frame spends most of its time in the screenshot. Capture of one 20 s film fell from 140 s to 47 s when we gave each worker its own headless Chrome. JPEG capture, GPU compositing and a decode fix made drafts cheaper too.

This post lists each change in [vawe](https://github.com/vawe-hq/vawe), what it gained and how to check it. It also lists the two changes we partly took back. A draft is the inner loop of an agent: edit the page, render a few seconds, look, repeat. The final render keeps slower settings.

<figure>

![Table comparing the draft path and the final path](/blog/fast-drafts/hero.webp)

</figure>

## What we found

| Change | Test | Result |
| --- | --- | --- |
| One Chrome per worker | Capture of one 20 s film | 140 s to 47 s (about 3x) |
| Decode screenshots with `Buffer` | Quiet machine, then a loaded one | 11% faster, then about 40% faster |
| GPU compositing for drafts | Half-size draft | 1.5x faster, about 44 dB PSNR from a final |
| JPEG quality 92 for drafts | `colour-sting` example | About 73 KB a frame |
| Cap at 4 lanes | `tracking-hud` under load 21 | 2.5, 4.7, 6.4 and 7.0 shots per second at 1, 2, 4 and 6 lanes |
| Time-aware test limits | `make e2e` | About 175 s to 4.3 s (three pages in the tree) |

The first row comes from one film on one machine. We did not sweep film types or core counts.

## Measure before you tune

You cannot pick a fix until you know where the time goes. We first gave drafts the final's settings at half size: lossless PNG, software compositing and fixed slices. That is correct and slow.

`harness/dev/bench-capture.mjs` runs one render per child process, so every run reads its environment fresh. It prints one JSON line with per-subframe timings for the seek, the settle, the screenshot call and the file write. It has two switches, GPU compositing and a browser per worker, so you can measure each alone.

## Make each worker own a Chrome

Before this change, our four workers acted as one. They shared a browser, and every screenshot, page open and page close went through one queue. More cores gave a longer line.

A final now opens one Chrome per worker. Each worker takes slices from the shared list and closes its browser when the list is empty. Inside a worker there is no queue. The code is `openLane` in `harness/media/render-page.mjs`. A page outside the repo root falls back to the shared browser, and drafts keep the shared browser.

Two earlier changes made the speed number fair. A final always cuts slices of 60 frames, so `--workers` changes the speed and never the pixels. Focus emulation makes every tab paint as the focused one. Both are on the [determinism checklist](/blog/determinism).

![Capture time 140 s with one shared Chrome and 47 s with one Chrome per lane; Buffer decode 11% faster on a quiet machine and about 40% faster under load.](/blog/chrome-per-lane/chart.webp "Capture time of one 20 s film.")

## Decode screenshots with Buffer

With real parallelism, a new cost appeared. Puppeteer decoded the base64 payload of `page.screenshot` with a per-character `Uint8Array.from`, on the one Node thread that all workers share. We decode with `Buffer` instead, and the bytes are identical.

To see the gap, decode 1 MB of base64 both ways. On our machine, `Uint8Array.from(atob(s), c => c.charCodeAt(0))` took 70.7 ms and `Buffer.from(s, 'base64')` took 0.3 ms. In the renderer, the change made capture 11% faster on a quiet machine and about 40% faster under load.

## Use JPEG and GPU compositing in drafts only

A draft does not need lossless frames. It captures JPEG at quality 92 with `optimizeForSpeed` (`DRAFT_JPEG_QUALITY`). A final stays lossless PNG.

GPU compositing was 1.5 times faster at half size, and a draft's pixels differ from a final's by about 44 dB PSNR. A final keeps GPU compositing off. About 150 rapid seek-and-screenshot round trips crashed the GPU compositor there. Do not use `--disable-gpu` for this, because it also breaks WebGL context creation. Use the compositing flags in `pageArgs`.

A draft also sizes its slices to the work (`sliceFramesFor`). It splits the frames evenly over the workers, with a floor of 15 frames, so a short window keeps every worker busy. A preview daemon keeps one warm Chrome between drafts. The time line prints the mode, such as `capture 18.0 s (draft: jpeg, gpu)`, so nobody compares a JPEG draft with a PNG final.

## What we took back

### SVG filters

GPU compositing painted an SVG filter in two states at random, and 70 of 216 frames differed between two renders. A page that draws an SVG filter now composites in software. That costs a draft about 2.5 times as much, and only those pages pay it.

### WebGL downscale

Chrome's own downscale of a WebGL page gave different pixels on each run. Drafts now capture at full size, and ffmpeg shrinks the frames. The reason is in [lay out big, capture small](/blog/drafts-lie).

## Cap Chrome on a shared machine

On 2026-09-26, more than ten agents ran at once, with 18 Chrome processes and a load average near 18. The machine overheated and throttled. Our first fix only counted the other renders and lowered each worker count. Ten renders at two workers each is still twenty Chromes.

The working fix has four parts:

1. Render slots: A slot is a file `slot-<i>.json`, made with an exclusive create. It holds the pid, the start time and the kind. The default is 2 slots, set by `VAWE_RENDER_SLOTS`. A render without a slot waits and prints the holder and its age.
2. A slot for drafts: A final may not take the last free slot, so slot 1 stays free for a draft. In one session, a draft waited up to 357 seconds behind finals before this rule.
3. A lane count from free resources: the lane count is the smallest of four numbers (`harness/lib/lane-budget.mjs`). They are cores minus 1, free memory divided by 1,500 MB, free process slots divided by 12, and 4. The 1,500 MB is one measurement: a software-composited 1080p Chrome used about 1.5 GB resident and 7 processes while idle.
4. A reaper: Every Chrome that the harness starts writes a file named after its pid, with its owner's pid inside. At the next launch, the renderer kills the Chromes whose owner is dead. A killed render leaves no Chrome behind.

The cap of 4 is from the `tracking-hud` run: a sixth lane adds under 10% for 1.3 GB more memory. When another render holds a slot, a new render starts at 2 workers. `VAWE_WORKERS` overrides both.

![Bar chart of shots per second: 2.5 at 1 lane, 4.7 at 2, 6.4 at 4, 7.0 at 6](/blog/slots-reaper/lanes.webp "Shots per second by lane count.")

To test the cap, start three renders at once. Two run, and the third prints the holder. Then kill a render with `SIGKILL` and start another: its Chromes are gone after the launch. The tests are `tests/lib/render-slots.test.mjs` and `tests/media/chrome-reaper.test.mjs`. We did not time how much waiting the slots saved.

## Keep the test suite fast

The same load broke our tests. `make e2e` took about 175 s and failed on timeouts. Most of that time went to a JSON scene format that we then deleted. We rebuilt e2e around what was left. It renders every page in `films/` as a half-size draft, in a pool of 2 to 4. Each render gets one check. The mp4 must exist, and its duration must match the page's `<meta name="duration">` within 0.15 s.

When the tree held three pages, the run took 4.3 s. It grows with the number of films, and we do not claim 4.3 s at fifty.

Timing tests now measure the machine first. `tests/media/check-budget.test.mjs` stores the seconds that each draft check took, with the capture time of that run. A later run divides its own capture time by the stored one and scales every limit. On a machine 2x slower, each limit doubles. A check that grows while the capture does not still fails.

## Draft checks in three tiers

Capture is not the only cost. `harness/lib/draft-tiers.mjs` puts each draft check in one tier.

- The fast tier runs on every draft: motion, text, worlds, tail, video and sound.
- The settled tier runs at settled frames only: contrast, layout, spec and speed.
- The ship tier runs at `dev --full` and at ship: per-frame box tracks and object tracks.

## A number we dropped

Our notes quoted a "40 ms frame". It came from a bench stamp of 9,077 ms for 228 frames (39.8 ms a frame) on a JSON sample film. The stamp in the repo today is 1,881 ms for 15 frames (125.4 ms a frame) on a canvas page. It includes process and browser start. The two do not compare, so we give no like-for-like speed-up for page drafts.

## FAQ

**How do I make Puppeteer screenshots faster?**
Capture JPEG instead of PNG when you do not need lossless frames. Decode screenshots with `Buffer`, and give each parallel worker its own browser.

**Does parallel Puppeteer need one browser per worker?**
In our test it did. Four workers in one browser queued every screenshot, open and close, and capture took 140 s. One Chrome per worker took 47 s.

**How do I stop too many Chrome processes?**
Cap renders with a machine-wide lock, compute the worker count from free memory, and kill Chromes whose owner process died.

**Is GPU compositing safe for deterministic renders?**
Not for SVG filters. In our test, 70 of 216 frames differed between two renders. We use software compositing for finals and for pages with SVG filters.
