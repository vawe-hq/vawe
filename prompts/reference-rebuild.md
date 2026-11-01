---
when: "a reference mp4 must be matched, not merely echoed"
answers: "the three prompts: the measured Task, Look and Spec of the reference, KEEP/SWAP, the rebuild loop on bin/vawe critique <page> --ref <mp4>"
group: reference
---

# Reference rebuild: measurements, KEEP/SWAP, rebuild

**Use when** a reference film exists and the deliverable must match it: its light, its pacing, its
type, its motion curves. Route 1 in `guides/ROUTING.md`. Not for "inspired by";
that is the director's brief.

**Length:** the reference's length. Never longer.

## The template, in three prompts

Each prompt fills sections of films/<name>/brief.md (`prompts/ANATOMY.md`). Measure what a program can
measure; use your eyes for the rest.

### Prompt 1: the measurements

```
<task>
Reference: quality/refs/<ref>/source.mp4. One line: what it is, who sees our film, the message, the
spectacle second. Do not write page code yet.
</task>

<look>
1. bin/vawe see quality/refs/<ref>/source.mp4. Read index.md and every grid it wrote.
2. bin/vawe frame <ref> --cuts for the measured cut list. Never eyeball cuts off a sheet.
3. Measure, then write as numbers: ground, ink and accent as hex; the typeface and weight; cap height
   as a percent of frame height; the surface recipe (shadow and glass values).
4. Measure the approach rate of each settle: what share of the remaining distance closes per frame.
   Real UI motion sits at 12 to 19 percent. Write the number per move.
5. Pull five stills at the five moments that define the look. Name them.
</look>

<spec>
Fill the Shots, Words and Objects tables of brief.md, at every cut and every hold. Shots: start and end
in seconds, what the viewer notices, the move in and out (name it from core/motion/easings.js EASINGS;
fit, do not guess), the camera. Words: every on-screen string quoted exactly, with appear and settle
seconds, cap height and position as a percent of the frame from its top left, weight, colour. Objects:
every moving element with its in, settle and out seconds. Exits should run shorter than entrances; write
down when the reference disagrees.
</spec>
```

### Prompt 2: keep and swap

```
<swap>
Read the Spec. For every line, write KEEP or SWAP and one reason.
KEEP: anything the reference does that we want exactly (light, pacing, curves, type scale).
SWAP: the content (our strings, our captures, our brand from its kit), anything the reference does
that breaks a house rule (an em dash on screen, a hook over 12 words, an exit slower than its entrance,
two adjacent transitions in one direction), anything measured off the grid, and any effect the reference shows before its cause
in our story: a burst before the press, a pop before the window opens, a sound before its action. Our cause-effect order wins
over the reference's sound timing (`taste/rules/cause-first.md`); style is taken from a reference, never its text, logos or photos.
Nothing is silent: an unmarked line is a bug.
</swap>
```

### Prompt 3: the rebuild

```
<build>
Build films/<name>/page.html from the Spec and the KEEP/SWAP table. Match the light map first, then
the camera and depth of field, then the type, then the detail (house order for recreations).
Every KEEP line is a number in the page: a @keyframes stop, an element.animate keyframe or a
[[f, v]] table in seek(t). Use approach(f, from, to, k) from core/motion/springs.js with the k you
measured. Then:
  bin/vawe critique films/<name>/page.html --ref quality/refs/<ref>/source.mp4
It compares the draft to the reference at the same timestamps and prints a match score. Loop until
combined >= 0.70 and every Acceptance row is green. Then run bin/vawe check coverage out/<name>.mp4 --ref
<ref.mp4> and fix the seconds it lists below its floor. Then run the critique pass
(the `vawe-critique` skill, frame-locked) as a fresh agent.
Three passes without progress: report what blocks you and go on with the next row.
</build>
```

## Questions

Ask in this order; the first changes the film most. A skipped question takes its default; never wait.

1. **Reference**: the mp4 to match? Default: `quality/refs/kinetic-promo/source.mp4`. Why: the SPEC comes from it, frame by frame.
2. **Privacy**: does the film stay private with its reference? Default: private; references are in-house and never published. Why: it decides where the film lives (`films/recreations/` is ignored by git).
3. **Content**: the strings and captures that replace the reference's? Default: vawe's own strings and captures from `site/app/`. Why: every SWAP line needs its replacement before the rebuild.
4. **Kit**: the brand kit? Default: `themes/vawe.css`. Why: every colour on a SWAP line comes from it.
5. **Threshold**: the match score that ends the loop? Default: 0.70 combined, then the frame-locked critique. Why: three passes without progress stop the loop; a number says when it is done.

## Gotchas

- The stills before the motion: a wrong background makes every later score wrong for a reason that
  is not the motion (`skills/vawe-reference/SKILL.md`).
- Scene detection catches hard cuts only; a crossfade boundary still wants an eye check.
- A reference can run 2x the pace a contact sheet suggests. Trust the cut list, not the sheet.
- `bin/vawe critique <page> --ref <mp4>` scores the match; it does not judge taste. Two fresh judges at 8/10 close a
  beat, never the agent that wrote the fix.

source: pattern from notdwd's reference-rebuild prompts (frame-by-frame SPEC.md, KEEP/CHANGE, the
12 to 19 percent approach rule, five stills, a fresh default-reject critic), an owner-shared
article, not redistributable, so this is our own text in that shape; the study and loop steps are
vawe's own (`skills/vawe-reference/SKILL.md`, `harness/media/see.mjs`). The light-first order is the house
rule for recreations.
