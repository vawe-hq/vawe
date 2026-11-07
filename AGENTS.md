# AGENTS.md: the map for vawe

vawe turns one HTML page into one film: write the page in what you know (HTML, CSS, Web Animations, SVG,
canvas, three.js); if natural code fails, report it as a framework bug.

## Start

- Node 22 or newer and ffmpeg. Run `npm install`. Chrome: `npx puppeteer browsers install chrome`.
- `bin/vawe new <name> --request "<the ask>"` checks the tools (it prints the install line for each missing one) and writes `films/<name>/page.html`, a working starter, and `brief.md`. The first run turns on `.githooks`.
- `bin/vawe dev films/<name>/page.html` renders a draft. `bin/vawe --help` lists the verbs; `bin/vawe <verb> --help` before first use. Every verb ends with `vawe: <verb> ok|FAILED (<reason>)` and names the `next:` step and the doc to read for it.
- `films/examples/colour-sting/` is a judged-PASS 5 s sting: study how it moves, then make your own direction.

The smallest film:

```html
<meta name="duration" content="3">
<meta name="message" content="zero fees">
<section data-world="hello"><h1>Zero fees</h1></section>
<style>h1 { font-size: calc(var(--vh) * 0.12); animation: in 0.8s var(--ease-land) both }
@keyframes in { from { translate: 0 40px; opacity: 0 } to { translate: 0 0; opacity: 1 } }</style>
```

## Hard rules

- A film is `films/<name>/page.html` plus its own assets folder, relative paths only, with `<meta name="duration" content="12.4">` in seconds (or `auto`, see `skills/vawe-page/SKILL.md`).
- Time is the seek, never the clock: CSS `@keyframes`, `element.animate()` or `window.seek(t)` as a pure function of t. No timers, no state between frames, no unseeded random: a virtual clock (`core/engine/page-clock.js`) owns them.
- Lay out with `--vw`/`--vh` and `<html data-aspect>` for `16:9 9:16 1:1 4:5 4:3`. Never crop. `--aspect W:H` on a render verb replaces the meta.
- Each beat is one element with `data-world="<id>"` (lowercase, the brief's Shots ids). `<meta name="message">`: the one thing to remember. `<meta name="spectacle">`: the second of the one big moment.
- Every tunable number is a literal (a `[[f, v]]` table, a keyframe stop, a `:root` property): the studio edits it.
- Sound is `<audio>` tags: small effects on actions, a recorded effect first, no bed. A music track only from a file the user gives (`taste/craft/sound.md`).
- A rule broken for cause is declared in the page with a measured reason, nowhere else (`skills/vawe-page/SKILL.md`, Waivers). A waiver is for a break that is the point of the shot. For any other break, try the fix first and write `tried <what>` in the `_why`.
- Use a `bin/vawe` verb, never raw `ffmpeg`, Chrome or a script. If no verb does the job, say so in your report.
- Do the stages in order and follow each verb's `next:` line: `frame --world` before `dev`, the Board before the draft.
- The person approves the plan, then the full draft: show it, end with "If you like it, type /vawe-approve" and stop. Never run `approve`.
- The critique and the judge run in a session that did not write the page. Never judge your own page or record its PASS.
- No `sleep` and no pipe on `bin/vawe` (it hides the exit code): `harness/live/verb-hint.mjs` says so when you do.

## The loop  `[live: harness/live/stage-say.mjs]`

Read each doc named in a row before its stage (a `skills/<name>/SKILL.md` needs no install).

| # | stage | the command |
|---|---|---|
| 1 | brief (facts only) | `bin/vawe new <name> --request "<the ask>"` (`vawe-brief`) |
| 2 | reference study | `bin/vawe refs list`, then fill `brief.md` "Taken from" (`guides/REFERENCE-STUDY.md`) |
| 3 | design system and kit | write `films/<name>/DESIGN.md` and `kit/` from `prompts/skill-combos.md` (`vawe-page`, `taste/build/DIGEST.md`: the taste pitfalls) |
| 4 | states | `bin/vawe frame <page> --world all`: one key frame per world |
| 5 | ideas, board | fill "Ideas" and "Board" in `brief.md`, then `bin/vawe frame <page> --board` (`vawe-transitions`) |
| 6 | draft | `bin/vawe dev <page>` (half size, 30 fps, with sound; `--silent` for picture only) |
| 7 | motion pass | `bin/vawe frame <page> --cuts`, then one "Motion pass" row per cut |
| 8 | critique | `bin/vawe critique <page> --fresh` (a separate critic session; `vawe-critique`) |
| 9 | fix | `bin/vawe dev <page> --from s --to s`: only the seconds the critique named |
| 10 | final | `bin/vawe critique <page> --fresh` (its own session), then the person's OK (`/vawe-approve`); then `bin/vawe ship <page>` and `bin/vawe wait <page>`; `ship` refuses without both |

## The proof before you say done

Report each path. Without all four the film is not done.

1. The draft: `out/<name>-draft.mp4`, newer than `page.html`.
2. The storyboard: `out/<name>-storyboard.html`.
3. The motion pass: one row per cut in `films/<name>/brief.md` "Motion pass".
4. The critique: `out/<name>.critique-<n>.md` exists, written by `critique --fresh` in another session (a separate terminal or agent), and the seconds it named fixed.

Set `VAWE_AGENT=<name>` (one per agent) and `VAWE_MODEL=<model>` in your shell: every verb logs to `out/<film>.runs.jsonl`.

## Shell

- The shell is zsh: quote every glob and `?`, `grep --include='*.mjs'`, `curl 'x?a=b'` (unquoted: `no matches found`).
- In a worktree a call with a heredoc, a `for` loop, a variable or `$(...)` is refused as "too complex to verify": one verb per call with literal arguments, the Write tool for any file, and plain `git` (no `git -C`).
- `bin/vawe wait <page>`, alone, waits for a render or critique (on STILL RUNNING call it again).
- A call over 120 s moves to the background and keeps its render slot: run `dev` alone, start a long render in the background yourself, and keep working.
- One file per `cat` or `head`: a hook rewrites `cat a b` and it breaks.
- macOS has no `timeout`. Read a page over about 25k tokens with offset and limit.

## Where to look

| need | doc |
|---|---|
| a film type and its template | `guides/ROUTING.md` |
| page code, contract details, waivers, sound, springs, moves, lens, every doc by job | `skills/vawe-page/SKILL.md` |
| edit a person's clips | `bin/vawe new <name> --footage <folder>` |
| a reference: study, style or recreate | `skills/vawe-reference/SKILL.md` |
| the look verbs (`see`, `frame`, `shot`) | `skills/vawe-critique/SKILL.md` |
| every taste rule; scoring | `taste/README.md`; `guides/judge.md` |
| a film over 60 s or over one session | `prompts/directors-brief-long-form.md` |
| every script and the run log | `harness/README.md` |
| a change to the engine: every effect composes, `bin/vawe-dev e2e` before and after, a comment only for a fact the code cannot show | `guides/ENGINE-CHANGES.md` |

Outside a checkout, start at `skills/html-to-video/SKILL.md`.
