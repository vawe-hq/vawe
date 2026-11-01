---
when: a real video looks better than ours and you want to learn and copy why, or you recreate a specific reference end to end, or reflect a real website section by section
answers: "how to sample a reference, what a dense read shows, the premium-feel habits, the ordered recreation loop (measure, capture, light first, verify), reflecting a site, and the honest 1:1 ceiling"
group: story
---

# REFERENCE STUDY: learn from great videos, then copy the feel, not the frames

When a real piece looks better than ours, the gap is rarely one effect. It is a handful of habits we
skipped. Study a reference like an editor: measure it, name what it does, reproduce the intent.
`bin/vawe see <ref.mp4> --spec` gives the cut list, light map, text timeline and curves.
The commands and stops of a recreation are in `skills/vawe-reference/SKILL.md` and `prompts/reference-rebuild.md`; this page holds the judgement behind them.

## Sampling rate decides what you learn

A contact sheet shows states. Motion lives between them. On one nine-second reference three rates gave
three films:

| rate | what the reader concluded |
|---|---|
| 1 fps | "it never changes composition" |
| 2 fps | it flips its ground, light to dark and back |
| 10 fps | the stacked echo builds, rotates in 3D, blurs into a cylinder and resolves; the closing phrase assembles word by word with four cursor grabs |

Only the last is true. The first two were confident and wrong, and a film planned off the 1 fps read
had to be replanned. So when the question is how something moves, take a contiguous strip at about
10 fps of the busiest shots. It costs many times a sheet in tokens, so spend it only there.

- Also sample the entrance, the exit and a zoomed crop of the text. The beat middle is the one frame
  that hides a dolly, a gradient fill or a colour wave.
- Check the end. Density is usually front-loaded, and a film that opens at a move every 0.7 s may hold
  its last two seconds almost still.
- Copy hold time, not the effect list. The published method this follows cut a 31 s film to 15 s by
  removing shots, not by speeding them up: mark each shot KEEP or CUT.
- Shot detection is evidence, not a verdict. A hard cut scores exactly. A dissolve scores almost nothing
  (a film that authors 14 cuts across dark frames was detected as 3). Review the frames.
- Keep the reference out of published films. Extract its grammar (shot length, cut rate, what carries a
  junction). Drop its UI, copy and colours.

## The habits that make it feel premium

A good reference does these and our defaults do not. Reach for them on purpose, and name the target of each.

1. Never dead. A part of every beat is in motion (a line typing, a counter, a glint, a secondary action): that is the alive-versus-slideshow lever. The camera holds still unless the beat earns a move; scale with `transform`, never font-size (reflow jitters).
2. Motion carries through the seam: the outgoing beat zooms out as the incoming zooms in, not a
   background swap.
3. Massive scale and frame bleed. One huge word, tiny everything else, reads as confident. A timid
   centred headline is the amateur tell.
4. Asymmetry. Hero words sit low-left or offset. Reserve centring for a deliberate lockup.
5. Dolly enter and exit. A word enters oversized and blurred and scales down to settle (a dolly-in, not
   a scale-up from small), holds, then scales up and blurs to leave.
6. Gradient fill on hero type (dark top to lighter bottom), not a flat colour.
7. Blur follows fast moves. A crisp fast move looks cheap.
8. One accent word per line, treated, never the whole line. Accent text on a light ground needs a darker
   accent ink to clear contrast.
9. Typewriter with a blinking caret for prompt, search and command beats. It sells "you are using it".
10. Front-loaded pacing, 1 to 1.5 s per beat, the strong word first, accelerate into the payoff, then
    hold. Uniform pacing reads flat.
11. Real product UI, tilted in perspective with a push-in, not a flat screenshot.
12. Cursor to consequence. A click with no visible outcome is a dead beat.
13. Repeated motifs build rhythm. Repetition with variation is structure.

Evidence: the Brew launch v1 had static holds, hard cuts, a small centred headline and fade-in words.
Fixing exactly those (a push per beat, zoom seams, hero size up and left, scale-settle entrances, a
darker accent ink for text at 2.4:1) moved it from "inspired by" to "reads like the same film".

## A style from a reference

A style taken from a reference is not a recreation. The brief names the ref, and `critique` and `judge` default to
it (the line `ref: <id>` shows which). Read the card that `bin/vawe refs frames <id>` prints (cuts, flashes, luma,
camera, palette), not only the top of SPEC.md. Judge the film against the ref, not against the generic range.

## Recreating a reference end to end

`bin/vawe new <name> --ref <ref.mp4>` writes SPEC.md, and `ship` refuses until the `bin/vawe critique <page> --ref <ref.mp4>`
loop passes (`skills/vawe-reference/SKILL.md`).

A reference is pixels, not a page. The loop turns those pixels into a page that reads as the same film.

1. Measure: `bin/vawe see <ref.mp4> --spec` writes SPEC.md (cut list, light map, text timeline, curves). Mark every line KEEP or CHANGE before you write code.
2. Get the real material: capture real UI, never redraw it.
3. Build light first, then camera and depth of field, then type, then detail. A recreation can score well on SSIM and still be wrong in the way a viewer sees first: one measured reference read 4 to 8x brighter with a diagonal field of light and the render was mostly black with a small glow bolted on. Match the light map first (`harness/lib/light-map.mjs`, a 16x9 low-frequency map in linear light) and check it with `compare` before you touch type.
4. Verify: `bin/vawe frame <page> --vs <ref.mp4> --at t1,t2` while you build, `bin/vawe check coverage <ours.mp4> --ref <ref.mp4>` and `bin/vawe critique --ref` as the done check.

- A tight measured fit (`MEASURE.md`) is a number you can author. A loose fit means the move is not one tween (typing, two stacked tweens, a mask): rebuild it by intent. Track one element with `node harness/media/track.mjs <ref.mp4> --box x,y,w,h --from t0 --to t1`.
- Dominance is by looking, and a brand's site is not its film. A dark-first site can launch with a cream film. Match the film you recreate, not the homepage.
- A recreated camera is one monotonic move with no reversal and a linear interior ease: an eased chain zeroes velocity at every key and pulses. Cut to the track: a cut a few frames off the beat reads sloppy. Copy the reference audio when you have it (`taste/craft/sound.md`).
- "Ours shows so little" is rarely too few cuts. It is frame emptiness, telling instead of showing, and under-using the surfaces you captured: back every claim with the surface that proves it (`taste/craft/show-dont-tell.md`).

## Reflecting a live site

Never rewrite a site's sections by hand: you lose its taste and half its assets. Screenshot each section, plan one beat per section in the site's order, capture the real block (logos, gradients and copy come free), and animate it your way. A dark capture goes on a dark surface, or you keep its assets and set the copy again in your own type. A true `<canvas>` or WebGL section cannot be captured as DOM: use its screenshot with a slow move. Hand-write HTML only for connective tissue: hook, CTA, counters.

## The honest ceiling

Two things bound 1:1: the display font (match it with the closest bundled face, do not pretend) and proprietary source assets (a capture of the live UI closes most of the gap). Everything else is reproducible. When the reference does something no primitive covers, that is a framework finding: report it, do not approximate it.
