# ai-chat-demo: brief

Template: prompts/beat-sheet.md. Shape: prompts/ANATOMY.md. Replace each [unanswered: default taken] with the answer, or keep the default. Replace each (guess: change me) with a measured value or your own choice.

## Inputs

- request: A 10 s demo of a fictional chat product called Lumen: a prompt is typed in the input, the answer streams in, one key part of the answer is called out.
- Length: 10 s
- Grid: free; cuts follow the picture [unanswered: default taken]
- Exposure: ones [unanswered: default taken]
- Cues: a recorded effect where one fits (`resources/README.md`), otherwise no cue; a synth voice from `core/audio/kit.mjs` only when you choose one [unanswered: default taken]

## Task

One line: what the film is, who sees it, the message, and the spectacle second (the one big moment,
with 1.5 s of quiet before it).

- what: A 10 s demo of a fictional chat product called Lumen: a prompt is typed in the input, the answer streams in, one key part of the answer is called out.
- for: people who see it once, muted, in a feed (guess: change me)
- message: Lumen answers and shows the number that matters
- spectacle: 6.4 s, four corner marks snap on the key number

## Taken from

Phase 2, before any design file. Study the references (`bin/vawe refs list`, then `bin/vawe refs frames <id>`, then Read each `~/.vawe/refs/frames/<id>/<shot>.png` at full size), then name 4 to 6 frames, not all. One row each: the exact path, and what you take (ground or light, type, colour, layout, motion). Fill it before DESIGN.md and page.html; `bin/vawe` says "Taken from not filled" until it holds a frame path.

| frame (exact path) | what you take |
|---|---|
| /Users/vandit/.vawe/refs/frames/chat-prompt-v0-light-1080/key-1-0.7s.png | layout: a window on a flat light ground, a greeting and a pill composer centred, rail on the left; we use our own sidebar, warm paper ground, one amber accent |
| /Users/vandit/.vawe/refs/frames/chat-prompt-v0-light-1080/key-3-2.3s.png | the prompt typed with a caret, the send button turns to an up arrow |
| /Users/vandit/.vawe/refs/frames/chat-prompt-v0-light-1080/key-5-4.4s.png | the sent bubble is tinted and right aligned, the answer is unboxed with a bold heading, the composer has docked low, the send button is a stop square |
| /Users/vandit/.vawe/refs/frames/chat-prompt-v0-light-1080/key-7-7.0s.png | the finished answer holds still with an action row under it |

The reference is one shot with no cuts, so `--cuts` has nothing to strip; I read the send moment with `bin/vawe frame chat-prompt-v0-light-1080 --at 2.0,2.2,2.4,2.6,2.8,3.0` (the bubble flies from the composer on a spring, the composer drops to the dock in 0.3 s, a dot shows while the model thinks).

| move taken | ref id | cut s |
|---|---|---|
| caret-typing in a pill composer, 22 chars a second | chat-prompt-v0-light-1080 | 2.0 |
| ai-stream-response: bubble flips on a spring, composer docks, answer streams in 1 to 3 word chunks with a dot on the newest | chat-prompt-v0-light-1080 | 2.6 |
| bracket-callout: one key phrase is marked and labelled after the stream ends | prompts/moves/bracket-callout | 6.4 |

Patterns (taste/craft/film-structure.md): one continuous screen (thread), the callout is the payoff after the stream ends.

## Directions

Three directions from three families before any motion; the first idea is the one every agent has.
Each slot: one sentence; the key frame (what is on screen at the one big moment); the palette (hex);
the typeface; the one signature move (a verb: fold, pour, slice, stamp); the thread (the one thing that
carries through the film); the risk (how it fails); from (a real frame path or ref id it is drawn from). No two slots share a hue family, a typeface or a move, and at most one is
carried by a circle, orb, sun, ring or glow. Budget: 2 colours, 1 typeface, 1 signature move, 1 sound.
Story and structure: the spine is taste/craft/story.md (hook, build, proof, payoff, CTA); what carries across each cut is taste/craft/film-structure.md; reject the median first (guides/PITCH.md).

films/ai-chat-demo/directions.html holds one working still per family: rewrite each into its slot's key frame.
Show the three to the person as one board: bin/vawe frame films/ai-chat-demo/page.html --directions. The person picks one, and later types /vawe-approve.
bin/vawe dev scores the three with the stills judge by itself, once per change of directions.html or their brief lines.

### A

- family: type-led (the film is carried by type)
- sentence: one big number, "€1,250 a month", alone on a warm paper ground with the question above it.
- key frame: 7 s, the number at 12 percent of the frame height.
- palette: #efebe4 ground, #17140f ink, #a8620a accent.
- typeface: Inter 650.
- move: land (the number rises 3 percent and fades in).
- thread: the amber accent.
- risk: no product shown, so it does not read as a chat demo.
- from: /Users/vandit/.vawe/refs/frames/chat-prompt-v0-light-1080/key-7-7.0s.png (the finished answer)

### B

- family: object-led (a real thing or the product UI)
- sentence: the whole chat app: a prompt typed in the composer, the answer streaming, one key part framed and labelled.
- key frame: 6.9 s, the answer with the key part in four corner marks and its label.
- palette: #fdfcfa window, #f6f3ee sidebar, #17140f ink, #a8620a accent, #f4e6d3 bubble.
- typeface: Inter at 2.8 percent of the frame height for the chat, 3.6 for the heading.
- move: bracket-callout (four corners snap on, EASE.pop).
- thread: the amber accent.
- risk: reads as a screenshot if the typing, the send and the stream do not move like the real thing.
- from: /Users/vandit/.vawe/refs/frames/chat-prompt-v0-light-1080/key-5-4.4s.png

### C

- family: graphic-led (shape, colour field, rhythm)
- sentence: an amber pill grows from the composer into the answer and the number sits inside it.
- key frame: 6.4 s, the pill at full width.
- palette: #f4e6d3 pill, #a8620a accent, #17140f ink.
- typeface: Inter.
- move: grow (the pill scales from the composer).
- thread: the pill.
- risk: hides the real answer, so it shows no chat working.
- from: /Users/vandit/.vawe/refs/frames/chat-prompt-v0-light-1080/key-3-2.3s.png (the send button)

- picked: B, because a chat template must show a real prompt, a stream and a call-out working; A is the end card.

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

- ground: #efebe4 warm paper with two slow amber lights
- ink: #17140f
- accent: #a8620a, on the send button, the streamed words, the corner marks, the label and the brand ring
- typeface: Inter
- cap height: chat text 2.8 percent of the frame height inside the app window (data-ui: a real chat is sized like a real screen)
- surface: window #fdfcfa, 1 px edge rgba(23,20,15,0.1), layered shadow
- look: only for a film that uses the lens: bin/vawe frame <page> --looks --at <s> shows the page under each look (clean, dream-bloom, film-halation, anamorphic, pro-mist, tilt-shift, soft-focus, vintage, cyanotype, riso, crt); then set look: '<name>' in the lens options

## Design system and kit

Phase 3. Write films/ai-chat-demo/DESIGN.md: the palette as roles, the type, the ground and light devices, the text treatment. Write films/ai-chat-demo/kit/: the ground layers, and every moving part as its own element (words, marks, bars, cards, icons, the wordmark).
Free faces (copy the file from assets/fonts/ to films/ai-chat-demo/assets/, then @font-face with src: url("assets/<file>")): Anybody: Anybody.woff2; Archivo: Archivo.woff2; Big Shoulders: BigShoulders.woff2; Bricolage Grotesque: BricolageGrotesque.woff2; Caveat: Caveat.woff2; Fraunces: Fraunces.woff2; Geist: Geist.woff2; Geist Mono: GeistMono.woff2; Hanken Grotesk: HankenGrotesk.woff2; IBM Plex Mono: IBMPlexMono-400.woff2, IBMPlexMono-500.woff2; Instrument Serif: InstrumentSerif-Italic.woff2, InstrumentSerif-Regular.woff2; Inter: InterVariable.woff2; JetBrains Mono: JetBrainsMono.woff2; Manrope: Manrope.woff2; Plus Jakarta Sans: PlusJakartaSans.woff2; Space Grotesk: space-500.woff2, space-700.woff2; Unbounded: Unbounded.woff2.
Palette seed for ai-chat-demo: seed-124 oklch(0.750 0.080 170.0), teal (one read: "sea-glass on a foggy Pacific shoreline, weathered, mineral, quietly oxidized"). It anchors the primary; keep its hue within 10 degrees, and compose bg, ink and one accent around it in OKLCH roles.
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
| chat | a question gets a clear answer and one number matters | literal: a real chat session, 0.8 | show the invisible: the model's thinking as a dot, 0.4 | part for whole: only the number at full frame, 0.3 | reversal: the answer first and the question after, 0.1 | 1 | because the template must show a chat working; the corner marks give the one moment |
| ask to answer | the prompt is sent | transformation: the typed line flies up and becomes the bubble, 0.6 | collision: the composer falls to the dock under it, 0.3 | scale shift: zoom into the composer, 0.2 | literal: the page cuts, 0.5 | 1 | because the bubble leaves the composer on a spring, as the real product does |
| answer to call-out | the key part is named | metaphor: a spotlight, 0.4 | literal: bold the number, 0.7 | transformation: corner marks snap onto the number and the rest dims, 0.2 | personification: an arrow points, 0.3 | 3 | because the marks and the dim move the eye without adding words |
| film | ask, answer, mark the number | literal: chat demo, 0.8 | show the invisible: token flow, 0.2 | scale shift: the number grows, 0.2 | reversal: result first, 0.1 | 1 | because the base case is the template people will remix |

## Board

Phase 5, after the states and before any motion. The board is a plan for time: rhythm, spectacle, transitions, sound. It is not a list of frames. Name each move from prompts/moves (`prompts/moves/README.md`), never "fade" by default. Replace every bracket.

Rhythm: cut lengths and holds are NOT all equal. At least one cut under 0.4 s, one over 0.9 s, and holds that vary.

| beat | in s | hold s | cut out s (length) |
|---|---|---|---|
| chat | 0 | 10 | 10 (end) |

Spectacle: the one big moment at 6.4 s (also `<meta name="spectacle">`). Quiet before it: 0.4 s after the stream ends, the answer holds still while the action row arrives. Release after: the label lands at 6.8 s, then the answer holds 2.7 s with a caret blinking in the composer.

| cut | move (prompts/moves) | what carries the eye | what leaves first | overlap s | camera (push, drift, whip, none) | depth | overshoots (EASE.nudge, one EASE.pop) | handoff (family: object) |
|---|---|---|---|---|---|---|---|---|
| chat (no cut) | ai-stream-response, bracket-callout | the amber accent | the rest of the answer dims | 0.0 | none | window over a drifting ground | the sent bubble (spring) and the four corner marks (EASE.pop) | deliberate cut: the film is one continuous screen, no cut |

Pick each cut by the feeling it must give (taste/craft/selection.md). Plan its handoff with the skill `vawe-transitions` (skills/vawe-transitions/SKILL.md): the family is one of the twelve in taste/craft/transitions.md, the object is the one thing that carries over, and "deliberate cut: <reason>" is a family. Fill the ledger from the handoff column.

| family | cuts |
|---|---|
| deliberate cut: one continuous screen | chat |

Sound is part of every film, subtle: small effects on actions, only on the cuts and actions that earn one, plus one for the spectacle. A real recorded effect first (the film's assets, or the sites in resources/README.md); with none that fits, no cue; a synth voice from `bin/vawe sound` only when you choose one. No synth bed, pad or chord. A music track only from a file the user gives. Why and how: taste/craft/sound.md.

Gain: leave the column empty to take the voice's default (`bin/vawe sound` lists it). Write a number only to move one cue on purpose: `data-gain` is absolute dB and replaces the default.

| at s | voice | gain dB | for |
|---|---|---|---|
| none | none | | silent: no recorded effect fits and the owner bans synth beds; a remix can add a tick on send |

## Motion pass

Phase 7, after the first draft. Done when `bin/vawe dev` shows overshoot-share, live-hold, constant-camera and seam-variety clean or waived with a reason, and you have Read `bin/vawe frame films/<name>/page.html --cuts` for every cut. For the spectacle second also run `bin/vawe frame <page> --moment <s> --onion` and `--velocity`. Check each cut against taste/craft/motion-craft.md and the principles in core/motion/README.md; one row per cut, ok, fix or n/a per principle. `bin/vawe ship` warns while this table holds a placeholder.

| cut | anticipation (hero) | follow-through, overlap | spacing eased | arcs | secondary action | exits faster | hold alive | camera still | what read flat | what I fixed (or why it stays) |
|---|---|---|---|---|---|---|---|---|---|---|
| chat, 3.0 s send and 6.4 s call-out (no cut) | ok: the bubble leaves the composer on a spring, the corner marks start 1.35x out | ok: the label lands 0.34 s after the marks, the composer docks 0.32 s under the bubble | ok: EASE.land on the dock, spring on the bubble, EASE.pop on the marks | ok: the marks converge on the key part | ok: ground lights drift, the label breathes 4% for 2.4 s, the composer caret blinks | n/a: the film ends on the product, there is no exit | ok: the label breathes through the hold | ok: camera still | the first draft opened on an empty chat and the corner marks were four separate arrivals | the chat now opens full on frame 0; the four corners are one frame element so the overshoot share drops to 2 arrivals (onion at 6.4 s shows the ghosts bunched at the end and one 15.5 percent overshoot) |

## Spec

Before any code, fill the three Spec tables in films/ai-chat-demo/brief.md: Shots, Words, Objects. One
Shots row per shot. Every row has one focal action and an end state I can picture. The slowest row is
at least 3x the fastest. Exits are shorter than entrances. Something happens in every row. Give every
Words and Objects row its times in seconds. Then build from the tables; never wait for a reply.

### Shots

| id | start s | end s | the viewer notices | move in | move out | camera | ground |
|---|---|---|---|---|---|---|---|
| chat | 0 | 10 | the question is typed and sent, the answer streams, the number is marked | window in 0.24 s | none: the film ends on the product | static | #efebe4 |

### Words

| text | shot | appear s | settle s | cap % | x % | y % | weight | colour |
|---|---|---|---|---|---|---|---|---|
| Save for a €30k car in 2 years? | chat | 2.2 | 2.2 | 2.8 | 41.6 | 25.7 | 400 | #17140f |
| You need to save €1,250 a month | chat | 4.83 | 4.83 | 2.8 | 39.3 | 55 | 650 | #17140f |
| Monthly target | chat | 6.83 | 6.83 | 2.1 | 68 | 55 | 600 | #ffffff |

### Objects

| id | selector | shot | in s | settle s | out s |
|---|---|---|---|---|---|
| window | .win | chat | 0.1 | 0.48 | 9.74 |
| composer | #composer | chat | 0.3 | 3.32 | 9.74 |
| answer | #answer | chat | 3.55 | 6.0 | 9.74 |
| corner marks | .frame | chat | 6.44 | 6.96 | 9.74 |

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
   `bin/vawe dev` scores the directions with the stills judge by itself; show the board with `bin/vawe frame films/ai-chat-demo/page.html --directions`.
   Each frame must be as beautiful as the anchor at full size.
2. Component labs: the 4 to 6 hardest pieces (a light, a material, a type move, a real UI), each alone
   on its own page films/ai-chat-demo/labs/<piece>.html at 3 sizes (`bin/vawe dev <lab> --aspect 16:9`, then
   `1:1`, then `9:16`). Fix a piece in its lab before it goes in the film.
3. Draft loop: `bin/vawe dev films/ai-chat-demo/page.html`, fix, repeat until every Acceptance row is green.
   Then Read `bin/vawe frame films/ai-chat-demo/page.html --cuts` for every cut and fix what reads flat.
   Then `bin/vawe critique films/ai-chat-demo/page.html` in a session that did not write the page.
4. Final: `bin/vawe ship films/ai-chat-demo/page.html`, then `bin/vawe wait films/ai-chat-demo/page.html`.

## Pitfalls

Taste pitfalls: taste/build/DIGEST.md (`bin/vawe dev` prints them).

## Deliver

- out/ai-chat-demo.mp4 from `bin/vawe ship`.
- This brief, with Spec edited to what you built and the Acceptance table filled with the number you
  measured next to each target.
- The judge report path for the final.

## First draft

Taste: taste/build/DIGEST.md (the full card is for the judge). Moves to copy: prompts/moves/README.md. Sound: the Board's sound rows, subtle (rule sound-swell).

bin/vawe dev films/ai-chat-demo/page.html
