---
title: "AGENTS.md best practices: how long should it be?"
description: "AGENTS.md best practices from data: we cut what agents read first from 5,402 to 2,239 words, then it grew back to 4,602 in ten days."
date: 2026-10-11
updated: 2026-10-16
section: agents
topic: agents
docs: agents, cli, engineering-notes
tags: "agents.md, context budget, documentation, ratchet, taste rules"
keywords: "how long should agents.md be, agents.md best practices, agent context budget, agents.md length, claude.md length"
hero: /blog/read-load/hero.webp
heroAlt: "Bar chart of words an agent reads before its first layer, from 5,402 on 2026-09-27 down to 2,239 on 2026-10-01 and back up to 4,602 on 2026-10-11."
---

How long should AGENTS.md be? From two weeks of measurement: keep what an agent must read before its first action near 2,000 words, and expect it to double anyway. We cut that reading from 5,402 words to 2,239 in four days. It grew back to 4,602 words in ten days.

We track one number: everything an agent reads before it writes the first layer of a film. Every session pays that cost, so it matters more than the length of one file. The question started with the weaker model, which skipped our long rule docs (see [AI agent harness: design for the weaker model](/blog/weaker-model)).

## What counts as words read first

`harness/dev/bench.mjs` counts the words an author reads before the first layer of a [vawe](https://github.com/vawe-hq/vawe) film. Five files count:

| File | Words at the time of writing |
|---|---|
| a one-line pointer file | 21 |
| `AGENTS.md` | 1,678 |
| the taste digest (`taste/build/DIGEST.md`) | 400 |
| the page-writing skill | 1,742 |
| the starter page that `vawe new` writes | about 794 |
| total | 4,635 live, against a stamped 4,602 |

The bench turns words into tokens with one fixed factor, 1.33. So the token figures here are estimates, not tokenizer counts.

## What we found

Each row is a re-stamp of the ratchet value in `quality/baselines/bench-ratchet.json`.

| Date | Words |
|---|---|
| 2026-09-27 | 5,402 |
| 2026-10-01 | 2,239 |
| 2026-10-05 | 2,714 |
| 2026-10-07 | 3,215 |
| 2026-10-09 | 3,947 |
| 2026-10-10 | 4,450 |
| 2026-10-11 | 4,602 |

Other re-stamps in between read 2,768, 3,420 and 4,444 words. In tokens, the low point was 2,978 and the 2026-10-11 stamp was 6,121. From 1 to 9 October the count rose 76%. By 11 October it was more than twice the low.

![Bar chart of the read-load stamp: 2,654 words before the diet, 2,239 after, then 2,768, 3,420, 3,947, 4,444 and 4,602 by 11 October](/blog/taste-digest/read-load.webp "The stamp at each re-stamp. The diet is the second bar.")

Rules over 500 characters moved the other way. A second ratchet counts them across the agent-facing docs (`quality/gates/rule-length.mjs`). The count fell from 324 to 42 on the day we merged duplicate rules. The 500-character limit is our choice. We assume that an agent skims a long rule more. We did not measure that.

## How the cut from 5,402 to 2,239 happened

Most of it was deletion. On 2026-09-30 two rewrites of the craft docs removed 5,258 lines in 27 files and 7,461 lines in 58 files. They deleted the docs of our old JSON scene format ([why it went](/blog/html-over-json)).

The last step was a merge of lists. On 2026-10-01 we moved the pitfalls in `AGENTS.md` and the page-writing skill into one list in the taste digest. Both documents got shorter. For that change alone, read-load fell from 2,654 words (about 3,530 tokens) to 2,239 words (2,978 tokens).

Two other changes moved reading out of the always-read set:

- Advice at the step. From 30 September, `dev` and `ship --status` print 5 to 8 "do X, not Y" lines for their own step. Each line quotes its row in the taste card, and a test fails when a quote leaves the card. A draft render of a 4 s starter took 4.3 s with the lines printed, the same as without.
- One file per rule. On 5 October the rules got one owner: `taste/rules/` holds one file per rule (98 at that time). A generator, `harness/dev/taste-build.mjs`, writes the card, the digest, `steps.json` and `limits.json`. We resolved ten conflicts between the old files.

This is one rule, shortened:

```
id: exits-shorter
step: motion
principle: An exit is a launch: it runs shorter than its entrance and accelerates.
limit: an exit shorter than its entrance
range: exit 0.35 to 0.6 of the entrance duration
break-when: the exit is a settle or a hand-off and the page says so
instead: exit on EASE.launch with leave(el) from core/motion/presets.js
check: exit-length
digest: Exits are faster than entrances: shorter, on EASE.launch.
```

Only the `digest` line is in the always-read set. The rest prints when a check fires. Twelve draft checks read the page from the DOM, and each cites its taste rule and the number from `limits.json`.

## How to keep a rule honest

When you change a rule, cite the measurement. A hard gate is also allowed if the number says it helps. The rule came from a rule that worked too well. One line in our docs said "keep one thing moving (a slow drift on the ground or the hero)". A grep of 36 films found 18 with a slow push or drift on the camera or ground. The advice said "a slow drift", so agents drifted on every hold. [Reward hacking in AI agents](/blog/loophole-audit) has the full audit.

A rule that changes in a doc must change in its check too. A test asserts that they agree. `tests/lib/bar-lint.test.mjs` gives `text-lingers`, `readable-hold` and the scene limit lines of 1, 4 and 8 words. All three must answer the same.

## What the numbers do not show

The file list changed on 2026-09-30, when we deleted the JSON format and the bench stopped counting the old stage skills. So 5,402 and 2,239 count different files. Only the trend is comparable, not the ratio. On that day the stamp also read 987 words for a short time. The old docs were gone and the new ones did not exist yet. The next stamps read 1,739 and 2,208. A ratchet that only goes down would reward that dip.

The series does not show that shorter reading made better films. A trace review of six weaker-model films on 10 October found a median of 13 drafts and a median first judged total of 45. None passed the judge. That measures the whole harness on that day, and we cannot assign any part of it to the digest.

Fewer long rules did not mean fewer words. The regrowth came from real additions. They are brief phases, a Board table and the skill ladder. They also include the lens and `vawe see` verbs, a transitions skill, an ideas method and an approval rule. Each answered a failure. The change that added the new motion path added 71 words, 1.3 percent of what an agent reads before its first layer.

## How to use it

Count the files your agent must read before its first action, not the whole docs folder. The bench runs in both git hooks of the repo (the two files in `.githooks/`). When the live count is above the stamp, it warns:

```
read-load grew to 4635 word(s), up from the stamped 4602.
An agent now loads more before writing its first layer.
If deliberate, re-stamp: node harness/dev/bench.mjs fast --stamp
```

The hook warns and never blocks. We expected a hard wall on a word count to invite padding the starter or moving words into a file the bench does not read. We did not test that expectation. The warning turns growth into a decision: the author prunes or re-stamps on purpose, with a reason.

![The ratchet loop: edit a doc, the hooks run the bench, the bench warns when the count grew, the author prunes or re-stamps.](/blog/read-load/diagram.webp "The ratchet loop.")

Then move each rule to the step where it applies. Our verbs print their docs line when they run, which costs the agent nothing until that stage arrives (see [one binary, one verb per step](/blog/one-binary)). The [quality gates docs](/docs/quality-gates) list which checks advise and which refuse.

## FAQ

**How long should an AGENTS.md file be?**
We keep the always-read set near 2,000 words. Ours grew from 2,239 to 4,602 words in ten days as real failures added real rules.

**What should I count, the file or everything the agent reads?**
Count everything the agent reads before its first action. For us that is five files: a pointer file, `AGENTS.md`, the taste digest, a skill and the starter page.

**Does a shorter AGENTS.md make agents better?**
We cannot say. Six weaker-model films after the cut had a median of 13 drafts, and none passed the judge. We cannot assign that result to the length.

**Should a word limit block a change?**
We chose a warning over a block. We did not test the block, but we expected it to invite padding.
