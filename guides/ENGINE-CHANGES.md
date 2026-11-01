---
when: you are changing the ENGINE rather than authoring a film: the renderer, the page clock, the audio mix, a measure, the studio, a gate, or anything under core/
answers: "who owns time, audio, measurement and the studio on the page path; the five rules for a change; where a refusal belongs instead of a gate"
group: crosscutting
---

# Changing the engine

A film is one HTML page (`AGENTS.md`). This file is for the code that renders, measures and edits it.
Run `bin/vawe e2e` (about 4 s) before and after every change. Framework agents follow
the template at the end of this page.

## The goal every change serves

Agent experience first: an agent builds great films with what it already knows (HTML, CSS,
@keyframes, element.animate, SVG, canvas, three.js, a normal shell) and never learns a private format.
Test a change by one question: what would an agent write unprompted, and does this make that work?

- Change the environment, never forbid the habit: if an agent's natural command fails, make it work
  (tools via `bin/vawe doctor`, how agents are launched), do not add a rule or hook against it.
- Give the tool the agent reaches for: agents built their own frame compare until `vawe sheet --ref` existed.
- Measure with traces (`node harness/dev/trace-review.mjs --project <dir> --films --compare <sha|date>` prints the film agents before and after the change), not impressions: minutes, failed calls,
  input tokens. Keep tasks small; one six-step agent used 106 M input tokens, a one-step agent 3 M.
- Numbers come from code (`vawe see --spec`), taste from the eye (`vawe sheet --ref`, a fresh judge).

## Who owns what

| Concern | Owner | What it decides |
|---|---|---|
| Time | `harness/media/render-page.mjs`, `core/engine/page-clock.js`, `core/engine/page-seek.js` | render-page walks the frames and sets the seek; page-clock replaces `Date`, `performance.now`, `requestAnimationFrame`, timers and `Math.random` before any page script runs; page-seek pauses every animation, sets `currentTime`, calls `window.seek(t)` and sets aspect, `--vw`, `--vh` |
| Page API | `core/engine/page-api.js` | `window.vawe`, the three.js helpers a page imports |
| Audio | `harness/media/page-audio.mjs`, `core/audio/kit.mjs` | reads `<audio>` tags, mixes offline as written (`<meta name="loudness">` opts in to a target), synth voices by `data-synth`; nothing plays live |
| Reference measure | `harness/media/ref-spec.mjs` (pixels), `harness/media/render-spec.mjs` (DOM), `harness/lib/spec-deltas.mjs` (the diff) | SPEC.md, spec.json, deltas.md; `bin/vawe see --spec` and `critique --ref` call them |
| Views | `harness/media/see.mjs` and `harness/media/see/*.mjs`, `harness/media/see-views.mjs` | grids, probe, look, layout, word events, phone sheet, strip, loop seam |
| Checks | `quality/gates/page-check.mjs`, `anim-traps.mjs`, `judge.mjs` | advise; only determinism, a missing waiver reason, a banned item and `ship` without approval or a fresh critique refuse |
| Studio | `studio/page-server.mjs`, `studio/page-source.mjs`, `studio/ui/` | live preview; edits the literals in the page source in place; its buttons run `bin/vawe` |
| CLI | `bin/vawe`, `harness/cli/` | one verb table (`verbs.mjs`), one parser (`parse.mjs`); a new verb needs the same hand-roll in 5 or more agents in trace-review (`node harness/dev/trace-review.mjs`). Otherwise add a flag to the owner verb or make its output better; `vawe --help` shows the core verbs, tiers are set on each entry |

If a change needs a second owner for one concern (a second clock, a second mixer, a second measure),
stop: extend the owner above. Two ways to say one thing is a fork, and the fork is the bug.

## Where a refusal is allowed

Checks advise; only determinism, approval and banned items refuse. The owner approved one more gate, `ship` without a critique of
the current page from another session (`harness/lib/critique-gate.mjs`), because traces of 44 film agents showed 21 of 23 shipped
past the warning and 2 of 23 ran a critique first. Every refusal ends with the command to run.

Built, adapting and not refusing: the first `dev` of a film with an empty Ideas or Board renders a 2 s window around the spectacle second, small,
and prints one line with the command that fills the plan (`harness/lib/dev-window.mjs`). `--from 0 --to <length>` renders the whole film. The plan status
still warns (`harness/live/plan-status.mjs`).

## The five rules

1. **Fix it at the root, or fail there. A gate is the last resort.** A gate belongs only where the
   problem cannot be prevented at the write site without complicating the code. Ask who decided the
   behaviour and how they meant it to be turned off before you add a flag; read the whole function,
   because the opt-out is usually a guard clause above the line you found.
2. **Say what you did and what you withheld.** A part of the harness that decides, refuses or
   advises records it in `out/<film>.runs.jsonl` through `harness/lib/runlog.mjs`. The withheld half is
   usually where the bug is: a thing that never happened leaves no other trace.
3. **Sugar resolves or fails loudly.** An unknown name, a bad flag or a missing asset stops with one
   line that names the fix (`vawe: unknown flag --frm; valid: ...`), never a silent no-op or a
   fallback face.
4. **Every effect composes.** A new look combines things the engine already owns (a unit, a clock, an
   order, a property, an exit). If one half has no owner, add the owner, not the effect. A new
   primitive ships with 2+ `aka` phrases and a `blurb` naming its real default.
5. **Price a change to the capture path.** Put a before and after wall-clock draft render in the
   commit body (`bin/vawe dev` on the same page). Determinism first: the same frame is the same
   pixels in any order (`tests/media/render-page-determinism.test.mjs`).

## Engineering rules

Code the next agent can read once and change safely. The code-quality hook
(`harness/live/code-quality.mjs`) enforces the numbers on every edit; the rest is review.

- **One function, one job.** A function that decodes, measures and writes is three functions. Hook
  limits: 60 lines per function, 6 parameters, depth 4; a file over about 400 lines is split by concern.
- **A pure core, I/O at the edges.** Measuring, fitting and scoring are pure functions of their inputs;
  the browser, ffmpeg, tesseract and the file system are called from a thin outer layer. A library
  function throws; only a CLI `main()` prints and exits.
- **Deterministic.** Same input, same output: no wall clock, no unseeded random, no dependence on
  file order. A number a film depends on comes from code, never from a model's estimate.
- **Loosely coupled, plugin-like.** A new check, measure, verb or film type is a new file in its
  folder, found by name (`quality/gates/`, `prompts/`); editing a central list is the exception. A
  library never imports a gate or a CLI; there are no import cycles.
- **No hidden state.** No mutable module-level variables when a return value can carry the state.
- **One way to say one thing.** Reuse `harness/cli/parse.mjs`, one `die`, one launch-flag list
  (`PAGE_ARGS`). A second copy is a fork, and forks drift.
- **Comments only for facts the code cannot show:** a limit, a measured number, an outside quirk.

## Landing a change

`bin/vawe land` is the one way to put a worktree branch on main. Commit everything first, then run it. It runs these steps and stops at the first that fails, with `land: FAILED at <step>: <reason>` and a non-zero exit:

1. `git fetch`, then `git rebase origin/main`. On a conflict it names the files, aborts the rebase and leaves the branch as it was; it never goes on half rebased.
2. A scan of every commit in the range: a file over 5 MB (even one a later commit deletes) is refused by name.
3. `tests/lib` and `tests/hooks`.
4. `git push origin HEAD:main` with an ssh keep-alive (the pre-push e2e is slow enough to drop an idle connection). It prints the pre-push e2e line, then the pushed range.

If main moved during the push, run `bin/vawe land` again. Do not use `--no-verify`.

## A bug is closed when a check catches it

The check is the record, not a log entry. Close a bug with a check that catches it (a render
invariant, a never-silent error, a page-check rule, a `vawe.assert`). A bug with no check is still
open, because the next agent will meet it again.

## Adding a check

Prefer a refusal at the source (the renderer, the parser) over a gate. When a gate is right:

- Name what you measured, where (the second, the element), and the one next command.
- Adapt instead of block: read the film's context and clamp, tolerate or reclassify. Hard refusals
  are for determinism, a missing waiver reason and data loss.
- Put it in `quality/gates/<name>.mjs`: `bin/vawe check <name>` finds it by file name (`harness/lib/check-gate.mjs`).
- Test it end to end: write down every way it can fail, then `bin/vawe e2e`. A unit test only for
  what a render cannot show.

## Adding a verb

A verb is one entry in `harness/cli/verbs.mjs`: a name, a one-line summary, its flags with type and
default, one example, the steps it runs and the one next command. Keep the parser strict: an unknown
flag exits 2 and names the valid ones. Do not add a verb for a tool a film does not need; run that
tool with `node <path>` and list it in `harness/README.md`.

## Command output: one contract, two renderings

A reporting command (a gate, a check, an audit) builds a finding as a record first and renders prose from it; it never prints ad-hoc text. The contract lives in `harness/lib/findings.mjs`.

1. A finding is a record: `{code, severity, summary, at?, fix?, doc?}`. Build the record, not a sentence.
2. Prose is rendered from the record, one tight line per finding, so prose and JSON cannot drift.
3. `--json` emits the records and nothing else on stdout. Headers, counts and advice go to stderr; the exit code is the same in both modes.
4. The rationale lives in a code comment, not in runtime output: a reader wants what is wrong, where (`at`), the fix and the one doc (`doc`).

Use `gateFindings()` to record and render, and `emitJson()` to print a payload of your own under `--json`. `bin/vawe check <gate> --json` forwards the flag; a gate can also write its records to the file named by `VAWE_FINDINGS_OUT`. Test runners tally pass and fail and stay prose.

## After a render

Classify every friction point as an engine bug, a gate gap or an authoring choice. Fix the engine ones
with a check that catches them. Measurements outrank doctrine: change or remove a rule when data shows it helps films.

## Framework agent task template

Paste this block at the top of a task for a framework agent, then fill the three blanks. Nothing
else is needed: `AGENTS.md` and this page hold the rest.

Size the task before you write it: ONE build step per agent. Every call re-sends the whole context,
so cost grows with steps times calls: a six-step agent used 106 M input tokens and 48 minutes, a
one-step agent 3 to 4 M and 3 to 7 minutes. Split a plan into one agent per step, in parallel where
the files do not overlap.

Review a sample of each batch: 3 of 10 items at random, plus every item that a check flagged. Use
`bin/vawe e2e` and the checks as the gate. If one sampled item fails, review the whole batch.

```
RULES (read first):
1. Create and change files with the Write and Edit tools only. No `cat > file <<EOF`, no python or
   node one-liners that write files, no `for` loops, no `$(...)`, no `sed -i` (macOS sed needs
   `-i ''` and fails otherwise), and no `cd` at all: use repo-relative or absolute paths. Read a
   file over 500 lines with `grep -n`, then Read with offset and limit; never read it whole twice.
   Plan every change to a file first, then apply them in the fewest Edit calls: each call re-sends
   your whole context.
2. Stage explicit paths (`git add a.mjs b.mjs`). `git add -A` and `git add .` are blocked. Plain
   `git`, never `git -C`. First command: `git branch -m <topic-name>`. If a hook fails on missing
   node_modules, run `sh harness/dev/link-shared.sh`.
3. You own ONLY: <files or folders>. Do not touch <files another agent owns>.
4. Commits: plain message, one logical step each, no AI attribution, no Co-Authored-By, never
   --no-verify, no em dash (U+2014) anywhere. Comments only for facts the code cannot show.
5. Scratch files go ONLY in your own /tmp/claude-501/<your-topic>/, never the session scratchpad or another agent's folder; draft renders take --out out/<your-topic>-*.mp4 when two agents render one film. Return the report as text. Never write it to
   FINDINGS.md or REPORT.md.

6. Use `bin/vawe` before any raw ffmpeg, Chrome, python or yt-dlp command: `bin/vawe --help` lists every verb
   (frames, spec, refs, compare, judge, runs...). Reuse its libraries (harness/lib/contact-sheet.mjs, key-frames.mjs,
   refs.mjs) instead of a second way to do one job. A capability that is missing becomes a verb or a flag, never a
   one-off script.

CONTEXT: <one paragraph: what the task changes and why>

STATIC CHECKS before each commit: `node --check <each changed .mjs>`,
`node quality/gates/doc-refs.mjs <each changed .md>`, `node harness/dev/no-emdash.mjs`.

ALLOWED TEST COMMANDS: `node harness/dev/e2e.mjs` (about 4 s: page tests plus half-size drafts),
`node --test tests/<one file>`, `bin/vawe dev <page>`. No full `bin/vawe test` unless the task says so.

REPORT (text, under 400 words): commits, what changed, what you left undone and why.
```

### Film task (one agent per beat or chapter)

Measured on the first film: a small range, a starting context under 10 files and the loop below
cut a polish pass from 14.6 to 2.3 minutes and from 24.6 M to 3.1 M input tokens.

```
Keep rules 1, 3 and 5 above. You own ONLY films/<name>/<your chapter or beat file>; never git add
a private film (films/recreations/). Read GUIDE.md first; the font, palette and shared assets are
fixed there before you start.
LOOP: `bin/vawe sheet films/<name>/page.html --ref <ref.mp4> --at <3-5 s> --out
/tmp/claude-501/<topic>/c.png`, Read that ONE sheet, list every difference, fix them all in the
fewest edits, repeat. Never render a range to look at frames. At most 6 loops.
DONE: every row of the guide's text list for your seconds is on screen at its time.
REPORT (under 200 words): what changed, what still differs, every tool problem with its time cost.
```
