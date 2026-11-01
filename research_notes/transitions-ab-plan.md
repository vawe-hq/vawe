# A/B plan: does the vawe-transitions skill make better cuts?

Plan only. No film is rendered by this note. Date: 2026-10-10.

## Question

Does an agent that loads `skills/vawe-transitions/SKILL.md` at stage 5 plan and build more handoffs, from more families, with fewer repeats, than one that does not?

## The brief (identical for both arms)

A plain 20 s product film for an invented project-tracking app, 16:9, 6 beats (hook, problem, three features, call to action), so 5 cuts. The brief gives facts only: product name, three features, one claim, the call to action. It names no transition. Use `bin/vawe new <name> --request "<the ask>" --length 20 --defaults` so both arms start from the same template and the same Board table.

## Arms

| arm | session | difference |
|---|---|---|
| A, control | fresh Sonnet, `VAWE_AGENT=ab-a<n>` | the Board template with the handoff column, but the skill is not loaded and AGENTS.md stage 5 is edited in a scratch copy to drop the `vawe-transitions` words |
| B, skill | fresh Sonnet, `VAWE_AGENT=ab-b<n>` | the repo as it is: stage 5 names the skill and the agent loads it |

Both arms run stages 1 to 6 only (brief to first draft), then stop. Three runs per arm (six films), each in its own worktree, at most 2 sessions at once (agent-concurrency cap). Same model, same effort, same day. Order of runs randomised. Drafts at 30 fps, half size.

## Measures (taken by script from the film, not from the agent's report)

1. Handoffs per cut: cuts with a planned handoff in the Board / cuts. And the same measured on the draft: cuts whose measured type from `findTransitions` is not a plain one-frame cut, or whose Board family is a deliberate cut.
2. Distinct families used: count of distinct ids from the Board handoff column (`harness/lib/handoffs.mjs parseHandoff`), out of the twelve.
3. Repeats: adjacent cuts with the same family, and families used more than twice. Both from `handoffAdvice`.
4. Defaults: cuts whose move cell names a plain fade, crossfade, whip pan, slide-up reveal or scale-in, with and without a reason.
5. Plan versus film: planned visible handoffs that measure as a hard cut (`measuredAdvice`).
6. Cost: tokens and wall time of stage 5, from `bin/vawe runs <film>`. Never ask the agent for its own time.

## Owner blind pick

Render each draft with `bin/vawe frame <page> --cuts` and the draft mp4. Strip names, agent tags and the Board. Present the six drafts in a random order as A, B, C, D, E, F. The owner picks the best three films and ranks "most varied" and "most chosen" on the cuts alone. Unblind after the ranking. A skill win needs the skill arm in the top three for at least 2 of the 3 pairs matched by run number, with the measures 2 and 3 not worse.

## Reading the result

| outcome | what it means |
|---|---|
| B beats A on measures 1 to 3 and the blind pick | keep the skill as written |
| B beats A on measures only | the skill makes the plan richer but the cuts do not look better: tighten step 7 (execution notes) |
| no difference | the Board column alone carries the effect: drop the skill steps 2 and 3 and keep the check |
| B costs over 40% more stage 5 tokens with no gain | cut the steps to the ledger and the defaults list |

Three runs per arm is a signal, not a proof. If the gap is small, add three runs per arm before changing the skill. Keep the six Boards and the measures in `reports/transitions-ab/` (not committed).
