# AGENTS.md: the map for vawe

vawe turns one HTML page into one film: write the page in what you know (HTML, CSS, Web Animations, SVG,
canvas, three.js); if natural code fails, report it as a framework bug.

## Setup

- Node 22 or newer and ffmpeg. Run `npm install`.
- Chrome for the renderer: `npx puppeteer browsers install chrome`. `bin/vawe doctor` checks every tool and prints the install line for each missing one.
- `bin/vawe --help` lists the verbs (`--help --all` every verb); `bin/vawe <verb> --help` before first use. The first run turns on `.githooks`.
- `films/examples/colour-sting/` is a judged-PASS 5 s sting: study how it moves, then make your own direction.

## Hard rules

- A film is `films/<name>/page.html` plus its own assets folder, relative paths only, with `<meta name="duration" content="12.4">` in seconds, or `content="auto"`: the last animation's end plus a hold (1.2 s or the last world's read time), `bin/vawe dev --lock-length` writes the number in, a page script reads `window.vawe.duration` (0 while the length is measured, the found length in the render, so an animation sized to it does not set the end; a plain browser has the stated number only), and a `window.seek`-only page must state a number.
- Time is the seek, never the clock: CSS `@keyframes`, `element.animate()` or `window.seek(t)` as a pure function of t. No timers, no state between frames, no unseeded random: a virtual clock (`core/engine/page-clock.js`) owns them.
- Lay out with `--vw`/`--vh` and `<html data-aspect>` for `16:9 9:16 1:1 4:5 4:3`. Never crop. `--aspect W:H` on a render verb (any whole ratio; `frame` also takes `--size WxH`) replaces the meta and joins the output name.
- Each beat is one element with `data-world="<id>"` (lowercase, the brief's Shots ids). `<meta name="message">`: the one thing to remember. `<meta name="spectacle">`: the second of the one big moment.
- One page, several looks: `bin/vawe dev|frame|ship <page> --param look=riso` (repeatable) loads the page as `page.html?look=riso`;
  read it with `new URLSearchParams(location.search)`. It joins the render key and the default output name (`-look-riso`).
- Every tunable number is a literal (a `[[f, v]]` table, a keyframe stop, a `:root` property): the studio edits it.
- Sound is `<audio>` tags: small effects on actions, a recorded effect first, no bed. A music track only from a file the user gives; `data-synth="bed"` is refused (`taste/craft/sound.md`).
- A rule broken for cause is declared in the page with a measured reason, nowhere else (`skills/vawe-page/SKILL.md`, Waivers). A waiver is for a break that is the point of the shot. For any other break, try the fix first and write `tried <what>` in the `_why`.
- Use a `bin/vawe` verb, never raw `ffmpeg`, Chrome or a script. If no verb does the job, say so in your report.
- Do the stages in order and follow each verb's `next:` line: `frame --world` before `dev`, the Board before the draft.
- The person approves the plan, then the full draft: show it, end with "If you like it, type /vawe-approve" and stop. Never run `approve`.
- The critique and the judge run in a session that did not write the page. Never judge your own page or record its PASS.
- Never `sleep`, and never pipe `bin/vawe` into `tail`, `head` or `grep`: the pipe hides the exit code.

## The loop  `[live: harness/live/stage-say.mjs]`

Read `taste/build/DIGEST.md` first: the one list of taste pitfalls. Read `skills/<name>/SKILL.md` before its stage (nothing to install); each stage in full is in `skills/vawe-page/SKILL.md`.

| # | stage | the command |
|---|---|---|
| 1 | brief (facts only) | `bin/vawe new <name> --request "<the ask>"` (`vawe-brief`) |
| 2 | reference study | `bin/vawe refs list`, then fill `brief.md` "Taken from" (`guides/REFERENCE-STUDY.md`) |
| 3 | design system and kit | write `films/<name>/DESIGN.md` and `kit/` from `prompts/skill-combos.md` (`vawe-page`) |
| 4 | states | `bin/vawe frame <page> --world all`: one key frame per world |
| 5 | ideas, board | fill "Ideas" and "Board" in `brief.md`, then `bin/vawe frame <page> --board` (`vawe-transitions`) |
| 6 | draft | `bin/vawe dev <page>` (half size, 30 fps, with sound; `--silent` for picture only) |
| 7 | motion pass | `bin/vawe frame <page> --cuts`, then one "Motion pass" row per cut |
| 8 | critique | `bin/vawe critique <page> --fresh` (a separate critic session; `vawe-critique`) |
| 9 | fix | `bin/vawe dev <page> --from s --to s`: only the seconds the critique named |
| 10 | final | `bin/vawe judge <page> --fresh` (its own session), then the person's OK (`/vawe-approve`); then `bin/vawe ship <page>` and `bin/vawe wait <page>`; `ship` refuses without both |

## The proof before you say done

Report each path. Without all four the film is not done.
`dev` prints the plan status first: the bans the page already shows (read before the render), what is empty, the plan findings, one `next:`.

1. The draft: `out/<name>-draft.mp4`, newer than `page.html`.
2. The storyboard: `out/<name>-storyboard.html`.
3. The motion pass: one row per cut in `films/<name>/brief.md` "Motion pass".
4. The critique: a `critique` line in `bin/vawe runs <name>` from another session (a separate terminal or agent), and the seconds it named fixed.

Set `VAWE_AGENT=<name>` (one per agent) and `VAWE_MODEL=<model>` in your shell: every verb logs to `out/<film>.runs.jsonl`.

## Shell

- The shell is zsh: quote every glob and `?`, `grep --include='*.mjs'`, `curl 'x?a=b'` (unquoted: `no matches found`).
- In a worktree a call with a heredoc, a `for` loop, a variable or `$(...)` is refused as "too complex to verify": one verb per call with literal arguments, the Write tool for any file, and plain `git` (no `git -C`).
- Never `sleep`: wait with `bin/vawe wait <page>` for any render or critique (returns within about 3.5 minutes; on STILL RUNNING call it again; run it alone).
- Every verb ends with `vawe: <verb> ok|FAILED (<reason>) in <s>s`: read that line, not a filtered tail.
- One file per `cat` or `head`: a hook rewrites `cat a b` and it breaks.
- A call over 120 s moves to the background and keeps its render slot: run `dev` alone, start a long render in the background yourself, and keep working.
- Edit with a tool that fails when the old text is missing, never a silent replace.
- macOS has no `timeout`, and `sed -i` needs `''`. Read a page over about 25k tokens with offset and limit.

Skills, read before the stage: `html-to-video` (start here), `vawe-brief`, `vawe-page`, `vawe-transitions`, `vawe-critique`, `vawe-reference` (`skills/<name>/SKILL.md`).

## Where to look

| need | doc |
|---|---|
| a film type and its template | `guides/ROUTING.md` |
| ideas for a beat or a cut | `guides/IDEATE.md` |
| transitions: the twelve handoff families | `taste/craft/transitions.md`, `skills/vawe-transitions/SKILL.md` |
| moves to copy, with clips | `prompts/moves/README.md` (`prompts/moves/RECIPES.md` chains them) |
| a new video component (clip) | `prompts/moves/README.md` Clip bar, the stage helpers in `prompts/moves/demo/assets/stage.js`, the UI presets in `core/motion/ui.js` (README Product UI presets) |
| lens: depth of field, bloom, LED grid | `prompts/moves/lens.md` |
| sound effects and where to get them | `taste/craft/sound.md`, `resources/README.md` |
| skill combos for DESIGN.md | `prompts/skill-combos.md` |
| springs, eases, motion principles | `core/motion/README.md`, `taste/craft/motion-craft.md` |
| page code, contract details, waivers | `skills/vawe-page/SKILL.md` |
| the look verbs (`see`, `frame`, `shot`) | `skills/vawe-critique/SKILL.md` |
| a reference: study, style or recreate | `guides/REFERENCE-STUDY.md`, `skills/vawe-reference/SKILL.md` |
| every taste rule; scoring | `taste/README.md`; `guides/judge.md` |
| a film over 60 s or over one session | `prompts/directors-brief-long-form.md` |
| every script and the run log | `harness/README.md` |
| a change to the engine: every effect composes, `bin/vawe e2e` before and after, a comment only for a fact the code cannot show | `guides/ENGINE-CHANGES.md` |
