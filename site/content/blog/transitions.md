---
title: "Motion graphics transitions: 12 types, 10 mistakes"
description: "Name what carries the eye over each cut. 12 handoff families and the 10 tells of a slideshow, with clips and a check you can run."
date: 2026-10-11
updated: 2026-11-04
section: motion-sound
topic: motion
docs: transitions, moves
tags: "video transitions, match cut, handoffs, slideshow, motion design"
keywords: "motion graphics transitions, match cut, scene transitions in motion graphics, video transition types, cut on action"
hero: /blog/transitions/hero.webp
heroAlt: "Twelve handoff families as a grid: graphic match, action match, object to object, position lock, container transform, shared axis, colour or light flood, type-driven, camera through, invisible cut, sound bridge, deliberate cut."
---

Good motion graphics transitions carry one thing across each cut. Our agents made films where scene A faded and scene B arrived. When three moves in a row went the same way, the film read as one long swipe. So we ask one question of every cut: what carries the eye across the seam? The answer is a handoff. This post groups the film grammar that already exists (match cut, cut on action, J-cuts and L-cuts, Murch's Rule of Six) by that question.

We have no measured gain in film scores from these rules yet. The check is advice only, and we have no before-and-after judge score. The numbers below are counts and thresholds.

![The twelve handoff families as a grid.](/blog/transitions/hero.webp "The twelve handoff families.")

## What we found

| Item | Count or threshold |
| --- | --- |
| Handoff families | 12 |
| Slideshow tells scored by `harness/lib/slideshow.mjs` | 10 |
| Repeats before a tell counts | 3 or more cuts, 5 or more elements, a 75 percent share, or shots within 15 percent of one length |
| Same family on adjacent cuts | 0 allowed |
| Same family in one film | 2 at most |
| Exposure flashes | 3 per second at most |
| Continuous-take video components in the library | 10 |

## 1. Name the one thing that crosses the cut

A transition belongs to the thing that leaves beat A and starts beat B. That thing has a screen position, a scale, a direction and a speed on both sides of the cut. If you cannot name it, the cut is a swap. The background changes, the text changes, and nothing from beat A starts beat B.

To check, write the carried element in the plan before you build. If the cell is empty, you have a slide change.

## 2. Pick a family from the twelve, and read its cost

The table in `taste/craft/transitions.md` gives each family four facts. It says what the family is, when the story fits it, its cost or risk, and which video components to copy. The cost column keeps an agent from using the showiest family on every cut.

| Family | What breaks it |
| --- | --- |
| Graphic match | needs the same framing in both shots; an anchor that drifts a few pixels breaks it |
| Action match | fails most visibly on a speed or ease mismatch |
| Colour or light flood | with no reveal point, it just cuts |
| Camera through | the strongest device, so use one per film |
| Deliberate cut | exempt from the limits, because hard cuts are most seams |

The other seven families are object to object, position lock, container transform, shared axis, type-driven, invisible cut and sound bridge. Our older doc listed transition types and what each means. It said what a dissolve means and not what to build. The family table changes the question from "which transition?" to "which thing do I carry, and what does it cost?"

## 3. Do not repeat a family on adjacent cuts

Two limits apply. No family on two adjacent cuts. No family more than twice in a film. Three moves in a row in one direction made our films read as one swipe. Write one row per cut in a log, with the family named, so a repeat shows in the table before any render.

## 4. Choose the less typical of four ideas

The skill `vawe-transitions` gives each cut a procedure. Draw four ideas from three families. Pick one that is not the most typical. Write a log row. That is the idea method applied to a cut, described in verbalized sampling for AI agents.

## 5. Put the handoff in the plan, then check the film against it

The plan has a cut table with a handoff column. `vawe check transitions` reads it and compares it with the measured film. It flags planned handoffs that came out as hard cuts. A plan that nobody compares with the film does nothing.

```bash
bin/vawe check transitions films/examples/colour-sting/page.html
```

On `colour-sting` it printed:

```
cut 4 plans colour or light flood but the film measures a hard cut at 4.37 s; build the handoff or plan a deliberate cut
```

## 6. Score the film for slideshow tells

`harness/lib/slideshow.mjs` scores ten tells from the motion records, the scene spans and, when there is a video, the detected cut kinds and the still runs. The ten are `all-at-once`, `crossfade-every-cut`, `cut-and-fade-in`, `dead-gap`, `equal-shots`, `one-thing-scenes`, `same-entrance`, `same-in-out`, `static-holds` and `swap-no-carry`. The check prints a score out of 10 with each tell, its seconds and a fix. It is advice only.

![Ten slideshow tells and their codes, with the repeat thresholds.](/blog/transitions/tells.webp "The ten tells.")

A single event is a choice: one crossfade for a time jump is not a tell. We set the thresholds so that our two public example films stay clean. They are `colour-sting` and `tracking-hud`. A test reads their page shape through the same rules. Run it with `bin/vawe check slideshow <page>`. On `colour-sting` we saw `score 0/10`. The check also said it skipped the entrance and exit tells. The reason: that page paints in `seek(t)`, so no element boxes were sampled.

## 7. Copy a continuous-take video component when the story allows one

Ten handoff video components in the library carry one shared element from scene A to scene B, with no cut and no crossfade. They are [highlight sweep](/video-components/highlight-sweep), [shadow handoff](/video-components/shadow-handoff), [word portal](/video-components/word-portal), [underline road](/video-components/underline-road), [caret door](/video-components/caret-door), [swipe-continues](/video-components/swipe-continues), [drop-and-land](/video-components/drop-and-land), [spin-rotation](/video-components/spin-rotation), [counter-dive](/video-components/counter-dive) and [thumbnail-grid](/video-components/thumbnail-grid). Each has a clip and a page under [/video-components](/video-components).

<figure>
<video src="/blog/transitions/swipe-continues.mp4" poster="/blog/transitions/swipe-continues.hd.webp" muted loop playsinline controls></video>
<figcaption>Swipe continues: one scene carries its motion into the next.</figcaption>
</figure>

<figure>
<video src="/blog/transitions/word-portal.mp4" poster="/blog/transitions/word-portal.hd.webp" muted loop playsinline controls></video>
<figcaption>Word portal: a word from scene A is the opening that scene B arrives through.</figcaption>
</figure>

When the carried element moves across the cut, match its speed on both sides. `ramp()` in the [CSS easing functions cheat sheet](/blog/easing) does that.

## 8. Cap the exposure flash at three per second

The exposure flash is a 3-frame over-exposure on a cut. The new shot starts at twice the brightness and settles in 0.15 s. We measured the clip at 60 fps. The mean luma is 27 before the cut and 203 to 208 in the peak. It is 67 on the first frame after the cut and 38 after 0.15 s. The helper allows at most 3 flashes in any one second, in line with the WCAG limit of three flashes per second. A fourth cut in that second still cuts, without the flash.

<figure>
<video src="/blog/transitions/exposure-flash.mp4" poster="/blog/transitions/exposure-flash.hd.webp" muted loop playsinline controls></video>
<figcaption>Exposure flash: the shot swap sits inside the peak, so the viewer never sees it.</figcaption>
</figure>

## 9. Keep the seam rules few

We folded the older seam rules into three: `seam-timing`, `hard-cut-default` and `eye-trace`. The change added 73 lines, removed 255 and retired five rule ids.

## The checklist

| Check | How to verify | Where in the code |
| --- | --- | --- |
| A carried element per cut | handoff column filled in the plan | the cut table of the plan |
| Family chosen with its cost | log row names the family | `taste/craft/transitions.md` |
| No family on adjacent cuts, none more than twice | the log | `skills/vawe-transitions/SKILL.md` |
| Four ideas, less typical pick | log row | `guides/IDEATE.md` |
| Plan matches the film | `vawe check transitions` | draft advice |
| Slideshow score | ten tells, score out of 10 | `harness/lib/slideshow.mjs` |
| Flash cap | at most 3 per second | exposure flash helper |

See the clips on their video component pages: [swipe-continues](/video-components/swipe-continues), [word-portal](/video-components/word-portal) and [exposure-flash](/video-components/exposure-flash). For the looks that dress these cuts, read [CSS animation library: 126 copyable video components](/video-components).

## Why the typical idea comes first

A model with no guidance writes the most typical idea first. For a beat that says "the AI is thinking", that idea is a spinner. Rule 4 uses verbalized sampling: ask for several ideas, each with a stated probability that a model would give it. The typical answer then shows up as the typical answer, and you can choose around it. The method ships today. The test that would show whether it helps is only planned, and we have no result.

## FAQ

**What are the main types of video transitions?**
We group them into twelve handoff families, such as graphic match, action match, shared axis and camera through. The grid at the top of this post lists all twelve.

**What makes a video look like a slideshow?**
Cuts that carry nothing across. The common tells are a crossfade on every cut, equal shot lengths, the same entrance for every element and scenes with one thing in them.

**What is a match cut?**
A cut where a shape, a colour or an action continues from the first shot into the second, so the eye does not reset. In our list it is the graphic match and the action match. The [match-cut video component](/video-components/match-cut) is one shape that crosses a scene change at the same place, size and angle.

**How many flashes per second are safe?**
The WCAG limit is three flashes in any one second. Our exposure-flash helper stops at three.
