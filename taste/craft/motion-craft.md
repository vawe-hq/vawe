---
when: planning or judging the timing, easing, layering and transitions of a page film
answers: "why the motion rules exist: layering, handoffs, arrival rhythm, overshoot, easing by feeling, cut against transition, and what a dead or jolting film looks like"
group: process
---

# Motion craft: why the motion rules exist

Contents:
- [The ten ideas, and the rule behind each](#the-ten-ideas-and-the-rule-behind-each)
- [Layering, life and handoffs](#layering-life-and-handoffs)
- [Speed, measured here](#speed-measured-here)
- [Arrival rhythm](#arrival-rhythm)
- [Snap: overshoot and settle](#snap-overshoot-and-settle)
- [Easing: which curve, and what it feels like](#easing-which-curve-and-what-it-feels-like)
- [Registers: restraint depends on the film](#registers-restraint-depends-on-the-film)
- [Which UI-motion standards transfer](#which-ui-motion-standards-transfer)
- [Genre pacing](#genre-pacing)
- [DO / DON'T](#do--dont)
- [Cut, or transition?](#cut-or-transition)
- [Effect choice, by feeling](#effect-choice-by-feeling)
- [Does the film ever stop](#does-the-film-ever-stop)
- [What code guarantees, and what is taste](#what-code-guarantees-and-what-is-taste)

Distilled from motion-design literature and from measured films. The numbers live in the rules
(`taste/rules/`); this page keeps the reasons and the examples. Failure smells are in
[failure-modes.md](failure-modes.md). The direction spine is in [direction.md](direction.md). Intent-first
effect choice is in [selection.md](selection.md). Restraint by film type is below. Springs and keyframe helpers are in `core/motion/springs.js`.

## The ten ideas, and the rule behind each

| Idea | What it means in practice | Rule |
|---|---|---|
| Timing is a voice, not a constant | Entry pace varies with intent. One duration everywhere reads as monotone narration. | [speed-bands](../rules/speed-bands.md) |
| Entrances land, exits launch | Entrances decelerate (arrivals are landings). Exits accelerate (departures are launches). Never linear on a move over 0.3 s (a camera's interior legs aside). | [entrance-ease](../rules/entrance-ease.md), [exits-shorter](../rules/exits-shorter.md) |
| Hierarchy through offset | Related elements arrive one after another. The hero moves last or largest. Motion order is reading order. | [stagger](../rules/stagger.md), [arrival-rhythm](../rules/arrival-rhythm.md) |
| Choreograph arrivals | Elements in one beat arrive as one phrase, not as independent events. Anticipation is the tiny pre-move before the main move. | [arrival-rhythm](../rules/arrival-rhythm.md), [anticipation](../rules/anticipation.md) |
| Settle and hold | A clip, card or line of text stays still long enough to read. | [readable-hold](../rules/readable-hold.md) |
| One hero motion per beat | One element owns the motion; the rest supports quietly. Two competing animations read as none. | [one-hero-motion](../rules/one-hero-motion.md) |
| Rotate layout archetypes | Never the same archetype twice in a row. | [archetype-rotation](../rules/archetype-rotation.md) |
| Velocity contrast between beats | A fast beat earns a still one. The still keeps one part moving (not a camera drift). | [live-hold](../rules/live-hold.md) |
| Cover the hard cut | A background jump (dark to light) wants a sting that peaks at the cut. Same-background scenes can whip or slide raw. | [ground-jump-cover](../rules/ground-jump-cover.md) |
| Type moves like it reads | Text enters in reading order, rises from its own baseline, and never crosses another line's path. | [arrival-rhythm](../rules/arrival-rhythm.md) |

## Layering, life and handoffs

### How a designer decides what moves, in order

1. **Message and hierarchy first.** Pick one focal point per transition and serve it. Material's
   choreography guide: "Maintain a clear focal point during transitions by carefully selecting the
   number and type of elements shared across the transitions" (m1.material.io/motion/choreography.html).
2. **Boards, then an animatic.** Lock the beats and their order as still frames before anything
   moves. In vawe that is `brief.md` and the stills step.
3. **Block pose to pose.** Key the hero motion first, at its start and end pose only. Check the read
   works with nothing else moving.
4. **Secondary, then ambient, last.** Add support in decreasing order of loudness, never all at once,
   and never before the primary read is proven.

### Primary, secondary, ambient

- **Primary** drives the beat: the one hero motion.
- **Secondary** reacts to the primary and stays quieter (a shadow settles a beat after its card).
- **Ambient** keeps a held frame alive without asking to be watched: a slow breathe or glint on a part, or the ground. Not a camera drift: the camera holds still unless the beat earns a move ([constant-camera](../rules/constant-camera.md)). It is the
  smallest of the three by design ([live-hold](../rules/live-hold.md)).

Time them by offset, not simultaneity: motions sharing a beat start at different moments, in
hierarchy order. Material's own number ("no more than 20 ms apart") answers how long a person waits for
an interface, not how a shot should feel, so use the film stagger in [stagger](../rules/stagger.md).

### Element life: enter, hold, exit

Every element has a designed enter, hold and exit, or a handoff. An element that is simply gone in the
next frame is dropped, not finished. Ask why before you ship it. A handoff where the outgoing
element's final pose becomes the incoming element's first pose reads as one object travelling
([seam-timing](../rules/seam-timing.md)).

### Handoffs that lead the eye (School of Motion's six transitions)

- **Match cut:** match a compositional element (a shape, a position) across the cut.
- **Cut on action:** cut to another view while matching the first shot's action. Place the hard cut on the action frame. Nothing checks the alignment: use your eye.
- **Graphic match / shape morph:** an SVG shape tweens into the next shape.
- **Container transform:** one element's shape grows into the next screen's frame.
- **Zoom through:** a continuous push into a surface with no cut across the shot.
- **Object wipe:** a live scene crosses and reveals the next, both sliding in lockstep on a hard edge.

A transition that blends two still rasters freezes any motion inside its window and jumps at the far
side. A film with continuing motion through a boundary needs a live join (a shared moving object, a
camera travelling through), never a blend of two frozen frames ([crossfade-limit](../rules/crossfade-limit.md)).

### Pitfalls

- **Everything moving at once.** Three or more top-level layers on one exact start read as a block, not a hierarchy.
- **Secondary competing with primary.** Two things owning the motion is zero read, not double.
- **Uniform timing, in both directions.** One duration on everything is monotone. Too many distinct durations read as drift: "five modals with five durations, each defensible, collectively incoherent" (Blake Crosley). Hold to a few named bands ([speed-bands](../rules/speed-bands.md)).
- **Motion with no meaning.** "Motion is information or it is noise." Adding motion because a frame feels empty is noise.
- **Ambient padding to look busy.** Switching on drift everywhere raises the motion of the whole frame and costs the film. See "Does the film ever stop" below.

## Speed, measured here

**Distance and duration.** Carbon and Material say duration should follow distance but publish no
equation. Across 345 keyed moves in 135 library scenes the median speed was flat by distance (about 650
to 710 px/s in every distance band). So the working figure is a speed, about 700 px/s for a move you want
the eye to follow (`eye_speed_px_per_s` in [speed-bands](../rules/speed-bands.md)). A third of all moves
cover under 50 px at about 72 px/s: that is ambient drift, and a short move is not obliged to be fast. The
published ceilings (300, 500, 700 and 1000 ms) all answer how long a person waits for an interface.
Nobody waits through a film, so they do not apply. No test on speed alone is reliable: a ceiling at the
95th percentile flagged three films that all read clean (a 2 px rule sweeping to reveal UI, an 1800 px
pane sliding out, a card tucking into a slot). Look at frames.

**Organic stagger** (Rauno Freiberg): a stagger reads as alive when it varies in degree as well as
order. Use a seeded shuffle for the order, not a metronome step.

**Cycling text** (a ransom-note re-roll) is not an entrance: it changes for the whole shot. Under about
0.8 s it reads as noise, over 2 s as broken. Offset letters so they do not flip in unison.

## Arrival rhythm

- **Across a beat**, between things that are not the same thing: irregular. A headline, a card and a chip that all begin on one frame give the eye no order. Offset them by different amounts, and start the next while the last is still settling.
- **Within one cascade**, among things that are the same thing: even. Six bullets or a row of logos read as one sweep only if the interval holds. A 40 / 260 / 40 ms cascade reads as a stall.

Both hold because they measure different scopes ([arrival-rhythm](../rules/arrival-rhythm.md)).

## Snap: overshoot and settle

The most recognisable "this was directed" tell is a move that lands soft: a curve that only
decelerates reads floaty, and one that lands decisively reads alive. The default way to land soft is
EASE.land, not a bounce ([overshoot](../rules/overshoot.md)).

- **Land fast, hold long.** A curve that decelerates for most of half a second reads floaty; a short, decisive landing reads alive. Keep the move quick (speed bands), and give the readable time to the hold after it, never to a slower move.
- **Overshoot is a claim about mass.** Use EASE.pop only where the point of the move is a press or a pop, and only on things that then hold still. Overshoot on text held for reading wobbles and looks like shaking.
- **A counter must never overshoot.** A number has no mass, and a count that springs flies past its true figure and falls back, so for a few frames the film shows a number that is not true. A film that says 1,822 and paints 1,900 on the way breaks the rule to use real figures ([overshoot](../rules/overshoot.md)).
- **Let the brand own the personality.** A punchy brand tightens durations and stagger, a calm one stretches them. Set it once per film as `:root` custom properties, not per element ([named-eases](../rules/named-eases.md)).

## Easing: which ease for which job

Pick the row for the job the element does. The times come from the speed bands and the limits in `core/motion`.

<!-- jobs table: written by harness/dev/taste-build.mjs from core/motion/ease-jobs.js: do not edit -->
| Job | Ease | Time | Avoid |
|---|---|---|---|
| Title or text entrance | EASE.land | 0.5 to 0.8 s | pop or any overshoot on text: held text that overshoots reads as shaking. |
| UI panel or card in | EASE.land | 0.22 to 0.5 s | scale or overshoot on a panel. A copied product panel only fades in 220 ms with a 0.8vh rise. |
| Value change (number swap) | EASE.swap | 0.15 s out, 0.26 s in | a spring on a number: it shows a figure that is not true. Roll each digit in its own slot; never half of two readings. |
| List stagger | EASE.landSoft, EASE.nudge | 0.15 to 0.3 s a row, 30 to 80 ms apart, the run within 0.5 s | land on every row: a hard first frame on each reads as flicker. Overshoot on more than every third row. |
| Small pop or notification | EASE.pop | 0.5 to 0.8 s for a corner notification that slides in over more than 20 px | text blocks and more than one moving item. A pop under 0.35 s leaves 2.4 frames of settle at 30 fps. A small item that moves 3 to 20 px (a bubble, a chip, a tip) takes the send spring instead: k 500, d 25. |
| Exit | EASE.launch, EASE.leave | 0.35 to 0.6 of the entrance (0.3 s after a 0.5 s one); 0.18 to 0.3 s when the entrance length is unknown | an exit on the entrance's own ease: it arrives while leaving. Use leave only for a settle or a hand-off the page names. |
| Camera move under 2 s | EASE.land | 0.5 to 2 s | settle or glide: they reach 5% of the travel only after 20% and 14% of the time, so a 1.6 s pull-back looks dead for its first 0.33 s. |
| Camera move of 2 s or more | EASE.glide, EASE.settle | 2 s or more | land: it stops dead on arrival. Glide for a push or a drift; settle for a pull of 2 s or more that starts and ends at rest. A camera move under 2 s takes land. |
| Scan or wipe travel | EASE.settle | 0.5 to 1 s | swap: its steep middle turns the travelling line into a blur. Keep swap for the value the line flips. |
| Hold drift | EASE.glide | the length of the hold, 2 s or more | a copied product surface: it holds still and stays alive through what the product does (a caret, a timer, a hover). |
<!-- end jobs table -->

## Easing: which curve, and what it feels like

An easing curve is the acceleration of a move: how it starts and stops. Choose by intent from the
EASE names in `core/motion/presets.js`; the table says what each feels like. Never a CSS keyword as a
default and never a hand-fitted cubic-bezier ([named-eases](../rules/named-eases.md)).

| Feeling you want | Curve | What it does |
|---|---|---|
| Directed entrance, clean decelerate | EASE.land | fast in, long smooth settle, zero overshoot |
| A short move under 0.4 s | EASE.landSoft | lands softer than land |
| Dramatic arrival | EASE.land on a hero at cinematic length, or a spring | very fast then a long tail; weighty |
| Press or pop (rare) | EASE.pop | passes its mark by about 15 percent and settles |
| Ambient loop (breathing, drifting) | EASE.glide | gentlest curve, no hard stop |
| Handover between two seen positions | EASE.carry | eases in, still fast at the end so the next move takes the speed |
| Speed ramp inside one move | slow to fast to slow | a camera or counter reads as intentional, not a lerp |
| No travel at all | a stepped swap | holds the from value and jumps at the far key |

### The pivot can travel

The transform origin decides which point a scale or rotation grows from. Animate it: a door that
swings from one hinge and then the other, a panel that grows from its left edge and then its centre.

### Follow-through: one property finishing after another on the same element

A card that slides in and whose rotation settles a beat after it lands reads as a physical object.
The same card whose every property stops on one frame reads as a slide changing. Thomas and Johnston
call it overlapping action ([follow-through](../rules/follow-through.md)).

### What a graph editor does that a curve table cannot say

1. **A key in the middle of a move should not stop.** Most curves above come to rest at their end, so three keys read as two moves with a full stop between. Compute the tangent at a waypoint key from its neighbours so the velocity entering equals the velocity leaving ([camera-path-linear](../rules/camera-path-linear.md)).
2. **A key has two sides, and their shape is the speed graph.** A spike then decay reads as a hit that settles. A flat plateau reads as a machine. A symmetric hump ("easy ease") reads as soft and generic by default: it is the reason so much motion looks competent and characterless. Choose the shape the motion means. Do not push influence near 100 on both sides of one key: the hump collapses to a spike and the object skips.

### Reading the tells

| Good | Bad (and why) |
|---|---|
| An entrance on EASE.land | An entrance that starts slow: it feels sluggish, never snaps |
| A visible slide on a named ease | A visible slide on linear: robotic, weightless, the amateur tell |
| Overshoot only on things that then hold still | Overshoot on text held for reading: it wobbles |
| Curve and duration varied by intent | One curve and one duration on everything |
| An exit that accelerates away | An exit on the entrance's own ease: it arrives while leaving |

## Registers: restraint depends on the film

Restraint has two answers. In a UI-adjacent or quiet explainer film, motion is a cost the viewer pays for legibility (NN/g treats animation duration as time taken from the task; Apple HIG: "avoid gratuitous motion"): one loud moment, everything else quiet. In kinetic type, hype, a launch promo or a continuous title sequence, motion is the content: sustained motion across the runtime is correct and a still beat is the cost (Saul Bass, Kyle Cooper). Pick the register before the restraint level. The register changes the restraint target, not the variety requirement: a hype film with every beat moving the same way is still monotone.

Seven devices, each right in one place and wrong in another: continuous ambient (a backdrop, a held beat that would be dead; wrong when it pulls the eye off the content); entrance and exit (almost every element); emphasis (the one hero reveal, a stat, a CTA; wrong when it fires every beat); transformation (a headline shrinking into a label; wrong between two objects with no shared logic); camera (real depth, a capture pan; wrong when camera and element double-count travel); physics (a spring on something with a rigid identity; wrong on a counter); time remapping (a speed ramp inside one move; wrong with no reason, it reads as a glitch).

What can be measured: cut rate has an accepted metric (average shot length, Cinemetrics). "Is this motion good" has none. Frame difference finds a dead frame; it cannot judge whether motion serves the beat. Keep the fresh judge (`bin/vawe-dev judge`) as an eye-first step, and never let a proxy count stand in for a judgement. The Material Design 3 curves are an outside reference only: film pages use the EASE names, not a pasted bezier.

## Which UI-motion standards transfer

From Emil Kowalski ([animations.dev](https://animations.dev), review-animations STANDARDS): about half do not apply to film. No transfer: a 300 ms UI budget (nobody waits on a film; product UI shown in a film follows the film speed bands), frequency of use (a film is watched once), interruptibility, `prefers-reduced-motion`, hover, press and drag, and "animate only transform and opacity for 60 fps" (we render offline; keep it for determinism). Transfer:

- **Easing order.** An entrance lands (EASE.land), an exit launches (EASE.launch), a move between two seen positions travels (EASE.carry), constant motion is linear only for a pan, a progress ring or an ambient drift. Never a slow-start curve on an entrance ([entrance-ease](../rules/entrance-ease.md)).
- **Strong curves.** The CSS keywords are too weak and a hand-fitted bezier starts too hard and stops too early: use the EASE names ([named-eases](../rules/named-eases.md)).
- **Asymmetric timing.** An entrance is an introduction and deserves its time, an exit is over: exits run faster and shorter ([exits-shorter](../rules/exits-shorter.md)). Never start from scale 0: start slightly smaller with opacity 0.
- **Springs** are duration plus bounce (`springLinear`, `springDuration` in `core/motion/springs.js`). Origin-aware motion is the strongest single technique: a popover scales from the button that opened it ([entrance-origin](../rules/entrance-origin.md)).

Motion is not decoration. It explains what just happened: a held frame says the last thing mattered.

## Genre pacing

Beat length and cut rate by genre are in [story.md](story.md) and [film-structure.md](film-structure.md#the-motion-grammar-ten-patterns-that-recur). A launch film
runs one transition family plus one accent; a product walkthrough is calm and uses UI-mechanism motion
only; shorts (games, facts) are snappy throughout.

## DO / DON'T

- DO let a counter's easing be the story (a speed ramp). DON'T animate numbers linearly.
- DO give ambient chrome a pulse at tiny amplitude. DON'T loop anything near text being read.
- DO stagger board cards. DON'T pop a whole board at once: it reads as a screenshot.
- DO scale travel to element size (a short travel for UI text, a longer one for heroes). DON'T fling small text far.

## Cut, or transition?

Before you reach for a transition, ask whether the beat wants a plain cut. School of Motion: "Simplicity
is the ultimate sophistication." The hard cut is the professional default, and a transition has to earn
its place ([hard-cut-default](../rules/hard-cut-default.md), [seam-meaning](../rules/seam-meaning.md)).

| Intent between two beats | Use |
|---|---|
| Fast pace, on the beat, raw impact | hard cut |
| Passage of time, location change, montage | dissolve |
| Punch, launch, hide-then-reveal (matched action) | cut on action: a hard cut placed on the motion |
| Visual continuity: a shape carries over | match cut, or a shape morph |
| Diving into a screen | dynamic zoom or a camera push into the artifact |
| Logo or "awe" flourish | morph: logos and one hero moment only |

- **A transition on every seam reads as a template.** A film is mostly cuts with a few earned transitions.
- **Cut to the beat** ([cut-on-beat](../rules/cut-on-beat.md)).
- **A transition states a relationship** (time passed, place changed, this becomes that). With no relationship to state, the cut is the honest choice.
- **Master a few:** a dissolve, one momentum move (whip or push), one zoom, a rare morph.

## Effect choice, by feeling

- **Kinetic type:** a plain rise is the default read. A typewriter suits terminals and timers. A scramble-decode suits tech, on hero words only. Tilt suits sporty; a pop suits playful brands only. Blur-in suits dreamy or refined brands. A gradient word at most once per film. A highlight or underline emphasises mid-sentence. A wave belongs to ambient loops only.
- **Cuts:** fade or blur is neutral. A whip works on momentum, on the same background only. A punch or zoom focuses a product. A spin suits logos. A jitter suits alarm or glitch only.
- **Stings:** a flash is an energy cut. Burn or light-leak suits warm brands. Ink or dissolve suits editorial. Glitch, scan or pixel suits tech. Confetti is for wins only.
- **Ambient looks:** fields sit behind content at low intensity. Overlays (VHS, CRT, film grain, light leak) sit on top, one per film, never behind small body copy, and never two together ([live-hold](../rules/live-hold.md)).
- **Motion blur:** a velocity-derived streak on fast moves sells speed and hides the frame stutter. Skip it on slow drifts and on small body text held mid-move, where it dissolves the text ([blur-follows-motion](../rules/blur-follows-motion.md)).
- **Colour grades:** duotone collapses a busy photo into two brand colours. Tritone keeps a mid-tone for faces and products. Posterize wants 4 to 6 levels, and fewer gets muddy. A vignette stays light or it reads as a tunnel.
- **Glow:** bloom belongs at a bright point (a logo, a lit number). Halation is film-warm glamour on one highlight, felt not seen. Diffusion softens a busy dark region so text floats.
- **Captions:** a highlight with a read trail is the default when the caption is the content. Karaoke pills are loudest, for hype cuts over busy footage, never over dense UI. A weight shift is quietest, for product demos.

## Does the film ever stop

**Local motion, not global motion.** The obvious way to raise a motion score is ambient motion
everywhere. That buys the number and costs the film. Judge local motion (something arrives,
concentrated in a small region) and global motion (everything drifts a little) separately. Measured
across a reference and its recreation, 80% of the change in a moving window lived in 3.1 to 3.9% of the
frame in both, because both films moved by revealing content in one place, not by breathing everywhere.

**A dead window** is a 0.5 s span with no local content motion: a reveal finished and nothing took
over. The reference film's quietest window measured 0.42 on the local-motion scale against a median of
1.33. `vawe-flow-2` had no window below 0.2 across 19.8 s. A bad recreation had ten, including one 2.5 s
dead stretch. The world keeps moving to the last frame ([live-hold](../rules/live-hold.md),
[moving-tail](../rules/moving-tail.md)).

**A jolt** is a speed jump between frames. A linear camera station, or a decelerating stop straight into
a hold, is the classic shape: smooth on a storyboard, jerky on screen. `page-check` reports the hard
version as `dead-stop` ([live-hold](../rules/live-hold.md)).

## What code guarantees, and what is taste

Code guarantees determinism (seek purity), text contrast, clipped glyphs, readable holds and dead
stops, through `bin/vawe check page-check` and `bin/vawe check review`. Everything else in this file is taste,
which is why it is written down.
