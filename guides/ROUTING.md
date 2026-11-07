---
when: "\"let's make a video\", before opening any file: which film type is this, and which prompt template and skill does it take?"
answers: "the film-type table (ten types, first matching row wins), the prompts/ template and skill each one takes, and how to resolve the common ambiguities"
group: crosscutting
---

# ROUTING: which film type is this

A request maps to one film type. Match the table top down; the first row that fits wins. Match the
FILM the request wants, not a word it happens to use. Then copy that row's template from `prompts/`
into the session and load its skill. Every template stops before code at least once; honour the stop.

## The film-type table

| # | film type | the request | template (`prompts/`) | skill |
|---|---|---|---|---|
| 1 | reference rebuild | a reference mp4 must be matched: its light, pacing, type, curves | `reference-rebuild.md` | `vawe-reference` |
| 2 | edit | the person gives their own clips to cut into one film | `edit-from-clips.md` | `vawe-page` |
| 3 | brand launch | market or show a real product, company or site from a URL, its own kit, real captures | `brand-launch-from-url.md` | `vawe-page` |
| 4 | UI morph | one element becomes 8 to 12 UI states on a beat grid and loops | `ui-morph-loop.md` | `vawe-page` |
| 5 | story or explainer | explain a topic, an article or data with invented visuals, nothing sold | `story-explainer.md` | `vawe-page` |
| 6 | music video | a song exists; every cut on a downbeat, one spectacle at the drop | `music-video-beat-synced.md` | `vawe-page` |
| 7 | long form | over 60 s, or more than one session or agent: brief, storyboard, guide, chapters | `directors-brief-long-form.md` | `vawe-page` |
| 8 | app or game capture | a mechanism as an explorable model, then a scripted tour of it | `interactive-lab-capture.md` | `vawe-page` |
| 9 | showreel | no brief: a taste probe, or learn the agent's defaults and then ban them | `showreel-one-liner.md` | `vawe-page` |
| 10 | sting | a short unnarrated motion unit under 10 s: a logo reveal, a stat hit, a moving title | `beat-sheet.md` (one row per beat) | `vawe-page` |

Edit scope: clips are content moved whole (trim, order, speed, titles, captions, a grade with the lens, transitions, music). Footage processing (tracking, roto, depth cuts) is out of scope (`prompts/moves/README.md`, Scope).

A request with no `brief.md` yet starts with `vawe-brief`. Every type then goes through the same loop: stills, draft, a fresh critique (`vawe-critique`), fix the named seconds, final. Under 15 s most types are one continuous action.
A client brief with rights and claims to check takes
`production-brief-acceptance.md` before any row. A sprite loop takes `pixel-art-sprite.md`. A still
that "looks AI" or a product UI surface needs the impeccable design skill: install it when the surface needs it (`npx skills add pbakaus/impeccable`). It is not part of vawe.

## Resolve the common ambiguities

- A request that names a site but sells nothing (no product, no CTA) is a reference rebuild, not a
  brand launch: the reference is the subject there, a product is the subject here.
- A short sting cut from a captured site (a 6 s logo reveal for a real brand) is still a sting when
  both hold: under 10 s and motion is the message. "Make a video from this site" with no length is a
  brand launch.
- An invented product (no URL, nothing real to capture) is never a brand launch: take `beat-sheet.md` and the RECIPES.md launch chain.
- Data with a real product behind it is a brand launch when the ask is to market it; an explainer
  only when nothing is sold.
- A song plus a product is a music video: the song owns the cuts, the product fills the frames.
- Two rows fit: the shorter film wins.
- Nothing fits: `beat-sheet.md`, then `vawe-page`, and say in the brief which row it almost was.

## How to use a template

Each file in `prompts/` has: when to use it, the template (XML-sectioned where the original was), a question bank (at most five questions, ordered by how much they change the film, each with its reason and its default), the gotchas and a `source:` line. Text is copied only where the licence allows it (MIT, Apache 2.0, CC BY 4.0 with attribution); third-party prompts and owner-shared articles are patterns only. How to build a prompt from scratch: `prompts/ANATOMY.md`. Every template targets the page contract in `AGENTS.md`. Typical lengths: sting 3 to 8 s, edit 8 to 60 s, showreel 15 s, brand launch 9 to 40 s, UI morph 12 to 16 s, story 9 s to 3 min, sprite 2 to 8 s, lab 20 to 60 s, long form 1 to 6 min, production brief one page, beat sheet one table.

1. Pick the row. If two fit, the shorter film wins.
2. `bin/vawe new <name> --footage <folder|clip>...` (the edit row) copies the clips, writes `footage.md`, a Cut list and a starter page, then asks the same details. `bin/vawe new <name> --request "<the ask>"` first prints the details it needs (subject, message, show, look, then format, family, assets, ending) and writes nothing; rerun it with `--answers <file>` or `--detail key=value`, or add `--defaults` to guess. Then it prints the template's questions with their defaults and writes `films/<name>/brief.md` with the defaults filled in, each marked `[unanswered: default taken]`, and the measured-brief sections (Task, Look, Spec, Acceptance, Gates, Pitfalls, Deliver) with every field it could not answer marked `(guess: change me)`. Ask the bank in one message; a skipped answer keeps its default. The agent side is the `vawe-brief` skill (`skills/vawe-brief/SKILL.md`).
3. Fill the brief's Spec tables before the page (the shape is in `prompts/ANATOMY.md`). After the details are in, never wait for a reply: take the guess marked `(guess: change me)` and go on.
4. Draft with `bin/vawe dev <page>` until every Acceptance row is green, then run the `vawe-critique` skill as a fresh agent. The taste rules are in `taste/build/DIGEST.md` and in the lines `dev` prints.
