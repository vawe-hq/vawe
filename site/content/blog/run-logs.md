---
title: "AI agent observability: one JSONL line per command"
description: "One JSONL line per command with stage, seconds and exit code. An agent guessed 18 min for a 6.2 min task. Trace reading found 74% of a session was waiting."
date: 2026-10-10
updated: 2026-10-16
section: agents
topic: agents
docs: files-and-outputs, cli, engineering-notes
tags: "observability, run logs, ai agents, jsonl, agent traces"
keywords: "ai agent observability, agent run logs, jsonl log, debugging ai agents, long-running commands for ai agents"
hero: /blog/run-logs/hero.webp
heroAlt: "One JSONL log line per verb call, with stage, duration, exit code, slot wait and images, feeding a runs report for time, failures and the draft series."
---

To add observability to an AI agent workflow, make the tool log every call. Then you can answer three questions without asking the agent. Where did the time go? What failed, and why? Did each draft fix what the last one flagged? In [vawe](https://github.com/vawe-hq/vawe) the log is one JSONL line per command in `out/<film>.runs.jsonl`, and a report command reads it.

We started on 2026-10-04. We asked an agent to log how long each step of a 6.2-minute task took. It returned a table that summed to about 18 minutes. It had run `date` once, typed the other timestamps by hand and guessed its own thinking time. It said so, but the numbers still looked like measurements. A language model has no clock while it thinks. It sees time only in tool output. So we wrote a rule: ask an agent what it saw and decided, never how long something took.

![Asking the agent for the duration of a 6.2 minute run gave about 18 minutes. The run log carries the measured seconds.](/blog/run-logs/diagram.webp "The agent's guess was nearly three times the measured time.")

## How to log every command

You need three things. One entry point that every command passes through (ours is `bin/vawe`, see [CLI design for AI agents](/blog/one-binary)). One append-only file for each unit of work, which is one film for us. And a way for child processes to report facts the entry point cannot see, such as a queue wait.

Our first log covered only `new`, `dev`, `judge` and `ship`. That was enough to start and not enough to keep. In one trace review the log held 21 lines for 162 tool calls. The verbs `strip`, `frames`, `compare`, `velocity`, `onion`, `critique` and `audio` left no record. A failed or killed draft wrote nothing, and time spent waiting for a render slot sat inside the draft's wall time.

So every verb now appends one line per call, including the calls that fail. The line holds the verb and its arguments, and the stage the film was in. It holds the start time and the duration in seconds, and the exit code and error reason. It also holds the wait for a render slot, the images the call printed, and a `tagged` field. The `tagged` field says whether the run named an agent through `VAWE_AGENT`. Set `VAWE_AGENT=<name>` and `VAWE_MODEL=<model>` in the agent's shell.

The tool measures every field itself. A child script reports facts such as the slot wait to the main process through a small notes file. The agent writes nothing to the log, so it cannot get the log wrong. The event shape is in `harness/lib/runlog.mjs` and `harness/lib/verb-log.mjs`.

Every call also ends with a result line, `vawe: dev ok in 38.2s` or `vawe: dev FAILED (reason) in 38.2s`. Agents pipe output into `tail` and lose the exit code, and the footer keeps the result visible. The log groups failure reasons by cause. "Render slot or navigation timeout" and "browser lost" then show as counts and not as 40 different strings.

## How to read the log

A JSONL file that nobody reads is storage, so the report is part of the tool. The command `vawe-dev runs <film>` shows time per stage and verb, failures and their causes, and the draft series. The flag `--all` gives one row per film for the last 30 days. The flag `--taste` reports, for each rule, how often it fired and how often an agent fixed it. It also shows how often the rule fired again in the next draft. The report code is in `harness/lib/runs-report.mjs` and `harness/dev/runs.mjs`.

This is the report for a film with one draft, as we ran it today:

```sh
bin/vawe-dev runs hello
# where time went: 1 verb calls, 0 min of verb time, none tagged with VAWE_AGENT
#   stage  calls  secs  slot wait  failed
#   brief  1      6     0          0
#   verb  calls  secs  slot wait  failed
#   dev   1      6     0          0
# what failed: nothing
# drafts 1 · median draft 5.4 s · no PASS yet · first judged total -
# vawe: runs ok in 0.1s
```

## What the log and the traces showed

The log joined with the agent transcripts gave three results. A small script paired every tool call in a transcript with its result and rebuilt a timeline for each session. The reviews made no render, ran no test and changed no file. They have limits: parallel calls overlap, so the tool-time columns count them twice, and cost fields in resumed sessions may be cumulative.

### Where the time went

In one 20 s film session, 81.5 of 110 minutes went to final renders and their polls. That is 74% of the wall time. The agent made 170 tool calls. Drafting, which we had tuned for weeks, took 7%. An 8 s film session spanned 73 minutes, 56 of them active. The agent made 162 tool calls: 106 Bash, 53 Read, 2 Write and 1 agent call. It started 3 finals that took 390, 400 and 421 s, and it waited with 16 polls of 100 s each.

![Stacked bar of one 110-minute session by stage. Ship and waits take 81.5 minutes.](/blog/trace-reviews/session-time.webp "74% of the session was final renders and polls.")

Of 130 Bash calls in the 110-minute session, 52 were `ship --status --wait` polls. The agent often sent three or four in one message, and they ran one after another, each blocking up to 100 s. Those polls held 17.6M of the session's 40.7M cache-read tokens, 43%. API time was 1,235 s of 6,630 s (19%), and tool time was 5,562 s (84%). The two overlap, but tool time dominated.

### What failed

Three of the 5 finals in that session failed, at a cost of 2,967 s: 49 minutes, 45% of the session. Two of them had captured to 100% (the log shows `capturing 19198/19200`) and then died at the audio mux step with a "detached Frame" error. The log recorded `failedAt: 0`, so the next ship started from the beginning and captured everything again. The third lost a slice after four tries, because another process closed the shared browser. In one review the agent piped 134 of 140 `vawe` calls into `tail`, `head` or `grep`. The tool flag then showed 2 failures per session, and the real count was higher.

### Whether drafts converge

In one review, 9 of 12 later drafts fixed no rule that the earlier draft had fired. Before the log we could only suspect a draft loop that does not converge. After it, we could count it. The docs audit also used `rules_fired` across 377 `dev` runs over 59 films to see which rules fired most and which never did. [How long AGENTS.md should be](/blog/read-load) shows what that audit cut.

## Fixes the traces led to

A final render can take about 16 minutes, and a Bash call over 120 s moves to the background, where the agent loses the thread. With no single call that could wait, the agent wrote its own polling loop. We changed how a long command talks to an agent.

- The `ship` verb runs in the background by default. It starts a job and returns. The `--wait` flag blocks, and `--status` reports progress or the result. It cancels a duplicate job.
- The `ship --status --wait` call blocks for up to 9 minutes and prints a progress line each minute. A long block then never looks like a hang. The result names the next call and the number of calls left.
- The `vawe wait` verb blocks on any render of a film, draft or final, with the same progress line. AGENTS.md says to run it once and not in parallel.

Drafts also stood in line behind finals. A machine has two render slots by default (`VAWE_RENDER_SLOTS`), and a final holds one for minutes. Inside `dev`, the slot wait was 357 s of 427 in one film and 339 of 395 in another. Three more films gave 172 of 200, 155 of 243 and 133 of 247. The five waits add up to 1,156 s. A final now never takes the last free slot, so a draft no longer queues behind finals. When a slot is busy, the waiting line names the holder and its age. The slot logic is in `harness/lib/render-slots.mjs`, and the background job is in `harness/media/ship-job.mjs`.

Other fixes made failed work recoverable:

- A mux failure keeps the capture and records the real stage.
- A resume finds its frames, because the kept-frames folder uses the file bytes as its key and not the file times. [Resume a failed Puppeteer render](/blog/resumable-finals) tells that story.
- Per-frame DOM probes no longer run on a canvas film. `dev --fast` on one canvas film went from 109 s to 26 s.
- The `vawe sound` verb reads cues shorter than one second. It had failed 8 of 19 calls with a message that hid the cause.
- A final needs a person's approval of the current page. Agents had shipped a 16-minute final on their own whenever they finished. [AI agent guardrails](/blog/advise-refuse) explains the gate.

We did not rerun the reviews after the fixes, so we have before numbers and no clean after. In the sessions we read next, agents no longer stacked parallel polls. That is not a time saving we can quote. The next review should measure the share of a session spent waiting, against the 74% here.

## Where per-command logs go wrong

- A skip flag without a counter hides intent. An early `vawe-dev runs` printed "judge -" for every draft, because `--no-judge` had no counter.
- A log that records only success hides the calls you most want to see.
- A queue wait inside a duration looks like a slow tool. Give it its own field.
- The log lacks intent. It tells you which call took 38 seconds. The transcript beside it tells you what the agent tried to do.

The [troubleshooting page](/docs/troubleshooting) covers the failure causes the log groups, and [the critique page](/docs/critique) applies the same idea to the film itself. For the rest of the harness, read [AI agent harness design for the weaker model](/blog/weaker-model).

## FAQ

**How do I add observability to an AI agent?**
Make the tool log every call as one JSONL line with the stage, the duration, the exit code and the error. Measure in the tool, never in the agent, and write a report command that reads the file.

**Can I ask an agent how long a step took?**
No. A language model has no clock while it thinks. Ours reported about 18 minutes for a task that took 6.2.

**How should an agent wait for a long-running command?**
Give it one blocking call with a progress line each minute, and a result line that names the next call. Before we did, one session spent 43% of its cache-read tokens on 52 polls.

**Why log failed commands too?**
A log that records only success hides the calls you most want to see. A render that failed twice at 100% capture cost one session 49 minutes.
