---
title: "JSON video format vs HTML: a blind test"
description: "A JSON video format lost a blind A/B test to one HTML page: 10.75 minutes against 5.9, and scores of 5 against 8. What we deleted after."
date: 2026-10-07
updated: 2026-10-16
section: rendering
topic: determinism
docs: the-page, video-from-code
featured: true
featuredOrder: 1
tags: "json video format, html to video, agents, web animations, architecture"
keywords: "json video format, html vs json for video, agent-native motion graphics, web animations api, html video format"
hero: /blog/html-over-json/hero.webp
heroAlt: "Bar chart. The JSON arm took 10.75 minutes and scored 5 and 4.5 from two judges. The HTML arm took 5.9 minutes and scored 8 and 7.5."
---

For an agent that writes video, plain HTML beat our own JSON video format on every number we took. Given the same brief, the HTML arm finished in 5.9 minutes against 10.75 and used one render fewer. Two blind judges scored its film 8 and 7.5 against 5 and 4.5. We decided to drop the JSON format two days later and deleted it on 2026-09-30. What replaced it is the [page contract for rendering HTML to video](/blog/page-contract).

The test was one run per arm. Treat it as a strong signal and not as a rate.

## What we found

| | JSON scene format (Arm A) | One HTML page (Arm B) |
| --- | --- | --- |
| What the agent writes | JSON with 24 layer types, named presets and size roles | `element.animate`, CSS keyframes, SVG, canvas |
| Renderer | A Go renderer that turns JSON into frames | A 40-line Puppeteer script that seeks the page and takes a screenshot per frame |
| Seen in training | No | Yes |
| Time to a film | 10.75 min | 5.9 min |
| Renders used (limit 5) | 4 | 3 |
| Blind judge scores | 5 and 4.5 | 8 and 7.5 |

![Two pipelines side by side. The JSON arm learns a vocabulary, writes JSON and hands it to a Go renderer. The HTML arm writes one page and a short script seeks and screenshots it.](/blog/html-over-json/diagram.webp "The two arms of the test.")

The test ran on 2026-09-27. Both arms got one brief for a 6 second kinetic sting. Each arm had a fresh agent with no memory of the other arm, a limit of 45 minutes and 5 renders. Two blind judges scored both films in opposite order. Arm A followed the JSON route in our AGENTS.md at the time.

## The agent must learn the vocabulary

The JSON format was tidy, and no model had seen it in training. The agent spent time looking for a preset name for a plain-English idea such as "make the letters flip". About 8 of the 10.75 minutes went into finding preset names for devices the agent could already describe in words. HTML needs no lookup. The agent writes the flip in CSS, the way it would on any website.

Our layer data showed that 4 of the 24 layer types made up 87% of all layers. Of 314 text elements that had a size, 0 used a size role. A large vocabulary that is mostly unused costs reading time and buys little.

## Failure modes

The faults in the JSON run came from the format. A `flap` preset showed random glyphs that read as noise, and the agent could not search the web for why.

The HTML run had one trap, and it cost 8 minutes. A Web Animations keyframe list with no end keyframe slides back to the resting state of the element. The element snaps back instead of holding its last value. You can see this in a browser. Here the last keyframe sits at offset 0.5, so at the end the opacity is the resting value 1 and not 0.5:

```js
const el = document.querySelector("#b"); // style="opacity:1"
const anim = el.animate(
  [{ opacity: 0, offset: 0 }, { opacity: 0.5, offset: 0.5 }],
  { duration: 1000, fill: "forwards" },
);
anim.pause();
anim.currentTime = 1000;
getComputedStyle(el).opacity; // "1"
```

We ran this in headless Chrome with Puppeteer. The opacity was "1" at the end, and "0" at the start. This is ordinary Web Animations behaviour, so the agent could look it up like any web question. We later made the renderer handle cases like it, and [how to seek CSS animations frame by frame](/blog/seekable-css) walks through them.

## What the framework keeps either way

Moving the input language to the web did not move the rest. The renderer (`harness/media/render-page.mjs`), the quality checks, the scoring agent and the harness stay ours. Two changes made the web side complete before the switch. The renderer seeks CSS animations, transitions and Web Animations instead of killing them (2026-09-27). A page can drive real WebGL with its own `vawe.onFrame`, with no new attribute language (2026-09-28). The renderer makes time a seek instead of a clock, as the [virtual clock reference](/blog/page-clock) shows.

## When to choose which

Choose a web page when the author is a language model. It already writes HTML, CSS and the Web Animations API well, and a bug in that code is a bug the web has already answered. That is our case. On 2026-09-29 we decided that every film is one HTML page. The house rule we wrote then: if something an agent would naturally write fails, that is a framework bug and not an agent mistake. The result is the small [page contract](/blog/page-contract): a web page with a few agreed `meta` tags and one `data-world` attribute per beat.

A private format can still make sense when people, not models, author through a UI that writes the file for them. It can also make sense when you need a vocabulary the web cannot express. Test it on a fresh agent before you invest in it, because a blind test is cheaper than a long design review. Count which parts get used. State your sample size: one run per arm tells you where to look, not how big the gap is. We later ran films on a weaker model as well, in [AI agent tooling: design for the weaker model](/blog/weaker-model).

## What we deleted

Deleting the old format was bigger work than writing the new one. Our agents read the tree. An agent that searches for "how do I add a layer" finds a layer system. An agent that opens `skills/` finds a skill for a format nobody should use. Every leftover file is an instruction, so we removed the whole direction.

| Change | Files | Lines added | Lines removed |
| --- | --- | --- | --- |
| Delete the format, engine, tools, gates, tests, skills and Go renderer (2026-09-30) | 1,415 | 65 | 205,163 |
| Remove the site copy of the engine and the pages built on it | 1,792 | 511 | 127,750 |
| Thin the Makefile, remove routers and dead scripts | 70 | 158 | 2,481 |

We read these from `git show --shortstat` on the three changes. The first one removed lines from these folders: `core/` 34,139, `films/` 33,733, `tests/` 29,864, `quality/` 29,733, `harness/` 23,501 and `blocks/` 17,221.

Three choices decided how it went:

- We tagged the last good state as `json-final` first. Any file comes back with `git checkout json-final -- <path>`. The tag turns "what if we need it?" into a cheap question.
- We did not freeze a copy. Our first move vendored a copy of the engine into `site/public` (50,586 lines added) so the site kept building. The copy removed no pull on agents, and we deleted it about 20 hours later, in the 127,750-line removal above. A frozen copy is still code.
- We dropped the guards in the same hour. A hook that checks a deleted format fails every other change. We removed the JSON gates from our local hooks (107 lines).

The end-to-end test suite mostly tested the old format. Once the format was gone, `make e2e` fell from about 175 s to 4.3 s. A week later we also removed the small leftovers: the scene registries, the three.js layer builder and the theme colour markers. A registry with one stale entry reads like a live feature. We have no agent success number that isolates the deletion, because other changes landed the same week, so we do not claim one. Keeping what the agent reads short is its own work, covered in [how long AGENTS.md should be](/blog/read-load).

If you came for an alternative to a React-based video tool, see [Remotion alternatives](/remotion-alternatives) and [HyperFrames alternatives](/hyperframes-alternatives). The page format is in the [docs](/docs/the-page).

## FAQ

**Is a JSON video format better than HTML?**
For a person who authors through a UI, it can be. For a language model, HTML won our blind test: 5.9 minutes against 10.75, and scores of 8 and 7.5 against 5 and 4.5. It was one run per arm.

**Why do AI agents write better HTML than a custom format?**
They saw HTML, CSS and the Web Animations API in training, and they can search the web for a bug. They cannot do either for a private format.

**How do you delete a whole product direction safely?**
Tag the last good state first. Delete the engine, tests, hooks and docs together, and do not keep a frozen copy. Then search for the old vocabulary.

**What did you lose by dropping the JSON format?**
A fixed vocabulary of 24 layer types and named presets. We kept the renderer, the checks and the scoring, because those do not depend on the input language.
