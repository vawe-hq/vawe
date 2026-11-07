---
name: vawe-brief
description: "Plan an HTML to video film (motion graphics as code). Turn a film request into films/<name>/brief.md: ask the person for the details that make a good film (subject, message, what to show, look), then write the brief in the measured anatomy and name the first draft command. Load when a person asks for a film and no brief.md exists yet."
effort: medium
license: Apache-2.0
---

# vawe-brief: the interview, then the brief

When you talk to the person, use plain words: describe what the viewer sees, not the harness terms (map: harness/lib/plain-words.mjs).
Run this skill inside a vawe checkout (`AGENTS.md`, `taste/`, `bin/vawe`). With none, get one: `git clone https://github.com/vawe-hq/vawe.git && cd vawe && npm install && bin/vawe-dev doctor`.

A thin request makes a thin film. Ask the person for the missing details once, at the start, then write the brief. Once the Board is filled, show the plan and end with "If you like it, type /vawe-approve".

## 0. Ask for the details

```bash
bin/vawe new <name> --request "<the ask>" --questions-json
```

This writes nothing. It prints the open details as `calls`, each call at most 4 questions in the shape of
the AskUserQuestion tool (required details first). The list is `DETAILS` in `harness/lib/measured-brief.mjs`.
Call AskUserQuestion once per call, in order, with that call's `questions` as given. Map each answer (the chosen label without "(Recommended)", or the "Other" text) to a `key: value` line in an answers file, the key being the header in lower case. Then run `bin/vawe new <name> --request "<the ask>" --answers <file>`.

If the person answers "you decide", or no person is there (hill-climb, CI), run `bin/vawe new` with `--defaults`: it guesses each open detail and names which.

When the request is thin, add one more call before the answers file: offer 2 or 3 ideas for the key beat as one AskUserQuestion question (each idea an option with its device and a one-line description, the least typical one marked Recommended). Make the ideas with `guides/IDEATE.md`; the pick goes in the `film` row of the brief's `## Ideas` table.

## 1. Start the film

`guides/ROUTING.md` maps the request to a film type and a `prompts/<t>.md` (a real product from a URL is `brand-launch-from-url`; a song that exists is `music-video-beat-synced`; a reference mp4 is `reference-rebuild`; no brief at all is `showreel-one-liner`). Add `--from prompts/<t>.md` to the `new` call above. It writes `films/<name>/brief.md` with every default marked `[unanswered: default taken]` and the measured-brief sections (`prompts/ANATOMY.md`) with guesses marked `(guess: change me)`.

The template's question bank is for what step 0 did not cover: take each default, delete its marker, and never reopen a question (a wrong default is fixed at the critique).

## 2. Write the brief

Replace each `(guess: change me)` with a number:

- **look**: hex for ground, ink and accent, typeface and weight, cap height as a percent of frame height.
- **spec**: the Shots, Words and Objects tables (times in seconds, positions as a percent of the frame). Start a 20 to 30 s film from a RECIPES.md chain, and turn its `invent` row into the film's own moment.
- **acceptance**: pre-filled; keep the rows, fill the measured value after each draft.

A director's brief (a music video, a story) may leave the tables to the first draft; it keeps task, acceptance and gates (`prompts/ANATOMY.md`, "When a director's brief wins").
Name the genre or the reference in the directions: a brief with no anchor reads as a template. Show the three directions with `bin/vawe frame <page> --directions`, then write `picked:`.

## 3. Name the first draft

End the interview turn with the one next command: `bin/vawe dev films/<name>/page.html`. Then load `vawe-page`, and `vawe-critique` in a fresh session.
