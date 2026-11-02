---
title: "AI agent tooling: design for the weaker model"
description: "Six films by a weaker model: median 13 drafts, 0 of 6 passed the judge. How to build defaults, checks and one command per step."
date: 2026-10-11
updated: 2026-10-16
section: agents
topic: agents
docs: agents, quality-gates, engineering-notes
tags: "ai agent harness, weaker model, advice, judge, agents"
keywords: "ai agent harness, agent harness engineering, design for weaker model, llm agent tooling, make agents succeed"
hero: /blog/weaker-model/symptoms.webp
heroAlt: "Four rows pairing a weaker-model failure with the harness change that answers it: attractor check, stills judge in dev, advice and error prefixes, and a judge ledger."
---

Design your AI agent harness for the weakest model you expect to run through it. A strong model covers the gaps in your tools. It reads a vague line, guesses right and moves on. A weaker model reads the same line and guesses wrong. That shows you where the harness is thin. "Harness" means everything around the model. That includes the commands, the lines they print, the checks, the scoring agent and the first docs it reads.

We build [vawe](https://github.com/vawe-hq/vawe), a framework where an agent writes one HTML page and gets a film. Since 2026-10-01 we run a weaker model next to the stronger one in every round of harness work.

## Four failures that were gaps in our tools

On 2026-10-01 we looked closely at one film from a weaker model. We saw four failures:

1. It named the brand with a name from our own list of stock names, and it drew a banded disc. Both were on the list of things to avoid.
2. It skipped the stills judge (the scoring agent that looks at still frames).
3. It read advice lines as blocking errors.
4. The judge changed its advice between rounds.

A better prompt would not fix any of these. The list named the traps and nothing checked for them. The advice lines looked like errors. The judge did not remember what it said the round before. A stronger model had walked past all four without a fault, so we had never seen them.

![Four failures and the harness change for each](/blog/weaker-model/symptoms.webp "Each failure and the change that answers it.")

## What we changed

Each change answers a failure at the point of action, with the fix printed in the line.

- Attractor check. `taste/attractors.json` holds the stock names and hero shapes. A test checks that the taste card quotes them. The `dev` and `new` verbs flag a match in the brand name and in each direction, and print the fix.
- Advice prefix. Every advice line from `dev`, `new` and the stills range check starts with `advice:`. Its block ends with `(advice only: ...)`. An error that stops the run starts with `error:`. `harness/lib/advice.mjs` owns the wording.
- Stills judge in `dev`. `bin/vawe dev` runs the stills judge itself when `brief.md` has three filled directions. It runs once per change of the directions or the slots, and prints its pick in three lines. `--no-judge` skips it.
- Judge ledger. The judge gives each fix an id. The next judge marks each open fix as fixed, partly or still before it adds new ones. It must say why a new fix reverses an old one. After three rounds on one target, the ledger prints a stop line.
- Motion lint for `window.seek` pages. The five motion rules also run on element boxes sampled over time (`harness/lib/box-track.mjs`). Canvas contents are out of scope, and the output says so.

Later, repeated judge findings became defaults in the starter page, the video components and the taste digest. The first 5 s sting that passed a fresh judge became the gold example, [`films/examples/colour-sting`](https://github.com/vawe-hq/vawe/tree/main/films/examples/colour-sting).

## What we found

The numbers come from a trace review on 2026-10-10, read with `vawe-dev runs --all`:

| Measure | Value |
| --- | --- |
| Weaker-model films | 6 |
| Median drafts per film | 13 |
| Median first judged total | 45 |
| Films that passed the judge | 0 of 6 |

The review also showed where the new checks did not reach. On one film, 15 of 17 `dev` calls used `--no-judge`, and the one stills judge that ran scored 17 on stills. The acceptance count stayed at 7 of 14 or 15 rows for 10 drafts in a row. Nine of 12 later drafts fixed no rule that had fired. Nothing counted the skip flag, so `vawe-dev runs` showed "judge -" for every draft.

## One rule, one owner

A cleanup pass on 2026-10-10 found a second gap. Two files, `tile.mjs` and `color-delta.mjs`, each kept a private copy of the Lab colour conversion. Each copy used rounded matrix constants and a 0.008856 cut. Our spec measure used other constants. So a colour distance could differ by about 0.001 between tools, and nobody looked because the gap was small.

Now `harness/lib/ref-measure/colour.mjs` holds `linearToLab`, `labOf` and `labToHex`, and both callers use it. The tile distance can shift by about 0.001, and that is the only behaviour change. Our rule has four steps. When a second caller needs a rule, move the rule to its owner. Switch the old callers. Check that behaviour did not change, and then add the new caller. An agent copies what it finds, so the owner of each rule must be easy to find and import.

We did not measure render time or agent success before and after this change. We make no claim that it made films better.

## Why not just use the strong model?

If the strong model passes, why spend days on failures it never makes? Its success hides the cause. A loop that works because the model guessed right fails on the next model, the next prompt or the next long session with thin context. The weaker model gives you those failures now, and each one points at a line of harness code. The changes cost the strong model nothing: `advice:` is two words, and a judge with a ledger is fair to every author.

There is a second reason. Our target is a first draft that passes a fresh judge. A fix loop hides weak defaults. A strong model repairs a weak default by the third draft. A weaker model does not, so the default must be good.

## Where we could be wrong

The 0 of 6 is the uncomfortable number. We cannot yet show that designing for the weaker model makes it succeed. We can show a list of gaps that it found and the stronger model did not. Some gaps may matter only for weak models. We will know more when a weaker-model film passes, and we will count the drafts it took.

## How to use it

1. Run your weakest model through your loop, not your best one.
2. Read the trace. Fix each failure at the line where it happens, not in the prompt.
3. Print the fix in the message that reports the problem.
4. Count the skip flags. A check that the agent can skip without a trace does not run.

Each part of the harness has its own post:

- [CLI design for AI agents](/blog/one-binary): one binary with one verb per step.
- [Make an agent ask questions first](/blog/new-asks): `vawe new` asks five questions and writes nothing until you answer three.
- [AI agent guardrails](/blog/advise-refuse): every check advises, and only a few things refuse.
- [How long AGENTS.md should be](/blog/read-load): the words an agent reads first, measured.
- [AI agent observability](/blog/run-logs): one JSONL line per command.
- [LLM as a judge for video](/blog/judge-design): the scoring side of the loop.

## FAQ

**What is an AI agent harness?**
It is everything around the model: the commands it runs, the lines they print, the checks, the scoring agent and the docs it reads first. Good harness design lets a weaker model finish the task.

**Why design a harness for the weaker model?**
A weaker model fails where the harness is vague, and a strong model hides that gap by guessing right. Each failure points at a line you can fix.

**Did designing for the weaker model make it pass?**
Not yet. After the fixes, 0 of 6 weaker-model films passed the judge, with a median of 13 drafts per film.

**How do I stop an agent from reading advice as an error?**
Prefix every advice line with `advice:` and every blocking error with `error:`. We did this in `harness/lib/advice.mjs`.
