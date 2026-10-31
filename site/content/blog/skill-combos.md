---
title: "Agent skills for UI design: a blind test of 6 combos"
description: "Eleven single UI skills all built cluttered heroes. In a blind test of 6 skill combos on 2 frame kinds, only Warm editorial won both."
date: 2026-10-11
updated: 2026-10-16
section: agents
topic: agents
docs: design-kit, key-frames
tags: "ui skills, ai agents, blind test, design systems, taste"
keywords: "ui skills for ai agents, frontend design skill claude code, ai design skills, best ui skills for claude, blind design test"
hero: /blog/skill-combos/hero.webp
heroAlt: "Table of six skill combos against two frame kinds. Warm editorial was picked for both. Soft light and Sparse geometry for the UI card only. Soft glass for the type frame only. Brutalist telemetry and Apple material for neither."
---

Which UI skills should an AI agent use for design? One skill is not enough. Eleven public UI skills, tested one at a time, all gave the same result: a decent but cluttered web hero. Then we tested six combos of skills on two kinds of film frame. One reviewer judged the frames blind. Only one combo, Warm editorial, won on both kinds.

## Why one skill fails on a film frame

An agent that makes a film frame tends to build a web page. It adds a nav, a pill, a small eyebrow label, a call-to-action button and wide section padding. A film frame needs none of these. A good frame has about one line and two or three things. The ground is never flat, and the eye knows where to go. The authors wrote UI skills for web interfaces, so they pull the agent toward the web habit.

## What we did

Round 1 used single skills. Eleven arms built the same frame: bolder, swiss-design, soft-skill, emil-design-eng, minimalist-skill, overdrive, frontend-design, landing-page, taste-skill, design-first-ui-prompting and gpt-tasteskill.

Round 2 used combos. Six arms built the same two frames for a fictional product. The first frame is a type frame ("Talk messy. Ship clean."). The second is a product UI summary card. One reviewer judged the frames blind (the test ran on 2026-10-09).

A combo is a named set of skills for four rungs: builder, type, colour and depth. The fifth rung, frame, always uses the vawe rules. The frame rung rejects web-page patterns, while the builder rung still builds the product UI as a real interface.

![The ladder. Builder, type, colour and depth take a fetched skill each. The frame rung uses our rules.](/blog/skill-combos/ladder.webp "Five rungs: four from skills, one from our rules.")

Every combo keeps the same reject list for web-page patterns: nav, CTA button, pill, eyebrow, section padding and cluttered hero. Each combo also rejects some defaults of its own skills. Warm editorial, for example, ignores the builder skill's ban on gradients, because our ground rule asks for grain plus a soft light. A skill can change the look. It never changes the layout.

## What we found

Round 1: all eleven single skills gave a decent frame, and all eleven frames were cluttered web heroes.

Round 2, one reviewer, one frame of each kind per combo:

| Combo | Type frame | Product UI card |
|---|---|---|
| Warm editorial | picked | picked |
| Soft light | not picked | picked |
| Sparse geometry | not picked | picked |
| Soft glass | picked | not picked |
| Brutalist telemetry | not picked | not picked |
| Apple material | not picked | not picked |

Warm editorial has a warm bone ground with grain and one soft warm light. It uses 1 px hairlines, a light grotesque with hierarchy by opacity, one terracotta accent and a layered neutral card shadow.

Two results surprised us. First, dropping the builder rung hurt. An earlier run used a colour skill without a builder skill, and the product UI turned into placeholder bars. Second, one combo is untested, and the file says so. "Crisp product" shares its builder and colour rungs with Apple material. Apple material lost, so we do not recommend it.

## What the numbers do not show

This is one reviewer and one run, with two frames for one fictional product. It tells us which sets to start from. It does not prove that the rejected skills are bad.

A combo proven for one kind of frame is proven for that kind only. A blended score across kinds would have hidden that Soft glass wins on type and loses on product UI. An untested combo becomes proven only after a still-frame test and a sign-off.

We used the same kind of blind choice for the [video component gallery](/blog/site-after-json). A featured bento of five video components sits above the gallery. A blind score from three reviewers on every clip chose them.

## How to use it

The six combos, with their rungs, rejects and evidence, are in `prompts/skill-combos.md` in the [vawe repo](https://github.com/vawe-hq/vawe). The brief template and the `DESIGN.md` advice carry the ladder, so a new film starts from it. To fetch one skill, run `command npx -y ui-skills get <slug>`. The [brief page](/docs/brief) shows how to ask for a film.

To rerun the test, build the same two frames once per combo and judge them blind for each frame kind.

## FAQ

**Which UI skills work best for AI agents?**
In our blind test, the Warm editorial combo was the only one picked for both a type frame and a product UI card. It uses minimalist-skill, swiss-design, colorize and beautiful-shadows.

**Is one UI skill enough for a design task?**
No. Eleven single skills all gave a decent but cluttered web hero. A set of skills plus your own composition rules worked better.

**Why keep the builder rung when the colour skill is good?**
A colour skill without a builder skill turned our product UI into placeholder bars. The builder skill makes the interface real.

**Can I trust a combo for any kind of frame?**
No. Soft glass won on the type frame and lost on the product UI card. A combo is proven only for the kind of frame it won.
