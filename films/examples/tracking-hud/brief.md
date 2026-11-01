# tracking-hud: brief

An 8 s, 16:9 film in the look of a computer-vision tracking HUD: hatched boxes and coordinate labels lock on the glyphs of big words, filmed through `core/surfaces/lens.js`.

Style after a tracking-HUD test by Michael Nowak (@mnowakdesign); no frames, words or layouts of his are used.

## Inputs

- request: an original short film in a tracking-HUD style
- length: 8 s
- content: own words and numbers about vawe (a few short ones per shot); no captures
- kit: `kit/kit.css` (its own HUD design system)

## Task

- what: an 8 s film where a vision overlay tracks every word, about vawe
- for: people who see it once, muted, in a feed; sound is a subtle extra
- message: every frame, computed.
- spectacle: 5.18 s: the long hold on "computed" with every glyph tracked, a 10 degree camera tilt and connectors fanning to three nodes

## Directions

Three directions from three families. The film is one HUD look, so they differ in what carries it.

### A

- family: type-led (the film is carried by type)
- sentence: big grotesk words are tracked by a vision overlay, so the viewer watches the machine see each word
- key frame: s14, "computed" at 22% of frame height, a hatched box on every glyph, 4 labels, connectors to 3 nodes, tilt 10 degrees
- palette: near-black #050505 ground, off-white #f2f2ee ink, one yellow #f6e84a on one glyph
- typeface: Archivo
- move: stamp (a box and its label land on a glyph)
- thread: the tracking box plus its coordinate label

### B

- family: object-led (a real thing or the product UI)
- sentence: a terminal types `x = f(t)` line by line while boxes lock on its glyphs
- key frame: s8, three code lines, boxes on x, f and t, a block caret
- palette: green phosphor #03140a with mint #b9ffd0 ink
- typeface: JetBrains Mono
- move: type
- thread: the caret

### C

- family: graphic-led (shape, colour field, rhythm)
- sentence: sixteen colour worlds cut at 0.2 to 1.2 s, the colour flipping every cut
- key frame: s3, 16.6 as halftone dots with a magenta fringe on deep blue
- palette: deep blue #0a1170, cream #f6f0e4, magenta #ff2d86
- typeface: Anybody (explored; the film keeps Archivo)
- move: flip (the world flips on the cut)
- thread: the cut rhythm

- picked: A, because the ask is a tracking overlay on large type; B lives inside it as the s8 hold and C is the cut rhythm over it.

## Signature

band=energy; ease=land; stagger=45; seam=motion; palette=mono plus accent; thread=the tracking box and its label

## Look

- ground: #050505 (mono), #03140a (green), #0a1170 (dither)
- ink: #f2f2ee (mono), #b9ffd0 (green), #f6f0e4 (dither)
- accent: yellow #f6e84a on one glyph (the m of "frame", s5)
- typeface: Archivo 800 for words, JetBrains Mono for labels and code
- words 22 to 62 percent of the frame height; labels chrome (cap 2.6 percent)

## Board

Phase 5, after the states and before any motion. Sixteen worlds, one per shot, `data-world` s1 to s16. The look is fast cutting: eleven of the sixteen are 0.25 to 0.30 s, two more are 0.35 and 0.45 s, three are long holds.

Beat grid. The cuts and flashes sit on a 73.8 BPM grid: beat 0.813 s, half 0.406 s, quarter 0.203 s, grid(k) = 2.77 + 0.2033 k s. Any bed you add should share this tempo and phase, or the cut table needs re-timing.

| grid s | grid k | cut and event |
|---|---|---|
| 1.96 | -4 | s8 in (1.95), typing starts |
| 2.77 | 0 | s9 in (2.767), flash and lock |
| 3.58 | 4 | s11 in (3.567), lock |
| 3.99 | 6 | s12 in (3.95), flash and lock |
| 4.40 | 8 | s13 in (4.40), lock |
| 4.80 | 10 | s14 in (4.767), lock |
| 5.21 | 12 | s14b in (5.183), flash and lock (the spectacle) |
| 5.62 | 14 | s15 in (5.583), lock |
| 6.02 | 16 | s15 second lock (6.02), no cut |
| 6.84 | 20 | s16 in (6.80), flash and lock |
| 7.24 | 22 | s16 second lock (7.19), no cut |

Rhythm: fast cuts on quarter beats (s2, s3, s6, s7: 0.20 s), half beats (s4, s5, s9 to s14b: 0.37 to 0.45 s), one whole beat (s8: 0.82 s), two long holds over 1.2 s (s15, s16). Every cut time is a multiple of 1/60 s nearest to the grid.

| beat | in s | cut out s (length) |
|---|---|---|
| s1 mono "001" | 0 | 0.333 (0.33) |
| s2 phosphor "seek" | 0.333 | 0.533 (0.20) |
| s3 paper "16.6" | 0.533 | 0.733 (0.20) |
| s4 mono "every" | 0.733 | 1.15 (0.42) |
| s5 phosphor "frame" | 1.15 | 1.55 (0.40) |
| s6 thermal "pixel" | 1.55 | 1.75 (0.20) |
| s7 navy "60" | 1.75 | 1.95 (0.20) |
| s8 mono code, typed | 1.95 | 2.767 (0.82) |
| s9 phosphor "no state" | 2.767 | 3.183 (0.42) |
| s10 paper "seed 7" | 3.183 | 3.567 (0.38) |
| s11 thermal "pure" | 3.567 | 3.95 (0.38) |
| s12 mono "tracked" | 3.95 | 4.40 (0.45) |
| s13 navy "0.016" | 4.40 | 4.767 (0.37) |
| s14 thermal "computed" | 4.767 | 5.183 (0.42) |
| s14b thermal "computed" (spectacle, held, nodes fan out) | 5.183 | 5.583 (0.40) |
| s15 phosphor "every frame," | 5.583 | 6.80 (1.22) |
| s16 mono "every frame, computed." | 6.80 | 8.00 (1.20) |

Flashes (`core/motion/exposure.js`, 3 frames, the cut inside the peak): at 2.767, 3.95, 5.183 and 6.80 s, each on a grid beat, never more than two in one second. Every shot start also carries a lock (2 red frames, a tear, an aberration peak, a tick); s15 and s16 carry a second lock on grid beats at 6.02 and 7.19 s.

Spectacle: the cut at 5.183 s into s14b (grid k = 12); the nodes fan out at 5.23 to 5.39 s (`<meta name="spectacle">`). Quiet before: s12 and s13 carry one word each, no connectors, no camera move, only the ground light drifting. Release after: from 5.58 s s15 and s16 hold one line each. Built from recipe 15 in prompts/moves/RECIPES.md: push with three depths (ghost word 0.3, tracked word 1, nodes and connectors 1.8), the word lands on `EASE.pop`, boxes stamp 0.2 s later, one in four on `EASE.nudge`.

Camera is the tilt in every state (perspective rx, ry, rz in the page table). Every world keeps a live ground (the light drifts) and a blur layer behind the word. Axis of each seam alternates: x, y, z, then reverse, so no two neighbours move the same way.

| cut | move (prompts/moves) | what carries the eye | what leaves first | overlap s | camera (push, drift, whip, none) | depth | overshoots (EASE.nudge, one EASE.pop) | handoff (family: object) |
|---|---|---|---|---|---|---|---|---|
| s1 to s2 (0.30) | flash-cut, x | the box on the "e" | labels | 0 | whip, x | 3 | none | deliberate cut: the flash lands on the beat |
| s2 to s3 (0.55) | cut-on-motion, y | the box slides to the next digit | ghost word | 0.05 | none | 2 | boxes on nudge | action match: the box slides to the next digit |
| s3 to s4 (0.80) | flap-resolve then cut, z | digits roll 1, 6, then land | halftone dots | 0.05 | push | 3 | none | object to object: the digits roll into the landed number |
| s4 to s5 (1.25) | flash-cut, x reverse | label stripe across "every" | boxes | 0 | whip, x reverse | 3 | none | deliberate cut: the flash on the beat |
| s5 to s6 (1.60) | slice-shift, y reverse | the yellow m | ghost word | 0.05 | none | 3 | m highlight on nudge | shared axis: the slice carries the yellow m |
| s6 to s7 (1.90) | push-blur, z reverse | the p box | type crop | 0.1 | pull | 2 | none | invisible cut: the push-blur peak |
| s7 to s8 (2.20) | cut-on-motion, x | the dither dots resolve into mono glyphs | dither fringe | 0.1 | none | 2 | none | action match: the dither dots resolve into glyphs |
| s8 to s9 (3.40) | caret-follow then flash-cut, y | the caret | code lines | 0 | drift | 2 | caret on nudge | sound bridge: the caret tick leads the flash |
| s9 to s10 (3.70) | flash-cut, x reverse | box on "state" | labels | 0 | whip, x | 3 | none | deliberate cut: the flash on the box |
| s10 to s11 (3.95) | slice-shift, y | the 7 | fringe | 0.05 | none | 2 | none | shared axis: the slice carries the 7 |
| s11 to s12 (4.25) | cut-on-motion, z | the hatch lines | ghost | 0 | push | 3 | none | position lock: the hatch lines hold their place |
| s12 to s13 (4.55) | flap-resolve, y reverse | the label counters | boxes | 0.05 | none | 2 | none | object to object: the label counters flap |
| s13 to s14 (4.85) | zoom-through, z (spectacle) | the c box grows into the full word | the halftone | 0.2 | push with depth-parallax | 4 | "computed" lands on EASE.pop; one in four boxes on nudge | camera through: the c box grows into the full word |
| s14 to s15 (6.20) | cut-on-motion, x | the longest connector | nodes and connectors | 0.1 | drift into whip | 3 | none | graphic match: the longest connector |
| s15 to s16 (6.50) | push-blur, y | the f box | green glow | 0.15 | slow push to the end | 3 | none | invisible cut: the push-blur to the end |

### Sound

Subtle. The page ships one `tick` per cut (the `data-synth="tick"` rows in `page.html`), quiet at -17 dB. Add your own music as an `<audio loop src=...>` row and check the cuts against its beat with `bin/vawe see`.

| at s | voice | gain dB | for |
|---|---|---|---|
| 0.02 to 7.21 | tick | -17 | one tick per cut and lock (the 19 `data-synth="tick"` rows) |

## Motion pass

Clean or waived: overshoot-share 23%, seam-variety clean, live-hold clean (every world drifts), group-landing waived in the page (the dither word draws three copies of each glyph), spectacle-weak waived in the page (the check reads svg rects; the word glyphs peak at 3 to 4 frame heights per second, `bin/vawe frame films/examples/tracking-hud/page.html --velocity --moment 4.85`). Left as advice: read hold (the words are 0.25 to 0.45 s shots), text collisions (tracked boxes and labels overlap on purpose), jumps at 0.47 to 0.53 s (the flash tail and the settle of the flash-cut), cuts vs spec and word position (the world sampler misses worlds under 0.4 s, so its cut times map to the wrong worlds).

Every cut read with `bin/vawe frame films/examples/tracking-hud/page.html --moment <cut> --span 0.6 --fps 15` (`--cuts` finds 9 of the 15 cuts). Spectacle: `bin/vawe frame films/examples/tracking-hud/page.html --onion --moment 4.85` and `bin/vawe frame films/examples/tracking-hud/page.html --velocity --moment 4.85 --sel '[data-world="s14"] .type:not(.ghost) .g'`: the glyphs start 4.78 to 4.85 s, peak 3.1 to 4.0 frame heights per second, settle 5.05 to 5.29 s, overshoot 0 to 6%.

| cut | what read flat | what I fixed (or why it stays) |
|---|---|---|
| s1 to s2 (0.30, flash) | the first draft had no flash (a later flash animation hid the first); then the fall lasted 0.5 s and washed the new word | flash opacity animation fill forwards, 0.3 s long with the peak held about 0.07 s; the new world starts at brightness 2.4 |
| s2 to s3 (0.55) | a black frame at the cut: each world was hidden for one frame between two visibility keyframes | worlds are visible from their start to the frame before their end (CSS hidden by default, keyframes fill forwards) |
| s3 to s4 (0.80) | the first glyph arrived 0.03 s after the cut, so the first frame was an empty ground | words start 0.06 s before their cut (HEAD_START), so the cut frame already shows the first letter |
| s4 to s5 (1.25, flash) | labels of the old world showed on black at the cut (a child visibility beat the hidden world) | label flicker and typed glyphs use opacity, not visibility |
| s5 to s6 (1.60) | long words ("seek", "pixel") were still arriving at the cut | gap 0.03 s and 0.16 s per glyph in worlds under 0.5 s |
| s6 to s7 (1.90) | the dither box stamped before its glyph | boxes start 0.08 s after the glyph's own arrival time |
| s7 to s8 (2.20) | typing began with a blurred caret only for 0.1 s | typing starts at 0.03 s |
| s8 to s9 (3.40) | none: code typed, boxes lock as the keys land, caret follows | stays |
| s9 to s10 (3.70, flash) | the flash turned the dither text to a pale lavender for 0.1 s | stays: that is the flash (about 205 of 255) |
| s10 to s11 (3.95) | slice y read as a small shake | stays: 7% travel with a 6 px blur in 0.22 s |
| s11 to s12 (4.25) | none after the head start | stays |
| s12 to s13 (4.55) | label numbers appeared static | labels flicker through six jittered values in 0.2 s, seeded per label |
| s13 to s14 (4.85, spectacle) | "computed" arrived at the same speed as the small words | glyphs rise 0.9 em with a 12 px blur, gap 0.03 s, camera 1.2, the word pops from 0.6 on EASE.pop, the world zooms from 1.7 |
| s14 to s15 (6.20) | the connectors were still drawing as the cut came | stays |
| s15 to s16 (6.50) | s15 and s16 type the same words | stays: the second one adds "computed." and a slow push to the end |

## Spec

### Shots

| id | start s | end s | the viewer notices | move in | move out | camera | ground |
|---|---|---|---|---|---|---|---|
| s1 | 0 | 0.37 | a frame counter with boxes locking on | cut | hard cut | whip none, push 1.07 | #060606 |
| s2 | 0.37 | 0.57 | two boxes on the e's, flash cut | flash-cut x | hard cut | whip x, push | #060606 |
| s3 | 0.57 | 0.77 | halftone dots, magenta fringe | slice y | hard cut | drift | #060606 |
| s4 | 0.77 | 1.17 | a tilted word, labels streak | cut z | hard cut | push 1.12 | #060606 |
| s5 | 1.17 | 1.57 | the yellow m | flash-cut x reverse | hard cut | whip x reverse, push | #060606 |
| s6 | 1.57 | 1.77 | a cropped word, three boxes | slice y reverse | hard cut | drift | #060606 |
| s7 | 1.77 | 1.97 | a huge number in dots | cut z reverse | hard cut | pull | #060606 |
| s8 | 1.97 | 2.77 | code typed, boxes lock as it types | whip x | hard cut | drift | #060606 |
| s9 | 2.77 | 3.2 | two lines, connector between boxes | slice y | hard cut | drift | #060606 |
| s10 | 3.2 | 3.57 | a seed in dots | flash-cut x reverse | hard cut | whip x reverse, push | #060606 |
| s11 | 3.57 | 3.97 | a word over its ghost | slice y reverse | hard cut | drift | #060606 |
| s12 | 3.97 | 4.4 | every glyph boxed | cut z | hard cut | push 1.1 | #060606 |
| s13 | 4.4 | 4.77 | a frame time in dots, zooms out | slice y | hard cut | drift, zoom out at 4.65 | #060606 |
| s14 | 4.77 | 5.2 | the spectacle: all glyphs boxed, connectors to 3 nodes | zoom-through | hard cut | push 1.12 with ghost parallax | #060606 |
| s15 | 5.6 | 6.8 | two lines, labels on e and f | whip x | hard cut | drift | #060606 |
| s16 | 6.8 | 8 | the message, then a slow push | slice y reverse | hard cut | push 1.06 to the end | #060606 |
