---
when: "you are about to write a film brief, or to ask a person the questions that make one"
answers: "the sections of a measured brief in order (task, look, keep/swap, spec, acceptance, gates, pitfalls, deliver), the trace evidence behind each, the fixed table formats, and when a director's brief wins"
group: reference
---

# ANATOMY: the measured brief

Every film brief in this repo is a measured brief. What a program can measure is a number. What it
cannot yet measure is a stated guess marked `(guess: change me)`. `bin/vawe new` writes this
skeleton into `films/<name>/brief.md`, prints one line naming the guesses, and never stops to ask.
You replace each guess with a measured value or your own choice. The owner's rule: seeing frames is
fine, but what can be measured can be improved.

## The evidence

Our own traces, not the corpus of other people's prompts:

- First drafts over 11 traced films scored 41 to 50 of 80, and motion and "expensive" stayed at 6 to 7
  (trace study 1, taste; experiment/hillclimb.md rounds 0 to 4). The model gap was small: Opus 48,
  Sonnet 47. The gold film passed because its agent measured with ffmpeg crops each round and fixed the
  lowest axis first, not because it read more rules.
- The draft check said "no problems" while the judge asked for a bigger tagline in 6 rounds, and it
  counted pixels where the judge counted sheet tiles (trace study 2, rows 4 and 5). Numbers that both
  sides read fix that.
- The judge flips on one value: the opening crest was edited 6 times, about 10 of 22 draft minutes
  (trace study 2, row 3).
- An agent that copied a recipe 1:1 scored lowest of its round (h3a, 41). Directions were skipped 8 of 8
  in early rounds (trace study 1, section 2).
- The owner's remake prompt works because every claim is a number with a pass line (remake-prompt-gap.md).

## The sections, in order

### Inputs

The template's five questions, each with a default. The draft check reads this section and compares
`length` and `aspect` with the page. Answers: briefs judged as template defaults (trace study 1, speed 8).

Before it writes anything, `bin/vawe new` asks for the details a good brief needs, most film-changing
first: subject, message, show, look (required), then format, family, assets, ending. The list, with each
question, reason and example, is `DETAILS` in `harness/lib/measured-brief.mjs`. A request that already
answers a detail skips it. Answers go in with `--answers <file>` or `--detail key=value`; `--defaults`
(unattended runs) guesses instead. The owner's rule: ask for the details, never approve a finished plan.

### 1. TASK

One line each: what the film is, who sees it, the message, the spectacle second (the one big moment,
with 1.5 s of quiet before it). Answers: the hook scored 7 in most first drafts; a named message and
second make the hook a thing to check.

### Directions

Three slots from three families (type, object, graphic; each with `risk:` and `from:`), then `picked:` with a reason. `directions.html`
holds one still each. Answers: directions skipped 8 of 8, and one invented brand (Vesper) in 4 of 8 films, a glowing circle in all 8.

### 2. LOOK

Numbers, not adjectives: hex for ground, ink and one accent; typeface and weight; cap height as a
percent of frame height; the surface recipe (shadow and glass values in px and alpha). Take the
numbers from the picked direction. Answers: type rose 6 to 8 when the face changed from one the judge read
as Inter; colour rose 7 to 9 with a contrasting accent (#d8124f); the tagline was under 6% cap height
in 3 films.

### 3. KEEP/SWAP

Reference films only. One row per line of the reference's measured SPEC.md: KEEP (light, pacing,
curves, type scale) or SWAP (our strings, captures, brand; anything that breaks a house rule), with
the replacement. An unmarked line is a bug. Answers: the recreation loop (`prompts/reference-rebuild.md`).

### 4. SPEC

Three tables, fixed. Times are seconds. Positions are a percent of the frame from its top left; `x %`
and `y %` are the text box's left and top edges. Every cell is a number you can check in the page.

```
### Shots
| id | start s | end s | the viewer notices | move in | move out | camera | ground |

### Words
| text | shot | appear s | settle s | cap % | x % | y % | weight | colour |

### Objects
| id | selector | shot | in s | settle s | out s |
```

`vawe new` writes one example row per table, marked `(guess: change me)` in its first cell. Replace it.
Text that is texture, not copy, is outside the text rows: `aria-hidden="true"` skips the text checks only for text under 2% cap
height, the same words 3 or more times, or a `data-texture="why"` of 12 characters or more; any other hidden text is checked as copy.
`data-chrome` (a real product's UI labels) follows the same test and is then held to a 2.5% cap floor with no read hold.
The page owns the times: after each full draft `bin/vawe dev` writes the measured times into the Words,
Objects and Shots cells (a changed cell ends in `*`), and never a target (cap, x, y). It also writes the page's
`:root` colours and typeface into each Look line still marked as a guess. `bin/vawe see <page> --sync-brief` does the
times by hand.
Answers: the gold film's gains came from numbers (ring width equals the "o", push 12%, a window onto the
real next world), and a static tail after 4 s appeared in 5 of 11 films.

Invention slot: each chain in `prompts/moves/RECIPES.md` has one beat reading
`invent: the film's own moment`. Do not copy a chain whole. `bin/vawe dev` prints advice when more
than 70% of a chain's moves appear in your Shots table in the chain's order.

### 5. ACCEPTANCE

```
| metric | target |
| frozen runs of 3+ frames inside a shot | 0 |
| jerky steps | under 5 |
| jumps not at a declared cut | 0 |
| still windows over 0.5 s outside a declared hold | 0 |
| near-identical tail tiles | 4 or fewer |
| text cap height | 6% or more |
| text contrast | 4.5:1 or more |
| text collisions | 0 |
| read hold per line | max(1.2 s, words/3 s) or more |
| exits shorter than entrances | all |
| word cap height and position vs spec | within 1% of frame |
| cuts vs spec | within 1 frame |
| loudness | -24 to -16 LUFS |
| peak | -10 dBFS or lower |
| judge: each storyboard frame as beautiful as the anchor, full size | YES |
```

`vawe new` pre-fills all 16 rows. After each draft, write the value you measured next to each target.
The judge row needs the anchor: the picked direction's key frame, or `films/examples/colour-sting`.
Checks advise and do not refuse (the judge passes only when every axis is 8 or more). Answers: the
disagreement between draft check and judge on tail tiles and tagline size; a number both read ends it.

### 6. GATES, in order

1. Stills and the stills judge: `bin/vawe-dev judge films/<name>/directions.html --fresh --stage stills`.
2. Component labs: the 4 to 6 hardest pieces, each alone on its own page at 3 sizes, fixed before they join.
3. Draft loop: `bin/vawe dev`, then a fresh `bin/vawe critique`, until every Acceptance row is green.
4. Final: `bin/vawe ship <page>`, then `bin/vawe wait <page>`.

Answers: a ship takes 3 to 19 minutes and one failed final cost 40 (trace study 1, speed); gates 1 to 3 find the failure in a draft.

### 7. PITFALLS

One line pointing to `taste/build/DIGEST.md`, the one list of taste pitfalls, plus any pitfall
specific to this film.

### 8. DELIVER

`out/<name>.mp4`, the brief with Spec edited to what you built, and the Acceptance table filled with
measured values, and the judge report path.

## When a director's brief wins

The measured brief is the default. A director's brief fixes the intent and the world, and leaves the numbers
to the agent. It wins for a music video, a story or a showreel, where the agent's taste is the point and a
table would fix what nobody has seen. Even then keep TASK, ACCEPTANCE and GATES: the film still has to
pass them. Write the tables after the first draft, from what the draft does.

| template | use |
|---|---|
| brand-launch-from-url, beat-sheet, reference-rebuild | measured: task, look, spec and (for a reference) keep/swap |
| ui-morph-loop, pixel-art-sprite, production-brief-acceptance | measured: the numbers exist |
| music-video-beat-synced, story-explainer, interactive-lab-capture | mixed |
| showreel-one-liner, directors-brief-long-form | director's |
