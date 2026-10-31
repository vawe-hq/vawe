---
title: "Motion graphics benchmark: 167 cuts measured"
description: "Median eye jump 0.185 frame heights and 30.5% of arrivals overshoot, from 167 cuts in 17 reference films. Four checks built from it."
date: 2026-10-07
updated: 2026-10-16
section: motion-sound
topic: motion
docs: references, motion-pass, quality-gates
tags: "motion graphics, quality metrics, benchmark, video analysis, agents"
keywords: "motion graphics benchmark, measure motion design, average shot length motion graphics, shot cut analysis, reference film measurement"
hero: /blog/quality-bar/hero.webp
heroAlt: "Large number 167 with the caption cuts measured, the quality bar is a range, not an opinion"
---

We measured 167 cuts in 17 reference films that we consider excellent. The median film moves the viewer's eye by less than a fifth of the frame height at a cut (0.185 frame heights). About three in ten of its arrivals overshoot their mark. Our own early drafts fell outside the reference range on all four checks we wrote from these numbers.

This post gives the method, the full ranges, and what the numbers cannot tell you. It is the outside bar that our [scoring agent for video](/blog/judge-design) compares films against.

## What we found

| Metric | p10 | Median | p90 |
| --- | --- | --- | --- |
| Eye jump at a cut (frame heights) | 0.152 | 0.185 | 0.396 |
| Cuts with the eye near the centre | 32.7% | 50% | 69.48% |
| Cuts where the ground changes | 0% | 56.3% | 100% |
| Arrivals that overshoot (22 films) | 21.1% | 30.5% | 40.9% |

The first three rows use 17 films and 167 cuts. The last row uses 22 films. Eye jump is how far the focus of the picture moves at a cut, in frame heights. The ground is the background layer.

![Range bars from the reference films. Medians: eye jump 0.185, eye near centre 50 percent, ground change 56.3 percent, overshoot 30.5 percent](/blog/quality-bar/ref-range.webp "p10 to p90 as a bar, the median as a tick (taste/build/ref-range.json). Each row has its own axis.")

Read across, the median reference film keeps the eye nearly still at a cut. It puts half its cuts near the centre. It changes the ground at a little more than half of them. The overshoot share is the number behind the `pop` curve in the [CSS easing functions cheat sheet](/blog/easing).

## Why a benchmark from other people's films

Until 7 October our scoring agent compared a new film with our own earlier films. An agent that only sees your films can only rank your films. If all of them share a habit (a slow drift, too much text, motion that is too fast), it reads the habit as normal. We wanted a bar from films outside our work, and a code path that measured it, so the answer would not depend on who looked.

## How we measured

`vawe refs` indexes the reference films and picks them by film type and length. The films live in a folder outside the repo and stay private. We publish the measurement and keep the films.

`vawe see --spec` measures any film deterministically: its cuts and flashes, and two more groups.

- The eye group: where the focus sits in each shot, how far it jumps at a cut and how far it travels. It also counts how often the focus sits near the centre.
- The ground group: the edge tone, whether the ground changes at a cut, and how much the light drifts. A cut compares the border cells of the two scenes.

We calibrated these tools against known fixtures before we relied on them, as [Can AI agents watch video?](/blog/watch-a-film) explains.

`harness/dev/bar-from-refs.mjs` takes one value per film for each metric and prints the p10, median and p90. It writes the file `taste/build/ref-range.json`. One value per film comes first, so that a long film with many cuts does not decide the range alone.

## Our early drafts against the range

We wrote four checks straight from the ranges. Each limit comes from a percentile, and each rule file records what our films looked like when we measured them.

| Check | Reference | Our early films |
| --- | --- | --- |
| `overshoot-share`: arrivals that overshoot | 21 to 61% (p10 to 1.5 x p90) | 0 to 11% |
| `speed-ceiling`: p90 peak speed, frame heights per second | references peak at 4 to 13; limit 12.6 | 14 to 30 |
| `text-breathing`: share of the film with readable text | 3 to 84%, median 61; limit 84% | 94% in two films |
| `text-lingers`: how long one word holds | 0.7 to 2.8 s | 3 to 4 s in two films |

![Our early films against the reference range: overshoot, peak speed, readable text and word hold](/blog/quality-bar/ours-vs-ref.webp "Early drafts against the same range.")

The gap on speed is the largest. Our films reached 30 frame heights per second at p90, against a reference ceiling near 13.

The checks advise and do not block, and each rule has a break-when line. A kinetic type film where the words are the picture says so in its brief. A percentile describes films. As a hard gate it invites agents to game it, which happened with another check (see [reward hacking in AI agents](/blog/loophole-audit)). The scoring agent changed at the same time. It now compares sheets side by side with two reference films per dial, and it caps its scores when we lose.

## What the numbers do not show

The range is not a definition of good. It is the spread of 17 films that we picked as good, one value per film. Seventeen is a small set, and the p10 and p90 of a small set move when you add one film. Overshoot rests on 22.

A film inside the range is typical of films we admire on those four dials. That does not make it good, and a deliberately strange film can break all four and be right. So every rule has a break-when line.

You also cannot reproduce the ranges from the films, because the films stay on one machine. You can check the file and the code that wrote it. We think a published method and a published range beat a published opinion, but the claim is weaker than "here are the films".

## Reproduce it with your own references

The method runs on any folder of films you choose:

1. Index the films with `vawe refs`.
2. Measure each one with `bin/vawe see <film.mp4> --spec` (the code is `harness/media/ref-spec.mjs`).
3. Summarise with `harness/dev/bar-from-refs.mjs`, which writes the p10, median and p90 for each metric.

We ran step 2 on a short clip with `--fast --no-ocr`, and it finished in 2.4 s and wrote `SPEC.md`. The clip has one shot, so it has no cuts to measure. The four rules live in `taste/rules/overshoot.md`, `speed-bands.md`, `text-breathing.md` and `readable-hold.md`. The agent workflow that uses these numbers is on [/ai-agents](/ai-agents).

## FAQ

**What is the average shot length in motion graphics?**
We did not measure shot length as a headline number. We measured what happens at the cut. The median eye jump is 0.185 frame heights, and about half of the cuts have the eye near the centre.

**How do you measure the quality of motion design?**
Pick reference films you trust, measure each with the same tool, and take one value per film. Then use the p10, median and p90 as a range, and check your own film against it.

**How many reference films are enough?**
Our set has 17 films for the eye and ground metrics and 22 for overshoot. That is a small set, so the percentiles move when we add a film. Treat the range as a guide.

**Should a quality metric block a render?**
We say no. A percentile describes films, and as a hard gate it invites agents to game it. Our four checks advise and each has a break-when line.
