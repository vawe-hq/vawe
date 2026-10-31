---
title: "AI agent guardrails: when a check should refuse"
description: "Advise by default. Refuse only for a render that cannot repeat, a waiver with no reason, or a final with no approval. 13 waivers audited."
date: 2026-10-11
updated: 2026-10-16
section: agents
topic: agents
docs: quality-gates, waivers, engineering-notes
tags: "ai agent harness, guardrails, agents, rendering, waivers"
keywords: "ai agent guardrails, agent approval gate, advisory checks, lint suppression comments, harness design"
hero: /blog/advise-refuse/hero.webp
heroAlt: "Two columns. Advise: every check prints a line starting with advice and the command continues. Refuse: only a non-deterministic render, a waiver with no reason and a final without approval stop a command."
---

An AI agent guardrail should refuse only in two cases: the output is wrong, or the work is lost. In every other case it should advise. In [vawe](https://github.com/vawe-hq/vawe), an agent writes an HTML page and the harness renders it into a film. That rule leaves three refusals: a render that cannot repeat, a waiver with no reason, and a final render without a person's approval. Every other check prints a line that starts with `advice:` and lets the command continue.

A guardrail can fail in two directions. It can stop the agent when the agent was right. Or it can wave through something expensive that nobody looked at. This post shows where we put the line.

| Check | What happens | Why |
|---|---|---|
| A render that cannot repeat | refuses, one line, exit code 2 | the film is wrong |
| A waiver with no reason | refuses | the page does not say why it breaks the rule |
| A final without approval | refuses, tells the agent to show the draft to a person | minutes of render on a film nobody has seen |
| A missing frame | refuses | a broken encode |
| A flat frame | advises | it may be a colour block or a flash |
| Every other check | advises | the check cannot see the intent |

## Why most checks only advise

A check does not know the context, so it cannot tell a real failure from a choice. A colour block or a white flash is a legitimate frame in a film. A check that fails the render because "this frame is blank" is wrong for a film whose point is the flash. On 2026-09-30 a flat frame stopped refusing and started advising. The code comment says a missing frame is a broken encode. A flat frame may be a colour block or a flash, so it only advises.

So a guard should clamp, tolerate or reclassify. A hard refusal stays for the cases where the output is wrong or the work is lost.

## What makes a render refuse

Time on a page is the seek, never the clock (see [a virtual clock that seeds Math.random and freezes Date.now](/blog/page-clock)). A render that cannot repeat is not a render. A small set of invariants fail with one line each and exit code 2. They are audio tags, fonts, a missing frame, frame count, brief drift and `vawe.assert`.

## How a page breaks a rule on purpose

The page declares a waiver with its reason, in a small JSON block. The reason travels with the page and lives nowhere else. A waiver with a reason passes. A waiver without one refuses. So the author of the page stays in charge of the rule.

### The audit of 13 waivers

The first version asked little of the reason. A waiver named a code, such as `text-low-contrast`, plus one `_why` string longer than 12 characters. A bare code covered every finding of that code in the film. A waiver written for one word at 2.25 s also hid a contrast failure at second nine.

We audited 36 film pages (the same read-only pass as in [reward hacking in AI agents](/blog/loophole-audit)). Here is what we counted:

| Finding | Count |
|---|---|
| waiver entries | 13, in 8 pages |
| `dead-air` over a range (one code that covered four checks, so each hid four) | 5 |
| bare, film-wide waivers in the gold example that agents copy | 3 |
| codes that no check emits (`glow`, `off-colour`) | 2 |

The gold example is the finding that stuck. Agents copy examples. A gold example with film-wide waivers and a reason with no place and no number teaches every new film to write the same. A reviewer cannot check such a reason either.

### What a reason must say now

Length was the only test, and an agent can write 60 characters of nothing. So the rule moved from the length of a reason to its content. One function decides whether a reason counts: `entryHasReason` in `harness/lib/waivers.mjs`.

A waiver has the form `code@second` or `code@a-b` for a range, with one code per check. We retired `dead-air`, and using it prints the four codes to choose from. A scoped waiver does not cover a finding that has no second. A reason must pass five tests:

1. It has at least 12 characters.
2. It is not generic. The check removes "intentional", "by design", "deliberate", "stylistic", "fine", "ok" and "as intended". Three real words must remain.
3. It names a place: a scene id of this page, or a second.
4. It names a measured value with its unit, such as `4.4:1` or `42%`.
5. The same reason appears on at most two waivers of the page.

A refusal prints the missing part, for example "the reason names no measured value: write the number the check printed, with its unit". The agent fixes it in one step.

![The five tests a waiver reason must pass.](/blog/waivers/diagram.webp "The five tests a reason must pass.")

The scoring agent sees every waiver too. Here is a reason that passes, from the public example film `colour-sting`:

```
"text-low-contrast@2.25": "world hot, 2.25 s: 'nsen' crosses the dye flood
mid-move at 4.4:1 against the 4.5:1 limit and lands readable by 2.5 s"
```

It names the scene, the second, the measured ratio and the limit. A reviewer opens the film at 2.25 s and checks it in ten seconds.

We did not ban waivers. A film can hold a word at low contrast for a beat on purpose. A check that nobody can waive turns a deliberate choice into a fight with the tool. A waiver that states its evidence keeps the escape hatch and makes each use reviewable. `tests/lib/waivers.test.mjs` pins the behaviour. A second audit over the same 36 pages did not run, so we have no after-count.

## Why the final render needs a person's approval

A final render is the slow step. Agents spent it on films that no person had seen, and then waited. In one traced session, 12 status calls took 3,922 seconds across 4 finals, about 16 minutes per final. Three other traced finals took 390, 400 and 421 seconds. Both figures come from trace reviews of agent sessions, not from a benchmark, and we did not reconcile the two sessions.

![Bars showing three traced final renders at 390, 400 and 421 seconds, and one session that spent 3,922 seconds in 12 status calls for 4 finals.](/blog/advise-refuse/diagram.webp "Traced final renders and one slow session.")

Since 2026-10-11, `vawe ship` refuses a final unless a person approved the current page. The approval is a file, `out/<film>.approved`, keyed on a hash of the page and every file it references. An edit changes the hash, so the command refuses a changed draft again. Unattended runs set `VAWE_UNATTENDED=1`. The command then prints that it checked no approval. If a named agent approves a draft it also worked on, the scoring agent sees a `self-approved` flag. The refusal tells the agent what to do: show the draft to a person and stop.

The gate does not make a final faster. It makes sure the slow render happens for a draft that someone has seen. [AI agent observability](/blog/run-logs) shows where those sessions spent their time.

## How to word advice so an agent keeps going

The first word of the line carries the meaning. In a trace of a weaker model, the agent read advice lines as blocking errors. Now every advice line starts with `advice:`. Its block ends with `(advice only: the render continued)`. An error that stops a command starts with `error:`. `harness/lib/advice.mjs` owns the format, so no check writes its own.

The same rule applied to the shell. We had a hook that refused `for` loops and `sed -i`. We reverted it the same day. Now guards stay only on the four git commands that lose work. [CLI design for AI agents](/blog/one-binary) tells that story.

## Limits

We have numbers for the problem and no clean before-and-after for the approval gate. An advise-first harness also relies on the agent reading the advice. A weaker model does not always do that, and [the weaker-model data](/blog/weaker-model) shows that advice alone did not get it to a passing film.

The [quality gates docs](/docs/quality-gates) list which checks advise and which refuse. The [page contract](/docs/the-page) shows the waiver block.

## FAQ

**When should an AI agent guardrail refuse?**
Refuse when the output is wrong or the work is lost. In vawe that means a render that cannot repeat, a waiver with no reason and a final without approval.

**What should a lint suppression comment contain?**
It should name the place and the measured value, such as a second and a ratio with its unit. A comment like "intentional" or "by design" tells a reviewer nothing.

**How do I stop an agent from reading advice as an error?**
Start every advice line with `advice:` and every blocking error with `error:`. Put the rule in one file so no check writes its own wording.

**Why not ban waivers?**
Some rules should break on purpose. A waiver that states its evidence keeps that option and stays reviewable.
