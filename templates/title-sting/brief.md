# title-sting: brief

Template: prompts/beat-sheet.md. Shape: prompts/ANATOMY.md. Replace each [unanswered: default taken] with the answer, or keep the default. Replace each (guess: change me) with a measured value or your own choice.

## Inputs

- request: A 5 s title sting for any product name. Fictional brand Northwind with a one-line tagline. 16:9. Own direction, replaceable text.
- aspect: 16:9
- Length: 16:9, 5 s (the 16 s in an earlier line is stale)
- Grid: free; cuts follow the picture [unanswered: default taken]
- Exposure: ones [unanswered: default taken]
- Cues: a recorded effect where one fits (`resources/README.md`), otherwise no cue; a synth voice from `core/audio/kit.mjs` only when you choose one [unanswered: default taken]

## Task

One line: what the film is, who sees it, the message, and the spectacle second (the one big moment,
with 1.5 s of quiet before it).

- what: A 5 s title sting for any product name. Fictional brand Northwind with a one-line tagline. 16:9. Own direction, replaceable text.
- for: people who see it once, muted, in a feed (guess: change me)
- message: named in what
- spectacle: 1.7 s

## Taken from

Phase 2, before any design file. Study the references (`bin/vawe refs list`, then `bin/vawe refs frames <id>`, then Read each `~/.vawe/refs/frames/<id>/<shot>.png` at full size), then name 4 to 6 frames, not all. One row each: the exact path, and what you take (ground or light, type, colour, layout, motion). Fill it before DESIGN.md and page.html; `bin/vawe` says "Taken from not filled" until it holds a frame path.

| frame (exact path) | what you take |
|---|---|
| /Users/vandit/.vawe/refs/frames/521432463128991396/key-4-6.1s.png | one word, heavy grotesque, centred on a near-flat ground: one line, no decoration (type only) |
| /Users/vandit/.vawe/refs/frames/521432463128991396/key-3-2.2s.png | a word built from displaced slices: the break is the motion, then it resolves (slice idea) |
| /Users/vandit/.vawe/refs/frames/mnowak/key-3-3.1s.png | one heavy word wide across the frame on a dark ground with a bright streak through it: a horizontal line crossing the word is a light device (we use wind streaks) |
| /Users/vandit/Developer/code/shortwave/.claude/worktrees/agent-a44bf33a40b0e8f3d/films/examples/colour-sting/page.html | the shape of a sting: quiet mark, one big turn, ink flips with the ground |

Then study how the references MOVE, since stills do not show it: run `bin/vawe frame <ref-id> --cuts` on 2 reference films, Read the strips, and name 3 moves you take (the ref id, the cut second, the move from prompts/moves).

| move taken | ref id | cut s |
|---|---|---|
| slice-shift: the word breaks into bands that land one after another | 521432463128991396 | 2.17 |
| cut-on-motion: the ground flips under a fast move | 521432463128991396 | 6.80 |
| hard turn: ink and ground swap on one cut, pattern "one object, many grounds" (film-structure.md) | 521432463128991396 | 11.20 |

## Directions

Three directions from three families before any motion; the first idea is the one every agent has.
Each slot: one sentence; the key frame (what is on screen at the one big moment); the palette (hex);
the typeface; the one signature move (a verb: fold, pour, slice, stamp); the thread (the one thing that
carries through the film); the risk (how it fails); from (a real frame path or ref id it is drawn from). No two slots share a hue family, a typeface or a move, and at most one is
carried by a circle, orb, sun, ring or glow. Budget: 2 colours, 1 typeface, 1 signature move, 1 sound.
Story and structure: the spine is taste/craft/story.md (hook, build, proof, payoff, CTA); what carries across each cut is taste/craft/film-structure.md; reject the median first (guides/PITCH.md).

templates/title-sting/directions.html holds one working still per family: rewrite each into its slot's key frame.
Show the three to the person as one board: bin/vawe frame templates/title-sting/page.html --directions. The person picks one, and later types /vawe-approve.
bin/vawe dev scores the three with the stills judge by itself, once per change of directions.html or their brief lines.

### A

- family: type-led (the film is carried by type)
- sentence: the name is sliced into five bands and the wind blows them in, one after another, until the word is whole.
- key frame: the five bands mid-slide at 1.8 s, the needle on the left, the word half assembled.
- palette: night #0c1e33, paper #f4efe4, needle #ff6b35
- typeface: Bricolage Grotesque 800
- move: slice
- thread: the wind streaks (they open the film, slice the name, wipe the ground, and drift once more)
- risk: the bands overlap into an unreadable smear if the stagger is too small.
- from: /Users/vandit/.vawe/refs/frames/521432463128991396/key-3-2.2s.png

### B

- family: object-led (a real thing or the product UI)
- sentence: a brass compass needle swings to north, and the name opens from behind it.
- key frame: the needle at rest over the first letter with a long soft shadow.
- palette: spruce #0f3b3a, sand #e8dcc0, brass #c89b4a
- typeface: Instrument Serif
- move: swing
- thread: the needle
- risk: a drawn needle reads as clip art without real light and material.
- from: films/examples/colour-sting/page.html

### C

- family: graphic-led (shape, colour field, rhythm)
- sentence: four colour fields slide in from the four sides and meet in a cross, and the name sits on the cross.
- key frame: the four fields nearly meeting with a thin gap of light.
- palette: ink #101010, signal #e5322d, snow #f6f6f2
- typeface: Archivo 800
- move: fold
- thread: the cross
- risk: the cross reads as a flag or a warning sign.
- from: /Users/vandit/.vawe/refs/frames/521432463128991396/key-4-6.1s.png

- picked: A, because the slices and the streaks are one idea (wind), the name stays the hero, and one accent keeps it easy to re-colour.

## Signature

Six dials. Choose in the page: `<meta name="signature" content="band=...; ease=...; stagger=...; seam=...; palette=...; thread=...">`.
The presets (enter, leave, stagger, layer) use band, ease and stagger as their defaults, and `bin/vawe dev` reads all six.

- band (speed band family: energy, professional, gravity or cinematic): energy 0.15 to 0.3 s; professional 0.3 to 0.5 s; gravity 0.5 to 0.8 s; cinematic 0.8 to 2 s only when the film has the seconds (taste/rules/speed-bands.md)
- ease (the main EASE name): EASE.land, landSoft, settle, swap, glide, carry, leave, launch, pop, nudge, snap; sampled springs with 8 or more stops; vary eases like font weights (repeated like elements may take vary), and two layers moving in one beat differ in duration or offset (taste/rules/named-eases.md)
- stagger (gap between siblings, in ms): 30 to 80 ms between siblings (engine default 50 ms); calm 80 to 120 ms (taste/rules/stagger.md)
- seam (transition family): moving seams: wipes, pushes, whips, zooms; rotate inside one family (soft, motion, shape, spatial) (taste/rules/seam-variety.md)
- palette (colour family): a family (warm neutral, cool neutral, saturated, mono plus accent, duotone) with a ground, a surface, three text levels and one accent (taste/rules/palette-from-brand.md)
- thread (the material carried through: object, type line, colour or rhythm): 1 to 2 threads, named in the brief: an object, a type line, a colour or a rhythm (taste/rules/thread.md)

## Look

- ground: night #0c1e33 lit to #1a3f66, then paper #f4efe4 after the wipe
- ink: paper on night, night on paper
- accent: needle #ff6b35, on the needle only
- typeface: Bricolage Grotesque, weight 800 for the name, 500 for the line
- cap height: about 16% of frame height for the name, 6% for the line
- surface: none; the ground has a radial light and 10% grain
- look: only for a film that uses the lens: bin/vawe frame <page> --looks --at <s> shows the page under each look (clean, dream-bloom, film-halation, anamorphic, pro-mist, tilt-shift, soft-focus, vintage, cyanotype, riso, crt); then set look: '<name>' in the lens options

## Design system and kit

Phase 3. Write templates/title-sting/DESIGN.md: the palette as roles, the type, the ground and light devices, the text treatment. Write templates/title-sting/kit/: the ground layers, and every moving part as its own element (words, marks, bars, cards, icons, the wordmark).
Free faces (copy the file from assets/fonts/ to templates/title-sting/assets/, then @font-face with src: url("assets/<file>")): Anybody: Anybody.woff2; Archivo: Archivo.woff2; Big Shoulders: BigShoulders.woff2; Bricolage Grotesque: BricolageGrotesque.woff2; Caveat: Caveat.woff2; Fraunces: Fraunces.woff2; Geist: Geist.woff2; Geist Mono: GeistMono.woff2; Hanken Grotesk: HankenGrotesk.woff2; IBM Plex Mono: IBMPlexMono-400.woff2, IBMPlexMono-500.woff2; Instrument Serif: InstrumentSerif-Italic.woff2, InstrumentSerif-Regular.woff2; Inter: InterVariable.woff2; JetBrains Mono: JetBrainsMono.woff2; Manrope: Manrope.woff2; Plus Jakarta Sans: PlusJakartaSans.woff2; Space Grotesk: space-500.woff2, space-700.woff2; Unbounded: Unbounded.woff2.
Palette seed for title-sting: seed-132 oklch(0.700 0.120 270.0), violet / purple (one read: "Linear-style considered tool indigo, the quiet violet of a focused product workspace, late-afternoon thinking"). It anchors the primary; keep its hue within 10 degrees, and compose bg, ink and one accent around it in OKLCH roles.
Type is chosen from taste/craft/typography.md and colour from taste/craft/color.md. Start from a PROVEN combo in prompts/skill-combos.md and record `Combo: <name>` in DESIGN.md. Skill ladder: apply one skill per rung, in this order, fetched with `command npx -y ui-skills get <slug>`. DESIGN.md records each rung as `Skill <rung>: <slug>: what it decided`, or `Skipped <rung>: <reason>`; `bin/vawe` advises on a missing rung.
1. builder: build the product UI and the kit parts as a real, beautiful interface (leonxlnx/soft-skill or emilkowalski/emil-design-eng). Real-looking data; never placeholder bars.
2. type: scale, weight, tracking (jakubkrehel/better-typography or pbakaus/typeset).
3. colour: roles and one accent (pbakaus/colorize or jakubkrehel/better-colors).
4. depth: shadows, light, blur layers (mengto/beautiful-shadows or mengto/progressive-blur).
5. frame: compose the video frame with vawe's own rules: about 1 line and 2 or 3 things, a ground that is never flat, an eye path. The frame rejects web-page patterns (nav, CTA button, pill, eyebrow, section padding); rung 1 still builds the UI parts. The kit format and an example: skills/vawe-page/SKILL.md, films/examples/colour-sting/kit/.
Product UI inside the film (app screens, cards, panels) is a designed interface placed under the density budget. For an invented product the UI is invented but designed; only chrome with no function is a pitfall.

## States

Phase 4: one static key frame per world, built from the kit, before any motion. Budget: the reference frames show a median of 1 text line, 1 word and 2 objects. A state shows about 1 line and 2 or 3 things; layout: taste/craft/layout.md. Its ground is never flat: one light, grain or depth device per film, named from a Taken from frame, and the ground changes at each world turn.

## Ideas

Phase 5, first part: after the states and before the Board. One row per beat (the world id) and per cut (`s1 to s2`), plus one for the film (`film`) and one for the hero motion moment. Method: guides/IDEATE.md. Write the plain meaning, then 4 ideas from 4 different devices (metaphor, transformation, show the invisible, scale shift, personification, literalise, part for whole, reversal, collision, literal), each as `device: the idea, typicality` with typicality 0 to 1 (how likely a model with no guidance writes it first). Take every idea from the subject's own world. Chosen is the idea number. Pick one that is not the most typical, and write "because ..." in why. Build the pick: the frames must show it.

| at | meaning | idea 1 (device: idea, typicality) | idea 2 | idea 3 | idea 4 | chosen (1 to 4) | why |
|---|---|---|---|---|---|---|---|
| film | the name arrives like weather | metaphor: wind slices the name in, 0.3 | literal: the name fades up, 0.9 | scale shift: the name zooms out of the needle, 0.6 | reversal: the name is wiped away and replaced by paper, 0.4 | 1 | because the brand name is a wind and a direction, and the streaks carry it through all three beats |
| hook to name, 1.3 | the needle finds north, then the name follows | personification: the needle looks, 0.4 | transformation: the streaks become the name, 0.5 | literal: a cut, 0.8 | collision: a streak hits the needle, 0.5 | 1 | because the streaks leave and the row slides the name out of the needle in the same breath |
| hook | one needle and the wind before any word | personification: the needle looks around, 0.4 | show the invisible: the streaks draw the wind, 0.5 | literal: a logo fade, 0.9 | scale shift: a huge needle, 0.5 | 2 | because the wind is the brand and it cannot be seen without a streak |
| name | the name arrives | literal: type on, 0.8 | metaphor: sliced and blown in, 0.3 | transformation: letters fly in, 0.7 | collision: the needle pushes the name, 0.5 | 2 | because the bands read as air moving the word |
| line | the promise | literal: a fade, 0.9 | transformation: words rise one after another, 0.6 | part for whole: one word only, 0.4 | reversal: the line first, then the name, 0.3 | 2 | because three words need 1.2 s and a rise keeps the eye on the line |
| tag | the end on paper | literal: hold, 0.9 | reversal: paper after night, 0.3 | personification: the needle turns to the viewer, 0.4 | scale shift: pull back, 0.6 | 2 | because the ground flip says the sting is done |
| name to tag, 3.55 | the sting ends on the tagline | literal: dissolve, 0.9 | reversal: one wide streak wipes night to paper, 0.3 | scale shift: zoom into the o, 0.6 | transformation: the word turns, 0.5 | 2 | because the wipe is the same streak thread, and it flips ink and ground in one move |

## Board

Phase 5, after the states and before any motion. The board is a plan for time: rhythm, spectacle, transitions, sound. It is not a list of frames. Name each move from prompts/moves (`prompts/moves/README.md`), never "fade" by default. Replace every bracket.

Rhythm: cut lengths and holds are NOT all equal. At least one cut under 0.4 s, one over 0.9 s, and holds that vary.

| beat | in s | hold s | cut out s (length) |
|---|---|---|---|
| hook | 0 | 1.3 | 1.3 (0.3 s overlap) |
| name | 1.3 | 1.1 | 2.4 |
| line | 2.4 | 0.8 | 3.2 (0.45 s wipe) |
| tag | 3.2 | 1.8 | 5.0 |

Spectacle: the one big moment at 1.7 s (also `<meta name="spectacle">`). Quiet before it: streaks and one needle, 1.3 s. Release after: the row settles, the tagline rises, the needle keeps swinging. Build it from recipe 15 in prompts/moves/RECIPES.md.

| cut | move (prompts/moves) | what carries the eye | what leaves first | overlap s | camera (push, drift, whip, none) | depth | overshoots (EASE.nudge, one EASE.pop) | handoff (family: object) |
|---|---|---|---|---|---|---|---|---|
| hook to name | slice-shift | the needle | the streaks | 0.3 | none | 2 | the needle pop | action match: the wind that blew the streaks slices the name |
| name to tag | cut-on-motion | the wipe edge | the night ground | 0.45 | none | 2 | none | graphic match: the same lockup in the next ink, changed at an orange edge |

Pick each cut by the feeling it must give (taste/craft/selection.md). Plan its handoff with the skill `vawe-transitions` (skills/vawe-transitions/SKILL.md): the family is one of the twelve in taste/craft/transitions.md, the object is the one thing that carries over, and "deliberate cut: <reason>" is a family. Fill the ledger from the handoff column.

| family | cuts |
|---|---|
| action match | hook to name (the streaks and the bands both travel right to left) |
| graphic match | line to tag (one lockup, the paper copy opens behind the edge) |

Sound is part of every film, subtle: small effects on actions, only on the cuts and actions that earn one, plus one for the spectacle. A real recorded effect first (the film's assets, or the sites in resources/README.md); with none that fits, no cue; a synth voice from `bin/vawe sound` only when you choose one. No synth bed, pad or chord. A music track only from a file the user gives. Why and how: taste/craft/sound.md.

Gain: leave the column empty to take the voice's default (`bin/vawe sound` lists it). Write a number only to move one cue on purpose: `data-gain` is absolute dB and replaces the default.

| at s | voice | gain dB | for |
|---|---|---|---|
| 0.85 | tap | | the needle lands |
| 1.3 | swoosh-long | | the spectacle: the slices |
| 3.35 | sub-thump | | the wipe |

## Motion pass

Phase 7, after the first draft. Done when `bin/vawe dev` shows overshoot-share, live-hold, constant-camera and seam-variety clean or waived with a reason, and you have Read `bin/vawe frame films/<name>/page.html --cuts` for every cut. For the spectacle second also run `bin/vawe frame <page> --moment <s> --onion` and `--velocity`. Check each cut against taste/craft/motion-craft.md and the principles in core/motion/README.md; one row per cut, ok, fix or n/a per principle. `bin/vawe ship` warns while this table holds a placeholder.

| cut | anticipation (hero) | follow-through, overlap | spacing eased | arcs | secondary action | exits faster | hold alive | camera still | what read flat | what I fixed (or why it stays) |
|---|---|---|---|---|---|---|---|---|---|---|
| hook to name 1.33 | ok: needle pops on EASE.pop from 0 s | ok: seven bands land 40 ms apart, scale settles after each | ok: EASE.land and glide | ok: row slides on one line | ok: streaks, a streak through the word at 1.3 s, needle sway | ok: streaks leave in 0.7 to 1 s, bands enter in 0.45 s | ok: needle swings 6 degrees | ok | the critique found a doubled word at 1.6 s from five bands that started 0.2 frame widths away; fixed | bands now alternate left and right by 0.1 frame width, 450 ms, start after the row slide, and a streak crosses the word |
| name to line 2.43 | n/a | ok: the line words rise 90 ms apart | ok | ok | ok: ground light moves from lower left to lower right | ok | ok | ok | nothing | stays |
| line to tag 3.2 | ok | ok | ok: EASE.land | n/a | ok: the edge carries the ink change | ok: the wipe is 0.45 s | ok: the needle swings 12 degrees and streaks drift | ok | the first version flipped the ground under half the frame; the paper world is now clipped to the edge and carries its own copy of the lockup | fixed |

## Spec

Before any code, fill the three Spec tables in templates/title-sting/brief.md: Shots, Words, Objects. One
Shots row per shot. Every row has one focal action and an end state I can picture. The slowest row is
at least 3x the fastest. Exits are shorter than entrances. Something happens in every row. Give every
Words and Objects row its times in seconds. Then build from the tables; never wait for a reply.

### Shots

| id | start s | end s | the viewer notices | move in | move out | camera | ground |
|---|---|---|---|---|---|---|---|
| hook | 0 | 1.33 | a needle pops and wind streaks blow past | needle pop, streaks glide | streaks leave right to left | static | #0c1e33 |
| name | 1.33 | 2.43 | the wind slices Northwind in | five bands slide in, 70 ms apart | wipe 0.35 s | static | #0c1e33 |
| line | 2.43 | 3.23 | the line rises under the name | three words, 90 ms apart | wipe 0.35 s | static | #0c1e33 |
| tag | 3.23 | 5 | the name on paper, the line below | wipe reveals | none | static | #0c1e33 |

### Words

| text | shot | appear s | settle s | cap % | x % | y % | weight | colour |
|---|---|---|---|---|---|---|---|---|
| Northwind | name | 1.35 | 2.4 | 16 | 50 | 46 | 800 | #f4efe4 then #0c1e33 |
| Find your way | name | 2.73 | 3.07 | 6 | 50 | 64 | 500 | #f4efe4 then #0c1e33 |

### Objects

| id | selector | shot | in s | settle s | out s |
|---|---|---|---|---|---|
| needle | .mark | hook | 0.1 | 0.8 | 5 |
| streaks | .streak | hook | 0 | 1.3 | 1.3 |
| edge | .edge | tag | 3.2 | 3.65 | 3.65 |

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
   `bin/vawe dev` scores the directions with the stills judge by itself; show the board with `bin/vawe frame templates/title-sting/page.html --directions`.
   Each frame must be as beautiful as the anchor at full size.
2. Component labs: the 4 to 6 hardest pieces (a light, a material, a type move, a real UI), each alone
   on its own page templates/title-sting/labs/<piece>.html at 3 sizes (`bin/vawe dev <lab> --aspect 16:9`, then
   `1:1`, then `9:16`). Fix a piece in its lab before it goes in the film.
3. Draft loop: `bin/vawe dev templates/title-sting/page.html`, fix, repeat until every Acceptance row is green.
   Then Read `bin/vawe frame templates/title-sting/page.html --cuts` for every cut and fix what reads flat.
   Then `bin/vawe critique templates/title-sting/page.html` in a session that did not write the page.
4. Final: `bin/vawe ship templates/title-sting/page.html`, then `bin/vawe wait templates/title-sting/page.html`.

## Pitfalls

Taste pitfalls: taste/build/DIGEST.md (`bin/vawe dev` prints them).

## Deliver

- out/title-sting.mp4 from `bin/vawe ship`.
- This brief, with Spec edited to what you built and the Acceptance table filled with the number you
  measured next to each target.
- The judge report path for the final.

## First draft

Taste: taste/build/DIGEST.md (the full card is for the judge). Moves to copy: prompts/moves/README.md. Sound: the Board's sound rows, subtle (rule sound-swell).

bin/vawe dev templates/title-sting/page.html
