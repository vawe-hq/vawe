---
when: "you are about to write a text or panel entrance, a transition, an exit, a typing effect or an emphasis, and want the proven version instead of your first idea"
answers: "the built moves as CSS and WAAPI snippets an agent copies, picked by job or by group, each with its `EASE` curve and a 1 s clip, and the eight demo looks"
group: reference
---

# prompts/moves/: proven moves to copy

[RECIPES.md](RECIPES.md) joins these moves into fourteen films (three brand stings and three product
stings, one per direction family, a 15 s launch, a kinetic type line, and six complete videos of 20 to 30 s: problem to fix, AI demo, feature tour, proof, manifesto, brand reveal) and one spectacle beat for any film (quiet, the big moment, the release), with the beat table, the sound cues and the traps at each seam.
The clips are not tracked as masters. Open a clip at `site/public/moves/<move>.mp4` (the web encode of the same render). `bin/vawe moves --only <move>` renders the master to `prompts/moves/<move>.mp4`, and `node scripts/site/moves.mjs --clips` encodes it into `site/public/moves`.
Each move file has a `Sound:` line under its snippet: the voice and the second to cue it, or none.

Scope: a move animates designed things (type, shapes, UI, illustration, colour fields). A photo may be content in a
move (a card, a tile, a window, a carousel item), moved whole. A move that only works by processing a captured
image (cutting it into depth layers, faking camera depth inside it, tracking or rotoscoping footage) is a footage
technique, not motion design, and is not part of vawe. Sampling a photo into a designed particle form (`imagePoints`) is in scope.

Each move is one markdown file with a 10 to 40 line snippet and a 1 s clip next to it. Choose from
the clip, not the name. Copy the snippet into the page; the numbers are the ones that read well.
Every curve is an `EASE` name (`EASE.land` for an entrance, `EASE.launch` for an exit, `EASE.pop` for an overshoot, ... from `core/motion/presets.js`, table in `core/motion/README.md`), never a hand-fitted
`cubic-bezier()`. Per-frame code (`vawe.onFrame`, `window.seek`) calls `easeFn('land')(u)` instead. The demo page each clip was rendered from is in `demo/`. Every demo links `demo/demo.css`
(tokens, type scale as a share of frame height, the UI card look); the snippets name its classes, so copy the ones you use.

A move earns its place with a real reference, an approved clip and a clear use; a clip that is not approved, or a use another move covers better, goes out.
This index lists the built moves, in seven groups.

## Featured

The five moves the gallery shows first, in order; the first is the large one. Chosen from a blind score of every clip
(three reviewers, the median; 8 or more only), at most two per group, then by the owner.

1. [Marquee along path](marquee-along-path.md): a row of tiles rides one curve at an even gap for a whole beat
2. [Lens](lens.md): a screen filmed as a real object, with tilt, depth, bloom and an LED grid
3. [Counter dive](counter-dive.md): the camera enters a title through the hole of an "o"
4. [Ticker takeover](ticker-takeover.md): the real answer crashes in and shoves a cycling line off the frame
5. [Shape trace morph](shape-trace-morph.md): a traced outline morphs into the brand mark on one pop

## Pick by job

One row per job, best move first. Every built move is in this table.

| job | moves |
|---|---|
| open on a detail, answer with the whole | [pull-back-reveal](pull-back-reveal.md) |
| open on the brand in under 2 s | [logo-sting](logo-sting.md) |
| arrive by flying into a scene, or give a push depth | [parallax-dive](parallax-dive.md) |
| land a title or wordmark, soft | [tracking-collapse](tracking-collapse.md), [mask-rise](mask-rise.md), [blur-word-cascade](blur-word-cascade.md), [liquid-displace](liquid-displace.md) |
| type a command, prompt or name | [caret-typing](caret-typing.md), [caret-follow](caret-follow.md) |
| land one hero word on the beat | [scale-punch](scale-punch.md), [letter-stagger](letter-stagger.md), [outline-fill](outline-fill.md), [variable-weight-wave](variable-weight-wave.md) |
| cut a line in under hard edges, per character, word or line | [vertical-cut-reveal](vertical-cut-reveal.md) |
| roll a word or label letter by letter, forward, back, or in random order | [letter-swap](letter-swap.md) |
| turn each character over as a small cube | [letter-3d-swap](letter-3d-swap.md) |
| put a picture inside the name | [text-as-mask](text-as-mask.md) |
| decide a name or number on screen | [flap-resolve](flap-resolve.md), [text-scramble-decode](text-scramble-decode.md), [word-swap-slot](word-swap-slot.md), [strikethrough-replace](strikethrough-replace.md) |
| point at one word in a held line | [word-sweep](word-sweep.md), [marker-highlight](marker-highlight.md), [underline-draw](underline-draw.md), [hand-drawn-notes](hand-drawn-notes.md) |
| change what a word means | [weight-morph](weight-morph.md) |
| point at one part of a UI | [spotlight-dim](spotlight-dim.md), [bracket-callout](bracket-callout.md), [ui-focus-zoom](ui-focus-zoom.md) |
| change between shots, hard and fast (exposure-flash reads as camera over-exposure) | [exposure-flash](exposure-flash.md), [cut-on-motion](cut-on-motion.md), [slice-shift](slice-shift.md), [speed-ramp-freeze](speed-ramp-freeze.md), [speed-ramp](speed-ramp.md), [smear-stretch](smear-stretch.md) |
| change between shots, soft | [stack-cover](stack-cover.md), [split-reveal](split-reveal.md), [iris-wipe](iris-wipe.md), [luma-matte-dissolve](luma-matte-dissolve.md), [light-leak-transition](light-leak-transition.md) |
| change between shots, graphic | [direction-wipe](direction-wipe.md), [color-block-wipe](color-block-wipe.md), [type-fill-transition](type-fill-transition.md), [match-cut](match-cut.md), [liquid-wipe](liquid-wipe.md), [shape-morph-wipe](shape-morph-wipe.md), [type-match-cut](type-match-cut.md) |
| change between shots, spatial | [whip-pan](whip-pan.md), [zoom-through](zoom-through.md), [push-blur](push-blur.md), [grid-tile-flip](grid-tile-flip.md), [spin-transition](spin-transition.md) |
| change between shots, one object carries over with no cut and no crossfade | [cursor-spotlight](cursor-spotlight.md), [toggle-horizon](toggle-horizon.md), [progress-timeline](progress-timeline.md), [avatar-world](avatar-world.md), [glow-record](glow-record.md), [highlight-sweep](highlight-sweep.md), [shadow-handoff](shadow-handoff.md), [word-portal](word-portal.md), [underline-road](underline-road.md), [caret-door](caret-door.md), [swipe-continues](swipe-continues.md), [drop-and-land](drop-and-land.md), [spin-rotation](spin-rotation.md), [counter-dive](counter-dive.md), [thumbnail-grid](thumbnail-grid.md) |
| run every beat in and out | [exit-fast](exit-fast.md), [chain-beats](chain-beats.md) |
| lean the camera toward a subject | [camera-moves](camera-moves.md), [rack-focus](rack-focus.md) |
| film a screen as a real object: tilt, depth, bloom, LED grid, fringes | [lens](lens.md) |
| move the camera over a whole world: push, pull, whip | [camera-moves](camera-moves.md) |
| give a camera move depth: ground, mid and front layers move by different amounts | [parallax-dive](parallax-dive.md) |
| two depths of words that resolve as the camera arrives; a focus pull | [depth-resolve](depth-resolve.md) |
| make some arrivals overshoot (21 to 41 percent of them) | [arrival-spring](arrival-spring.md) |
| enter the next world by flying into an element | [scale-through](scale-through.md), [zoom-through](zoom-through.md) |
| wipe in the next beat along the last move's direction | [direction-wipe](direction-wipe.md) |
| overlap beats so the next starts before the last ends | [chain-beats](chain-beats.md) |
| hold a line still to read, with a ground option behind it (the hold itself keeps a part moving, rule live-hold) | [drift-hold](drift-hold.md), [gradient-mesh-field](gradient-mesh-field.md) |
| give a held frame a living ground | [aurora-drift](aurora-drift.md), [grain-field](grain-field.md), [halftone-field](halftone-field.md), [ink-warp](ink-warp.md), [dot-grid-wave](dot-grid-wave.md), [light-pool](light-pool.md), [gradient-mesh-field](gradient-mesh-field.md) |
| show a click doing its job | [cursor-click](cursor-click.md), [notification-pop](notification-pop.md), [success-check](success-check.md), [command-palette-summon](command-palette-summon.md) |
| show a real UI arriving | [card-assemble](card-assemble.md), [skeleton-reveal](skeleton-reveal.md), [clip-expand](clip-expand.md), [device-tilt-stage](device-tilt-stage.md) |
| show an AI product answering | [ai-stream-response](ai-stream-response.md) |
| show an AI agent doing several steps | [agent-progress](agent-progress.md), [terminal-run](terminal-run.md) |
| show an agent asking permission | [approval-gate](approval-gate.md) |
| show a model being chosen | [model-picker](model-picker.md) |
| show a code change reviewed and merged | [diff-card](diff-card.md) |
| show an edit and its result in one frame | [panel-live-sync](panel-live-sync.md) |
| prove a number | [count-up](count-up.md), [chart-build](chart-build.md) |
| turn a real photo into a particle form with its own detail | [photo-particles](photo-particles.md) |
| prove a change with a picture | [before-after-wipe](before-after-wipe.md) |
| end on the brand | [wordmark-cascade](wordmark-cascade.md), [logo-sting](logo-sting.md), [mark-trace](mark-trace.md), [shape-trace-morph](shape-trace-morph.md) |
| end quietly | [calm-lockup](calm-lockup.md), [thanks-sweep](thanks-sweep.md) |
| end on an action | [cta-pop](cta-pop.md), [cta-morph-press](cta-morph-press.md) |
| hand the product to the brand | [ui-strip-away](ui-strip-away.md) |
| prove it with customers | [logo-wall](logo-wall.md) |
| show the problem, then the fix | [overwhelm-collapse](overwhelm-collapse.md) |
| show the product works with other tools | [integration-hub](integration-hub.md) |
| make many things read as one gesture | [grid-stagger-wave](grid-stagger-wave.md) |
| tour several features in one space | [pan-stations](pan-stations.md) |
| hit one detail on a beat | [crash-zoom](crash-zoom.md), [echo-trail](echo-trail.md) |
| replace a line with the answer, by impact | [ticker-takeover](ticker-takeover.md) |
| say it works for everyone while the brand stays still | [anchor-cycle](anchor-cycle.md) |
| name the person on screen | [lower-third](lower-third.md) |
| carry a line along a curve | [text-on-path](text-on-path.md) |
| melt a tab or panel into the next | [gooey-filter](gooey-filter.md) |
| ride tiles along a curve, or slide rows of them | [marquee-along-path](marquee-along-path.md), [simple-marquee](simple-marquee.md) |
| orbit tiles around one point | [circling-elements](circling-elements.md) |
| turn a cube to show another face | [css-box](css-box.md) |
| break a picture into blocks and clear it | [pixelate-svg-filter](pixelate-svg-filter.md) |
| open a picture inside a line of type | [media-between-text](media-between-text.md) |
| run a spoken line as captions | [caption-karaoke](caption-karaoke.md), [caption-editorial](caption-editorial.md) |

## Reveal a title

| move | use when |
|---|---|
| [mask rise](mask-rise.md) | a line of type enters from under an invisible edge; the mask box is tall enough for descenders |
| [tracking collapse](tracking-collapse.md) | a title or wordmark arrives: letters converge from wide tracking while the word sharpens |
| [caret typing](caret-typing.md) | a command, a prompt, a name typed in; the caret moves with each character then becomes the next element |
| [letter stagger](letter-stagger.md) | a word lands letter by letter, 45 ms apart, on one exact curve |
| [scale punch](scale-punch.md) | the hero word hits from 1.4x and recoils on the overshoot curve; a full stop pops after it |
| [split-flap resolve](flap-resolve.md) | a name or number is decided: each letter is a tile that flips through seeded glyphs on a hinge and locks left to right |
| [word swap slot](word-swap-slot.md) | one word in a held sentence rolls through 3 or 4 values and lands; the sentence reflows its width |
| [blur word cascade](blur-word-cascade.md) | copy resolves word by word from blur with a slight rise; no mask, so nothing cuts a descender |
| [text as mask](text-as-mask.md) | the type is a window onto a rich picture: the frame opens tight on image, pulls back to the title, and the layers keep moving inside the fixed letters |
| [outline fill](outline-fill.md) | one hero word arrives as an outline, letter by letter, then an accent floods each letter from its baseline on the beat |
| [strikethrough replace](strikethrough-replace.md) | an old word or price is struck through by a tilted line drawn left to right, it dims and shrinks, and the new value rises in beside it character by character |
| [grid stagger wave](grid-stagger-wave.md) | a title arrives with many things around it: a grid of tiles enters in a wave by distance from the title, 70 ms per tile, each tile pushed out from the source on a spring |
| [text scramble decode](text-scramble-decode.md) | a name or codename is revealed as a lookup: a mono line of seeded wrong glyphs locks left to right, each fresh letter flashes accent, then a verified line appears under it |
| [ticker takeover](ticker-takeover.md) | a line with a cycling word is replaced by the answer: the word rolls through three values, then the hero crashes in on a long slide and its edge pushes the whole text group out of the frame |
| [anchor cycle](anchor-cycle.md) | one phrase stays pinned while a tape beside it is hard-cut through eight words, slow then fast, and holds on the last; a brand lockup then drops in under the still anchor |
| [lower third](lower-third.md) | a person is on screen: an accent rule grows, a plate wipes open, the name rises from a mask and the role follows, then the card leaves faster than it came |
| [liquid displace](liquid-displace.md) | a title arrives bent by moving water and settles to sharp type: an SVG turbulence map drives a displacement that drains to zero by 1.15 s, then the type holds still and readable |
| [echo trail](echo-trail.md) | one element flies in and stops on a beat: five time-offset copies of it trail with falling opacity, then fold into the lead on the hit frame while it squashes and recoils |
| [caption karaoke](caption-karaoke.md) | a spoken line runs as captions: the word being said lifts to full ink and one soft pill glides word to word on a [[t, wordIndex]] speech table |
| [caption editorial](caption-editorial.md) | editorial captions: one or two key words per line in a contrasting italic serif, and the next caption replaces the last on a short line-by-line mask cut |
| [variable weight wave](variable-weight-wave.md) | one hero word arrives as a wave: weight and width of a variable face crest letter by letter, left to right, then settle at a firm weight |
| [text on path](text-on-path.md) | a line of words rides an SVG path with startOffset set from the seek time, front word first, and settles readable on the curve |
| [vertical cut reveal](vertical-cut-reveal.md) | a line arrives hard-edged: every character, word or line rises from under its own clip edge, staggered from the first, last, middle or any item on the motion library's spring (port of fancy) |
| [letter swap](letter-swap.md) | a word or label rolls letter by letter: each letter slides out of its clip box and the same letter slides in; forward or pingpong, stagger or seeded random order (port of fancy) |
| [letter 3d swap](letter-3d-swap.md) | a lowercase line turns over as boxes: each character is a cube that rolls 90 degrees about its centre to the same character on the next face (port of fancy) |

## Change between shots

| move | use when |
|---|---|
| [cut on motion](cut-on-motion.md) | a moving shape carries the eye across a hard cut into a new scene |
| [push with blur](push-blur.md) | a panel pushes in with a directional blur that follows its speed, set per frame |
| [exit fast](exit-fast.md) | the pair every beat needs: arrive fast and land soft, leave faster and shorter |
| [chain beats](chain-beats.md) | beats overlap: the next starts at 65% of the last and one element hands off (dot, bar, rule); use once per film |
| [whip pan](whip-pan.md) | the next shot is to the side: a fast sideways pan with a blur that follows its speed hides the seam |
| [match cut](match-cut.md) | one shape crosses a scene change at the same place, size and angle and changes meaning (spinner ring, finished ring) |
| [iris wipe](iris-wipe.md) | a circle closes on the click or mark the eye is on and uncovers the next scene |
| [stack cover](stack-cover.md) | the next panel slides over the last one: the old shot moves a quarter as far and dims, a shadow grows with the overlap |
| [split reveal](split-reveal.md) | the frame opens like doors onto the next shot: two halves part, the gap starts dark and lights as they clear |
| [slice shift](slice-shift.md) | horizontal bands slide off in alternation, staggered with seeded jitter and speed blur, and uncover the next shot |
| [type fill transition](type-fill-transition.md) | a word scales into one letter until its stem is the whole frame; that colour is the next shot's ground |
| [colour block wipe](color-block-wipe.md) | a solid brand-colour block sweeps across the cut with a slanted, blurred leading edge; a darker block trails it and the next shot sits behind |
| [zoom through](zoom-through.md) | the camera dives into a UI part until it fills the frame and the next shot comes out of it, with real zoom blur from stacked exposures |
| [speed ramp freeze](speed-ramp-freeze.md) | a beat needs weight before a change: story time is an integral of a speed curve, so the ball, its squash and the camera slow to a sharp near-hold on the hit frame, then snap on at 3.5x with blur |
| [speed ramp](speed-ramp.md) | both sides of a cut move the same way: the outgoing accelerates into the cut and the incoming leaves it at the same speed and slows, so the cut lands at peak speed |
| [liquid wipe](liquid-wipe.md) | a gooey organic edge floods the frame onto the next shot: bars with round heads fuse through a goo filter into a wet edge, and an accent band leads the next shot |
| [grid tile flip](grid-tile-flip.md) | a wall of tiles flips in a wave to the next shot: one perspective for the grid, each tile lifts toward the camera and darkens edge-on, shot A on the front and shot B on the back |
| [luma matte dissolve](luma-matte-dissolve.md) | the next shot arrives through its own brightness: an SVG luminance matte with a falling threshold shows its bright areas first, then midtones, and its dark ground last |
| [smear stretch](smear-stretch.md) | an elastic cut: shot A's content stretches into streaks on an ease-in, the cut lands at the peak, and shot B snaps back from the streak on an under-damped spring, thinning and bulging like rubber |
| [shape morph wipe](shape-morph-wipe.md) | the next shot grows out of a shape on screen: the mask is born as a dot, grows as a circle, then widens and squares off into a rounded card and past the frame |
| [spin transition](spin-transition.md) | a 90 degree camera roll carries the cut: A rolls to 45 degrees speeding up, B rolls in from -45 and lands soft, scaled to always cover the frame, with rotational blur from 16 stacked exposures |
| [swipe continues](swipe-continues.md) | a card is swiped left and the next scene arrives from the right at the same speed: one belt, the finger lets go at the peak, 40 percent of the travel on the throw and 60 on the brake, 8 stacked exposures for the blur |
| [drop and land](drop-and-land.md) | an action in scene A lands in scene B: the product tile lifts, falls under gravity out of the card into the cart while one camera tilt brings the cart up and stops before the landing, then squashes and settles on a spring |
| [spin rotation](spin-rotation.md) | a loading spinner hands over to the loaded screen: the arc's leading edge sweeps a wedge that uncovers the next screen, the camera rolls 14 degrees with the turn and settles tilted, and the ring flies to the header as its mark |
| [counter dive](counter-dive.md) | a title is entered through one letter: the camera pushes in log space into the counter of an "o" cut out of the title, scene B is already inside it as a miniature, and it fills the frame with no cut |
| [thumbnail grid](thumbnail-grid.md) | the scene shrinks into a thumbnail in a grid that is the next scene: one pull back in log space about the middle cell, nine frame-sized cells in the world, radius from square to the look's step, then the title and a selection ring |
| [light leak transition](light-leak-transition.md) | two shots meet through warmth: three generated warm layers swell over a dark UI on their own clocks, the cut lands on the peak, and the new shot climbs out as they fall faster; no image asset |
| [type match cut](type-match-cut.md) | one word grows in shot A and holds its place while the frame cuts around it; in shot B the same node is part of a new line |
| [cursor spotlight](cursor-spotlight.md) | a click opens the next screen: the cursor tip grows a soft circle (a radial mask, not a blur) that shows shot B inside it while shot A stays outside until the circle covers the frame |
| [toggle horizon](toggle-horizon.md) | a setting switches the world: the toggle track stretches past both frame edges and thins to the horizon line of the next scene, and shot A opens away from the line, up and down |
| [progress timeline](progress-timeline.md) | a bar ends and the result opens in an editor: the fill runs past its end, stands up into the scrubber of a timeline and reveals it while it keeps the fill's speed |
| [avatar world](avatar-world.md) | a person or brand is the way in: a round vector avatar grows until its circle covers the frame and its art is the ground of the next scene |
| [glow record](glow-record.md) | an alert becomes a live state: a badge's red floods the frame in 0.35 s on a screen blend with over-exposure, then gathers into the red dot of a recording light |
| [highlight sweep](highlight-sweep.md) | a highlight sweeps across a key word, keeps going off the line and grows into the next panel's background; the edge never stops at the word, and the word flips to dark ink at the edge |
| [shadow handoff](shadow-handoff.md) | a card lifts, its blurred shadow stretches down and right and darkens into the night scene's ground colour, then the card leaves faster than it lifted |
| [word portal](word-portal.md) | a typed word grows until one stem is the whole frame and the next scene shows through the letterforms (an SVG text clip over a fixed scene B), on a log-path zoom |
| [underline road](underline-road.md) | the underline of a headline extends, bends down and becomes the route on a simple map, with the camera trailing the head at its speed and stopping at the map's end |
| [caret door](caret-door.md) | the blinking caret grows tall, then opens as a two-frame-wide door that turns about it under perspective; the next screen is on the door's face |

## Point the eye

| move | use when |
|---|---|
| [word colour sweep](word-sweep.md) | the accent runs word by word in reading order and stays on the target word |
| [weight morph](weight-morph.md) | one word gets heavier on a real variable-font axis; the glyphs reshape, nothing is scaled |
| [marker highlight](marker-highlight.md) | a highlighter bar wipes behind one phrase and the text flips dark for contrast |
| [underline draw](underline-draw.md) | a line draws under the key word, left to right, fast in and slow out |
| [bracket callout](bracket-callout.md) | corner brackets fly in and snap onto a word or a UI part with a small overshoot |
| [spotlight dim](spotlight-dim.md) | the frame dims around one target: a hole closes from the full frame onto it and its shadow is the dim |
| [hand drawn notes](hand-drawn-notes.md) | a person's margin notes: a loose circle round one word, an arrow from a written label and an underline, drawn on with stroke-dashoffset and a seeded wobble |

## Move the camera

| move | use when |
|---|---|
| [UI focus zoom](ui-focus-zoom.md) | zoom onto one part of a captured UI: the cursor lands, then one translate and one scale put the part in the middle |
| [caret follow](caret-follow.md) | the camera trails the typing caret on a soft spring, so a long line stays readable at close range |
| [pull back reveal](pull-back-reveal.md) | open tight on a detail and pull back to the whole; scale runs on a log path so the speed reads even |
| [parallax dive](parallax-dive.md) | the camera flies forward through layers at real depths: near layers rush past, the far ground barely moves; also one camera move on ground, mid and front layers by depth (`parallax()`) |
| [exposure flash](exposure-flash.md) | a cut on a screen film reads as over-exposure: 3 frames of white, the swap inside the peak, the new shot starts at 2x brightness and settles in 0.15 s; at most 3 flashes a second |
| [lens](lens.md) | a screen filmed as a real object: tilt, depth, bloom, LED grid, fringes, done as lens work and never faked with CSS layers |
| [camera moves](camera-moves.md) | a whole world as one wrapper: push toward a subject (the ground scales less so the layers separate), pull, whip between worlds (`camera()`); the camera holds still by default |
| [depth resolve](depth-resolve.md) | far words small and soft resolve as the camera arrives; a focus pull (`focus()`) |
| [scale through](scale-through.md) | fly into a plain element and its colour is the next world, in Web Animations only |
| [direction wipe](direction-wipe.md) | a mask edge moves the way the last move went and reveals the next beat |
| [arrival spring](arrival-spring.md) | `EASE.nudge` on one arrival in three, `EASE.pop` on the one that matters (`nudgeEvery`) |
| [rack focus](rack-focus.md) | focus moves from one depth layer to another: near melts, far resolves, pinpoint lights swell into discs; use once per film |
| [drift hold](drift-hold.md) | the line holds still while only the ground drifts, so a held frame never sits dead |
| [gradient mesh field](gradient-mesh-field.md) | a title sits on a living ground: four soft colour pools drift on seeded paths in one fragment shader, with grain against banding; the copy keeps 4.5:1 |
| [pan stations](pan-stations.md) | several steps or features as one continuous place: the camera pans between stations on one wide canvas and holds at each, a rail and a parallax dot grid carrying the space between them |
| [crash zoom](crash-zoom.md) | one detail hits on a beat: a 0.13 s ease-in slam to 2.6x with real zoom blur from 16 stacked exposures, a 5 percent overshoot and a short recoil |

## End a film

| move | use when |
|---|---|
| [logo sting](logo-sting.md) | a short logo hit: the mark lands, one light band crosses it, the word opens from behind it, a slow push runs to the last frame; use once per film |
| [wordmark cascade](wordmark-cascade.md) | the name is the last beat: letters fall onto a rail with shrinking gaps, the full stop lands last, an accent bar runs the rail; use once per film |
| [mark trace](mark-trace.md) | a line mark draws itself with a riding tip, thickens to its final weight, then an accent bar runs the finished mark; use once per film |
| [shape trace morph](shape-trace-morph.md) | a brand mark is built like a shape layer: an outline draws on, fills as it closes, then morphs into the real mark on one spring; both paths keep the same command count; use once per film |
| [calm lockup](calm-lockup.md) | the quiet ending: logo and line settle slowly while two lights drift behind and the lockup floats; use once per film |
| [cta pop](cta-pop.md) | the call to action pops in under its line on the overshoot curve, the one accent, and the arrow leans to invite the click |
| [thanks sweep](thanks-sweep.md) | a closing line sweeps in on a soft mask edge with an accent bar riding the edge, then drifts; use once per film |
| [UI strip away](ui-strip-away.md) | the last beat hands the product to the brand: the UI leaves layer by layer, top layer first, while the sidebar mark travels to the middle and becomes the lockup |
| [logo wall](logo-wall.md) | the proof beat before the call to action: three lanes of hairline cells with invented logos slide in from alternate sides on a stagger, blurred to their speed, and keep drifting after they land |
| [CTA morph press](cta-morph-press.md) | the close moves from brand to action: one plate changes shape into a button on one spring, a cursor arrives on a bowed path and presses, and the button shows a confirmed state |

## Product moments

| move | use when |
|---|---|
| [clip expand](clip-expand.md) | a panel or capture grows out of one point the eye is already on |
| [cursor click](cursor-click.md) | a cursor travels a bowed path to a control, the control lights and dips on the press, the label rolls to its result, the cursor leaves |
| [count up](count-up.md) | a number is the proof: each digit is a wheel that rolls to its value with speed blur, then a delta chip and a sparkline |
| [card assemble](card-assemble.md) | a UI card builds: the shell lands, then each part arrives from the side of its slot, the accent action last |
| [notification pop](notification-pop.md) | a banner drops in on the overshoot curve, icon then text, holds a second and leaves faster than it came |
| [chart build](chart-build.md) | gridlines draw, bars rise in sequence, the newest bar turns accent and its value tag pops on it |
| [before after wipe](before-after-wipe.md) | the claim is a change: one card in two states, and a scan line carries the after state (accent, real numbers) over the grey before on the iris curve |
| [skeleton reveal](skeleton-reveal.md) | grey blocks in the shape of the content shimmer under one moving light, then each region resolves into real content, 200 ms apart; use once per film |
| [AI stream response](ai-stream-response.md) | a typed prompt is sent up into the thread, a status line shines, then the answer streams in 1 to 3 word chunks with a caret on the newest chunk |
| [overwhelm collapse](overwhelm-collapse.md) | the problem turns to the fix: 26 cards, chips and notifications flood the frame on a shrinking gap, then a fast cubic-in collapse pulls them into one point and one clean element opens |
| [success check](success-check.md) | a button resolves into a drawn check: the press dips, the width closes to a circle, the check draws on one dash, the circle lands on a small spring and one ring leaves it |
| [integration hub](integration-hub.md) | the "works with your tools" beat: invented tool logos fly in on curved paths and land on a ring around the product mark, then every wire draws in the same frames and pulses ride into the hub |
| [device tilt stage](device-tilt-stage.md) | the product as an object: the UI on a CSS 3D laptop that rises from a steep top-down angle, turns and settles on a spring, the glass reflection sliding with the lid's angle |
| [command palette summon](command-palette-summon.md) | the keyboard-first beat: the app dims, a Cmd+K palette drops in on a spring, a query types, non-matching rows collapse to zero height, Enter presses the chosen row and the palette leaves fast |
| [gooey filter](gooey-filter.md) | a tab, pill or panel must melt into the next: shapes that touch merge into one soft outline through the SVG gooey filter (blur 15, alpha matrix 19 and -9), the active tab box slides on a critically damped spring and the page swaps in 0.2 s |
| [agent progress](agent-progress.md) | an AI agent works through steps: a card springs in, an arc turns beside a status line that swaps states, and numbered rows flip to checks one by one, ending mid-list |
| [panel live sync](panel-live-sync.md) | an edit and its result in one frame: a cursor scrubs fields in a panel and the button on the page beside it rotates, rounds and grows in the same frames |
| [terminal run](terminal-run.md) | a coding agent works in a real Claude Code terminal: the task is typed and sent, a status line counts tokens, Read, Update (red and green diff) and Bash calls arrive, the answer lands |
| [approval gate](approval-gate.md) | the agent asks before it acts: the Claude Code permission prompt replaces the input, the selection looks at option 2 and returns, Enter runs the command and the work goes on |
| [model picker](model-picker.md) | a model choice: on claude.ai a pointer opens the model menu, picks Opus, the check moves and the label rolls to the new name |
| [diff card](diff-card.md) | code review as proof: a GitHub pull request diff builds, the diffstat counts to +312 -48, checks pass and the Open badge becomes Merged |

`bin/vawe moves` renders only the clips whose demo, `demo/demo.css` or imported `core/` files changed (hashes and the CRF used in `clips.lock.json`; a clip over 2 MB is encoded again at a higher CRF). `--only <move>` forces one clip, `--all` forces every clip.

Two rules the snippets already obey, so keep them when you adapt one: an exit keyframe has no
`from` (a `from` fills backwards over the entrance and hides it), and `var()` never goes inside the
`animation` shorthand (write the longhands; Chromium drops the whole declaration otherwise).

The demo look was polished with two ui-skills: `jakubkrehel/better-ui` (concentric radius, layered shadow over border for depth, optical alignment, tabular numbers, icon stroke matched to text weight) and `emilkowalski/animate` (only to check the approved motion, nothing rewritten).
Rejected from them: their default UI sizes and 300 ms duration caps (film type needs a 6 percent cap height and holds), the 0.96 press scale and blur-in icon values as global rules (each move keeps its own tuned numbers), and reduced-motion and hit-area advice (a film has no input).

## Grounds

The job: give a held frame a living ground that never steals the eye. Each ground moves at a mean luma change of 0.5 to 3.0 per frame at 60 fps, keeps 4.5:1 for the copy against the lightest and darkest pixel behind it, and is a pure function of the seek time. [gradient mesh field](gradient-mesh-field.md) and [drift hold](drift-hold.md), in Move the camera, do the same job.

| move | use when |
|---|---|
| [aurora drift](aurora-drift.md) | three soft bands of light hang from the top of the frame and fold slowly in one shader while the copy sits low; the light thins out above the type |
| [grain field](grain-field.md) | a quiet printed or filmic frame breathes: a slow tonal ground and film grain that turns over 24 times a second, seeded from the seek time, never from Math.random |
| [halftone field](halftone-field.md) | a physical or retro frame gets a 45 degree dot screen whose dot size waves across the frame while every dot stays in its cell |
| [ink warp](ink-warp.md) | a rich liquid ground for short large copy: marbled ink flows by domain warp in one shader, thinner behind the type |
| [dot grid wave](dot-grid-wave.md) | a clean product or data frame gets a plain SVG dot grid with one travelling wave of scale and brightness, weaker behind the copy |
| [light pool](light-pool.md) | a matte held frame gets one soft pool of light that wanders on a seeded path, plain CSS with no shader; the stillest ground of the group |
| [marquee along path](marquee-along-path.md) | tiles ride one SVG path forever at an even gap, turned with the curve, rolling z-index, 8 percent of the path per second; one element along the path is an option |
| [simple marquee](simple-marquee.md) | three rows of tiles slide for a whole beat, left, right, left, each row four copies that wrap by one set width at 8 percent per second |
| [circling elements](circling-elements.md) | eight upright tiles orbit one point on a 120 px radius, one linear turn in 10 s |
| [css box](css-box.md) | a 200 px cube of bold type turns to another face on a stiff overdamped spring (stiffness 100, damping 30, no overshoot) under perspective 600 |
| [pixelate svg filter](pixelate-svg-filter.md) | a photo breaks into square blocks that grow and shrink with one number, size = x / 30 through a convolve, tile and dilate SVG filter |
| [photo particles](photo-particles.md) | a real photo (filaments, veins, scales) is sampled into 120 000 lit, coloured points that gather from a seeded scatter over 1.5 s and then breathe, filmed through the lens with the film-halation look |
| [media between text](media-between-text.md) | a picture grows from zero width inside a line of type on a 0.4 s critical spring and closes on a 0.3 s tween, the words part and wrap |

## Clip bar

A clip is the card a move shows in the gallery, so it shows the move working inside a scene. A word or an object alone on a flat colour fails the bar. Each rule is checked with `bin/vawe frame --world all`, `bin/vawe frame`, `bin/vawe frame` or the demo source. The shared parts are in `demo/demo.css` (the stage) and `demo/assets/stage.js`.

| # | rule | check |
|---|---|---|
| 1 | 4 to 6 s (`<meta name="duration">`). Frame 0 is the empty ground (lit for a stage clip, flat for a real-product or title clip). The finished state holds 1.0 s or more with one small part alive (a caret, a counter tick, a ping, a sheen, or what the copied product really does: a hover, a tab title), never a loop near text being read, and the camera stays still. A plain title card may hold still once its last move has landed; it declares the hold with `static-window@a-b`. Then `leave(el, clipMs)` from `demo/assets/stage.js` takes the subject out in 0.3 s, ending 0.1 s before the clip end, on the same empty ground. | `bin/vawe frame <clip> --at 0,<duration minus 0.03>`: the two tiles show the same ground |
| 2 | The subject sits in context. Type: on the lit ground with one supporting part (a hairline and a caption; no eyebrow, nav, CTA or pill). A UI move: a copy of one real product (see rule 3) with real content, body text 2 percent of the frame height or more (chrome and captions may be smaller as `data-chrome`, as in the product), or in one floating `.glass` panel on a stage clip. A transition: two real states of one scene, each text in the same slot in both states, so no two text layers overlap mid-swap, and the after state has a real shape (a step, a result), not a flat line. | `bin/vawe dev <demo> --silent`, then the look sheet it prints; `bin/vawe frame <clip> --at` through the swap |
| 3 | Real product (owner approved 2026-10-19; `prompts/skill-combos.md`, default look "Mature product"): a clip that shows an AI chat, a dashboard, a pull request or a terminal copies the real screen (a Chrome window `.win` in `demo/demo.css`, or the macOS terminal `.win.term` in `demo/assets/terminal.css`; `data-look="product"`, no `data-stage`) on a flat neutral ground measured from the reference clips (#f3f3f0 light, #0c0c0c dark). The browser window is 131.9 x 87.9 u (74 percent of the width, 88 percent of the height), the terminal 109.6 x 88.2 u (62 percent, 88 percent) with a 2.2 u mono face, as the references crop them. One layered neutral window shadow, no lights, grain, glass, glow, blobs or gradients behind it. Brand marks only where the real UI shows them, as simple accurate SVG. A product copy follows the product's own motion (rule 4). A stage clip instead (type, brand): `<html data-stage>` gives four soft lights, a drifting pool and a fixed grain, with no vignette; `driftLight(ms)` moves the pool once round the clip; the pool centre differs from a corner by 8 levels of 255 or more. Each clip names its skill combo (`prompts/skill-combos.md`) in the demo's `data-look`: `product` is Mature product, `soft` is Soft light (product UI), `editorial` is Warm editorial (type). | `bin/vawe frame <clip>`: the ground is flat for a product copy; pool centre against corner for a stage clip |
| 4 | Overshoot and springs only where the real surface uses them, or for brand and type components (20 to 40 percent of their arrivals overshoot their rest by 5 to 20 percent of the travel, at least one lead arrival visibly; `bin/vawe dev <demo> --silent` prints `range: arrivals that overshoot N%`, reference band 21 to 41). A product copy follows the product's own motion and never invents overshoot: a terminal never eases its text (typed characters, the sent prompt line, output rows, the permission prompt and the selection marker appear in whole steps with `show` and `runDot` from `demo/assets/stage.js`; only the scroll may ease), a menu or popover opens with a short fade and scale, a window or panel fades in with no scale (`UI.panel`), a dashboard chart draws on load, a pull request page does not animate its rows, a chat bubble snaps about x1.11 as the reference clip shows. Only the clip framing eases: the window's entrance and `leave`. Creative motion on a real surface only when the user asks for it. When dev prints an overshoot-share advice for a product copy, waive it in the `authoring` JSON with the reason "real surface: <product> does not overshoot". | `bin/vawe frame <demo> --moment <s>` around the send and the output: no in-between frame for terminal text; `--velocity` on a brand or type clip |
| 5 | Two themes: `<html data-theme="light">` is the default clip, `<meta name="variants" content="dark">` renders `<move>-dark.mp4` (a look's theme block holds the other colours). Both pass `node prompts/moves/demo/contrast.mjs`. | open both clips |
| 6 | Clips are silent: no `<audio>` in a demo, and `bin/vawe moves` renders with `--silent`, because the reference clips have no sound. The `Sound:` line of the move names the cue for a film: the voice and the second (`taste/craft/sound.md`). | `bin/vawe moves --only <name>`: the clip has no audio stream |
| 7 | The numbers in the snippet of the move file are the numbers in the demo. | read both |
| 8 | A 4 to 6 s clip prints findings that a real product answers in one of four ways. (a) `text-unreadable-hold`, `text-moves-before-hold`: waive both in the `authoring` JSON with the measured hold (2 to 4 s against the 5.4 s asked). (b) `static-window@a-b`: keep one real part alive (a caret blink, a spinner, a hover, a tab title) or declare it with the measured seconds and what really stays still. (c) Cap height: product chrome (tab strip, address bar, nav, footer hints, rails) takes `data-chrome` (no read hold; its 2.5 percent floor still prints as advice, which a real product's chrome stays under); the content text stays at the size the reference crops it. Neither is waivable. (d) Text collisions: they come from page content moved under fixed chrome (a scroll), so scroll only when the content has to, and never beyond the height of the first header. Run `node prompts/moves/demo/contrast.mjs` for contrast. | `bin/vawe dev <demo> --silent`: every finding is waived with a number or fixed |

Where the numbers come from. Five product films in `~/.vawe/refs/measures.md` (never committed): 24 to 36 percent of their tracked arrivals overshoot (Linear Agent 24, Arc 26, Raycast 2026 30, Linear Releases 32, Framer Enterprise 34, Raycast Pro 36), and the two UI-in-scene films hold a shot 5.5 to 6.2 s at median (Linear Agent 5.45, Linear Releases 6.17). Two read in full with `bin/vawe see`:

- Linear Releases (`6dIwFoQ0eVg`, 30 s): 5 shots of 4.4 to 8.3 s, none under 4 s. Palette `#040404` for 88 percent of the pixels and `#181818` for 9 percent (a step of 20 levels), bloom 2.2 px. Of 40 tracked parts 18 overshoot, median 18 percent, one at 349. Each shot has 10 parts that start and land at different times (0.3 to 2.6 s long), so something always moves.
- Raycast Pro (`u6iro1jHujs`, 22 s): 24 shots, median 0.82 s, but every second shot holds 1.4 s. 27 of 85 tracked parts overshoot, median 42 percent. Black ground, 2.3 px bloom. Sound: 69 onsets in 22 s, most of kind "pop", at -21.8 LUFS.

Sound today. A clip is silent. A film that uses a move cues the synth effect voices (`pluck`, `tick`, `tap`, `droplet`, `air`, `whoosh`, `shimmer`) on its actions, never as a bed; a recorded effect cut with `bin/vawe sound <file> --sfx` from a site in `resources/README.md` replaces a synth cue when one exists.

## Looks: one design system, eight demo looks

`demo/demo.css` holds both. A demo sets `<html data-look="name">`; no class, size or timing changes.

### The foundation (every look inherits it)

- Type: six sizes as a share of frame height (`--u` is 1 percent): hero 18, title 11, head 7.6, lead 6, body 4.8, small 3.8. `--hk` scales only the three headline sizes for a face that sets small.
- Faces: `--sans` text, `--head` headlines (weight, tracking, case by token), `--label` eyebrows, `--mono`, `--display` wordmarks, `--em-face` one emphasis word (`.em`).
- Spacing `--s1`..`--s5` (1.2 to 7 u). One grid: 12 columns, margin `--s5`, gutter `--s3` (`.grid`).
- Radius steps `--r0`..`--r6` (0, 0.5, 1, 2, 3, 4.6, 6 u). A look picks `--r-chip` and `--r-card` from them.
- Line weights: hair 1 px, rule 0.25 u, heavy 0.45 u. Depth: ring, stack, lift, hero. A look changes only the colour and which step it uses.
- Colour roles: ground, surface, raised, hover (a visible ladder), ink, muted, accent, on-accent, plus the `--paper` pair for a cut.
- Contrast: ink, muted, on-accent and paper text pass 4.5:1; accent as text passes 3:1 (large type only). `--faint` is for dots, rules and icons, never for text. `node prompts/moves/demo/contrast.mjs` checks all eight.
- `.chip` is a fixed square (`--size`, default 11 u) for an icon or a letter; a label that grows with its text is a pill of your own, not a `.chip`.
- Stage: `<html data-stage data-look="soft|editorial" data-theme="light|dark">` adds the lit ground (four soft lights, a drifting pool, grain); `.glass` with an inner `.core` is the double-bezel frame for a UI. The two stage looks are combos from `prompts/skill-combos.md`: `soft` (Soft light) and `editorial` (Warm editorial), each light by default with a dark block. A look has a block for the theme it does not start in (vawe light, paper dark, daylight dark, terminal light, soft dark, editorial dark); the other six looks have one polarity and ignore `data-theme`.
- Faces are in `generators/media/fonts.mjs` with a locked version (`harness/media/fonts.lock.json`).

### The eight looks

| look | character | use for |
|---|---|---|
| vawe | cool near-black, cobalt, dark ink on the accent | product UI, brand stings, anything default |
| daylight | white-blue, navy ink, tinted shadow, indigo | product UI on light: cursor, palette, before-after |
| terminal | charcoal green, one mono face, phosphor | typing, commands, streams, code |
| swiss | off-white hairlines, red, tracked mono labels | type and data: charts, logo walls, callouts |
| paper | cream, serif headline, brick orange, grain | quiet editorial type: titles, quotes, thanks |
| brutal | acid yellow, black borders, hard shadow | hits on the beat: punch, cut, cascade |
| signal | near-black, condensed capitals, mint, pills | loud headlines, flash cuts, slices, release notes |
| field | one saturated green, lemon, tints | bold colour wipes, pops, sweeps |

### Variety rule (how a look is assigned)

1. Within a group a look appears at most twice. Two exceptions: a group of more than 20 moves (Change between shots) lets one look take a third, and a move may borrow the nearest look when its pool is full.
2. Adjacent moves in a group list differ.
3. Product-UI moves take product looks (vawe, daylight, terminal, swiss). Type moves take editorial looks (paper, swiss, brutal, signal). Transitions take colour-led looks (field, brutal, signal) first.
4. A typed stream takes terminal.

The assignment is the `data-look` on each `demo/*.html`. Shared assets live in `demo/assets/`: `logos.js` (sixteen invented brands, never a real company) and `photos/` (CC0 only, sources in `photos/credits.json`); reuse them before you draw a new one. `bin/vawe moves` renders only the clips whose demo, `demo/demo.css` or imported `core/` files changed (hashes in `clips.lock.json`).
