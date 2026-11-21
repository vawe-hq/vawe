---
when: you need to know which script does a job, or you are adding, changing or deleting a tool under harness/
answers: "what each harness/ folder and script is for, and which scripts have no verb (run them with node)"
group: engine
---

# harness/

Every script here is reached from `bin/vawe` (verbs in `cli/verbs.mjs`), `bin/vawe-dev` (framework tools: land, claim, e2e, test, runs, moves, doctor, check, worktrees, bots, template; verbs in `dev/verbs.mjs`), a git hook, a test or the
list below. A script none of those reaches is dead: delete it.

| Folder | Holds |
|---|---|
| `cli/` | the `vawe` verb table, argument parser and `new` starter |
| `media/` | the renderer (`render-page.mjs`, `page-audio.mjs`), the views (`see.mjs`, `see/`, `see-views.mjs`), `still.mjs` (one full-size PNG of a page or mp4), `storyboard.mjs` (one self-contained HTML board of a page or draft: a card per world, the handoffs, a rhythm strip; its data is `lib/storyboard.mjs`, its page `lib/storyboard-html.mjs`), the reference measures (`ref-spec.mjs`, `render-spec.mjs`) |
| `lib/` | shared helpers: the gate table (`check-gate.mjs`), the render harness, run logs, judge codes |
| `dev/` | the `vawe-dev` verb table, git hooks' helpers (`no-emdash.mjs`, `push-guard.mjs`), `e2e.mjs`, `bench.mjs`, worktree tools |
| `live/` | Claude Code hooks: `stage-say.mjs` (next command), `verb-hint.mjs` (names the verb for a hand-made screenshot, link check or contact sheet), `post-edit.mjs` (the code-shape ratchet and the em dash scan, one PostToolUse hook on Write|Edit), `no-blanket-git.mjs`, `log-read.mjs`, `shell-env.mjs` (see Hooks below) |

## Hooks

The files in `live/` are Claude Code hooks. This repo does not track a `.claude/settings.json`, so each
user registers them. `log-read.mjs` is a PostToolUse hook: it logs every image the agent Reads under
`out/` to the film's `out/<film>.runs.jsonl`, so `vawe-dev runs` can say which images were looked at.
Register it in your own settings with matcher `Read` and command `node harness/live/log-read.mjs` (run
from the repo root).
`verb-hint.mjs` is a PreToolUse hook (matcher `Bash`, command `node harness/live/verb-hint.mjs`): when a command does by hand what a verb does (a puppeteer or headless Chrome screenshot, a curl status loop, a sleep loop on a render, an ffmpeg contact sheet or frame grab) it adds one line naming the verb. It never blocks and names each verb once per 30 minutes.
`stage-say.mjs` names the film's next stage. Register it twice: as a UserPromptSubmit hook (command `node harness/live/stage-say.mjs`), and as a PostToolUse hook (matcher `Bash`, command `node harness/live/stage-say.mjs --after-tool`). A subagent gets no UserPromptSubmit, so the second one is the only way its stage reaches it; it speaks after a `bin/vawe` call, and only when the stage line changed.
`shell-env.mjs` is a SessionStart hook (command `node harness/live/shell-env.mjs`, no matcher, so it also runs on resume). It appends `setopt nonomatch` to `$CLAUDE_ENV_FILE`, which Claude Code sources before each Bash command of the session, subagents included. An unquoted glob or `?` with no match then reaches the command as plain text, as in bash, instead of stopping zsh with `no matches found`. Docs: https://code.claude.com/docs/en/hooks (SessionStart, `CLAUDE_ENV_FILE`).

## Run log

Every verb appends one line to `out/<film>.runs.jsonl`: verb, stage, seconds, exit code and render slot wait, tagged
with `VAWE_AGENT` and `VAWE_MODEL` from the shell. `bin/vawe-dev runs <film>` (or `--all`) reads it.
`VAWE_RUNS_DIR` moves the logs to another folder. A test that runs a `bin/` script sets it to its own temp folder.

## CI

`.github/workflows/gates.yml` runs the basics on each push to main: the static gates, `doc-refs`, and the tests in
`tests/lib`, `tests/motion` and `tests/hooks`, 4 files in parallel (the runner has 4 CPUs), with `VAWE_CI=1`. The
pre-push hook runs the heavy checks (site build, `tests/dev`, e2e) on your machine. Keep the job green and under 2 minutes:

- A test that needs a tool other than node, git, ffmpeg or Chrome skips when the tool is missing. The runner is Ubuntu: it has no zsh.
- A test that opens a real page in Chrome skips when `VAWE_CI` is set. The runner has no GPU, so one probe can take minutes.
- A test writes only to its own temp folder. It never rewrites a shared file under `out/`, because a parallel test can append to that file at the same time. For the run logs, set `VAWE_RUNS_DIR`.
- When CI goes red, fix it before the next push. The pre-push hook prints the state of each workflow.
- `sync-docs-vendor.yml` and `sync-skills.yml` run only when their paths change. No runs is not a failure.

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

## Encode settings

Every encode of a page (draft, master, web copy, layer clip, ProRes master) converts RGB with the BT.709 matrix to limited range and tags bt709 for matrix, primaries and transfer. Render Chrome runs with `--force-color-profile=srgb`. A final adds a fixed-seed noise to the 8-bit YUV frames of the master and the web copy, after the matrix, so dark gradients do not band (`tests/media/render-banding.test.mjs`). `vawe ship --master prores` also writes `<name>.prores.mov` (ProRes 422 HQ, with the sound) next to the mp4. `tests/media/render-colour.test.mjs` and `tests/fixtures/pages/colour-patches.html` guard it in every e2e.

## Template export

`bin/vawe-dev template <page>` makes `out/<name>-template/<name>-template.zip`: a template for Premiere Pro and After Effects.
The entry point is `media/template-export.mjs`.

- `media/template-read.mjs` loads the page once. It reads each body element per frame (paints or not, its blend mode), each editable text (box, baseline, scale, opacity, colour) and the worlds and sound cues.
- `lib/template-plan.mjs` splits the page into layers, bottom first. A world, an element that holds an editable text and an element with a blend mode each get their own layer. Other neighbours share one.
- `render-page.mjs` renders each layer as a final with `layer` set: `core/engine/page-layer.js` hides the other layers and the page ground, and the clip is ProRes 4444 with alpha, converted with the BT.709 matrix and tagged bt709 like every other encode. Subframes blend premultiplied in float.
- The editable texts come from `films/<name>/template.json`: `{ "inputs": [{ "id": "name", "selector": ".title", "label": "Title", "at": 2.5 }] }`. Each selector must match one element. `at` is the second where the font, size and colour are read.
- An editable text is not painted in its layer clip. A second clip holds that text alone, as the film draws it. The After Effects script adds a live text layer above it, with position, scale, opacity and colour keyframes from the page.
- `page-audio.mjs` `writeStems` writes the mix as the final has it and one wav per cue.
- `--light` makes the small zip a person downloads: a layer that moves becomes a folder of 8-bit RGBA PNGs (`media/<layer>/<layer>_00001.png`) when that is at most half the ProRes size, and stays ProRes 4444 when it is photographic or over 20 s (`media/template-clips.mjs` `chooseFormat`). Motion blur defaults to 1 with `--light`, 32 without. After Effects imports each folder with `ImportOptions.sequence`; the XML names the first frame.
- `--poster <file.webp>` writes the film's poster (one frame, 1280 wide; `media/poster.mjs`) before the export, and `--poster-only` stops there. It lives on this tool because it is the one place that takes a template page and writes the files of a template folder.
- `lib/premiere-xml.mjs` writes the FCP 7 XML, `lib/ae-jsx.mjs` the ES3 build script, `lib/template-readme.mjs` the README, `lib/zip-write.mjs` the zip (ZIP64 past 4 GB).

## Tools with no verb

Run with `node <path>`; the file header holds the usage. A film rarely needs them.

- `harness/media/tts.mjs` a voiceover file from text
- `harness/media/music.mjs` a music track by genre (only for a user-requested track)
- `harness/media/kie.mjs` a generated image or video
- `harness/media/cutout.mjs` a cutout with the background removed
- `harness/media/ref.mjs` fetch a reference film into `refs/`
- `harness/dev/palette.mjs` the script behind the retired palette alias: a brand seed and how to compose a palette around it
- `harness/dev/trace-review.mjs` the one reader of agent transcripts: per agent the verb and stage order, `next:` lines and hook hints followed, raw tools, docs read, navigation (reads before the page, rereads, task-output polls, lookups that found nothing), failures by class, cost and rule breaks; an aggregate table, `--json`, `--compare <sha|date>` (parts in `lib/trace/`)
- `harness/dev/harness-bench.mjs` (`vawe-dev harness-bench`) how well an agent follows the harness on its first draft: 3 fixed prompts in `harness-bench-prompts.json`, one headless `claude -p` session each, counts from the run log, the dev report and the stream, saved per variant and commit under `quality/baselines/` once a run writes it
- `harness/dev/bench-capture.mjs` where capture time goes, per render variant
- `harness/dev/check-sweep.mjs` which draft checks fire over many pages, waivers ignored (the false-flag baseline)
- `scripts/brand/kit.mjs`, `scripts/brand/palette.mjs`, `scripts/brand/photos.mjs` a brand kit from a site
- `generators/fonts/glyphs.mjs` a glyph table for a font; `generators/media/fonts.mjs` the free fonts
