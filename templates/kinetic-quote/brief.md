# kinetic-quote: brief

Template: prompts/reference-rebuild.md. Shape: prompts/ANATOMY.md. Replace each [unanswered: default taken] with the answer, or keep the default. Replace each (guess: change me) with a measured value or your own choice.

## Inputs

- request: An 8 s kinetic type piece that sets one short quote word by word. Take structure and motion from reference 521432463128991396 (focus kinetic type); own words, own brand. 16:9. Replaceable text.
- length: 8 s
- aspect: 16:9
- Reference: `quality/refs/kinetic-promo/source.mp4` [unanswered: default taken]
- Privacy: private; references are in-house and never published [unanswered: default taken]
- Content: vawe's own strings and captures from `site/app/` [unanswered: default taken]
- Kit: `themes/vawe.css` [unanswered: default taken]
- Threshold: 0.70 combined, then the frame-locked critique [unanswered: default taken]

## Task

Reference: quality/refs/<ref>/source.mp4. One line: what it is, who sees our film, the message, the
spectacle second. Do not write page code yet.

- what: An 8 s kinetic type piece that sets one short quote word by word. Take structure and motion from reference 521432463128991396 (focus kinetic type); own words, own brand. 16:9. Replaceable text.
- for: people who see it once, muted, in a feed (guess: change me)
- message: Say the one thing (guess: change me)
- spectacle: 4.8 s (guess: change me)

## Taken from

Phase 2, before any design file. Study the references (`bin/vawe refs list`, then `bin/vawe refs frames <id>`, then Read each `~/.vawe/refs/frames/<id>/<shot>.png` at full size), then name 4 to 6 frames, not all. One row each: the exact path, and what you take (ground or light, type, colour, layout, motion). Fill it before DESIGN.md and page.html; `bin/vawe` says "Taken from not filled" until it holds a frame path.

| frame (exact path) | what you take |
|---|---|
| /Users/vandit/.vawe/refs/frames/521432463128991396/key-1-0.1s.png | one small word alone on a near-white ground; heavy dark ink; the film starts with almost nothing |
| /Users/vandit/.vawe/refs/frames/521432463128991396/key-3-2.2s.png | a word resolving from broken glyphs: each letter is its own state until it lands |
| /Users/vandit/.vawe/refs/frames/521432463128991396/key-4-6.1s.png | one heavy grotesque word, centred, no decoration |
| /Users/vandit/.vawe/refs/frames/521432463128991396/key-6-10.9s.png | the last word as huge tilted letters that bleed past the frame edges |
| /Users/vandit/.vawe/refs/frames/521432463128991396/key-5-7.2s.png | a hard flip to a black ground for one short beat |

Then study how the references MOVE, since stills do not show it: run `bin/vawe frame <ref-id> --cuts` on 2 reference films, Read the strips, and name 3 moves you take (the ref id, the cut second, the move from prompts/moves).

| move taken | ref id | cut s |
|---|---|---|
| text-scramble-decode: a word resolves letter by letter (pattern: one word per shot, each with its own entry) | 521432463128991396 | 2.17 |
| cut-on-motion: hard cut to a black ground on a fast move | 521432463128991396 | 6.80 |
| scale-punch: the last word grows to fill the frame in tilted letters | 521432463128991396 | 10.63 |

## Directions

Three directions from three families before any motion; the first idea is the one every agent has.
Each slot: one sentence; the key frame (what is on screen at the one big moment); the palette (hex);
the typeface; the one signature move (a verb: fold, pour, slice, stamp); the thread (the one thing that
carries through the film); the risk (how it fails); from (a real frame path or ref id it is drawn from). No two slots share a hue family, a typeface or a move, and at most one is
carried by a circle, orb, sun, ring or glow. Budget: 2 colours, 1 typeface, 1 signature move, 1 sound.
Story and structure: the spine is taste/craft/story.md (hook, build, proof, payoff, CTA); what carries across each cut is taste/craft/film-structure.md; reject the median first (guides/PITCH.md).

templates/kinetic-quote/directions.html holds one working still per family: rewrite each into its slot's key frame.
Show the three to the person as one board: bin/vawe frame templates/kinetic-quote/page.html --directions. The person picks one, and later types /vawe-approve.
bin/vawe dev scores the three with the stills judge by itself, once per change of directions.html or their brief lines.

### A

- family: type-led (the film is carried by type)
- sentence: seven words of one quote, each with its own way in (typed, decoded, slammed, tilted), then the last word fills the frame.
- key frame: MOVE. as five tilted black letters with a red period on a near-white ground at 5.3 s.
- palette: paper #f2eff3, ink #151317, accent #ff3d2e
- typeface: Archivo 500 to 900
- move: decode
- thread: the type, one word per beat, and a red caret or period that marks what is still being said
- risk: the five entries read as a list of effects, not one sentence.
- from: /Users/vandit/.vawe/refs/frames/521432463128991396/key-6-10.9s.png

### B

- family: object-led (a real thing or the product UI)
- sentence: the quote is written on a paper strip that a hand pulls through a slot, one word at a time.
- key frame: a strip half out of a slot with the word Mean on it.
- palette: kraft #b08a5a, slate #2c3a46, cream #f1e8d5
- typeface: IBM Plex Mono 500
- move: pull
- thread: the strip
- risk: a drawn strip and slot read as clip art.
- from: films/examples/colour-sting/page.html

### C

- family: graphic-led (shape, colour field, rhythm)
- sentence: each word sits on its own colour field and the fields wipe in a fixed rhythm.
- key frame: a violet field with one white word and a lime bar under it.
- palette: violet #4b2bd6, lime #c8f23a, white #ffffff
- typeface: Space Grotesk 700
- move: wipe
- thread: the fields
- risk: it is a slideshow of colour cards.
- from: /Users/vandit/.vawe/refs/frames/521432463128991396/key-5-7.2s.png

- picked: A, because the reference structure is type only and one accent keeps it easy to re-word.

## Signature

Six dials. Choose in the page: `<meta name="signature" content="band=...; ease=...; stagger=...; seam=...; palette=...; thread=...">`.
The presets (enter, leave, stagger, layer) use band, ease and stagger as their defaults, and `bin/vawe dev` reads all six.

- band (speed band family: energy, professional, gravity or cinematic): energy 0.15 to 0.3 s; professional 0.3 to 0.5 s; gravity 0.5 to 0.8 s; cinematic 0.8 to 2 s only when the film has the seconds (taste/rules/speed-bands.md)
  unused so far: energy, gravity, cinematic
- ease (the main EASE name): EASE.land, landSoft, settle, swap, glide, carry, leave, launch, pop, nudge, snap; sampled springs with 8 or more stops; vary eases like font weights (repeated like elements may take vary), and two layers moving in one beat differ in duration or offset (taste/rules/named-eases.md)
  unused so far: landSoft, settle, swap, glide, carry, leave, launch, pop, nudge, snap
- stagger (gap between siblings, in ms): 30 to 80 ms between siblings (engine default 50 ms); calm 80 to 120 ms (taste/rules/stagger.md)
- seam (transition family): moving seams: wipes, pushes, whips, zooms; rotate inside one family (soft, motion, shape, spatial) (taste/rules/seam-variety.md)
  unused so far: soft, motion, shape, spatial
- palette (colour family): a family (warm neutral, cool neutral, saturated, mono plus accent, duotone) with a ground, a surface, three text levels and one accent (taste/rules/palette-from-brand.md)
  unused so far: warm neutral, cool neutral, saturated, mono
- thread (the material carried through: object, type line, colour or rhythm): 1 to 2 threads, named in the brief: an object, a type line, a colour or a rhythm (taste/rules/thread.md)
  unused so far: object, type, colour, rhythm

## Look

1. bin/vawe see quality/refs/<ref>/source.mp4. Read index.md and every grid it wrote.
2. bin/vawe frame <ref> --cuts for the measured cut list. Never eyeball cuts off a sheet.
3. Measure, then write as numbers: ground, ink and accent as hex; the typeface and weight; cap height
   as a percent of frame height; the surface recipe (shadow and glass values).
4. Measure the approach rate of each settle: what share of the remaining distance closes per frame.
   Real UI motion sits at 12 to 19 percent. Write the number per move.
5. Pull five stills at the five moments that define the look. Name them.

- ground: paper #f2eff3 lit to #ffffff; dark #0b0a0c for one beat
- ink: #151317 on paper, #f2eff3 on dark
- accent: #ff3d2e on the caret, the rolling glyphs and the final period
- typeface: Archivo, weights 500, 800, 900
- cap height: 7% for typed lines, 21 to 30% for the words, up to 45% for the finale letters
- surface: none; radial light and 10% grain
- look: only for a film that uses the lens: bin/vawe frame <page> --looks --at <s> shows the page under each look (clean, dream-bloom, film-halation, anamorphic, pro-mist, tilt-shift, soft-focus, vintage, cyanotype, riso, crt); then set look: '<name>' in the lens options

## Design system and kit

Phase 3. Write templates/kinetic-quote/DESIGN.md: the palette as roles, the type, the ground and light devices, the text treatment. Write templates/kinetic-quote/kit/: the ground layers, and every moving part as its own element (words, marks, bars, cards, icons, the wordmark).
Free faces (copy the file from assets/fonts/ to templates/kinetic-quote/assets/, then @font-face with src: url("assets/<file>")): Anybody: Anybody.woff2; Archivo: Archivo.woff2; Big Shoulders: BigShoulders.woff2; Bricolage Grotesque: BricolageGrotesque.woff2; Caveat: Caveat.woff2; Fraunces: Fraunces.woff2; Geist: Geist.woff2; Geist Mono: GeistMono.woff2; Hanken Grotesk: HankenGrotesk.woff2; IBM Plex Mono: IBMPlexMono-400.woff2, IBMPlexMono-500.woff2; Instrument Serif: InstrumentSerif-Italic.woff2, InstrumentSerif-Regular.woff2; Inter: InterVariable.woff2; JetBrains Mono: JetBrainsMono.woff2; Manrope: Manrope.woff2; Plus Jakarta Sans: PlusJakartaSans.woff2; Space Grotesk: space-500.woff2, space-700.woff2; Unbounded: Unbounded.woff2.
Palette seed for kinetic-quote: seed-184 oklch(0.400 0.087 160.0), green (one read: "deep forest apothecary, moss, bottle glass, and herbal tincture under afternoon light"). It anchors the primary; keep its hue within 10 degrees, and compose bg, ink and one accent around it in OKLCH roles.
Type is chosen from taste/craft/typography.md and colour from taste/craft/color.md. Start from a PROVEN combo in prompts/skill-combos.md and record `Combo: <name>` in DESIGN.md. Skill ladder: apply one skill per rung, in this order, fetched with `command npx -y ui-skills get <slug>`. DESIGN.md records each rung as `Skill <rung>: <slug>: what it decided`, or `Skipped <rung>: <reason>`; `bin/vawe` advises on a missing rung.
1. builder: build the product UI and the kit parts as a real, beautiful interface (leonxlnx/soft-skill or emilkowalski/emil-design-eng). Real-looking data; never placeholder bars.
2. type: scale, weight, tracking (jakubkrehel/better-typography or pbakaus/typeset).
3. colour: roles and one accent (pbakaus/colorize or jakubkrehel/better-colors).
4. depth: shadows, light, blur layers (mengto/beautiful-shadows or mengto/progressive-blur).
5. frame: compose the video frame with vawe's own rules: one line and one hero (the product UI, a device or a photo of the real thing) with only the details the eye needs, a ground that is never flat, an eye path. The frame rejects web-page patterns (nav, CTA button, pill, eyebrow, section padding); rung 1 still builds the UI parts. The kit format and an example: skills/vawe-page/SKILL.md, films/examples/colour-sting/kit/.
Product UI inside the film (app screens, cards, panels) is a designed interface placed under the density budget. For an invented product the UI is invented but designed; only chrome with no function is a pitfall.

## States

Phase 4: one static key frame per world, built from the kit, before any motion. Budget: the reference frames show a median of 1 text line, 1 word and 2 objects. A state shows one line and one hero (the product UI, a device or a photo of the real thing) with only the details the eye needs; layout: taste/craft/layout.md. Its ground is never flat: one light, grain or depth device per film, named from a Taken from frame.

## Ideas

Phase 5, first part: after the states and before the Board. One row per beat (the world id) and per cut (`s1 to s2`), plus one for the film (`film`) and one for the hero motion moment. Method: guides/IDEATE.md. Write the plain meaning, then 4 ideas from 4 different devices (metaphor, transformation, show the invisible, scale shift, personification, literalise, part for whole, reversal, collision, literal), each as `device: the idea, typicality` with typicality 0 to 1 (how likely a model with no guidance writes it first). Take every idea from the subject's own world. Chosen is the idea number. Pick one that is not the most typical, and write "because ..." in why. Build the pick: the frames must show it.

| at | meaning | idea 1 (device: idea, typicality) | idea 2 | idea 3 | idea 4 | chosen (1 to 4) | why |
|---|---|---|---|---|---|---|---|
| film | a quote said one word at a time, ending on the one word that matters | literal: one line of text fades in, 0.9 | transformation: each word enters a different way, 0.4 | metaphor: a tape that types the quote, 0.5 | scale shift: the last word grows to fill the frame, 0.4 | 2 | because the reference gives each word its own entry and ends big, and the owner can swap the words |
| say | the first word starts the sentence quietly | literal: fade in, 0.9 | show the invisible: a caret waits, then the word is typed, 0.4 | scale shift: a tiny word, 0.5 | personification: the word looks up, 0.5 | 2 | because typing says someone is writing it now |
| less | the second word is the idea: say less | literal: slide in, 0.8 | transformation: noise resolves into the word, 0.3 | reversal: the word is erased to a dot, 0.4 | collision: two words merge, 0.5 | 2 | because decoding shows meaning forming out of noise |
| mean | the pivot to a dark ground | literal: fade to dark, 0.8 | collision: the word slams in, 0.4 | scale shift: it grows from a dot, 0.5 | part for whole: only the m, 0.5 | 2 | because a slam on a dark flip is the hard turn in the reference |
| make | the sentence turns to action | literal: stack of words, 0.8 | transformation: two words tilt in from two sides, 0.4 | metaphor: a hand places each word, 0.6 | reversal: the words leave, 0.5 | 2 | because the tilt prepares the big tilted finale |
| move | the payoff word fills the frame | literal: a big word fades in, 0.8 | scale shift: five letters land huge and tilted, 0.3 | transformation: the word moves apart, 0.5 | collision: letters crash together, 0.5 | 2 | because the word names the film and the letters move |
| credit | the end: who said it | literal: small credit fades in, 0.9 | show the invisible: the credit is typed, 0.4 | personification: the caret signs it, 0.5 | reversal: the credit leads, 0.4 | 2 | because it echoes the first beat and closes the frame |
| say to less, less to mean, mean to make, make to move, move to credit | hard cuts on motion | deliberate cut, 0.5 | wipe, 0.7 | whip, 0.6 | dissolve, 0.9 | 1 | because the reference cuts hard and fast |

## Board

Phase 5, after the states and before any motion. The board is a plan for time: rhythm, spectacle, transitions, sound. It is not a list of frames. Name each move from prompts/moves (`prompts/moves/README.md`), never "fade" by default. Replace every bracket.

Rhythm: cut lengths and holds are NOT all equal. One cut breathes longer than the rest, and holds vary.

| beat | in s | hold s | cut out s (length) |
|---|---|---|---|
| say | 0 | 1.3 | 1.3 |
| less | 1.3 | 1.3 | 2.6 |
| mean | 2.6 | 1.3 | 3.9 |
| make | 3.9 | 1.1 | 5.0 |
| move | 5.0 | 1.6 | 6.6 |
| credit | 6.6 | 1.4 | 8 |

Spectacle: the one big moment at 4.6 s (also `<meta name="spectacle">`). Quiet before it: two words, tilted in, on light. Release after: the letters drift, then a plain credit is typed. Build it from recipe 15 in prompts/moves/RECIPES.md.

| cut | move (prompts/moves) | what carries the eye | what leaves first | overlap s | camera (push, drift, whip, none) | depth | overshoots (EASE.nudge, one EASE.pop) | handoff (family: object) |
|---|---|---|---|---|---|---|---|---|
| say to less 0.8 | text-scramble-decode | the word centre | the typed word | 0 | none | 1 | none | deliberate cut: the reference cuts on the word |
| less to mean 2.1 | cut-on-motion | the baseline | the light ground | 0 | none | 1 | none | deliberate cut: a flip to dark |
| mean to make 3.4 | cut-on-motion | the left edge | the dark ground | 0 | none | 1 | none | deliberate cut: a flip back to light |
| make to move 4.4 | scale-punch | the lower word | the tilted words | 0 | none | 1 | the period pop | deliberate cut: the spectacle |
| move to credit 6.0 | exit-fast | the red period to the caret | the letters | 0 | none | 1 | none | deliberate cut: the red mark carries to the caret |

Pick each cut by the feeling it must give (taste/craft/selection.md). Plan its handoff with the skill `vawe-transitions` (skills/vawe-transitions/SKILL.md): the family is one of the twelve in taste/craft/transitions.md, the object is the one thing that carries over, and "deliberate cut: <reason>" is a family. Fill the ledger from the handoff column.

| family | cuts |
|---|---|
| deliberate cut | all five cuts |

Sound is part of every film, subtle: small effects on actions, only on the cuts and actions that earn one, plus one for the spectacle. A real recorded effect first (the film's assets, or the sites in resources/README.md); with none that fits, no cue; a synth voice from `bin/vawe sound` only when you choose one. No synth bed, pad or chord. A music track only from a file the user gives. Why and how: taste/craft/sound.md.

Gain: leave the column empty to take the voice's default (`bin/vawe sound` lists it). Write a number only to move one cue on purpose: `data-gain` is absolute dB and replaces the default.

| at s | voice | gain dB | for |
|---|---|---|---|
| 0.1 | tick | | the first typed letter |
| 0.8 | tap | | the decode starts |
| 2.1 | tap | | the dark slam |
| 3.4 | tap | | the tilt |
| 4.4 | sub-thump | | the spectacle |
| 6.1 | tick | | the credit is typed |

## Motion pass

Phase 7, after the first draft. Done when `bin/vawe dev` shows overshoot-share, live-hold, constant-camera and seam-variety clean or waived with a reason, and you have Read `bin/vawe frame films/<name>/page.html --cuts` for every cut. For the spectacle second also run `bin/vawe frame <page> --moment <s> --onion` and `--velocity`. Check each cut against taste/craft/motion-craft.md and the principles in core/motion/README.md; one row per cut, ok, fix or n/a per principle. `bin/vawe ship` warns while this table holds a placeholder.

| cut | anticipation (hero) | follow-through, overlap | spacing eased | arcs | secondary action | exits faster | hold alive | camera still | what read flat | what I fixed (or why it stays) |
|---|---|---|---|---|---|---|---|---|---|---|
| say to less 0.8 | n/a | ok | ok | n/a | ok: caret blinks | ok | ok | ok | nothing | stays |
| less to mean 2.1 | ok | ok | ok | ok | ok | ok | ok | ok | nothing | stays |
| mean to make 3.4 | ok | ok | ok | ok: tilt arcs | ok | ok | ok | ok | nothing | stays |
| make to move 4.4 | ok | ok: letters land 70 ms apart | ok | ok | ok: slow drift | ok | ok | ok | the critique found letters over one another in flight and a pale ghost entry | fixed: letters start fully opaque at 1.3 times size, 80 ms apart; a little overlap remains for 0.2 s while they land, and they settle apart |
| move to credit 6.0 | n/a | ok | ok | n/a | ok | ok | ok: caret blinks | ok | nothing | stays |

## Keep and swap

Read the Spec. For every line, write KEEP or SWAP and one reason.
KEEP: anything the reference does that we want exactly (light, pacing, curves, type scale).
SWAP: the content (our strings, our captures, our brand from its kit), anything the reference does
that breaks a house rule (an em dash on screen, a hook over 12 words, an exit slower than its entrance,
two adjacent transitions in one direction), anything measured off the grid, and any effect the reference shows before its cause
in our story: a burst before the press, a pop before the window opens, a sound before its action. Our cause-effect order wins
over the reference's sound timing (`taste/rules/cause-first.md`); style is taken from a reference, never its text, logos or photos.
Nothing is silent: an unmarked line is a bug.

| item | keep or swap | what replaces it |
|---|---|---|
| light map | KEEP: near-white ground, black type, one dark flip | paper and ink of our own |
| strings | SWAP | our own quote and credit |
| captures | SWAP | none used |
| folders, photos, emoji, key caps | SWAP | none: type only |
| typeface | SWAP | Archivo |

Mark every line of the reference's SPEC.md KEEP or SWAP. An unmarked line is a bug.

## Spec

Fill the Shots, Words and Objects tables of brief.md, at every cut and every hold. Shots: start and end
in seconds, what the viewer notices, the move in and out (name it from core/motion/easings.js EASINGS;
fit, do not guess), the camera. Words: every on-screen string quoted exactly, with appear and settle
seconds, cap height and position as a percent of the frame from its top left, weight, colour. Objects:
every moving element with its in, settle and out seconds. Exits should run shorter than entrances; write
down when the reference disagrees.

### Shots

| id | start s | end s | the viewer notices | move in | move out | camera | ground |
|---|---|---|---|---|---|---|---|
| say | 0 | 1.33 | the word Say is typed | letters step in | hard cut | static | #f2eff3 |
| less | 1.33 | 2.63 | less. decodes from noise | glyphs roll, then land | hard cut | static | #f2eff3 |
| mean | 2.63 | 3.73 | Mean it. slams in on dark | scale 1.6 to 1 | hard cut | static | #f2eff3 |
| make | 3.73 | 4.63 | Make it tilts in | rotate and slide | hard cut | static | #f2eff3 |
| move | 4.63 | 6.43 | MOVE. fills the frame | five letters land, 70 ms apart | hard cut | static | #f2eff3 |
| credit | 6.43 | 8 | the credit is typed | letters step in | none | static | #f2eff3 |

### Words

| text | shot | appear s | settle s | cap % | x % | y % | weight | colour |
|---|---|---|---|---|---|---|---|---|
| Say | say | 0.33 | 0.33 | 7 | 50 | 50 | 800 | #151317 |
| less. | less | 1.8 | 1.93 | 29 | 50 | 50 | 800 | #151317 |
| Mean | mean | 2.63 | 2.63 | 21 | 35 | 52 | 800 | #f2eff3 |
| it. | mean | 3.03 | 3.4* | 21 | 65 | 52 | 800 | #f2eff3 |
| Make | make | 3.73 | 4.3* | 21 | 20 | 30 | 800 | #151317 |
| it | make | 4.07 | 4.2 | 21 | 62 | 62 | 800 | #151317 |
| move. | move | 4.93 | 5.0 | 40 | 50 | 50 | 900 | #151317 |
| Northwind Type Studio | credit | 7.13 | 7.13 | 7 | 50 | 50 | 500 | #151317 |

### Objects

| id | selector | shot | in s | settle s | out s |
|---|---|---|---|---|---|
| caret | .caret | say | 0.1 | 0.4 | 0.8 |
| glyphs | #less span | less | 0.8 | 1.8 | 2.1 |
| letters | .L | move | 4.43 | 5.0 | 6.0 |

## Acceptance

| metric | target |
|---|---|
| frozen runs of 3+ frames inside a shot | 0 |
| jerky steps | under 5 |
| jumps not at a declared cut | 0 |
| still windows over 0.5 s outside a declared hold | 0 |
| near-identical tail tiles | 4 or fewer |
| text cap height | 6% or more |
| text contrast | 4.5:1 or more |
| text collisions | 0 |
| read hold per line | 0.6 s a word from 4 words, else max(1.2 s, words/3 s) |
| exits shorter than entrances | all |
| word cap height and position vs spec | within 1% of frame |
| cuts vs spec | within 1 frame |
| loudness | -24 to -16 LUFS |
| peak | -10 dBFS or lower |
| judge: each storyboard frame as beautiful as the anchor, full size | YES |

## Gates

Do the gates in order. A failed gate sends you back to the one before it.

1. Stills: three directions in directions.html, then the five frames that define the look.
   `bin/vawe dev` scores the directions with the stills judge by itself; show the board with `bin/vawe frame templates/kinetic-quote/page.html --directions`.
   Each frame must be as beautiful as the anchor at full size.
2. Component labs: the 4 to 6 hardest pieces (a light, a material, a type move, a real UI), each alone
   on its own page templates/kinetic-quote/labs/<piece>.html at 3 sizes (`bin/vawe dev <lab> --aspect 16:9`, then
   `1:1`, then `9:16`). Fix a piece in its lab before it goes in the film.
3. Draft loop: `bin/vawe dev templates/kinetic-quote/page.html`, fix, repeat until every Acceptance row is green.
   Then Read `bin/vawe frame templates/kinetic-quote/page.html --cuts` for every cut and fix what reads flat.
   Then `bin/vawe critique templates/kinetic-quote/page.html` in a session that did not write the page.
4. Final: `bin/vawe ship templates/kinetic-quote/page.html`, then `bin/vawe wait templates/kinetic-quote/page.html`.

## Pitfalls

Taste pitfalls: taste/build/DIGEST.md (`bin/vawe dev` prints them).

## Deliver

- out/kinetic-quote.mp4 from `bin/vawe ship`.
- This brief, with Spec edited to what you built and the Acceptance table filled with the number you
  measured next to each target.
- The judge report path for the final.

## Build

Build templates/kinetic-quote/page.html from the Spec and the KEEP/SWAP table. Match the light map first, then
the camera and depth of field, then the type, then the detail (house order for recreations).
Every KEEP line is a number in the page: a @keyframes stop, an element.animate keyframe or a
[[f, v]] table in seek(t). Use approach(f, from, to, k) from core/motion/springs.js with the k you
measured. Then:
  bin/vawe critique templates/kinetic-quote/page.html --ref quality/refs/<ref>/source.mp4
It compares the draft to the reference at the same timestamps and prints a match score. Loop until
combined >= 0.70 and every Acceptance row is green. Then run bin/vawe check coverage out/kinetic-quote.mp4 --ref
<ref.mp4> and fix the seconds it lists below its floor. Then run the critique pass
(the `vawe-critique` skill, frame-locked) as a fresh agent.
Three passes without progress: report what blocks you and go on with the next row.

## First draft

Taste: taste/build/DIGEST.md (the full card is for the judge). Moves to copy: prompts/moves/README.md. Sound: the Board's sound rows, subtle (rule sound-swell).

bin/vawe dev templates/kinetic-quote/page.html
