---
title: "Can AI agents watch video? What they miss, measured"
description: "Our agent read 5 reference frames, then made 0.20 s flashes where the reference ran 0.07 to 0.10 s. Ground-truth fixtures and six tools fixed it."
date: 2026-10-11
updated: 2026-10-16
section: agents
topic: watching
docs: references, critique
tags: "ai video analysis, agents, reference video, video comparison, measurement"
keywords: "can ai agents watch videos, ai video analysis tool, compare two videos, extract frames from video, test video analysis accuracy"
hero: /blog/watch-a-film/hero.webp
heroAlt: "Bar chart. The reference film's three flashes lasted 0.10, 0.07 and 0.10 seconds. The agent's three flashes lasted 0.20 seconds each. In the reference 27 percent of pixels were darker than Y 50, in the agent's film 80 percent."
---

Can an AI agent watch a video? Only as well as its tools let it measure one. We asked an agent to make an 8 s film in the style of a reference clip. It read 5 of the reference's key frames and 2 of its 16 cut strips, and described them in words. Its flashes ran 0.20 s each. The reference's ran 0.10, 0.07 and 0.10 s.

Our scoring agent gave the result 62, then 61, then 62. The owner of the reference said the concept was right and the look was wrong. Both verdicts were honest, because the scoring agent never saw the reference either. This post follows that session through its trace. Then it lists the tools and tests we built so an agent can compare two films in numbers. It is part of our series on [judging generated video](/blog/judge-design).

## What the agent saw and what it missed

A weaker model made the film. It met the reference at stage 2 of the loop. There it read 5 key frames, 2 of 16 strips and the top 60 lines of the reference's spec file. Of 53 file reads in the session, 7 were reference images, and the last came at 20:17 on the session clock. After that, 0 of 83 `vawe` calls carried the reference id or a `--ref` flag.

The brief template had told the agent to pick 4 to 6 reference frames and strip two reference films. The agent did that and stopped. The instruction worked as a ceiling. Reading frames is not measuring them.

Sentences lose the details that decide whether a film looks right. The agent missed halation (the soft glow where a bright edge meets dark), a CRT pixel-grid mask and flashes of two or three frames. We measured the final film against the reference:

| Measure | Reference | Agent's film |
| --- | --- | --- |
| Flashes (runs of frame-mean luma above Y 110) | 3, lasting 0.10, 0.07 and 0.10 s | 3, lasting 0.20 s each |
| Share of pixels below Y 50 | 27% | 80% |
| Share between Y 50 and 110 | 68% | 12% |
| Share above Y 110 | 5% | 8% |
| Glow and screen | halation, pixel-grid screen, lens tilt | a `text-shadow` |

![Flash length and brightness split: reference against ours.](/blog/plan-vs-reference/gap.webp "The agent's flashes ran twice as long, and its film was far darker.")

The agent called its film "dark and sparse". That is true of both films, so nothing told it that one was far darker. A tool could print every row of the table, and none did. At 30 frames a second, 0.20 s is 6 frames. Our docs call an exposure flash of 6 frames or more a strobe.

## Why every check stayed quiet

Every later check compared the film with something the agent wrote itself. The acceptance rows measured the agent's own word and shot tables. The range checks used a generic range from 17 other films. The scoring agent printed "side-by-side comparison skipped: the film type is unknown", because it chose comparison films by film type. A film that names its own reference never got compared with it.

The design ladder failed too. The agent skipped four of five rungs with the reason "the reference defines it". Those rungs held the faults: colour (the flashes), depth (no real lens) and type (the glow). The check accepted any non-empty reason.

The critique step failed more quietly. A subagent critic read three sheets, and one sampled 8 frames at 1 frame per second for a 16-shot film. A 0.2 s flash does not show at 1 fps. The critic wrote that it could not find the flash frames. The reference's owner had noticed the flashes first.

## Six tools that let an agent watch a video

We set two rules. If you cannot measure it, you cannot improve it. A reference gets no token cap, so each shot gets a full-size frame and not a thumbnail.

![Six verbs: refs frames, strip, onion, velocity, spec and see, from one frame to a whole film.](/blog/watch-a-film/verbs.webp "The six verbs, from one frame to a whole film.")

- The `vawe refs frames` verb writes the settled full-size frame of each shot.
- The `vawe strip` verb shows the frames through a moment or through every cut, with the motion start and the settle.
- The `vawe strip --onion` mode blends the frames of one move into one image. The `vawe strip --velocity` mode samples a page 120 times a second and reports start, peak, settle, overshoot and ease shape per element.
- The `vawe see --spec` mode measures where the eye goes and what the ground does in each shot.
- The `vawe see` verb reports flashes, clipped share, bloom, chromatic offset, screen texture and glow colour. The `vawe zoom` verb shows a sharp crop of one region beside the same region of a second film.
- The `vawe see` verb reads a film completely: structure, motion, look, type, sound and images.

The `zoom` and `see` verbs take `--vs <ref>` and print deltas. The code is in `harness/media/see/`, and the verb table is in `harness/cli/verbs.mjs`. The reference is now the default: `critique`, `compare` and `judge` use the reference the brief names (`harness/lib/refs.mjs`). We had a `--ref` flag before, and agents skipped it.

<figure>
<video src="/blog/watch-a-film/exposure-flash.mp4" poster="/blog/watch-a-film/exposure-flash.hd.webp" muted loop playsinline controls></video>
<figcaption>A 3-frame exposure flash from our video component library, the <a href="/video-components/exposure-flash">exposure-flash video component</a>. At 30 frames a second it lasts 0.10 s. The agent's 0.20 s runs were twice as long.</figcaption>
</figure>

## How to test a measuring tool against ground truth

A tool that prints numbers needs a test where you know the answer. On a real film you do not know the truth, so you compare the tool with your own impression. That impression is what the tool replaces. So we render small pages with answers set by construction. The script `harness/dev/see-truth.mjs` renders each page like a `vawe dev` draft (960 by 540 pixels, 30 fps, silent). Each fixture is a `page.html` and a `truth.json` in `tests/fixtures/truth/<family>/`.

Four fixtures show the idea:

- The `cuts` fixture has six scenes with hard cuts at 0.5, 0.6, 0.85, 1.85 and 2.25 s. Scenes of 0.1, 0.25 and 1.0 s are in on purpose, because a cut detector fails on short shots.
- The `flash` fixture has two full-frame flashes over a grey ground of luma 48. One lasts 2 frames at luma 200. The other lasts 3 frames at luma 240.
- The `motion` fixture has a box that overshoots 8% over 600 CSS px, and a second box that moves linearly over 400 CSS px.
- The `camera` fixture has a picture that pans, zooms from 1 to 1.3 and turns 12 degrees. A still slab tilted 8 degrees must not read as a camera move.

Set each tolerance from the unit of the thing. One frame at 30 fps is 0.0333 s, so a cut may be off by 0.0334 s and no more. The scorer prints one row per measure with four states: pass, fail, "no tool" and "not available". A number passes only when its error is inside the tolerance, and a missing value fails. A gap in the tooling then looks like a gap and never like a pass. The suite has 11 families: cuts, flash, motion, camera, eye, ground, look, type, sound, events and beat.

Run it on one family:

```sh
node harness/dev/see-truth.mjs --only flash
bin/vawe see out/see-truth/flash.mp4
```

We ran both today. The suite scored 13 pass, 0 fail and 1 "no tool" in 14 s. It found flash 1 at 0.8 s for 2 frames and flash 2 at 1.8 s for 3 frames, as built. The `vawe see` verb printed the same two flashes, with luma 48 to 200 and 48 to 240. On the `cuts` family the same script scored 22 pass and 4 fail in 49 s. All 4 failures are `vawe storyboard --text` rows that returned no value. We did not record a pass count for the whole suite, so we give none.

## Error bars on every number

A pass row says a tool is good enough. The agent also needs to know how wrong each number can be. The script `harness/media/ref-calibrate.mjs` renders twelve fixtures at 960 by 540 pixels and 60 fps. They cover an audio click, a layout grid, moves on four curves, motion blur, a card moving in and out, staggered text and transitions. It subtracts the known truth of each page from what `vawe see --spec` reports. Then it writes the p50, p90 and bias of the error per measure to `quality/baselines/ref-spec-error.json`.

Each limit comes from the decision the number feeds. It is 33.3 ms for most timings, 0.02 for overshoot, 3% of the frame for position and 10% for size. Thirteen of 14 measures sit inside their limit.

| Measure | p90 error | Must detect |
| --- | --- | --- |
| start time | 8 ms | 33.3 ms |
| element size | 4.5% | 10% |
| palette distance | 0.909 | 6 |
| word start | 33 ms | 33.3 ms |
| tail landing | 304 ms | 33.3 ms |

Word start passes by 0.3 ms, at 99% of its budget, so a small code change can tip it over. Tail landing is the time a slow move comes to rest. It fails at 912% of its limit, because "when did it land?" has no sharp answer. The file `harness/lib/ref-measure/error-table.mjs` attaches the error to every spec. Where the p90 error exceeds the limit, the spec prints "check by eye", and the agent opens the frames. Calibration also caught three parser bugs. A move that reverses at its peak was split in two. The parser read element size wrongly. Word font size ignored the word's own letters.

## What changed in later sessions

In later sessions, agents used `look --vs` and `zoom --vs` 10 times and `see --vs` 3 times. The default reference worked. Before, nobody reused the reference after stage 2. That counts use. It does not measure quality.

We have no score after the change. We did not rerun that film, and we will not invent a number. The flash, luma and read-count figures come from one trace of one session, so read them as an example and not as a rate. The next test is whether films made with these tools pass more often, against the ranges in [our motion graphics benchmark](/blog/quality-bar). The [critique docs](/docs/critique) show the tools in the loop. The code is in the [vawe repo](https://github.com/vawe-hq/vawe).

## FAQ

**Can an AI agent watch a video?**
An agent reads frames, not motion. Give it numbers for cut times, flash lengths and brightness, and it can compare two films. Without them it describes a film in words and misses details such as a 0.07 s flash.

**How do I compare two videos frame by frame?**
Render both at the same exact seconds, put them side by side, and print measured deltas for light, motion and cuts. In vawe, `vawe sheet --ref` does the first and `vawe see <film> --vs <ref>` does the second.

**How do I check that a video analysis tool is accurate?**
Render a page whose answer you set, such as a cut at 0.85 s, and score the tool within one frame. Report the p90 error beside every number the tool prints.

**Why did the agent copy the concept and miss the look?**
It turned reference frames into sentences, and sentences drop halation, pixel grids and short flashes. A check that compares a film only with the agent's own notes cannot see that loss.
