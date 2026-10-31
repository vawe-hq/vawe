---
title: "Verbalized sampling for AI agents: method and test plan"
description: "Verbalized sampling asks a model for several ideas with a typicality score. Our agent version uses four ideas, a ledger and six checks. No test result yet."
date: 2026-10-11
updated: 2026-10-16
section: agents
topic: agents
docs: brief, references, engineering-notes
tags: "verbalized sampling, mode collapse, creative agents, ideation, motion graphics"
keywords: "verbalized sampling, verbalized sampling prompt, mode collapse llm, how to get diverse ideas from llm, agent ideation method"
hero: /blog/ideate/hero.webp
heroAlt: "Five steps of the ideate method: meaning, four ideas from four devices, a typicality number, a pick that is not the most typical, and a ledger row."
---

Verbalized sampling is a prompting method. You ask a model for several answers, and each answer carries a stated probability that a model would give it. The typical answer then shows up as the typical answer, and you can choose around it. We built an agent version for film ideas. The method ships today. The test that would show whether it helps is only planned, and we have no result.

![Five steps: meaning, four ideas from four devices, typicality, pick, keep the ledger row.](/blog/ideate/hero.webp "The ideate method, from the meaning of a beat to a ledger row.")

## The problem: mode collapse

A model with no guidance writes the most typical idea first. For a beat that says "the AI is thinking", that idea is a spinner. Someone who works on a food app would write something else: the send button grows into a wok and tosses the ingredients.

![Example: a spinner is the first idea. The send button that grows into a wok has typicality 0.15.](/blog/ideate/wok.webp "The wok idea comes from the subject's own world.")

For one agent, the typical idea is fine. For a framework that many agents use, every film starts to look like the same film. This is mode collapse in the plain sense. You can see it without a benchmark: run the same brief a few times. A rule such as "be original" does not help, because an agent agrees and then writes the spinner.

The paper "Verbalized Sampling" (arXiv 2510.01171) blames typicality bias in preference data for mode collapse. It asks for several answers with stated probabilities. For creative writing it reports 1.6 to 2.1 times more diversity, with a larger gain on stronger models. Those are the paper's numbers. We have not measured them in motion graphics.

## What the agent does

The guide `guides/IDEATE.md` owns the method. Our version is smaller than the paper's. For each idea the agent writes a number from 0 to 1. The number says how likely a model with no guidance writes that idea first. It is the agent's own estimate, not a measured fact, and the guide says so. The method runs once per decision:

1. Write what the beat or cut must say in one plain sentence, with no style words.
2. Write four ideas, each with a different device from a table of ten. The ten devices are metaphor, transformation, show the invisible, scale shift, personification, literalise, part for whole, reversal, collision and literal. Take every idea from the subject's own objects, materials and verbs.
3. Give each idea a typicality number, and write all four before the pick. A number written after the pick only justifies it.
4. Pick one idea that is not the most typical, with one reason. If the plain `literal` idea is right, say why the story needs it.
5. Write the row in the `## Ideas` table of `brief.md`, then build what you picked. The frame has to show it.

The same method plans cuts. The skill `skills/vawe-transitions/SKILL.md` runs it for each cut: four ideas drawn from three of twelve handoff families, the less typical pick, and a ledger row. The families are in [motion graphics transitions](/blog/transitions).

## How the ledger is checked

The ledger is data, so checks can read it. They advise and never block. The code is in `harness/lib/ideas.mjs`.

| Check | Fires when |
| --- | --- |
| `ideas-missing` | a scene has no row |
| `ideas-literal` | every chosen device is `literal` |
| `ideas-variety` | one device is picked for more than half the rows |
| `ideas-typical` | the pick is the most typical idea and has no reason |
| `ideas-thin` | there are fewer than four ideas, a repeated device or a missing number |
| `ideas-reworded` | four ideas are one idea reworded, or a picked idea is copied to another row |

The check `ideas-reworded` exists because four labels on one thought is the known way around the method. It compares the idea texts, not only the labels. Run the gate on a page like this:

```sh
bin/vawe check ideas films/<name>/page.html
```

On a page whose brief has no Ideas section, the gate prints `the brief has no "Ideas" section; nothing to check` and passes. We ran that case today. We did not run the gate on a filled ledger for this post.

The checks cannot see the film, and that is a known hole. The fresh scoring agent and the critic ask a different question for each beat: which idea is on screen? An idea in the ledger that the frames do not show is a finding. A ledger that the frames do not match is worse than no ledger.

## How we would know it works

We wrote the test plan before we shipped the method, with a fixed pass bar. It is a blind comparison of 6 briefs and 2 arms (films made without the method and films made with it), which makes 12 films. Three reviewers judge each pair, which gives 18 reviews. The ideate arm passes if all three conditions hold.

- Its distinctiveness is higher in at least 4 of 6 pairs, with a mean gain of at least 1.0 point.
- Its clarity is not more than 0.5 points lower.
- It wins at least 10 of the 18 overall picks.

Six pairs give a signal and not a proof, and the plan says so. If the method fails the bar, the plan lists what we would change for each kind of failure.

## Limits

We publish a method and a plan, not a result. The typicality number is a self-estimate. The paper's diversity gain comes from another domain. Until the blind test runs, the honest claim is narrow. The typical idea is now written down where an agent and a reviewer can see it.

The method is in the [vawe repo](https://github.com/vawe-hq/vawe) at `guides/IDEATE.md`. For the tools around it, see [the brief page](/docs/brief) and [the checks](/docs/quality-gates). For another case where a plan and a film disagreed, read [can AI agents watch video?](/blog/watch-a-film). The craft posts on looks, curves and cuts start at [the CSS animation library](/blog/site-after-json).

## FAQ

**What is verbalized sampling?**
It is a prompt that asks a model for several answers, each with a stated probability that a model would give it. You can then pick an answer that is not the most typical.

**What is mode collapse in an LLM?**
A model with no guidance returns the same most-typical answer again and again. For creative work, many runs then give near-identical ideas.

**Does verbalized sampling work?**
The paper reports 1.6 to 2.1 times more diversity in creative writing. We have no result for motion graphics, because our blind test of 12 films has not run.

**How do I stop an AI agent from writing the obvious idea?**
Make it write four ideas from four devices and give each a typicality number before it picks. Keep the choice in a table that a check can read. Telling it to "be original" does not work.
