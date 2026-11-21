---
when: "choosing the cut between two beats (you cannot say why a transition is there)"
answers: "the transition taxonomy (type, meaning), the banned slideshow tells with their fixes, the twelve handoff families (what carries the eye across a cut, when each fits, its cost, moves to copy), Murch's Rule of Six, continuity versus montage, the per-seam decision procedure, durations and speed profiles, where the eye is at a cut"
group: story
---

# TRANSITIONS: choosing the seam by theory, not habit

Contents:
- [The prime rule](#the-prime-rule)
- [Emotion first: Walter Murch's Rule of Six](#emotion-first-walter-murchs-rule-of-six)
- [Invisible or expressive](#invisible-or-expressive)
- [The taxonomy: type, meaning, when](#the-taxonomy-type-meaning-when)
- [The twelve handoff families](#the-twelve-handoff-families)
- [Banned (slideshow tells)](#banned-slideshow-tells)
- [The decision procedure: run it at every seam](#the-decision-procedure-run-it-at-every-seam)
- [Restraint: the invisible cut dominates](#restraint-the-invisible-cut-dominates)
- [Speed is the anti-repetition lever](#speed-is-the-anti-repetition-lever)
- [Durations](#durations)
- [Where the eye is at a cut](#where-the-eye-is-at-a-cut)
- [Align the beats to the seam](#align-the-beats-to-the-seam)
- [Station to station: the launch-film transition with no cut](#station-to-station-the-launch-film-transition-with-no-cut)
- [The motion-design layer (elements, not shots)](#the-motion-design-layer-elements-not-shots)

A transition is the seam between two beats. It is grammar, not decoration: it means something, and the
meaning must be chosen, not defaulted. The failure this page exists to stop is picking one effect (a
blur, a dissolve) and spraying it on every cut. That is not "smooth". It is a seam that says nothing,
ten times. [selection.md](selection.md) lists intent to choice in one line each. This is the deep dive for the cut.

## The prime rule

> A transition must serve the relationship between the two beats and the feeling across the seam. If it
> serves neither, it is a hard cut.

The hard cut is the default and the great majority of professional edits
([hard-cut-default](../rules/hard-cut-default.md)). You earn anything more by naming what it does
([seam-meaning](../rules/seam-meaning.md)). "It looks smoother" is not a reason. It is the blur-spam tell. Crossfade means
"this continues". Hard cut means "wake up" or disruption. Slow dissolve means "drift with me". You
crossfade everything: use hard cuts for disruption and register shifts.

## Emotion first: Walter Murch's Rule of Six

Murch (*In the Blink of an Eye*) ranks what a cut serves, by weight:

| # | criterion | weight | asks |
|---|---|---|---|
| 1 | emotion | 51% | does the cut serve what the audience should feel? |
| 2 | story | 23% | does it advance the narrative? |
| 3 | rhythm | 10% | is it the right moment, musically? |
| 4 | eye-trace | 7% | does it respect where the viewer already looks? |
| 5 | 2D plane, screen direction | 5% | does it honour the 180 degree axis? |
| 6 | 3D spatial continuity | 4% | is the physical space consistent? |

Emotion outranks the other five combined. Never give up emotion for story, story for rhythm, and so on
down. A cut that breaks screen direction and nails the feeling is correct. Cut where the audience would
blink: on the completed idea, not mid-thought. That is why a typed line finishes before the seam and a
beat lands before it leaves.

## Invisible or expressive

Continuity (Hollywood): the cut is invisible. Match on action, motivated cuts, J and L cuts, a
shared-element morph. Most seams live here. Montage (Eisenstein): the cut is shown, because meaning is
made in the collision (the Kuleshov effect: the same face reads as hunger or grief by what it is cut
against). Dissolve, graphic match, smash cut. Ask: should this seam disappear or speak?

## The taxonomy: type, meaning, when

| transition | signifies | reach for it when | in a page |
|---|---|---|---|
| hard cut | nothing, invisible | the default; two beats are one thought | back-to-back beats; overlap a few frames so the stage never empties |
| cross-dissolve | time passing, a link, gentleness | soften, link two images | opacity blend of both beats |
| fade to black | an ending, an act break | open or close the film or a major section | fade to the ground, a real pause; earn it |
| wipe | playful, deliberate, shows the seam | an energetic change of place or time | `clip-path` mask, a soft edge (feather) |
| iris | focus, vintage, isolate | spotlight one thing | circular `clip-path` |
| match cut, graphic | "these two are the same" | bridge scenes by a visual rhyme | same framing or shape across a hard cut |
| match cut, on action | seamless, energy carried | cut on a movement so the eye rides it past the seam | a shape on one path across both scenes (`prompts/moves/cut-on-motion.md`) |
| match cut, conceptual | wit | a word in A pays off in B | copy and timing across a hard cut |
| smash cut | shock, jolt | end on maximum tonal contrast | hard cut plus a hard content or ground contrast |
| whip pan | frantic energy, "meanwhile" | a kinetic change; hide the cut in blur | fast translate with directional blur on both beats |
| push, slide | a new place, same energy | carry the eye one way | translate both beats together, one direction per seam |
| zoom, punch | product focus, a calm reveal | push into a detail | scale up through the cut |
| squeeze | a fast pivot | a speed ramp you can see | smear-stretch through the cut |
| J-cut | anticipation | lead into what is coming | next beat's audio starts before its picture ([sound.md](sound.md)) |
| L-cut | a held emotion | hold a tone while the image moves on | audio runs over the next entrance |
| shared-element morph | magic, same identity | a thing becomes its next role (highest craft) | one persistent element repositions and resizes across the cut |
| camera travel | one world, beats are places | the content has a spatial logic worth walking | the transition is the flight; no cut (below) |
| jump cut | urgency, restlessness | compress time on purpose | hard cut in the same framing; sparingly |

## The twelve handoff families

The taxonomy above names the seam; a family names what carries the viewer across it. Every cut has a handoff: the one thing that
leaves beat A and starts beat B (its screen position, scale, direction and speed on both sides), or nothing, which is a deliberate
cut. Choose per cut with the skill `skills/vawe-transitions/SKILL.md`; this table is the grammar it chooses from. Moves are in
[prompts/moves](../../prompts/moves/README.md).

| family | what it is | fits when the story at the cut is | cost or risk | moves to copy |
|---|---|---|---|---|
| graphic match | two shots share a shape, colour or line, so the eye does not reset | a rhyme between two ideas | needs the same framing in both; an anchor that drifts a few pixels breaks it | [match-cut](../../prompts/moves/match-cut.md), [type-match-cut](../../prompts/moves/type-match-cut.md), [underline-road](../../prompts/moves/underline-road.md) |
| action match | motion continues across the cut at the same direction and speed | one action finishing in a new place | a speed or ease mismatch is the most visible failure | [cut-on-motion](../../prompts/moves/cut-on-motion.md), [swipe-continues](../../prompts/moves/swipe-continues.md), [drop-and-land](../../prompts/moves/drop-and-land.md) |
| object to object | one thing becomes another and the change carries the meaning | a change of state or role | the two objects must differ in meaning, not only in shape | [shape-trace-morph](../../prompts/moves/shape-trace-morph.md), [cta-morph-press](../../prompts/moves/cta-morph-press.md), [avatar-world](../../prompts/moves/avatar-world.md) |
| position lock | an anchor stays at one screen spot while the world changes around it | a change of place with one constant (a user, a cursor, a control) | the anchor must be the subject, else it reads as a glitch | [toggle-horizon](../../prompts/moves/toggle-horizon.md), [progress-timeline](../../prompts/moves/progress-timeline.md), [highlight-sweep](../../prompts/moves/highlight-sweep.md) |
| container transform | an element grows into the next beat's container | zooming from a thumbnail or card into its content, a change of scale | z-order: the container must sit above both beats until it fills | [clip-expand](../../prompts/moves/clip-expand.md), [thumbnail-grid](../../prompts/moves/thumbnail-grid.md), [cursor-spotlight](../../prompts/moves/cursor-spotlight.md), [command-palette-summon](../../prompts/moves/command-palette-summon.md) |
| shared axis | both beats move along one axis, so the cut reads as travel | a sequence of related steps, a change of place | repeating the axis on adjacent cuts is a stutter ([seam-variety](../rules/seam-variety.md)) | [chain-beats](../../prompts/moves/chain-beats.md), [pan-stations](../../prompts/moves/pan-stations.md), [direction-wipe](../../prompts/moves/direction-wipe.md) |
| colour or light flood | a full-frame colour or glow fills the screen and the next beat is revealed from it | a change of time or mood, a reveal, a payoff | a flood with no reveal point just cuts; it must reach the farthest corner | [light-leak-transition](../../prompts/moves/light-leak-transition.md), [exposure-flash](../../prompts/moves/exposure-flash.md), [glow-record](../../prompts/moves/glow-record.md) |
| type-driven | a letter, word or glyph is the mask, the wipe or the object that becomes the next beat | a claim that names the next beat, a payoff | the type must stay readable until it turns into the ground | [type-fill-transition](../../prompts/moves/type-fill-transition.md), [text-as-mask](../../prompts/moves/text-as-mask.md), [word-portal](../../prompts/moves/word-portal.md) |
| camera through | the camera pushes into a hole, screen or letter and exits in another world | a change of scale or place, a reveal | strongest device: one per film; reversing direction across the cut breaks it | [zoom-through](../../prompts/moves/zoom-through.md), [parallax-dive](../../prompts/moves/parallax-dive.md), [caret-door](../../prompts/moves/caret-door.md), [counter-dive](../../prompts/moves/counter-dive.md) |
| invisible cut | the join hides behind a wipe-out object or a motion-blur peak | a change of place that must not call attention | needs a real blur or occluder, else it reads as a hard cut | [push-blur](../../prompts/moves/push-blur.md), [whip-pan](../../prompts/moves/whip-pan.md), [smear-stretch](../../prompts/moves/smear-stretch.md) |
| sound bridge | audio leads (J-cut) or trails (L-cut) the picture so the ear carries the join | any cut where the picture alone is plain | picture and sound must agree on the handoff frame | the Board sound row ([sound.md](sound.md)); pairs with any move |
| deliberate cut | a hard cut chosen on purpose, on a beat or for shock | a tonal flip, a time jump, a smash, a payoff that needs no help | none, but it needs a stated reason like any other ([hard-cut-default](../rules/hard-cut-default.md)) | [exit-fast](../../prompts/moves/exit-fast.md), [speed-ramp-freeze](../../prompts/moves/speed-ramp-freeze.md), [cut-on-motion](../../prompts/moves/cut-on-motion.md) |

Ledger limits (no family on adjacent cuts, none more than twice) and the choice procedure are in the skill, not here. A deliberate cut is exempt from both limits:
hard cuts are most seams.

## Banned (slideshow tells)

A film that reads as slides has one of these. `bin/vawe check slideshow <page>` measures them and scores the film out of 10
(advice; waive with the code `slideshow` and a reason that names a second and a measured value).

| tell | the fix, in one line |
|---|---|
| every scene enters and exits the same way (`same-in-out`) | change the way in or out per scene; exits shorter than entrances |
| a fade or crossfade between every scene (`crossfade-every-cut`) | carry one handoff object across the cut, from a family above |
| hard cut plus a fade in on every scene (`cut-and-fade-in`) | open each scene on the carried object landing, not on a fade |
| a full-frame background swap at every cut with no carried element (`swap-no-carry`; an element counts only if it is visible on both sides and moves within 0.3 s of the cut, one animation over 80 percent of the film is a drift) | name a handoff object that leaves A and starts B |
| scene B starts only after scene A fully left, a dead gap (`dead-gap`) | overlap 0.2 to 0.4 s |
| all elements of a scene enter at once with one move (`all-at-once`) | stagger 30 to 80 ms, a different move for hero and support |
| one centred line of text per scene on a still ground (`one-thing-scenes`) | give each scene a part that moves while the line is read |
| equal shot lengths (`equal-shots`) | vary: let one cut breathe about 0.5 s longer than the rest |
| a static camera and static content in a hold (`static-holds`) | element motion inside every hold |
| the same entrance (fade-up, scale-in) for every element in the film (`same-entrance`) | different moves for hero, support and detail |

The thresholds are repeat counts, not single events: 3 or more cuts, 5 or more elements, a 75 percent share, shots within 15 percent
of one length. One crossfade for a time jump is a choice, not a tell. The code is `harness/lib/slideshow.mjs`.

## The decision procedure: run it at every seam

1. Does this seam need to exist? If two beats flow as one thought, use the invisible default: hard cut,
   match on action, or a shared-element morph. Most seams stop here.
2. What must the viewer feel across it? Continuity is a cut. Time or gentleness is a dissolve. Closure
   is a fade. Shock is a smash. Anticipation is a J-cut. Lingering is an L-cut.
3. Invisible or expressive?
4. What is the relationship? Same object, new state: morph. Same action: match on action. Rhyme: match
   cut. Time: dissolve. Act boundary: fade. Tonal opposition: smash. New place with energy: whip or wipe.
5. What does the seam mean? A change of time, place or perspective justifies a visible transition.
   Nothing to signify: cut.
6. Lead or linger with sound? This is where "smooth" comes from in pro work.
7. Eye-trace and velocity: cut where the eye already is. Keep direction and speed across the seam (exit
   accelerating, enter decelerating through a shared blur).
8. Rhythm: accelerate into a climax, then hold the payoff. Cut on the beat when the user gave a track, or
   two frames early.
9. Restraint check: is this the one primary family or one of the earned accents
   ([hard-cut-default](../rules/hard-cut-default.md))? Adjacent moving transitions change axis or direction
   ([seam-variety](../rules/seam-variety.md)): two back-to-back seams that both push left read as a stutter.

If a seam cannot answer 1 to 5 with a real relationship or feeling, it is a hard cut. That rule stops
effect-spam in both directions, monotone and soup.

## Restraint: the invisible cut dominates

Straight cuts are the meat. Dissolves, fades and wipes are seasoning. You can cut a whole film with
hard cuts. A different showy transition on every seam is the amateur tell. Pick one primary family.
Save the boldest accent for the payoff. Make the outro the simplest. Blur was not wrong as
a primary: it was wrong as the only thing, with no earned accents. Transition only to mark a change of
time, place or perspective.

## Speed is the anti-repetition lever

The transition is the verb and the timing is the adverb. A seam with no speed profile reads flat, and a
film whose seams all ride one gentle curve feels repetitive however many effects it uses. Vary the
velocity across the film, not only the effect.

| profile | curve | reach for it on |
|---|---|---|
| ramp | slow, fast, slow | whips, zooms, squeezes, any thrown seam (the default for motion) |
| rush | EASE.launch, accelerate away | an exit: the beat leaves faster than it arrived |
| brake | EASE.land, decelerate in | an entrance: the beat arrives slower than it set off |
| pop, spring | EASE.pop: overshoot then settle | a chip, badge or UI element landing (rare; the page names it) |
| snappy | decisive, no overshoot | a punchy cut that lands and stops |
| smooth | EASE.glide, gentle at both ends | a calm dissolve or fade, where a ramp would fight the mood |
| linear | constant speed | a deliberately mechanical sweep; rarely what you want |

In a page, write a ramp with an `EASE` name (`core/motion/presets.js`: `carry` into a cut, `land` out of it), or a
`[[f, v]]` table in `seek(t)`. A whole film gets one velocity personality: calm decelerates in, a branded
film uses ramps, hype is snappy, tense rushes. An explicit curve on one seam still wins.

## Durations

The ranges per transition type (match overlap, whip, dissolve, slide, zoom, fade) are in
[seam-timing](../rules/seam-timing.md), in seconds. Finals render at 60 fps, so count frames at 60.
A seam is felt, not measured: round to the frame. A whip that is not fast and blurred reads as a slow
slide. Soft edges are the cheap-versus-polished tell: a hard wipe edge reads as a slide deck, a feathered
one reads graded. A wipe can sweep at any angle, not only the four cardinals.

## Where the eye is at a cut

Nothing measures this: judge it by eye on the frames on both sides of a cut (`bin/vawe critique`). Read the focal point of the frame before the cut and put the incoming subject at or near that screen point; do not make the eye cross the frame at a joint (Derek Lieu). Murch ranks eye-trace fourth of six, at 7 %, under emotion (51 %), story (23 %) and rhythm (10 %), so a cut that serves the story may cost the eye a journey. It is a strong default, not a wall. Rule: [eye-trace](../rules/eye-trace.md).

The eye ranks targets in a fixed order: brighter, larger, in focus, moving (a built frame has no face). The focal point is the winner among the live elements, not what you meant it to be. Brighter means contrast against the ground, not luminance: white type on a white field is the brightest thing and nobody looks at it.

The eye is steered, not only ranked, and all four terms can be animated: brighter (a glow whose intensity, radius and colour change over the shot, cold to hot, wide to tight), larger (travel in Z under perspective instead of scaling, so the element stays crisp), in focus (rack the blur from one plane to another), moving (a keyed path, or a beam that sweeps and reveals what it touches through a moving `mask-image`). Light the subject, then move the light: a glow parked on the hero stops being seen within a second. Rack, do not cut, when two things share a frame and the second matters now. Ask of every beat: where is the eye at the start, where should it be at the end, and what moves it? "It stays where the cut put it" is fair on a held beat and a failure on any other.

When a cut makes the eye jump, in order of cost: place the next headline where the last focal point was (free in a built film); aim the outgoing beat at the corner the next beat opens in; give the next beat more time (a run of short beats, each demanding a jump, never lets the viewer catch up); keep the jump and say why in the page's `authoring` block. No source publishes a distance: the rule's 0.30 of the frame diagonal is this repo's working figure.

## Align the beats to the seam

A blend seam mixes the frame just before the cut with the frame just after. If both beats are on screen
across the cut (the outgoing text never left, the incoming text already arrived), the seam crossfades two
nearly identical stages and the copy mushes into an unreadable double. The outgoing beat must end at
the seam, and the incoming beat must start at it. A persistent morph element is the exception and should
span the cut. Check with the eye: `bin/vawe critique` reads the loop seam and measured deltas.

The frame must not go empty across a joint either. A one-frame luminance dip is a flash. Several frames
of emptiness mean the outgoing beat left before the incoming one arrived. A blank frame on a white
ground never dips, it only drains, so look at the frames, not only the luminance.

A full-bleed layer above a moving layer must not start mid-move and hide it before it plays: that reads
as a hard cut nobody authored. Start the cover after the move ends, or raise the mover.

## Station to station: the launch-film transition with no cut

The Apple move: instead of cutting between product shots, the camera flies through one continuous space
and dwells on each feature in turn. There is no seam because there is no cut. The film reads as one
world, not a stack of slides. Reach for it when the beats are places with a spatial logic (a dashboard,
then a panel inside it, then a detail), not unrelated claims. Each station has a point to centre, a
zoom, a flight time into it and a dwell. Use constant speed on interior legs: an eased curve at each stop
zeroes velocity and breaks one flight into N hops ([camera-path-linear](../rules/camera-path-linear.md)).

## The motion-design layer (elements, not shots)

- Shared element (container transform) is match on action. A headline shrinks into a label. A card slides
  to its next mark. It is the highest-craft continuity we have.
- Easing by role: an entrance lands (EASE.land), an exit launches (EASE.launch), a move or morph between
  seen positions travels (EASE.carry), constant motion is linear. Springs suit interruptible motion because
  they keep velocity. App UI timing budgets do not transfer to film ([motion-craft.md](motion-craft.md#which-ui-motion-standards-transfer)).
- Diegetic beats non-diegetic. Motion that emerges from a real trigger (a whip, a touch point, a shared
  element) reads honest. A generic fade laid on top reads as stock. Prefer the transition that arises
  from the content.
- Choreography (Material): one focal point, share only the most important element across the seam, one
  directional path, stagger secondary entrances, never fire a group at once ([stagger](../rules/stagger.md)).

Sources: StudioBinder (transition types, Rule of Six, match cuts, Soviet montage); Adobe and MasterClass
(J and L cuts, continuity editing); Eisenstein and Kuleshov (montage); Murch, *In the Blink of an Eye*;
Material Design and Apple HIG (choreography, shared element); Thomas and Johnston, *The Illusion of
Life*; Emil Kowalski, animations.dev.
