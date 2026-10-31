---
title: "Resume a failed Puppeteer render and catch hangs"
description: "A render died at 97% and left 3.7 GB of frames. Slice markers, retries and a 60 s watchdog that names the stuck step."
date: 2026-10-10
updated: 2026-10-16
section: rendering
topic: rendering
docs: ship, troubleshooting, render-flags
tags: "resumable rendering, puppeteer hangs, watchdog, headless chrome, retries"
keywords: "resume failed render, puppeteer hangs, puppeteer timeout, render checkpoint, document.fonts.ready hang"
hero: /blog/resumable-finals/hero.webp
heroAlt: "Eight capture slices: six have finish markers, one is marked lost after four attempts, one has not run. A resume skips the six and runs the last two."
---

Our worst render died at 97%, after 20,768 of 21,504 subframes. The only record of it was 3.7 GB of orphaned PNG files. Nothing told us which film they belonged to, so nothing reused them. In one later session, failed finals cost 49 minutes, 45% of the session.

This post covers two fixes in [vawe](https://github.com/vawe-hq/vawe). The first lets a failed Puppeteer render resume. The second is a watchdog that turns a silent hang into an error that names the stuck step. A final takes about 16 minutes. The renderer cuts the film into slices, captures each slice on a page in headless Chrome, and encodes at the end. Slices run in parallel, as in [speed up Puppeteer screenshots](/blog/fast-drafts).

## What we found

| Problem | Test | Result |
| --- | --- | --- |
| A final died at 97% | One film, 21,504 subframes | 3.7 GB of frames that nothing could reuse |
| Failed finals in one session | A trace of 110 minutes, 5 ships | 3 failed, 2,967 s, 49 minutes, 45% of the session |
| Two silent hangs | Two renders | 600 s and 400 s with no output, then a clean pass |
| Slowest real step | A `colour-sting` draft | 0.38 s (a screenshot) |
| Stall limit | Default `STALL_MS` | 60 s, about 160 times the slowest real step |

## Resume a failed render

Before the fix, a slice that lost its page twice made the final exit with code 2. It left its frames behind and reported nothing. A new run started from zero in a new place. You can only delete a directory of frames that has no key.

Four changes in `harness/media/render-page.mjs` fix this:

- The frames directory name holds the page and a key of its settings. The same film at the same settings finds its own frames.
- A finished slice leaves a marker, and the next run skips each slice that has one.
- A slice gets four attempts (`SLICE_ATTEMPTS = 4`), each on a fresh page. A page that failed once is a bad page. Only the fourth failure throws.
- After a good encode, the renderer removes the frames. Frames untouched for three days are swept, so a forgotten failure does not keep gigabytes.

A failed final also records its percent and its reason. The commands `ship --status`, `dev`, `runs` and `new` print one line that names the failure and the command that resumes it.

![Eight capture slices: six with markers, one lost after four attempts, one not run. A resume skips the six.](/blog/resumable-finals/hero.webp "A resume skips the finished slices.")

### The key must hash bytes

Our first key hashed the size and the mtime of every file in the page folder and in `core/`. A checkout, a rebase or an edit in another session changed the hash between a failed final and its resume. The resume opened a new directory and started at 0%.

The key now hashes file bytes. Anything git can touch, such as mtimes, paths or sizes, moves a key. Content does not.

![Before: the key hashed size and mtime, so a rebase changed it and the resume started over. After: the key hashes file bytes, so the same content finds the same directory.](/blog/resumable-finals/key.webp "The key before and after.")

### A dead browser and a dead mux

If the browser of a worker died, the retry had no page to use. A final now opens a new Chrome for that worker.

Some finals were 100% captured and then lost at the last step, which mixes the page audio. The renderer now reads the page audio before the capture. It keeps the frames when the mux fails and records the real stage. The test `tests/media/render-mux-retry.test.mjs` covers the retry.

## Catch a hang

A Puppeteer hang that fixes itself on retry is the worst kind. You cannot reproduce it, and an agent that waits on the render cannot tell whether to wait or kill the process.

Every browser call goes through the DevTools protocol. The only bound on one call was the protocol timeout, 30 minutes (`PROTOCOL_TIMEOUT_MS`). When a call never returned, nothing happened for up to half an hour. Twice it never returned: 600 s and 400 s of silence, then a clean pass on the next run.

### One cause: fonts.ready had no deadline

`awaitFonts` in `core/engine/page-seek.js` awaited `document.fonts.ready` before its own 10-second deadline started. If a face that first appears in the middle of a film never arrived, `fonts.ready` never resolved, so the deadline never ran. The fix races `fonts.ready` against the deadline too. Any wait with no deadline of its own deserves the same doubt.

### The general bound: a watchdog

That explained one hang. The next could come from anywhere, so each slice now runs under a watchdog. Before each await, the slice calls `mark('<step>')` with a name such as `seek`, `screenshot`, `settle` or `open page`. A timer checks every second how long the slice has gone without a new mark. After 60 seconds with no mark, it fails the slice with a message in this form:

```
render stalled: worker 1, frame 6 (0.20 s), in seek for 60 s; retrying slice 0.00-0.50s on a fresh page (attempt 2 of 4)
```

It then closes the stuck page, opens a fresh one and runs the slice again from its first frame. A seek is a pure function of time, so the rerun gives the same pixels. If your slices are not pure functions of time, a restart hides the bug. If every attempt stalls, the render fails with an error that names the step. The usual causes are a `window.seek` or `onFrame` hook that never resolves, a font or image that never loads, or a starved browser.

We chose 60 s after a measurement. The slowest real step was 0.38 s, a screenshot in a `colour-sting` draft. A 60 s limit is far above that, so a loaded laptop does not trip it, and far below both hangs. The limit is `STALL_MS`, and `renderPage` takes a `stallMs` option.

![Bar chart in seconds: slowest real step 0.38, stall limit 60, hangs of 400 and 600](/blog/stall-watchdog/seconds.webp "The stall limit against real step times and the two hangs.")

### Two related limits

A page with several WebGL canvases slows down over a long render until one protocol call times out. The renderer now recycles the capture page every 300 subframes (`RECYCLE_SUBFRAMES`).

Puppeteer's navigation limit is 30 seconds. On two drafts beside a loaded machine it fired when nothing was wrong. Now `gotoLoaded` finds out why a load stalled. An unfinished request, a blocked main thread or a console error fails at once with the reason. If nothing explains the stall, the load retries with a 120-second limit.

## Where the 49 minutes went

We read the trace of one 110-minute session. Three of its five ships failed, and the failed finals cost 2,967 s. Two of the failures sat at "0%" in the record, although the log had shown `capturing 19198/19200`. The capture was complete. The last step lost its browser frame while it mixed the audio ("detached Frame"), and the ship record said 0%.

So the record had a bug as well as the render. A fully captured film must not show 0%. The next person or agent reads that percent to decide whether to start over. The cheapest work to protect was the frames.

![A 110 minute session bar: 49 minutes in failed finals, 61 minutes everything else.](/blog/resumable-finals/cost.webp "Time in failed finals, one session.")

## Check it

Run the two test files in a checkout of vawe:

```bash
node --test tests/media/render-resume.test.mjs tests/media/render-stall.test.mjs
```

On our machine, all 7 tests passed (54 s for the resume file and 43 s for the stall file, run apart). The resume file covers a slice that fails one to three times and then passes. It covers a slice that fails four times and resumes later. It covers a key that survives a touch of the page and `core/`, and the sweep of old frames. The stall file covers a stalled seek, a stall on every attempt, and a font that never arrives.

The stall test renders the page once with no stall to learn its capture time. It then sets its limit to twice that time, with a floor of 1.5 s. The test stays fast on a quick machine and stable on a slow one.

We did not measure the time that the fixes save. We know the cost before: 49 minutes in one session, and a 97% film that would now resume. We also have no count of how often the watchdog fires. The render summary lists any retried slices, and we have not summed them.

For the page rules that make a retry safe, see [the virtual clock](/blog/page-clock). The [troubleshooting docs](/docs/troubleshooting) list the usual causes of a stall.

## FAQ

**How do I resume a failed Puppeteer render?**
Name the frames directory by a hash of the page content and the render settings, and write a marker when a slice finishes. A new run then skips the slices that have a marker.

**Why does my Puppeteer script hang with no error?**
A DevTools call has no bound except the protocol timeout, which is 30 minutes by default in our setup. Wrap each step in a watchdog that records the step name and fails after a fixed idle time.

**How long should a render stall limit be?**
Measure your slowest real step first. Ours was 0.38 s, and we set 60 s. That is above any real step and well below the hangs of 400 s and 600 s.

**Is it safe to retry a stalled slice?**
Yes, if each frame is a pure function of its time. The rerun then gives the same pixels. If your frames depend on earlier frames, a retry hides the bug.
