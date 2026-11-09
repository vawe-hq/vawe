---
when: you need to know which script does a job, or you are adding, changing or deleting a tool under harness/
answers: "what each harness/ folder and script is for, and which scripts have no verb (run them with node)"
group: engine
---

# harness/

Every script here is reached from `bin/vawe` (verbs in `cli/verbs.mjs`), `bin/vawe-dev` (framework tools: land, claim, e2e, test, runs, moves, doctor, check, worktrees, bots; verbs in `dev/verbs.mjs`), a git hook, a test or the
list below. A script none of those reaches is dead: delete it.

| Folder | Holds |
|---|---|
| `cli/` | the `vawe` verb table, argument parser and `new` starter |
| `media/` | the renderer (`render-page.mjs`, `page-audio.mjs`), the views (`see.mjs`, `see/`, `see-views.mjs`), `still.mjs` (one full-size PNG of a page or mp4), `storyboard.mjs` (one self-contained HTML board of a page or draft: a card per world, the handoffs, a rhythm strip; its data is `lib/storyboard.mjs`, its page `lib/storyboard-html.mjs`), the reference measures (`ref-spec.mjs`, `render-spec.mjs`) |
| `lib/` | shared helpers: the gate table (`check-gate.mjs`), the render harness, run logs, judge codes |
| `dev/` | the `vawe-dev` verb table, git hooks' helpers (`no-emdash.mjs`, `push-guard.mjs`), `e2e.mjs`, `bench.mjs`, worktree tools |
| `live/` | Claude Code hooks: `stage-say.mjs` (next command), `verb-hint.mjs` (names the verb for a hand-made screenshot, link check or contact sheet), `code-quality.mjs`, `no-emdash-live.mjs`, `no-blanket-git.mjs`, `log-read.mjs` (see Hooks below) |

## Hooks

The files in `live/` are Claude Code hooks. This repo does not track a `.claude/settings.json`, so each
user registers them. `log-read.mjs` is a PostToolUse hook: it logs every image the agent Reads under
`out/` to the film's `out/<film>.runs.jsonl`, so `vawe-dev runs` can say which images were looked at.
Register it in your own settings with matcher `Read` and command `node harness/live/log-read.mjs` (run
from the repo root).
`verb-hint.mjs` is a PreToolUse hook (matcher `Bash`, command `node harness/live/verb-hint.mjs`): when a command does by hand what a verb does (a puppeteer or headless Chrome screenshot, a curl status loop, a sleep loop on a render, an ffmpeg contact sheet or frame grab) it adds one line naming the verb. It never blocks and names each verb once per 30 minutes.

## Run log

Every verb appends one line to `out/<film>.runs.jsonl`: verb, stage, seconds, exit code and render slot wait, tagged
with `VAWE_AGENT` and `VAWE_MODEL` from the shell. `bin/vawe-dev runs <film>` (or `--all`) reads it.

## The frame merge: keep or fall back, 14 days after the merge

`still`, `frames`, `sheet`, `strip`, `zoom` and `storyboard` are aliases of `frame` (`harness/cli/aliases.mjs`). Keep `frame` if, over the 14 days after the merge, agents only (rows with a `VAWE_AGENT` name):

| metric | keep if | command |
|---|---|---|
| help lookups per call | 10% or less (family was 14%) | run 1 |
| exit-2 rate | 5% or less (strip was 12%) | run 2 |
| alias rows from named agents | 0 by day 14 | run 3 |
| hand-made frame grabs (`hint:sheet` + `hint:still`) | not above 6 | run 4 |

Set `P=~/.claude/projects/<project folder>` and `MERGE=<the date of the merge commit "frame: one verb">` first. Run from the repo root of the checkout that holds the film run logs. Write the trace-review JSON to a file first (`... --json --aggregate-only > tr.json`): a pipe into `jq` broke on the 137 KB output in one sandbox.

0. `node harness/dev/trace-review.mjs --project $P --since $MERGE --films --json --aggregate-only > tr.json`
1. `jq '[.agents[].verbs[] | select(.verb | test("^(frame|still|frames|sheet|strip|zoom|storyboard)$"))] | {calls: map(select(.help | not)) | length, help: map(select(.help)) | length}' tr.json`
2. `cat out/*.runs.jsonl | jq -s --arg m $MERGE '[.[] | select(.cmd == "verb" and .verb == "frame" and .tagged and .start >= $m)] | {calls: map(select(.help | not)) | length, usage: map(select(.usage)) | length}'`
3. `cat out/*.runs.jsonl | jq -r 'select(.cmd == "verb" and .alias and .tagged) | "\(.start[0:10]) \(.alias)"' | sort | uniq -c`
4. `jq '[.agents[].raw | (."hint:sheet" // 0) + (."hint:still" // 0)] | add' tr.json`

If two of the first three fail, fall back to three verbs: `still` (absorbs `--box`, `--auto`, `--vs`), `sheet` (absorbs `--world`, `--looks`, `--vs`, `--board`) and `strip` (unchanged). Delete an alias when run 3 shows no rows for 14 days and at least 30 days passed since the merge. Today's numbers, before the merge: help 14% of calls, exit 2 at 4% for the family (12% for strip), 6 hand-made grabs since 2026-10-20.

## Tools with no verb

Run with `node <path>`; the file header holds the usage. A film rarely needs them.

- `harness/media/tts.mjs` a voiceover file from text
- `harness/media/music.mjs` a music track by genre (only for a user-requested track)
- `harness/media/kie.mjs` a generated image or video
- `harness/media/cutout.mjs` a cutout with the background removed
- `harness/media/ref.mjs` fetch a reference film into `refs/`
- `harness/dev/palette.mjs` the script behind the retired palette alias: a brand seed and how to compose a palette around it
- `harness/dev/trace-review.mjs` the one reader of agent transcripts: per agent the verb and stage order, `next:` lines and hook hints followed, raw tools, docs read, navigation (reads before the page, rereads, task-output polls, lookups that found nothing), failures by class, cost and rule breaks; an aggregate table, `--json`, `--compare <sha|date>` (parts in `lib/trace/`). Each harness change it motivates gets a row in `quality/baselines/retro-ledger.json`: the metric, its baseline, and after a with-and-without trial whether the problem occurred, the agent used the change and its actions changed; a change that does not help is removed
- `harness/dev/bench-capture.mjs` where capture time goes, per render variant
- `harness/dev/check-sweep.mjs` which draft checks fire over many pages, waivers ignored (the false-flag baseline)
- `scripts/brand/kit.mjs`, `scripts/brand/palette.mjs`, `scripts/brand/photos.mjs` a brand kit from a site
- `generators/fonts/glyphs.mjs` a glyph table for a font; `generators/media/fonts.mjs` the free fonts
