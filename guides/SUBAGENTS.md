---
when: "about to fan work out to subagents"
answers: "what a fan-out costs; the brief lines and worktree contract every subagent brief needs; the brief for a film author (the critics are in skills/vawe-critique)"
group: crosscutting
---

# SUBAGENTS: the cost of a fan-out and the subagent brief

The critics, their inputs and their verdict shapes are in `skills/vawe-critique/SKILL.md`: one critic, one job, one artifact the author did not see. This page keeps what a fan-out costs and the brief every subagent needs.

## What a fan-out costs

Measure before you fan out. One audit here ran 87 agents and 5.66M subagent tokens (about 65,000 per
agent, 22 tool calls each) for 61 findings, while the main context grew by about 3,000 tokens.

- Each agent pays a startup cost: system prompt, repo instructions and every tool definition.
- Tool output stays in the agent's context, and every turn resends the whole context. Cost rises faster
  than tool calls.
- Agents do not share reads. Four agents that read the same file pay four times.

Rules that follow:

1. Fewer and larger agents. One agent covering four areas pays the startup cost once. Published guidance
   says 3 to 5 subagents suit most work. Keep about 4 running at once on the laptop.
2. Batch many items 5 to 10 per agent, never one agent per item.
3. Put the file contents in the prompt so the agent does not search.
4. Keep the brief narrow and cap the return with a structured schema. Never let an agent return its transcript.
5. Sequential, dependent work stays one agent. Anthropic's multi-agent research system uses about 15x the
   tokens of a normal chat, and a single agent has matched five multi-agent designs at an equal
   thinking-token budget. Before a fan-out, state in one sentence what one agent with the same budget
   would plausibly have produced. If you cannot, the fan-out is a guess about parallelism.
6. Two cases justify the cost: the work does not fit one context, or you need a judgement with no stake.

The failures seen in real runs were not "too many agents". An agent claimed a report "already delivered"
that never arrived. An agent ended its turn waiting on a monitor and stalled. An agent died on a rate
limit. Two agents nearly collided in one directory. A count would have prevented none of these. The rules
that do are disjoint scopes, one agent for sequential work, and reading the artefact instead of the claim.

## The brief: lines that each cost a real session

A brief that omits these does not fail loudly. The agent works for an hour and returns less.

- Fast-forward onto main before starting and again before the last commit. A stale tip merges silently.
- Stage explicit paths. Hooks refuse `git add -A` and a bare `git stash`.
- Name the files the agent owns and the files it must not touch. Two agents on one file is the only
  failure merging cannot fix.
- Do not block on a background render, and do not delegate. Agents that launched a render and waited, or
  spawned sub-agents and stalled on them, never resumed.
- A worktree does not carry gitignored inputs (`node_modules`, `assets/fonts`, `refs`, films). Create it
  with `harness/dev/worktree.sh add <name> <glob ...>` (it links them and records the scope, so
  `node harness/dev/worktree-status.mjs` warns the next agent about overlap). Never a bare `git worktree add`.

## A film author's brief

The method lives in AGENTS.md, the verbs' `next:` lines and the stage hook. A brief gives the facts and
leaves the method to them, so the agent follows one source:

```
Make a film in the vawe repo, up to a draft the person reviews. In every shell call:
export VAWE_AGENT=<film> VAWE_MODEL=<model>. Follow AGENTS.md and the next: line of each verb; run every
stage in its order. Never run ship or approve. Do not commit.
The ask: <the person's words, verbatim>.
Facts for bin/vawe new --answers: <name, length, subject, message, assets with their paths>.
```

- Start the agent in its own worktree (the Agent tool's worktree isolation). An agent started in another
  checkout carries that checkout's AGENTS.md: one brief had to say "ignore the AGENTS.md in your
  context", and two agents read an AGENTS.md path that did not exist.
- Leave out read lists and steps of your own. Each stage names its doc when the agent reaches it.
- Measure the run with `node harness/dev/trace-review.mjs --project <dir> --authors --since <date>`.
  From 2026-10-15 to 2026-11-09, 3 of 8 authors ran every stage, none in order, and 4 skipped Ideas.

## Worktree agent contract

Every worktree brief carries these lines. Each cost a real session.

- Prove the base: run plain `git merge main`, then quote `git merge-base --is-ancestor <sha> HEAD`.
- Copy the gitignored inputs the task needs from the lead's checkout.
- Run git only as plain `git <cmd>` from your own worktree, never `git -C`, `command git` or `/usr/bin/git`.
- If a hook denies a command, stop and quote the denial. Do not work around it.
- Never edit `quality/baselines/*`: a ratchet only falls.
- Start any server on your own port and stop it by PID, never by name.
- Work inside the render budget the brief states. When it runs out, stop and report.
- Run long commands in the foreground and wait yourself. Never end your turn saying you are waiting.
- Never trust a report: read the commits and files on disk.
