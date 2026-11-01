---
title: "CLI design for AI agents: one binary, one verb per step"
description: "CLI design for AI agents: one binary with 24 verbs, one-line usage errors, a result line that survives a pipe and a hook that names the next step."
date: 2026-10-10
updated: 2026-11-02
section: agents
topic: agents
docs: cli, quality-gates, engineering-notes
tags: "cli, ai agents, harness, developer experience, hooks"
keywords: "cli design for ai agents, cli for ai agents, ai agent cli, agent hooks, agent shell commands fail"
hero: /blog/one-binary/hero.webp
heroAlt: "Before and after diagram: a 156 line Makefile with routers and scripts becomes one command, bin/vawe, with a 19 line Makefile that only forwards."
---

How do you design a command-line tool for an AI agent? Give it one entry point, one verb for each step, and an error that fits on one line. Our agents ran 5,520 shell commands in one audit window, and 443 failed. That is about one in twelve. This post lists the rules behind `bin/vawe`, the one command that drives [vawe](https://github.com/vawe-hq/vawe), and what each rule did.

![A 156-line Makefile with four routers becomes one command and a 19-line Makefile.](/blog/one-binary/hero.webp "Before and after: one entry point replaces a Makefile, four routers and loose scripts.")

## What we found

We could not split the 443 failures by cause. Many came from shell habits, such as an unquoted zsh glob or `sed -i` without `''`. The rest came from an interface with too many shapes. Until 2026-09-30 an author could reach the renderer in many ways. There was a Makefile with 156 lines of targets, four router modules and loose scripts under `harness/`. Raw `ffmpeg` and Chrome calls also worked. A person learns that map once. An agent starts each session without it.

| Rule | What the agent sees |
| --- | --- |
| One entry point | `bin/vawe <verb>` for every step. The Makefile has 19 lines and only forwards. |
| The verb is the step | One verb for each stage of the loop. |
| Usage in the error | One line: what is missing, then the usage. |
| Unknown verb lists verbs | The valid verbs, and a note if the checkout is stale. |
| A result line last | `vawe: <verb> ok` or `FAILED (<reason>) in <s>s`. |
| Verbs come from traces | A new verb for each hand-rolled command. |
| Verbs before raw tools | AGENTS.md says to use `bin/vawe` before `ffmpeg`, Chrome or a script. |

Documentation did not close the gap. AGENTS.md got a Shell section, and later trace reviews still found the same `sed -i` and `cat a b` failures. A tool has to refuse the wrong call, name the right one, and be the only tool.

## One entry point, one verb per step

`bin/vawe` arrived on 2026-09-30 with nine verbs: `new`, `dev`, `ship`, `critique`, `spec`, `studio`, `check`, `test` and `judge`. Six minutes later we cut the Makefile from 156 lines to 19 aliases and deleted the routers and dead scripts: 70 files, 2,481 lines. Old paths now forward to the CLI, so they cannot drift from it.

The verb is the step. `vawe dev` is the draft render, `vawe frame --world all` the key-frame sheet and `vawe ship` the final. The stage table in AGENTS.md names one verb per stage, so the agent never translates a stage into a command. The first nine verbs were a guess. Most of the rest came from trace reviews. Each time an agent hand-rolled a command, we checked for a verb and added one if it was missing. In October there were 29 verbs. In the 2026-11 merge the six picture verbs (`still`, `frames`, `sheet`, `strip`, `zoom` and `storyboard`) became one verb, `frame`, with a mode flag for each. The old names still run and print the new command once. Today there are 24 verbs (`bin/vawe --help --all` lists them). Their code and flags are in `harness/cli/verbs.mjs`.

One agent found the beat of a music file with a Python and NumPy script. The reason: `vawe see` answered "no readable video stream" for an audio file. We added `vawe sound`, and in the next review one film called it 21 times. AGENTS.md also says: if a verb is missing what you need, say so in the report and do not hand-roll it. That turns each gap into a visible bug report.

## An error that fits on one line

A missing argument prints what is missing and the usage, and nothing else. Every verb has `--help`. We ran this in the repo today:

```sh
bin/vawe frame --world all
# vawe: missing <film>; usage: vawe frame <film> [flags]
# vawe: frame FAILED (missing <film>; usage: vawe frame <film> [flags]) in 0.0s
# exit code 2
```

An unknown verb lists the valid verbs. It also says when the checkout is stale. An agent that asks for a verb that exists on `main` but not in its worktree gets that answer. The argument parser is `harness/cli/parse.mjs`.

## A result line that survives a pipe

A review of agent transcripts found 134 of 140 `vawe` calls piped into `tail`, `head` or `grep`. A pipe hides the exit code. The tool's error flag showed 2 failures in that review. The real count was at least 8. So the last line of every verb says ok or FAILED, with the reason and the seconds, and `tail -1` still shows it. Later reviews counted fewer pipes: 9 of 32 calls across three sessions of one film, and 12 of 87 across eight sessions of another. The later prompts also told the agent not to pipe, so the footer cannot take all the credit. The run log records the same fields; see [AI agent observability with one JSONL line per command](/blog/run-logs).

![One failed call: a usage error, a FAILED footer with the reason and the seconds, and the exit code.](/blog/one-binary/diagram.webp "The footer survives a pipe.")

## Do not refuse what the agent writes on its own

On 2026-09-30 we tried the opposite. At 04:58 we extended a git hook, `harness/live/no-blanket-git.mjs`. It refused a `for`, `while` or `until` loop, `sed -i` and a multi-part command that starts with `cd`. It added 32 lines and removed 8. Seven minutes later, at 05:05, we reverted it.

The question that caused the revert was short: if the agent wants to write this, why do we stop it? The refusals we meant to prevent came from the worktree isolation of the agent runtime, not from the habits. The hook removed no failure. It moved the failure earlier and blocked the sessions where loops and `sed -i ''` work. We had read 443 failures as 443 bad habits, because the habits were what the failed commands had in common. We never asked where each refusal came from. Our tests passed, because they checked that the hook refused the forms. Nothing tested whether the forms were the cause.

The guard now covers only the four git commands that destroy local changes. The fixes that followed all change the environment. The habit then works, or the failure names its cause.

- The `vawe doctor` verb has a `--json` output and probes for encode, `drawtext` and launching Chrome. A render failure names the failed check.
- The `vawe wait` verb blocks until any render of a film ends and prints a progress line each minute. AGENTS.md says: never `sleep`, run `vawe wait`.
- A quality hook compares an edit only with the `HEAD` of its own worktree, so a tangle the edit did not add never blocks it.
- The `vawe-page` skill gives the macOS `sed -i ''` form, and the Shell section of AGENTS.md lists what fails in this shell.

A warning in a doc did less than a change in the environment. Each line in the Shell section costs every agent a read, so the section stays short. [How long AGENTS.md should be](/blog/read-load) tracks that cost.

## A next-step line after every verb

A film goes through about ten stages, listed in AGENTS.md. A weaker model forgets which one comes next. It skips the brief and the Board and goes straight to a draft, and the cost shows up late, in a render that looks generic. More text in AGENTS.md did not help, because the agent reads it once.

So `harness/live/stage-say.mjs` runs on each prompt and works in four steps. It asks `git status` which `films/*/page.html` changed, and stays silent if none changed in the last three hours. It reads the film's state from files. These are the brief, the named reference frames, the design file, a frames sheet, a draft, and the Board and Motion pass tables. It picks the first unmet stage. It prints one line with the reason, such as `bin/vawe frame films/<name>/page.html --world all`. The verbs import the same text from the hook, so a verb and the hook cannot name different steps. `tests/hooks/stage-say.test.mjs` keeps the order under test.

We read the transcripts of 2026-10-10 and checked whether the agent did what each next line said. For the early stages (brief, reference study, design, states and Board) it followed every line, in order. Three things went wrong:

- The hook fires once per prompt, and a headless run with one prompt sees it one to four times. The verb output arrives after every command. So the verbs are the main channel and the hook is the backstop.
- Some lines asked for things the agent did not do. After `strip` the line said to compare against the reference, and 0 of 6 `compare` calls carried the reference the brief named.
- One line never changed. After 13 of 13 `dev` results the agent read "strip the cuts and read every one", even after it had read 18 strips. An agent that sees the same advice 13 times learns to skip it.

The fix: `dev` now asks the same state function as the hook (`nextStep`). It checks whether `out/strip/<name>` changed since the last draft, and when it did, the line moves on. We have not rerun a trace review since, so we cannot say how often the agent now follows the line after `dev`.

## What the numbers show

The Makefile went from 156 lines to 19, and the interface from several calling shapes to one. The bench ratchet counts the `vawe` commands between a new brief and the first draft render. The count was 2 on 2026-10-01, 5 on 2026-10-07 and 6 on 2026-10-13. It rose because we added real stages, such as reference study and a Board. There is no clean after-count for the 443 of 5,520 figure.

The full verb list with flags is in the [CLI reference](/docs/cli). The reasoning behind the whole harness is in [why we build the agent harness for the weaker model](/blog/weaker-model). For the guard rule in general, read [AI agent guardrails](/blog/advise-refuse).

## FAQ

**What makes a CLI good for AI agents?**
One entry point, one verb for each step, and errors on one line that name the missing argument and the usage. End every command with a result line, so a pipe cannot hide the outcome.

**Why do agents pipe command output into tail and lose the exit code?**
Agents shorten long output out of habit. The pipe returns the exit code of `tail`, not of your tool. A last line that says ok or FAILED, with the reason, fixes this.

**Should a hook block shell habits such as for loops or sed -i?**
No. Our hook that did so lasted 7 minutes and removed no failure. Guard only commands that lose data, and change the environment so the natural habit works.

**How does an agent know the next step in a long workflow?**
Print the next command after each verb, computed from files on disk. A per-prompt hook reaches the agent only once per prompt, and a line that never changes becomes noise.
