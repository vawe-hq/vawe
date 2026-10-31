---
title: "AI agent clarifying questions: gate before it acts"
description: "How to make an AI agent ask clarifying questions first: our CLI prints five questions, exits 0 and writes nothing until three are answered."
date: 2026-10-01
updated: 2026-10-16
section: agents
topic: agents
docs: brief, cli
tags: "ai agents, clarifying questions, cli design, brief"
keywords: "ai agent clarifying questions, make agent ask questions before acting, agent asks before acting, cli prompts for agents, creative brief for ai"
hero: /blog/new-asks/hero.webp
heroAlt: "Decision flow of vawe new: unanswered subject, message or show prints the questions and writes nothing; answers or the defaults flag write the page and brief."
---

To make an AI agent ask clarifying questions before it works, put the questions in the first command of the task. The command prints the open questions with a reason and an example for each, writes no files, and exits 0. The agent answers in a file or asks its human, runs the command again, and only then gets a starter. We built this into `vawe new`, the first command of every [vawe](https://github.com/vawe-hq/vawe) film, on 2026-10-01.

Before that date `vawe new` filled every open detail with a default and wrote a page and a `brief.md` at once. The agent got something that rendered. Then it built a whole film around a subject, message and look it had guessed. Those first decisions shape every shot after them, so a wrong guess there costs the most. We called the result a template film.

![Decision flow of vawe new: ask, answer, write.](/blog/new-asks/diagram.webp "Unanswered required details print questions. Answers or --defaults write the files.")

## What you need for an ask-first command

- One command that every session runs first. A skill or a doc page does not work. We tried a `vawe-brief` skill on 2026-09-30, and a skill helps only if the agent loads it.
- A list of the details that change the output most, in order, with a flag on each required one.
- A file format the agent can write with its file tool, such as `key: value` lines.

## Step 1: print the questions and write nothing

`vawe new` stops when a required detail is missing. We ran this in the repo today, and it created no files:

```sh
bin/vawe new demo --request "a 5 s sting"
# vawe new: 5 facts needed before a good brief
# Nothing is written yet. Answer these, most film-changing first.
# 1. subject: What is the product or subject, and who is it for?
#    why: every shot, word and colour follows from the real thing; a thin subject gives a generic film
#    example: Argus, a log search tool for on-call engineers at small SaaS teams
# 2. message: What is the one message, and what is the one big moment?
# 3. show: What must the viewer see working: the product UI, a number or a process?
# 4. assets (optional): Which real assets exist: captures, logo, photos?
# 5. ending (optional): How does it end: the brand, a call to action, a URL?
# vawe: new ok in 0.0s
```

Order the questions by how much the answer changes the result. Ours puts the subject first, because everything follows from it. Each question carries a `why` line and an `example` line (shortened above). An agent that knows why the subject comes first writes a better answer. It also copies the shape of the example. Keep both to one or two lines.

## Step 2: exit 0, because a question is not an error

A non-zero exit code makes the call look like a failure. An agent may retry it in a loop or report it as broken. So `vawe new` exits 0 when it only asked. The run log writes no film event for an ask. An ask then does not count as a new film, and the draft counts stay honest. [AI agent observability](/blog/run-logs) explains the log.

## Step 3: accept answers in the forms an agent can produce

`vawe new` takes three forms:

```sh
bin/vawe new demo --request "a 5 s sting" --answers answers.txt
bin/vawe new demo --request "a 5 s sting" --detail subject="..." --detail message="..."
bin/vawe new demo --request "a 5 s sting" --questions-json
```

The first reads `key: value` lines that the agent wrote with its file tool. The second takes each answer as a flag. The third prints structured question calls, at most four each, for clients that have a question tool. The human then sees choices and not a wall of text.

## Step 4: keep a flag for runs with nobody to ask

Tests and unattended jobs need a way through. The `--defaults` flag guesses every open detail and prints which ones it guessed. Suppose the three required details (subject, message, show) have answers and an optional one does not. The command then goes ahead. It writes the gap into `brief.md` as a stated guess marked `(guess: change me)`. A guess is never hidden.

## Check that it works

We ran the command a second time with an `answers.txt` that held the three required lines (subject, message, show). It wrote `films/demo/page.html`, `brief.md`, `directions.html` and an `assets` folder. The brief carried 10 stated guesses: spectacle second, ground, ink, accent, typeface, cap height, surface and the shot, word and object tables. We removed the test film afterwards.

- Run the command with only a request. You should see the questions, no new files and exit code 0.
- Run it with `--answers` that cover the required details. You should get the starter and a brief whose gaps carry the guess mark.
- Run it with `--defaults`. The output should name every guessed detail.

## Where an ask-first command goes wrong

- The question lives in a doc, and the agent skips the doc. Put it in the command.
- The ask exits non-zero, and the agent treats it as a crash and retries.
- The defaults path guesses silently. Nobody can then tell a guess from a fact in the brief.
- The answers feed nothing measurable. The same week we made the measured brief the default file, with Task, Look, Spec, Acceptance, Gates, Pitfalls and Deliver sections. Its numbers are only as good as the facts under them. [Reward hacking in AI agents](/blog/loophole-audit) shows how such a scoreboard can still go wrong.

## What we cannot prove yet

We did not A/B test asking against guessing, and we have not scored films made each way. This is a design decision with a changed default. A bare `vawe new` can no longer write a brief from guesses without `--defaults`. The cost is one extra round trip for an agent that does not know the answers. An agent that passes `--answers` the first time pays nothing.

The code is in `harness/cli/new.mjs` (the questions and the `--defaults` path) and `harness/lib/measured-brief.mjs` (the detail list, the `required` flags and the guess mark). Next, read [CLI design for AI agents](/blog/one-binary) for the loop after the first command. For the full set of rules, read [AI agent harness design for the weaker model](/blog/weaker-model). The [quickstart](/docs/quickstart) and the [brief page](/docs/brief) show `vawe new` from the user's side.

## FAQ

**How do I make an AI agent ask questions before it starts?**
Make the first command of the task print the open questions and write nothing. Give each question a reason and an example, and let the agent answer in a file.

**Should a clarifying-question step exit with an error code?**
No. Exit 0. A non-zero code looks like a crash, and agents retry or report it as broken.

**What if no human can answer, as in a test or a batch job?**
Offer a flag that takes defaults and prints each guess. In vawe, `--defaults` does this, and the brief marks every guess with `(guess: change me)`.

**Why not put the questions in a skill or the prompt?**
A skill works only if the agent loads it, and a prompt line is one of dozens in context. The agent has to run a command, so it cannot skip it.
