# terminal-demo: brief

Template: prompts/beat-sheet.md. Shape: prompts/ANATOMY.md. Replace each [unanswered: default taken] with the answer, or keep the default. Replace each (guess: change me) with a measured value or your own choice.

## Inputs

- request: A 12 s demo of a fictional CLI tool called halcyon: a command is typed in a terminal, output streams line by line, a result lands, then the tool name and the install line close the film.
- Length: 12 s
- Grid: free; cuts follow the picture [unanswered: default taken]
- Exposure: ones [unanswered: default taken]
- Cues: a recorded effect where one fits (`resources/README.md`), otherwise no cue; a synth voice from `core/audio/kit.mjs` only when you choose one [unanswered: default taken]

## Task

One line: what the film is, who sees it, the message, and the spectacle second (the one big moment,
with 1.5 s of quiet before it).

- what: A 12 s demo of a fictional CLI tool called halcyon: a command is typed in a terminal, output streams line by line, a result lands, then the tool name and the install line close the film.
- for: people who see it once, muted, in a feed (guess: change me)
- message: halcyon ships your app from the terminal
- spectacle: 7.2 s, the LIVE band prints across the window

## Taken from

Phase 2, before any design file. Study the references (`bin/vawe refs list`, then `bin/vawe refs frames <id>`, then Read each `~/.vawe/refs/frames/<id>/<shot>.png` at full size), then name 4 to 6 frames, not all. One row each: the exact path, and what you take (ground or light, type, colour, layout, motion). Fill it before DESIGN.md and page.html; `bin/vawe` says "Taken from not filled" until it holds a frame path.

| frame (exact path) | what you take |
|---|---|
| /Users/vandit/.vawe/refs/frames/terminal-run-v0-light-1080/key-1-0.8s.png | the window: the window shape and its one mono face (ours is larger, 89 percent of the width, so the text reads at feed size), a ruled composer at the bottom, the window on a flat quiet ground; we make it dark teal |
| /Users/vandit/.vawe/refs/frames/terminal-run-v0-light-1080/key-2-2.1s.png | typing with a solid block caret that follows each key; text steps per character |
| /Users/vandit/.vawe/refs/frames/terminal-run-v0-light-1080/key-5-4.6s.png | tool lines print whole, a dot per step, a result swaps in place (Running to done); one saturated pair of colours only |
| /Users/vandit/.vawe/refs/frames/terminal-run-v0-light-1080/key-7-7.2s.png | the finished session holds still, only the caret blinks |

The reference is one shot with no cuts, so `bin/vawe frame terminal-run-v0-light-1080 --cuts` has nothing to strip; the motion was read from `prompts/moves/terminal-run.md` and its demo.

| move taken | ref id | cut s |
|---|---|---|
| caret-typing: block caret, 30 ms a key, Enter reprints in place | terminal-run-v0-light-1080 | 2.1 |
| terminal-run: step lines print whole, result swaps in place, no easing on text | terminal-run-v0-light-1080 | 4.6 |
| window leaves in 0.3 s, then a calm lockup lands (calm-lockup) | terminal-run-v0-light-1080 | 7.2 |

Patterns (taste/craft/film-structure.md): the terminal is one continuous object (thread), the closing lockup is a reveal after the quiet.

## Directions

Three directions from three families before any motion; the first idea is the one every agent has.
Each slot: one sentence; the key frame (what is on screen at the one big moment); the palette (hex);
the typeface; the one signature move (a verb: fold, pour, slice, stamp); the thread (the one thing that
carries through the film); the risk (how it fails); from (a real frame path or ref id it is drawn from). No two slots share a hue family, a typeface or a move, and at most one is
carried by a circle, orb, sun, ring or glow. Budget: 2 colours, 1 typeface, 1 signature move, 1 sound.
Story and structure: the spine is taste/craft/story.md (hook, build, proof, payoff, CTA); what carries across each cut is taste/craft/film-structure.md; reject the median first (guides/PITCH.md).

films/terminal-demo/directions.html holds one working still per family: rewrite each into its slot's key frame.
Show the three to the person as one board: bin/vawe frame films/terminal-demo/page.html --directions. The person picks one, and later types /vawe-approve.
bin/vawe dev scores the three with the stills judge by itself, once per change of directions.html or their brief lines.

### A

- family: type-led (the film is carried by type)
- sentence: the tool name "halcyon." at 17 percent of the frame height on a dark teal ground, with the install line under it.
- key frame: 11 s, the lockup with the install box and a lit block caret.
- palette: #0a1214 ground, #e6f0f1 ink, #46d6c6 accent.
- typeface: Geist 600.
- move: land (name rises 3.5 percent and fades in).
- thread: the teal block caret.
- risk: reads as a plain logo card; the command never runs.
- from: /Users/vandit/.vawe/refs/frames/terminal-run-v0-light-1080/key-7-7.2s.png (the held end state)

### B

- family: object-led (a real thing or the product UI)
- sentence: a real shell session: the command is typed, the steps print whole rows, a LIVE badge lands, then the name closes it.
- key frame: 7.2 s, the result block under four ticked steps.
- palette: #101b1e window, #e6f0f1 ink, #46d6c6 accent, #8fa6ab muted.
- typeface: Geist Mono 3.5 percent of the frame height, Geist for the name.
- move: print (a row appears whole on one frame, no easing on text).
- thread: the teal block caret.
- risk: reads as a screenshot if the typing and the progress bar are not stepped like a real terminal.
- from: /Users/vandit/.vawe/refs/frames/terminal-run-v0-light-1080/key-5-4.6s.png

### C

- family: graphic-led (shape, colour field, rhythm)
- sentence: one progress bar fills across the frame as the whole film; the name appears when it is full.
- key frame: 6.5 s, the bar at 70 percent filling the frame width.
- palette: #0a1214 ground, #46d6c6 bar, #e6f0f1 ink.
- typeface: Geist Mono.
- move: fill (stepped cells).
- thread: the bar.
- risk: hides the real tool output, so it shows nothing working.
- from: /Users/vandit/.vawe/refs/frames/terminal-run-v0-light-1080/key-5-4.6s.png (the Running step)

- picked: B, because a template for a CLI demo must show the real command and its output working; the name closes it as in A.

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

- ground: #0a1214 with two slow teal and blue lights
- ink: #e6f0f1
- accent: #46d6c6, on the caret, ticks, bar, LIVE badge, URL and the name's full stop
- typeface: Geist Mono for the terminal, Geist 600 for the name
- cap height: the name is 17 percent of the frame height; terminal text is 3.5 percent (a window 89 percent of the frame wide so the text reads at feed size) (a real terminal face, set apart by the real-surface rule)
- surface: terminal window #101b1e, 1 px edge rgba(230,240,241,0.11), layered shadow
- look: only for a film that uses the lens: bin/vawe frame <page> --looks --at <s> shows the page under each look (clean, dream-bloom, film-halation, anamorphic, pro-mist, tilt-shift, soft-focus, vintage, cyanotype, riso, crt); then set look: '<name>' in the lens options

## Design system and kit

Phase 3. Write films/terminal-demo/DESIGN.md: the palette as roles, the type, the ground and light devices, the text treatment. Write films/terminal-demo/kit/: the ground layers, and every moving part as its own element (words, marks, bars, cards, icons, the wordmark).
Free faces (copy the file from assets/fonts/ to films/terminal-demo/assets/, then @font-face with src: url("assets/<file>")): Anybody: Anybody.woff2; Archivo: Archivo.woff2; Big Shoulders: BigShoulders.woff2; Bricolage Grotesque: BricolageGrotesque.woff2; Caveat: Caveat.woff2; Fraunces: Fraunces.woff2; Geist: Geist.woff2; Geist Mono: GeistMono.woff2; Hanken Grotesk: HankenGrotesk.woff2; IBM Plex Mono: IBMPlexMono-400.woff2, IBMPlexMono-500.woff2; Instrument Serif: InstrumentSerif-Italic.woff2, InstrumentSerif-Regular.woff2; Inter: InterVariable.woff2; JetBrains Mono: JetBrainsMono.woff2; Manrope: Manrope.woff2; Plus Jakarta Sans: PlusJakartaSans.woff2; Space Grotesk: space-500.woff2, space-700.woff2; Unbounded: Unbounded.woff2.
Palette seed for terminal-demo: seed-186 oklch(0.450 0.074 200.0), sky blue (one read: "deep hydrothermal vent, mineral teal under pressure, the cold blue-green of oxidized copper in submerged light"). It anchors the primary; keep its hue within 10 degrees, and compose bg, ink and one accent around it in OKLCH roles.
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
| run | a command runs and succeeds | literal: a real shell session, 0.8 | show the invisible: the deploy as a bar filling, 0.4 | scale shift: the result row floods the window width as an accent band, 0.3 | reversal: the output types itself first, 0.1 | 3 | because one full-width band is the only colour field in the session and it makes the result the big moment |
| close | the name and how to get it | part for whole: the caret of the last prompt becomes the cursor of the install line, 0.3 | literal: a title card, 0.8 | transformation: the window shrinks into the wordmark, 0.2 | metaphor: a lit port, 0.2 | 1 | because the same teal caret travels from the shell to the install line and carries the thread |
| run to close | the session ends, the brand lands | literal: window leaves, 0.7 | collision: wordmark pushes the window out, 0.1 | transformation: the window folds shut to a line while the caret flies out, 0.2 | scale shift: zoom into the caret, 0.1 | 3 | because the fold is 0.17 s and the caret stays on screen across the cut |
| film | one command, one result, one name | literal: deploy demo, 0.8 | show the invisible: the build as a graph, 0.2 | part for whole: one teal caret carries the film from shell to install line, 0.2 | reversal: result first, 0.1 | 3 | because the caret is the thread of the film |

## Board

Phase 5, after the states and before any motion. The board is a plan for time: rhythm, spectacle, transitions, sound. It is not a list of frames. Name each move from prompts/moves (`prompts/moves/README.md`), never "fade" by default. Replace every bracket.

Rhythm: cut lengths and holds are NOT all equal. At least one cut under 0.4 s, one over 0.9 s, and holds that vary.

| beat | in s | hold s | cut out s (length) |
|---|---|---|---|
| run | 0 | 8.55 | 8.83 (0.28 fold) |
| close | 8.6 | 3.4 | 12 (end) |

Spectacle: the one big moment at 7.2 s (also `<meta name="spectacle">`). Quiet before it: 1.6 s of steady printing at 0.5 s a step, the bar fills in whole cells. Release after: the result holds 0.7 s, the next prompt blinks, the window folds shut from 8.55 s to 8.83 s.

| cut | move (prompts/moves) | what carries the eye | what leaves first | overlap s | camera (push, drift, whip, none) | depth | overshoots (EASE.nudge, one EASE.pop) | handoff (family: object) |
|---|---|---|---|---|---|---|---|---|
| run to close | terminal-run, calm-lockup | the teal caret | the window | 0.0 | none | ground lights drift under both | none: a terminal does not overshoot | deliberate cut: the window folds in 0.28 s and the ground stays, so the lockup lands on the same lights |

Pick each cut by the feeling it must give (taste/craft/selection.md). Plan its handoff with the skill `vawe-transitions` (skills/vawe-transitions/SKILL.md): the family is one of the twelve in taste/craft/transitions.md, the object is the one thing that carries over, and "deliberate cut: <reason>" is a family. Fill the ledger from the handoff column.

| family | cuts |
|---|---|
| deliberate cut: the ground stays while the window leaves | run to close |

Sound is part of every film, subtle: small effects on actions, only on the cuts and actions that earn one, plus one for the spectacle. A real recorded effect first (the film's assets, or the sites in resources/README.md); with none that fits, no cue; a synth voice from `bin/vawe sound` only when you choose one. No synth bed, pad or chord. A music track only from a file the user gives. Why and how: taste/craft/sound.md.

Gain: leave the column empty to take the voice's default (`bin/vawe sound` lists it). Write a number only to move one cue on purpose: `data-gain` is absolute dB and replaces the default.

| at s | voice | gain dB | for |
|---|---|---|---|
| none | none | | silent: no recorded effect fits and the owner bans synth beds; keyboard ticks can be added by a remix |

## Motion pass

Phase 7, after the first draft. Done when `bin/vawe dev` shows overshoot-share, live-hold, constant-camera and seam-variety clean or waived with a reason, and you have Read `bin/vawe frame films/<name>/page.html --cuts` for every cut. For the spectacle second also run `bin/vawe frame <page> --moment <s> --onion` and `--velocity`. Check each cut against taste/craft/motion-craft.md and the principles in core/motion/README.md; one row per cut, ok, fix or n/a per principle. `bin/vawe ship` warns while this table holds a placeholder.

| cut | anticipation (hero) | follow-through, overlap | spacing eased | arcs | secondary action | exits faster | hold alive | camera still | what read flat | what I fixed (or why it stays) |
|---|---|---|---|---|---|---|---|---|---|---|
| run to close, 8.55 s | ok: the caret waits 0.65 s at the last prompt before it flies | ok: the lockup scales in 140 ms after it lands | ok: EASE.carry on the caret, EASE.land on the lockup, EASE.launch on the fold, text steps | ok: the caret flies from the prompt to the install line | ok: ground lights drift, spinner turns | ok: the fold is 0.28 s, the name enters in 0.6 s | ok: the prompt caret blinks, the install line types to 11.1 s | ok: camera still | the strip showed the old fade over empty ground | replaced the fade with a fold and a caret that stays on screen across the cut |

## Spec

Before any code, fill the three Spec tables in films/terminal-demo/brief.md: Shots, Words, Objects. One
Shots row per shot. Every row has one focal action and an end state I can picture. The slowest row is
at least 3x the fastest. Exits are shorter than entrances. Something happens in every row. Give every
Words and Objects row its times in seconds. Then build from the tables; never wait for a reply.

### Shots

| id | start s | end s | the viewer notices | move in | move out | camera | ground |
|---|---|---|---|---|---|---|---|
| run | 0 | 8.83 | the command types, five steps tick, LIVE lands | none: on screen from frame 0 | fold 0.28 s | static | #0a1214 |
| close | 8.63* | 12 | the name, then the install line typed | layer in 0.6 s | none: the film ends | static | #0a1214 |

### Words

| text | shot | appear s | settle s | cap % | x % | y % | weight | colour |
|---|---|---|---|---|---|---|---|---|
| halcyon deploy --env production | run | 1.7 | 1.7 | 3.5 | 37.6 | 19.4 | 400 | #e6f0f1 |
| api deployed in 5.7s | run | 7.23 | 7.23 | 5.0 | 23.1 | 60 | 600 | #e6f0f1 |
| halcyon. | close | 8.77* | 8.93* | 11.9 | 14 | 21 | 600 | #e6f0f1 |
| Ship from the terminal. | close | 9.03* | 9.1* | 6 | 14 | 38 | 400 | #8fa6ab |
| npm i -g halcyon | close | 10.33* | 10.33* | 3.6 | 14 | 58 | 400 | #e6f0f1 |

### Objects

| id | selector | shot | in s | settle s | out s |
|---|---|---|---|---|---|
| window | .win | run | 0 | 0 | 8.83 |
| deploy steps | .step | run | 2.15 | 7.2 | 8.83 |
| result | #res1 | run | 7.2 | 7.2 | 8.83 |
| name | #mark | close | 8.65 | 9.25 | 12 |
| install line | #install | close | 9.32 | 9.65 | 12 |

## Acceptance

| metric | target | measured (last draft) |
|---|---|---|
| frozen runs of 3+ frames inside a shot | 0 | 0 |
| jerky steps | under 5 | 0 |
| jumps not at a declared cut | 0 | 0 |
| still windows over 0.5 s outside a declared hold | 0 | 0 (the 8.1 to 8.7 s hold is declared) |
| near-identical tail tiles | 4 or fewer | declared (caret blink and typed rows) |
| text cap height | 6% or more | 6.0% for the tagline; 3.5% for the terminal text (data-ui floor 3%) |
| text contrast | 4.5:1 or more | all pass |
| text collisions | 0 | 0 |
| read hold per line | 0.6 s a word from 4 words, else max(1.2 s, words/3 s) | declared: steps print every 0.5 to 1.0 s as the real tool does |
| exits shorter than entrances | all | all |
| word cap height and position vs spec | within 1% of frame | within 1% (the table is read from the build: left-set at 14%) |
| cuts vs spec | within 1 frame | not measured: no hard cut |
| loudness | -24 to -16 LUFS | not measured: silent |
| peak | -10 dBFS or lower | not measured: silent |
| judge: each storyboard frame as beautiful as the anchor, full size | YES | measured at ship |

## Gates

Do the gates in order. A failed gate sends you back to the one before it.

1. Stills: three directions in directions.html, then the five frames that define the look.
   `bin/vawe dev` scores the directions with the stills judge by itself; show the board with `bin/vawe frame films/terminal-demo/page.html --directions`.
   Each frame must be as beautiful as the anchor at full size.
2. Component labs: the 4 to 6 hardest pieces (a light, a material, a type move, a real UI), each alone
   on its own page films/terminal-demo/labs/<piece>.html at 3 sizes (`bin/vawe dev <lab> --aspect 16:9`, then
   `1:1`, then `9:16`). Fix a piece in its lab before it goes in the film.
3. Draft loop: `bin/vawe dev films/terminal-demo/page.html`, fix, repeat until every Acceptance row is green.
   Then Read `bin/vawe frame films/terminal-demo/page.html --cuts` for every cut and fix what reads flat.
   Then `bin/vawe critique films/terminal-demo/page.html` in a session that did not write the page.
4. Final: `bin/vawe ship films/terminal-demo/page.html`, then `bin/vawe wait films/terminal-demo/page.html`.

## Pitfalls

Taste pitfalls: taste/build/DIGEST.md (`bin/vawe dev` prints them).

## Deliver

- out/terminal-demo.mp4 from `bin/vawe ship`.
- This brief, with Spec edited to what you built and the Acceptance table filled with the number you
  measured next to each target.
- The judge report path for the final.

## First draft

Taste: taste/build/DIGEST.md (the full card is for the judge). Moves to copy: prompts/moves/README.md. Sound: the Board's sound rows, subtle (rule sound-swell).

bin/vawe dev films/terminal-demo/page.html
