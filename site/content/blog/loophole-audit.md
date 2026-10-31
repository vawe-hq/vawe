---
title: "Reward hacking in AI: 18 of 36 agent runs gamed a check"
description: "18 of 36 films passed a live-hold check with a slow camera drift. Our own advice line taught the trick. How to write checks agents cannot game."
date: 2026-10-10
updated: 2026-10-16
section: agents
topic: agents
docs: quality-gates, waivers, engineering-notes
tags: "ai agents, reward hacking, automated checks, testing, harness design"
keywords: "reward hacking ai agents, agents gaming checks, goodhart's law agents, acceptance criteria for ai agents, test fixtures for checks"
hero: /blog/loophole-audit/hero.webp
heroAlt: "Large text 18 of 36 with the caption films drifted the camera, because our own advice taught them how"
---

Reward hacking in AI agents means an agent changes the cheapest thing that turns a check green. In our audit of 36 film pages, 18 ended a held shot with the same slow camera drift. The cause was ours. Our live-hold check counted any motion in a held shot as alive. The advice line it printed said "keep one thing moving (a slow drift on the ground or the hero)".

Nobody told the agents to cheat. They read the output of a check, found the cheapest change that made it pass, and applied it. This post covers the audit, the three causes behind almost every loophole and the fixes. It also covers a second case: a scoreboard that measured the agent's own plan.

## What we checked

[vawe](https://github.com/vawe-hq/vawe) turns one HTML page into a film. A set of 107 rules checks the page. Many of the checks are global and binary:

- Live-hold asks whether fewer than 2 percent of pixels changed over 0.3 s. A 1 to 6 percent scale push on the whole stage passes it.
- Moving tail asks whether any animation runs on a visible element in the last second. Animating everything a little passes it.
- Living ground asks for a layer that paints a gradient or an image over 15 percent of the frame. An empty full-frame div with a faint radial gradient passes it.

## The one question

The audit was read-only. We rendered nothing and edited nothing. For each check we asked one question: what is the cheapest change that turns it green? Then we counted how many of the 36 films already used that change. The counts come from a grep of the page source. They show a pattern in the code, not a measured render.

| Pattern in the page source | Films |
|---|---|
| slow scale or translate drift | 18 of 36 |
| drifting blob ground | about 7 of 36 |
| full-frame grain overlay | 23 of 36 |
| full-frame gradient layer | 30 of 36 |
| `data-gain` set although the guide says leave it off | 19 of 24 with audio |
| synth bed, the cheapest way to meet a loudness check | 4 of 24 with audio |
| a declared spectacle second | 25 of 36 |

Gradient and grain are mostly honest, because our rule asks for a lit ground. The check could not tell a lit ground from a transparent layer. The spectacle second matters because the check lets an author move it to the strongest second after the fact.

Waivers told a different story. There were 13 waiver entries in 8 pages, and 2 were dead, because no check emitted the code they waived. None hid the camera drift or the bed. Those films were green because of the trick, not because of a waiver. Also, 21 of the 107 rules had no check at all.

![Bar chart of tricks found in the page source of 36 films.](/blog/loophole-audit/tricks.webp "Patterns found in the page source of 36 films.")

## Three causes

1. The advice named the trick. Besides the live-hold line, the digest said to end on a slow push or drift. The grain rule called grain the cheapest fix. An agent obeys the advice it gets.
2. The measure was global. It counted whole-frame pixel change, any running animation or any gradient box. A global measure has a global cheap answer.
3. One exemption covered about ten checks. Text marked `aria-hidden` or `data-chrome` skipped most text checks at once. One attribute could exempt a line of copy from all of them.

## The fixes

Each fix has the same shape: exclude the global cheap change from what counts.

- Live-hold no longer counts a whole-frame camera move, and the starter page no longer drifts the camera.
- Living-ground and blank-frame now measure what a layer paints against the ground. Grain, a blend overlay or a faint gradient is not a ground.
- The moving-tail, grain, acceptance and spectacle lines now name the real fix. The docs no longer recommend a drift as the hold.
- A reviewer rubric lists each known trick and needs a cited second for a claim. The [scoring agent post](/blog/judge-design) explains it.
- Waivers follow rules in [AI agent guardrails](/blog/advise-refuse).

![Diagram: ask each check the cheapest-change question, exclude global answers, then fixtures, advice, waivers and rubric.](/blog/loophole-audit/audit-loop.webp "The audit question and the four things that came out of it.")

## A fixture page for every trick

The change we trust most is a test. For each trick the audit found, `tests/fixtures/tricks/` holds a fixture page, and an honest page sits beside it. `tests/media/tricks.test.mjs` runs the checks on each. A check that stops catching its trick shows up as a failing test. The honest page proves that the check still passes real work, which is the half people forget. Before this, nobody tested that the checks reject cheats, so a fixed loophole could return unseen.

To run it from the repo root:

```sh
node --test tests/media/tricks.test.mjs
```

We ran it for this post: 11 tests passed in about 18 seconds. The checks live in `quality/gates/page-check.mjs` and `harness/lib/`.

## A second case: the scoreboard that measured its own plan

A scoreboard can leak in the other direction: it can measure the agent against the agent's own plan. Every `vawe new` brief carries a Spec with tables for shots, words and objects, and an Acceptance table. `harness/lib/acceptance.mjs` parses those tables after each draft. It counts frozen runs, jerky steps and jumps, and compares the words, objects and cuts in the film with the Spec. It prints one table with a trend line.

In a trace review of one weaker-model film, the table stayed at 7 of 14 or 15 rows green for ten drafts. In 9 of the 12 drafts after the first, the log field `rules_fired` showed "fixed none". Fifteen of 17 `dev` calls ran with `--no-judge`. The one stills judge that ran scored 3, 2 and 2 for its three candidate frames, and no judge ran on a later draft.

![Three counts from one film: 7 of 15 rows green, 9 of 12 drafts that fixed nothing, 15 of 17 dev calls with the judge skipped.](/blog/measured-brief/counts.webp "Three counts from one film.")

There were two root causes:

- The rows measured the agent's own tables. The agent wrote the Spec, built the page, and then the script checked the page against the Spec. A film can match its own plan and still look nothing like the film it should match. Such a check shows consistency, not quality.
- The thresholds came from a generic range. The range used 17 reference films, not the one reference the brief named. A 0.3 s shot got a requirement of "needs 5.00 s".

The trace also showed "7 of 14" and "7 of 15" for the same table, because the row count moved while we measured. Now a draft prints "N of M measured green, K more at ship (15 rows)", with one denominator.

The fix list was short. Judge against the named reference at least once every three drafts. Take thresholds from that reference. Make `refs`, `critique` and `judge` default to the reference the brief names. We have no before and after on one film, so we do not claim the scoreboard now works.

## What we still do not know

We have the before numbers and no after. We did not rerun the grep on a fresh set of films, so we cannot say how many films still cheat. The fixtures prove that the checks reject the tricks we know. They say nothing about the next one.

## How to use it

Ask this question of every new check: what is the cheapest change that turns it green? If that change is global, exclude it. Then add a fixture for the trick and an honest page that must pass. The [quality gates docs](/docs/quality-gates) list the checks.

## FAQ

**What is reward hacking in AI agents?**
It is when an agent meets the letter of a check without the intent. In our audit, 18 of 36 films passed a live-hold check with a slow camera drift.

**How do I stop an agent from gaming a check?**
Ask what the cheapest change is that turns the check green, and exclude it if it is global. Keep a fixture page for each trick and an honest page that must still pass.

**Can advice text cause reward hacking?**
Yes. Our own advice line said "a slow drift on the ground or the hero", and agents drifted on every hold. The advice now names the real fix.

**Why not check an agent against its own plan?**
The check then shows only that the work matches the plan. In our trace, 7 of 14 or 15 rows stayed green for ten drafts, and 9 of 12 drafts fixed nothing the rules named.
