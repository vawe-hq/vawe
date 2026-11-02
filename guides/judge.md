---
when: the render is done and something must actually LOOK at it
answers: "what `bin/vawe judge` does · the axes a fresh judge scores · the verdict contract · why the PASS is never the author's to record"
group: process
codes: judge-not-ready
---

# The vision judge: the check that SEES

The static checks read the page and the render numbers. None of them can see whether a headline is
centred by accident, an underline sits under its word, or a frame looks expensive. The judge is the
check that looks. It reads rendered key frames against a rubric. It advises: it never blocks a render.

## Commands

```bash
bin/vawe judge out/<name>.mp4 [--ref ref.mp4] [--struct] [--runs A,B]   # prepare the sheet and rubric
bin/vawe judge --fresh films/<name>/page.html --brief films/<name>/brief.md [--stage stills|draft|final]
bin/vawe judge <page|mp4> --verdict PASS|FIX [--at <s> --top-fix "<fix>"] [--fix <code>@<beat> ...]
```

- **Prepare** writes a key-frame sheet and `rubric.md` under the scratch base. A fresh session reads the sheet against the rubric. With `--ref`, every tile is frame-locked: reference left, film right.
- **`--fresh`** scores now with a separate headless Claude session that has the Read tool only (about 30 s). It returns one JSON object and writes `out/<name>.judge.json` (`out/<name>.stills.json` for `--stage stills`). Each fix gets an id in a ledger: the next judge of the film marks every open fix fixed, partly, still or stale (the sheet no longer shows it: closed, dropped from the printed fixes and counted) before it adds new ones, and names the old fix a new one reverses, with a reason (`harness/lib/judge-ledger.mjs`). Each fix also names `what` it changes, its value `now` and the value it `want`s; when the asked value for one `what` moves back and forth over three rounds, the report prints `stop: keep <what> at its current value; the judge varies on this item`. `bin/vawe dev` runs the stills judge itself once per change of `directions.html` (`--no-judge` skips it). It advises and never blocks.
- **`--verdict`** records the verdict against the exact render. It refuses a stale render, a missing sheet, and a PASS recorded by the agent that rendered the film.
- **`--struct --runs A,B`** writes one rubric per run, scored by two independent judges on the 12 criteria in `harness/lib/judge-codes.mjs`. Every criterion needs `{score, evidence, t}`, and the evidence must name a concrete observation (`harness/lib/evidence-lint.mjs`). `node quality/gates/judge.mjs --compare A.json B.json` flags any criterion where the runs differ by more than 2 points.

## The fresh judge

The judge starts from reject. It scores each axis 1 to 10: 8 is good work, 10 is rare, and a score
under 8 needs a fix. It names the moment it looked at, and every fix is one concrete change an author
can make in one edit.

| Film axes | What it asks |
|---|---|
| hook | the first second gives one clear, strong thing to look at |
| motion | curves, continuity, overlap; nothing snaps or stops dead |
| scenes | the world turns every 1 to 2 beats; count the distinct worlds |
| type | faces, scale contrast, spacing, hierarchy, reading time |
| colour | palette discipline, light, contrast, one accent used with intent |
| sound | final stage only. Subtle cues that mark the beats, and a mix left as written (near -20 LUFS with default gains), score well. Do not ask for -14 LUFS or louder hits unless the brief asks. |
| pace | density per frame and rhythm; readable holds, no dead air |
| expensive | looks made by a person with taste, not assembled from a template |

Stills axes: concept, focal, colour, type, template (distance from a generic template). The rubric
text is `FRESH_AXES` in `quality/gates/rubric.mjs`. Keep this table and that text in step.

### Tricks and owner decisions

The rubric lists the tricks that turn a check green without improving the film (`TRICKS` in
`harness/lib/judge-tricks.mjs`): camera drift through a hold, a drifting ground, a grain or faint
gradient laid over a flat ground, a drone bed, hidden or faint copy, padded or split worlds, a moved
spectacle, motion on a formula, a uniform gain shift, reworded ideas and an unkept idea. The judge names a trick only with the second
it saw it at and what it saw there; an entry with no second is dropped. A cited trick caps the axes it
games at 7, and the report prints it as `trick <id> at <s> s: <evidence>`.

The brief's `## Ideas` table (`guides/IDEATE.md`) adds one question for each beat and cut: name the idea on screen, and say whether the frame shows the chosen idea (the shared element, the object) or only the plan text. A planned idea that no frame shows is a finding (trick `unkept-idea`). The ledger checks read only the plan, so the judge also looks for the known trick `reworded-ideas`: four ideas with four device labels that are one thought.

The judge respects the film's own `DESIGN.md` and the owner decisions: it asks for no house face
(no forced Anybody), no bigger elements to reach a number, no camera push as a reward or a fix, and no
move of the spectacle. Its verdict is read by a person. It is not printed back to the author as a target:
the stills line in `bin/vawe dev` shows the pick, the reason and the first fix, never the scores.

## Side by side with real films

When `~/.vawe/refs` exists (`bin/vawe refs list`; `$VAWE_REFS_DIR` moves it), the judge also reads the sheets of two in-scope reference films of the film's type (product or brand, the closest length, then id order) and says per dial (text, colour, motion) which is better, ours or the reference. Without the folder, one line says the comparison was skipped.
The dials cap the axes (`AXIS_DIAL` in `harness/lib/judge-bar.mjs`): type is text, colour is colour, motion and pace are motion. Ours losing a dial to both references caps its axes at 6, losing to one caps them at 7, and the verdict is not PASS while ours loses a dial to both.
The answers are `bar` in `out/<name>.judge.json` and the run log; `bin/vawe-dev runs --taste` shows wins and losses per dial. The anchor question stays: it compares key frames, the bar compares whole sheets.

## The verdict contract

- Per frame, for a person: `beat N, <worst dimension>: <issue> -> <fix>`, only for frames with a real problem.
- Per finding, for the machine: `--fix <code>@<beat>`, repeated. An unknown code is refused and the valid codes are listed.
- A FIX names one time stamp and one concrete fix (`--at`, `--top-fix`). A fix with no time stamp, or one that is not a number and a direction, does not count.
- PASS only when every frame clears every dimension. If your eye catches a flaw, it is a FIX. "Renders fine" is not a PASS.
- No score is averaged across judges. A 1-5 per criterion is one judge's reason. Averaging invents a precision no judge claimed.

## Reading a contact sheet

Each tile is a separate frame. Grid position carries no time or motion information. Comparing an
element between two tiles in different rows is comparing two unrelated layouts, and calling the
difference a "jump" is a false positive. A device visible across several tiles (a caret, a repeated
icon) is intended motion, not a ghost. Claim motion or position only from same-scale, full-resolution
stills in real time order, or from measured numbers.

## The PASS is not the author's to self-record

A judge scoring a film it wrote inflates the score. That is a measured bias, and it is why a slideshow
was once recorded PASS by the agent that made it. Hand the sheet and rubric to a fresh session that did
not author the film, and record PASS only when that eye agrees. A subagent shares the author's session
and process id. Recording a PASS with `vawe judge` accepts a `VAWE_AGENT=<its-name>` tag that differs from the
author's (`harness/lib/judge-self-record.mjs`). The ship gate does not: a tag does not make a new session, so
it counts a review as fresh only when it is `bin/vawe judge <page> --fresh`, `bin/vawe critique <page> --fresh`
(each starts its own headless session), or a critique logged from a session other than the one that rendered
the draft (`harness/lib/critique-gate.mjs`). Run one of the first two.

Three judges drawn from one model share their blind spots, so a 3-0 is weaker evidence than it looks.
The real control is a position swap: if the winner follows the arm, it is real. If it follows the
position, it is void. Nothing here answers "did this edit help": tile the two renders side by side
and judge by eye, knowing which arm is which.

## What the judge cannot see

A frame can score well on every axis and still be the same shape as the last twenty films. Sameness
across a library needs the library, not one film's frames. A judge PASS says nothing about it.
