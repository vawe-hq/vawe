---
title: "LLM as a judge: start at reject, a video example"
description: "A judge that starts from reject, caps scores against two reference films per dial and keeps a ledger. Silent films scored 0."
date: 2026-10-11
updated: 2026-10-16
section: agents
topic: watching
docs: critique, quality-gates
tags: "llm as a judge, evaluation, ai agents, motion graphics, rubric"
keywords: "llm as a judge, llm judge rubric, llm judge reference comparison, llm judge ledger, evaluate generated video"
hero: /blog/judge-design/hero.webp
heroAlt: "Large number 0 with the caption sound score for a silent film, the judge that could not be argued with"
---

An LLM as a judge is a language model that scores another model's output against a rubric, in place of a person. In vawe, it scores a rendered film on eight axes. Fairness is the hard part: our first version gave a deliberately silent film 0 on sound, so that film could never pass.

This post shows how the judge works now. It starts from reject. It answers side-by-side questions against reference films and turns the answers into score caps. It keeps a ledger of its own advice, and it skips any axis that a film declares out.

## What the scoring agent reads and scores

On 30 September we added `judge --fresh`. It is a fresh, read-only agent that uses the Read tool only. It reads a deterministic contact sheet, six change-peak frames and a loudness line. It takes about 30 seconds and writes one JSON object. The run lives in `harness/media/judge-fresh.mjs`.

It scores eight axes from 1 to 10:

| Axis | What it asks |
|---|---|
| hook | does the opening hold attention |
| motion | how things move |
| scenes | how the shots are built |
| type | the text treatment |
| colour | palette and light |
| sound | the mix and the cues |
| pace | the rhythm of cuts and holds |
| expensive | does it look made by a person with taste, or assembled from a template |

The prompt in `quality/gates/rubric.mjs` tells the judge to default to reject. An 8 is good work, a 10 is rare, and any score under 8 needs a fix. The judge must also name the moment it looked at, so a reader can check each score against the frame.

## Three ways our first scoring agent failed

- It flipped. It asked for one value in one round and a different value in the next. One target went back and forth over three rounds.
- It punished choices. A film whose brief declared silence got 0 on sound. A film with no text lost points on type. Neither could pass, however good the rest was. One flower film "scored 0 and could never pass", and on type "three of four films lost it by construction".
- It had no outside bar. It compared a film only with our own earlier films, so a habit that all of them shared looked normal. We built an outside bar from 167 measured cuts, described in [a motion graphics quality benchmark](/blog/quality-bar).

## Compare with two reference films, then cap

The judge answers a side-by-side question against two reference films on four dials: text, colour, motion and craft. The premise, from a code comment, is that a judge asked "which is better" agrees with people more often than one that scores alone. So the scores follow the answers.

If our film loses a dial to both references, the axes on that dial get a cap of 6. If it loses to one, they get a cap of 7. A missing answer counts as a loss, and a cap can only lower a score. The mapping never changes:

| Dial | Axes it caps |
|---|---|
| text | type |
| colour | colour |
| motion | motion, pace |
| craft | scenes, expensive |

The code is `harness/lib/judge-bar.mjs`.

![Flow: a read-only judge reads a contact sheet, compares with two reference films per dial, applies score caps, writes a ledger, and the next judge marks each fix.](/blog/judge-design/flow.webp "One pass of the fresh judge, and where the ledger and fairness rules sit.")

## A ledger stops the scorer changing its mind

Each fix the judge asks for gets an id in a file next to the film. The next judge of that film must mark each open fix as fixed, partly or still before it may add new ones. A fix that undoes an earlier one must say which one and why.

Each fix also names what it changes, its value now and the value it wants. Sometimes the asked value for one target moves back and forth over three rounds (85, then 40, then 85, for example). Then the report prints a stop line: keep this at its current value, because the judge varies on this item. The report closes and counts a fix that it marks stale. Measured deltas go into the rubric as settled facts, so the model judges taste and only confirms the lines we mark. The code is `harness/lib/judge-ledger.mjs`.

Our digest records a working assumption: the judge varies by about 1 point per axis. After three rounds that flip one note, keep the value you measured.

## An author can decline an axis

The author declares it in the brief, in a form the harness can check. A brief that declares silence, with a Board sound row of "none" or a line "sound none", removes the sound axis. A brief that says "no text" removes the type axis and the text dial.

The declaration has to be checkable: a Board row or a line in the brief. A free-text excuse would become a loophole, and agents find loopholes fast ([18 of 36 films gamed one of our checks](/blog/loophole-audit)).

## The author never sees the score

A score shown to the author becomes a target. The printed report does not show one. The rubric lists each known trick, needs a cited second for each claim and respects the film's own `DESIGN.md`. The agent that rendered a film cannot record a PASS for it: the verdict step refuses.

## What we found

A trace review on 10 October gave these numbers for six weaker-model films:

| Measure | Value |
|---|---|
| Median first judged total (eight axes, each out of 10) | 45 |
| Films that passed | 0 of 6 |
| Totals of one film we judged to look wrong | 62, 61 and 62 |

The 62-point film shows a harness fault, not a judge fault. The film type was unknown, so the side-by-side comparison did not run, and the judge scored a film it never compared with its reference. [Can AI agents watch video?](/blog/watch-a-film) covers that trace and the fix: every check now defaults to the named reference.

We have not measured how often the judge agrees with a person. The 1 point figure is an observed spread, not an agreement rate. We also have no before and after of judge scores for the fairness fixes, only the cases that led to them.

## When an LLM judge is the wrong tool

Do not use it when a script can measure the thing. A flash length, a luma split or a cut time is a number. A model that eyeballs a contact sheet gets it wrong more often than a measuring tool that we tested. We push those numbers into measured deltas and let the judge confirm them.

Do not use it either if you dismiss what it says. Our judge reported a shrinking box three times and we called it a misread. It was a real render bug: the Puppeteer default viewport reset our render tabs (see section 7 of [headless Chrome screenshots differ between runs](/blog/determinism)).

## How to use it

Run `bin/vawe judge <page> --fresh` for a score in a separate headless session, never in the session that wrote the page. The [quality gates docs](/docs/quality-gates) list the other checks. For the checks around the judge, read [reward hacking in AI agents](/blog/loophole-audit) and [AI agent guardrails](/blog/advise-refuse). The harness around the judge is in [AI agent harness: design for the weaker model](/blog/weaker-model).

## FAQ

**What is an LLM as a judge?**
It is a language model that scores another model's output against a rubric, in place of a person. Ours scores a rendered film on eight axes from 1 to 10 and starts from reject.

**How do you stop an LLM judge from changing its mind between rounds?**
Keep a ledger. Each fix gets an id, and the next judge must mark each open fix as fixed, partly or still before it adds new ones.

**Why compare with reference films?**
A judge asked "which is better" agrees with people more often than one that scores alone. Our judge caps an axis at 6 if the film loses to both references on its dial, and at 7 if it loses to one.

**Should a silent film lose points for no sound?**
No. When the brief declares silence in a form the harness can check, the judge skips the sound axis.
