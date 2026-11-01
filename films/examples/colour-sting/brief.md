# colour-sting: brief

## The request

"A 5-second motion graphics sting for a made-up brand. Invent the brand: a name, a simple logo mark,
and one line. Rich colour: a saturated colour world with glow and gradients. A fast motion graphic: a
lot happens in 5 seconds, with quick, continuous motion and transitions. Subtle sound cues, felt not
noticed. Make it look expensive, not like a template."

- length: 5 s
- aspect: 16:9
- sound: synth cues only, no bed, near -20 LUFS after the mux

## Task

- what: a 5 s sting for a made-up brand
- for: people who see it once, muted or not, in a feed
- message: onsen turns up the colour
- spectacle: 2.75 s, the ring lands as the o of the name

## Taken from

Four frames of the repo's own move clips, as strips in `assets/`. The film takes what each one gives and makes its own direction.

| frame (exact path) | what you take |
|---|---|
| films/examples/colour-sting/assets/taken-match-cut.jpg | one shape holds its place across the cut while the ground and the ink flip (0.50 to 0.63 s): the cut into amber and the cut into red |
| films/examples/colour-sting/assets/taken-logo-sting.jpg | the name opens out from behind the mark on a feathered edge (0.50 to 0.88 s): the line opens from the ring's edge |
| films/examples/colour-sting/assets/taken-pull-back-reveal.jpg | the first frame is tight on one detail and the camera pulls back (0.00 to 0.38 s): the ring opens close and pulls back |
| films/examples/colour-sting/assets/taken-push-in.jpg | a slow push that runs to the last frame (0.00 to 1.00 s): the lockup never holds still |

How they move, from `bin/vawe frame` on the clips:

| move taken | ref id | cut s |
|---|---|---|
| match-cut | site/public/moves/match-cut.mp4 | 0.60 |
| logo-sting | site/public/moves/logo-sting.mp4 | 0.60 |
| pull-back-reveal | site/public/moves/pull-back-reveal.mp4 | 0.00 |
| camera-moves | site/public/moves/camera-moves.mp4 | 0.00 |

## The brand

- name: onsen (a hot spring): the brand turns the heat of colour up
- mark: a glossy ring whose colour runs from cold ultramarine on one side round to hot amber on the other, a temperature dial with no join.
  In the wordmark the ring is the first o of onsen.
- line: "Turn up the colour"
- face: Unbounded, one face: the name at 400, the line at 300 with "colour" at 600. Its wide, round o is the shape of the ring,
  so the ring can stand in for the letter.

## Directions

### A
- family: object-led (a glossy tube, the mark itself)
- sentence: Onsen, the heat dial: the ring turns and each turn heats the world.
- key frame: the ring rushes the lens and the next, hotter world, with the name waiting in it, shows through its hole
- palette: ultramarine #2536ff, magenta #ff2b8c, vermilion #ff4a1f, amber #ffab24, cream #fff3e3
- typeface: Unbounded
- move: the ring carries every seam, and the ground is lit from where the ring is
- thread: the ring, from the first frame to the last, ends as the o of the name

### B
- family: graphic-led (colour fields that fold)
- sentence: Pleat, the folding ribbon: a paper ribbon folds down the frame, each fold a new saturated face.
- key frame: three folds across a mint ground, the name on the last face
- palette: lemon, mint, olive
- typeface: Manrope
- move: a hinge fold per beat
- thread: the ribbon

### C
- family: type-led (the name is the stage)
- sentence: Brume, the wet word: the name sits huge and a glass drop rolls across it, bending each letter it passes.
- key frame: the drop over the "u" of brume, the letter magnified and split into coral and violet
- palette: teal, coral, violet
- typeface: Bricolage Grotesque
- move: a rolling refraction across the letters
- thread: the drop

- picked: A, because the mark is the film: one object carries every beat, its own colours are the worlds, and it ends as a letter of the name, so the brand is explained without a slogan on black. B is a known paper-fold template; C needs refraction the page cannot fake well.

## Signature

`<meta name="signature" content="band=gravity; ease=land; stagger=0; seam=hard cut; palette=saturated; thread=object (the ring)">`

- ease: arrivals run on `EASE.land`, the line opens on `EASE.nudge`, the ring's landing uses the `pop` curve once
- seam: hard cuts hidden inside a turn, a hole and a match cut, never a fade

## Look

- ground: a radial gradient per world, lit from the ring, with 12 percent grain on top so nothing bands
- ink: cream #fff3e3 on the dark worlds, plum #2a0710 on amber
- accent: ultramarine #2536ff, the cold end of the ring, on "colour" only
- typeface: Unbounded
- cap height: the name is 29% of the frame height, the line 6.7% and never lower

## States

One state per world, ids as in `data-world`:

| world | ground | what shows |
|---|---|---|
| cold | ultramarine | the ring close to the lens |
| warm | magenta | the ring, face on, with "ns" in its hole |
| hot | vermilion | the name, with the ring's rim at the frame edge |
| amber | amber | the lockup: ring as o, "nsen", the line |
| red | red | the same lockup, cream ink, "colour" in amber |

## Beats

| beat | time | world | the one thing that moves | seam into it |
|---|---|---|---|---|
| cold | 0.00 to 0.70 | ultramarine, lit from the ring | the ring, close, pulls back and turns toward edge-on | first frame: the ring is already there |
| warm | 0.70 to 2.00 | magenta | the ring opens from edge-on to face-on and slides left, then rushes the lens from 1.4; through its hole the next world shows, with "nsen" already waiting in it | turn: the cut hides in the 70 degree slit of the turning ring |
| hot | 2.00 to 2.75 | vermilion | the ring turns at the lens (the rim goes soft), flies back and lands in the gap as the o; the hot core behind it grows toward amber | depth: the hole grows past the frame |
| amber | 2.75 to 4.35 | amber, lit from the ring; the ink turns dark on the cut | the ring sends the line out (it opens rightward from the ring's edge by 3.1); from 3.3 the hotspot travels to "colour" and the ultramarine runs word by word with it, 140 ms a word; from 3.4 a vermilion heat front closes in from the edges | match cut on the landing frame: the lockup holds, the world and the ink flip |
| red | 4.35 to 5.00 | red, lit from the ring; the ink turns cream and "colour" takes the ring's hot end, amber | the heat front closes into a red world; a further 12% push runs to the last frame | the front closes on the beat: the lockup holds, the world and the ink flip once more |

## Board

The board is a plan for time: rhythm, spectacle, transitions, sound.

Rhythm: the holds are 0.70, 1.30, 0.75, 1.60 and 0.65 s. The cuts out are 0 s (a hard cut), 1.00 s (the hole opens at 1.0 and the rush fills the frame by 2.0), 0 s (the match cut) and 0.95 s (the heat front closes from 3.4 to 4.35).

| beat | in s | hold s | cut out s (length) |
|---|---|---|---|
| cold | 0.00 | 0.70 | 0.70 (0.00) |
| warm | 0.70 | 1.30 | 2.00 (1.00) |
| hot | 2.00 | 0.75 | 2.75 (0.00) |
| amber | 2.75 | 1.60 | 4.35 (0.95) |
| red | 4.35 | 0.65 | 5.00 (end) |

Spectacle: the one big moment at 2.75 s (also `<meta name="spectacle">`): the ring lands as the o of the name on the `pop` curve and the world flips to amber. Quiet before: 2.00 to 2.75, one object moves (the ring flies back) on a world that does not change; the rush from 1.4 to 2.0 is the build. Release after: the line opens, the light and the accent run to "colour", and nothing new arrives after 3.9 while the push keeps the hold alive. Built from recipe 15 in prompts/moves/RECIPES.md.

| cut | move (prompts/moves) | what carries the eye | what leaves first | overlap s | camera (push, drift, whip, none) | depth | overshoots (EASE.nudge, one EASE.pop) | handoff (family: object) |
|---|---|---|---|---|---|---|---|---|
| cold to warm, 0.70 | match-cut: the ring holds its place in the turn | the ring | the cold ground | 0 | none, the ring moves in 3D | ground, ring | none | graphic match: the ring holds its place |
| warm to hot, 1.00 to 2.00 | pull-back-reveal, run the other way: the ring rushes the lens and the next world shows through its hole | the ring, then the name inside it | the magenta ground | 1.00 | none, the ring moves in 3D | ground, ring, name | none | camera through: the ring rushes the lens |
| hot to amber, 2.75 | match-cut: the lockup holds, ground and ink flip; logo-sting: the line opens from the ring; camera-moves: the camera pushes on from 2.45 | the ring as the o | the red ground | 0 | push from 2.45, 20% to the last frame | ground, lockup | the ring's landing on the `pop` curve (the one hero arrival), the line opening on `EASE.nudge` | position lock: the lockup holds while ground and ink flip |
| amber to red, 4.35 | match-cut with a heat front that closes first | the hotspot, then "colour" | the amber ground | 0.95 | the same push plus a 12% punch | ground, heat, lockup | none, the word sweep runs on `EASE.land` | colour or light flood: the heat front |

Sound is subtle: no bed, one voice per cut and one for the spectacle. Voices are the quiet palette of `bin/vawe sound` at their default gain. Cues sit on `data-on="world:<id>"`, so they follow the picture.

| at s | voice | gain dB | for |
|---|---|---|---|
| 0.02 | tap | -12 | the first frame |
| 0.70 | tick | -14 | the turn cut |
| 1.30 | swoosh-long | -14 | the rush at the lens |
| 2.75 | sub-thump | -14 | the spectacle, the landing |
| 3.75 | shimmer | -16 | the accent running to "colour" |
| 4.35 | tap | -12 | the red cut |

## Motion pass

`bin/vawe dev films/examples/colour-sting/page.html` shows no problem and 10 of 10 acceptance rows green. The page declares no waiver for overshoot-share, live-hold or seam-variety, because none of them fires. The camera push runs from 2.45 to the last frame, so every hold moves. The strips of the four cuts, from `bin/vawe frame films/examples/colour-sting/page.html --cuts`, were read: the turn hides the first cut, the hole fills the frame before the second, the lockup holds still across the third, and the heat front closes before the fourth.
