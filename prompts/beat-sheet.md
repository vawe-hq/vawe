---
when: "any film over one beat is about to be built"
answers: "the Task line and the Shots, Words and Objects tables (fixed columns, seconds, percent of frame) and how their rows become page literals"
group: reference
---

# Beat sheet: the table you write before any code

**Use when** any film over one beat is about to be built. Every strong repo in the ecosystem
writes a shot table first and codes from it; the ones that skip it ship dead holds and cuts nobody
planned. This is the table, and the one-line prompt that asks for it.

**Length:** one table, one row per shot. Ten minutes.

## The prompt

```
<task>
One line: what the film is, who sees it, the message, and the spectacle second (the one big moment,
with 1.5 s of quiet before it).
</task>

<spec>
Before any code, fill the three Spec tables in films/<name>/brief.md: Shots, Words, Objects. One
Shots row per shot. Every row has one focal action and an end state I can picture. The slowest row is
at least 3x the fastest. Exits are shorter than entrances. Something happens in every row. Give every
Words and Objects row its times in seconds. Then build from the tables; never wait for a reply.
</spec>
```

## The tables

The shape is fixed, so a program can read it (`prompts/ANATOMY.md`):

```markdown
### Shots
| id | start s | end s | the viewer notices | move in | move out | camera |
|---|---|---|---|---|---|---|
| s1 | 0.00 | 2.00 | the promise, four words | words land on beats 1 to 4, settle | hard cut on 2.00 | static |
| s2 | 2.00 | 4.40 | the word "film" is now the product | the word's box grows into the capture, content swaps with a 120 ms blur | match cut | push 4 percent |

### Words
| text | shot | appear s | settle s | cap % | x % | y % | weight | colour |
|---|---|---|---|---|---|---|---|---|
| One page in | s1 | 0.00 | 0.60 | 10 | 7 | 60 | 700 | #14161a |

### Objects
| id | selector | shot | in s | settle s | out s |
|---|---|---|---|---|---|
| capture | .capture | s2 | 2.00 | 2.60 | 4.40 |
```

The page names each row's start once, as a custom property every delay in that row reads, so one
edit moves the whole beat:

```html
<style>:root { --beat-1: 0s; --beat-2: 2s; }
.word { animation-delay: calc(var(--beat-1) + 0.5s); }
.capture { animation-delay: var(--beat-2); }</style>
<audio data-synth="pluck" data-at="0.00"></audio>
<audio data-synth="pluck" data-at="1.50"></audio>
<audio data-synth="swell" data-at="1.24"></audio>
```

Sound is felt, not noticed (rule sound-level): quiet ticks at their default gains and at most one swell beat a hit on every word.

Column meanings:
- **the viewer notices**: what the eye lands on first. One thing. If you cannot name it, the shot
  has no focal point.
- **move in**, **move out**: the change and where it ends, and the transition to the next row.
  Adjacent rows change axis or direction. An end state you can picture is one you can check.
- **camera**: static, push, pull, whip, tilt. One camera language per film.
- **cap %**: the height of a capital letter as a percent of the frame height, 0.7 of the font size: cap 30 needs `font-size: calc(var(--vh) * 0.43)`.
- **x %, y %**: the text box's left, centre or right (x) and cap top, middle or baseline (y; a turned word: its box top, middle, bottom), as a percent of the frame from its top left. The check takes the edge nearest your number: write 50 for a centred word.
- Exposure and sound cues are not columns: write them as page literals. Exposure is ones (UI) or twos
  (a drawn look); a cue lands 30 ms before its frame.

## Questions

Ask in this order; the first changes the table most. A skipped question takes its default; never wait.

1. **Length**: the total seconds, and about how many rows? Default: the route's length: a sting is 5 s, otherwise 15 s, 6 rows. Why: the last end s is the duration meta; a longer film than the rows has a dead tail.
2. **Grid**: a beat grid (BPM and offset) or free timing? Default: free; cuts follow the picture. Why: with a grid every start is a beat, or two frames before one.
3. **Exposure**: ones or twos? Default: ones. Why: UI is on ones; a drawn look is on twos.
4. **Cues**: recorded effects or synth voices? Default: a recorded effect where one fits (`resources/README.md`), otherwise no cue; a synth voice from `core/audio/kit.mjs` only when you choose one. Why: cues come from the picture and are placed 30 ms early either way.

## Beyond the three tables

A story beat can also carry: the arc position (hook, build, proof, payoff, CTA; outcome first beats product first), the mechanism you reproduce or adapt (the signature of the device you keep and the one thing you change), the persuasion job (negative contrast, category naming, risk reversal; a beat with none is decoration) and the felt arc (curiosity, recognition, trust, urgency).

Every beat has three phases: build 0 to 30 percent (elements enter, staggered), breathe 30 to 70 (the content is visible and one part moves) and resolve 70 to 100 (a decisive end, faster than the entrance). Weight the cues into the back half of the beat; at a beat's start only its first cue is present. Two banned failures: the slideshow (everything dumped in the first 25 percent, then frozen) and the screensaver (elements drifting independently to fake life in a hold).

Vary the cut rhythm and set the fastest beat by contrast with a slow one beside it. Bookend: let the payoff call back the hook. No two beats move alike. The worst render bugs (a black flash, a morph that reads as a collision) hide in the transition overlap, so sample the frames that straddle every seam: `bin/vawe critique <page>` writes the strip and the loop seam.

## From the table to the page

Each row becomes a block in `page.html`: an element or a shot function, and a keyframe stop or
`[[f, v]]` table with the row's start and end as literals. The studio edits those literals in place,
so the table and the page agree by construction.
## Gotchas

- A row with two focal actions is two rows.
- A row longer than 4 seconds with one action is a hold wearing an action's clothes. Split it or
  waive it.
- The last end s is the duration meta. If the film is longer than the rows, the tail is dead.
- Sound cues come from the picture; you write them when you write the action, not after the render.

source: the column set is adapted from Hanif's `templates/beat-sheet.md` in
https://github.com/buildwithhanif/claude-animation-skill (MIT, Hanif) and the "reads: start to end"
storyboard shape in https://github.com/JohnHeibel/ClaudeAnimationBase (MIT, John Heibel); the
"freeze the hold is the biggest cheap-motion tell" and "a duration with no tail" rewrites are from
HyperFrames' prompt anatomy, https://github.com/heygen-com/hyperframes/blob/main/docs/prompting/anatomy.mdx
(Apache 2.0, HeyGen), pattern only, none of its attribute vocabulary.
