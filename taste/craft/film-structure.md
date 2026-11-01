---
when: "what holds this film together across its cuts"
answers: the devices a short film can be held by (spatial, verbal, temporal, conceptual), how many threads to carry, how practitioners choose, causality as the register the devices miss, and the ten motion patterns measured in 22 reference films
group: crosscutting
---

# Film structure: what holds a short film together

Contents:
- [Continuity without an object](#continuity-without-an-object)
- [The devices](#the-devices)
- [How practitioners decide](#how-practitioners-decide)
- [A decision aid (inference, argue with it)](#a-decision-aid-inference-argue-with-it)
- [Causality: what made the cut happen](#causality-what-made-the-cut-happen)
- [The motion grammar: ten patterns that recur](#the-motion-grammar-ten-patterns-that-recur)
- [Sources](#sources)

Name what holds the film across each cut, and carry it in at least two registers. A transforming prop is
one device out of a dozen. It is the cheapest, and a film that keeps one rectangle alive and resizes it is
visually inert however clean it looks.

## Continuity without an object

One studied reference film held together across ten cuts in eighteen seconds without keeping one prop
alive. Measured frame by frame, it ran two threads at once: a grammatical one (one clause per shot, none
finishing) and a spatial one (a path the camera travels along, which black shots break on purpose). A
contact sheet undercounts this: measure before you copy (`ffmpeg select='gt(scene,0.25)'`, then sample
inside shots that look empty).

Continuity is not something good films do less of. They carry it in more than one register at once, so no
single register has to be literal. The prop does not need to survive a cut when the sentence and the space do.

**What must survive a cut is an unresolved thing.** An object mid-transformation is one kind. A sentence
mid-clause is another, and it is strictly more permissive: the picture under a clause can be anything.
Ask at each cut: is something unfinished?

Pace: that film ran shots of 0.76 s to 3.2 s with a median of 1.52 s. Films of 2.5 to 4 s a beat run about
half that cut rate, and no composition reads as energetic at half the rate.

Count your threads ([thread](../rules/thread.md), [beat-cause](../rules/beat-cause.md)). One is fragile: it has to be literal and obvious. Two is usually enough and lets both be
subtle. The reference ran three: the unfinished sentence, a travelling path, and a steady cut rhythm of about
1.5 s. That redundancy let it change props, palette and type wholesale. State the threads in the brief.

What redundancy buys: word-level emphasis (one word carries the colour, the rest sits grey), a different
world per beat (palette flips instead of holding), props with weight (real objects at hero scale, lit and
shadowed), type that touches and is occluded by the prop, a list built line by line on one prop, and emoji at
hero scale only as a deliberate subject.

## The devices

Each answers: at a cut, what does the viewer carry across?

### Spatial: something in the picture survives

| Device | What survives | Works when | Fails when |
|---|---|---|---|
| Transforming object | the prop, in a new state | one subject, one process, short runtime | several subjects, or the object is a box being resized |
| Match cut (shape, motion, colour, subject, theme) | a form, a direction, a hue | the two frames genuinely rhyme | the rhyme is forced and reads as a trick |
| Long take | one unbroken space and time | the subject is a place or a walk through a system | the content has no spatial logic |
| Camera travel | one continuous surface or path | the beats share a world | the beats are unrelated claims |
| Masking, reveal | the object, partly concealed then shown | utility changes with what is exposed | nothing is withheld |
| Cloning | a new object born from the old | a one-to-many relation | used as a generic entrance |
| Dolly and zoom | your position in one space | navigating between places in a system | there is no system |

Camera travel here: lay the beats out as stations on a canvas bigger than the frame and move one camera
(a transformed wrapper) along a path, so the flight replaces the cut. Give the layers different depths, or
a truck moves every layer by the same amount and reads as a slide. In a match cut, align centre, size and
rotation of the two silhouettes to within a few pixels, and overlap 1 to 2 frames. The School of Motion timing
note is usable: on a twelve-frame move cut on frame six and pick the next shot up on frame seven.

### Verbal and aural: something you hear survives

| Device | What survives | Works when | Fails when |
|---|---|---|---|
| Unfinished sentence | grammar; no full stop | a voice or a readable line | no VO and no copy |
| Sound bridge (J-cut, L-cut) | audio running past the picture cut | the film has sound | the film is silent |
| Bookend | an opening image the ending answers | the film has a change to show | the ends merely repeat |
| Open question | an unanswered loop | the payoff answers it | the question was rhetorical |

A sound bridge is the cheapest continuity device in live action. A film that ships silent gives it up.

### Temporal: the clock survives

| Device | What survives | Works when | Fails when |
|---|---|---|---|
| Metric cutting | a fixed cut length, felt as a pulse | an argument or a list | content needs uneven dwell time |
| Rhythmic cutting | a pulse that bends with the frame | real variety to pace | it drifts into no pattern |
| Music-led | the track's sections | the track is chosen before the boards | the track arrives last as decoration |

Laura Nicolas on the Lolo titles: "We really used the music as the main structure... it really leads the
whole sequence by its rhythmic changes" ([Art of the Title](https://www.artofthetitle.com/title/lolo/)).

### Conceptual: the idea survives

| Device | What survives | Works when | Fails when |
|---|---|---|---|
| Motif | a repeated image, shape or colour | the repetition means something | it is a watermark |
| Intellectual montage | an argument made by the junction | you compare two things | there is nothing to compare |
| Escalation | each beat outbidding the last | a real ranked order | the beats are peers |
| Through-line | one idea in many pictures | the idea is specific | the idea is "innovation" |

### Whole-film shapes

Problem and solution, product demo, vignette anthology, manifesto. A manifesto and an anthology are
deliberately discontinuous in the picture and held by the voice and the pulse. Take the names, not the
advice: no credible source ranks these shapes.

## How practitioners decide

The choice of device is tacit knowledge that nobody writes down. What exists:

1. **Murch ranks what a cut must serve and puts spatial continuity last** (emotion 51 %, story 23 %, rhythm
   10 %, eye-trace 7 %, screen plane 5 %, 3D space 4 %). Choose what holds the film for the feeling first.
   Spatial persistence is what you give up first.
2. **The message decides before any picture exists.** Ordinary Folk runs Message, Design, Animation, Audio.
   School of Motion puts storyboard and animatic before animation. Settle structure in the cheapest medium.
3. **If there is a track, the track may be the structure.** With a voice, the words set the pace.
4. **The platform sets the front of the structure.** Short form: hook in 3 s, escalation, payoff, CTA or
   loop, subject filling a 9:16 frame from the first frame.
5. **Kinetic type has its own test.** If the viewer cannot read the word at the moment it matters, the
   motion works against the message.

## A decision aid (inference, argue with it)

- **Is there a voice or a reading line?** Yes: the sentence can carry the film and the pictures are free.
- **How many subjects?** One: a transforming object, camera travel or masking. Several peers: a metric cut
  rate, a repeated frame or a motif. Two in opposition: intellectual montage.
- **Place, process or claim?** A place: camera travel or a long take. A process: the transforming object.
  A claim: a bookend, an escalation or a motif, and show the evidence.
- **Median shot length?** Under about 2 s, rhythm and match cuts do most of the work. Over about 3 s, a
  through-line has to do something or the film drifts.
- **Is a payoff withheld?** Then the open question is a thread by itself and costs nothing visually.
- **How many threads?** One is fragile. Add a second before you author.

## Causality: what made the cut happen

The devices answer "what survives the cut". None answers "what made the cut happen". Four beats can share a
prop, a colour and a cut rate and still be four things that merely follow each other: after is not because.
Art of the Title reads the Fight Club titles this way: abstract images held together by "this immediate
relationship between cause and effect".

For each beat state three things: how it moves (the mechanism), what it turned into (the change the viewer
sees), and what made it happen (the cause: "the cursor hits Send on the card in beat 1"). A film where every
beat turns into something and no beat causes the next is a run of unrelated changes.

A cause names an act, not an order and not a transition. "Then" and "it cuts to the next shot" say when and
how, not why. Not every film has a causal spine: a manifesto, an anthology and a metric-cut list are held by
something else. Decide whether this film should have one. Whether the causing act is on screen is a judgement
for your eyes.

## The motion grammar: ten patterns that recur

Twenty-two reference films were measured frame by frame (shot length, mean frame-to-frame luma change, ground luminance per shot) and 17 were read by hand. A device seen in one film is an idea, in three a technique. This is evidence, not a rule; the rules that came from it are [world-turns](../rules/world-turns.md), [first-frame](../rules/first-frame.md), [shot-length-varies](../rules/shot-length-varies.md) and [accent-share](../rules/accent-share.md). Median shot length is about 4 s (the fastest film, 1.48 s, did not read as frantic; films built on travel and dissolves have no hard cuts, which is often the finding). A mean is the wrong statistic for a beat: read the per-frame curve.

1. **A beat is a burst, then a rest** (3 films). The change curve rises to a peak and decays to near nothing before the next beat; every shot ends quieter than its middle. The rest is what makes the next arrival read as an arrival. Filling flat segments with drift to lift the average produced a uniform churn: hold the pose with no keys.
2. **Blur-resolve as the entrance** (3 films). Type arrives heavily blurred and settles; nothing slides or fades. A blurred still looks fast, a half-opacity still looks broken. Animate `filter: blur()` from about 24 px to 0 over about 0.4 s.
3. **The ground inverts on every cut** (3 films). Consecutive beats alternate dark and light, so no cut needs an effect; the inversion is the transition. Within one hue is the gentler form.
4. **Three ways to invert a frame** (3 films): the backdrop changes (a new world), the subject changes value, or the light changes over an unchanging world. Only the first is a new world, and we reach for it every time.
5. **Hold the picture, move the type** (3 films). Every photographic or rendered object is still; all motion is type arriving and the ground changing. The cut rate is high while the change inside a shot is low. Do not add a push-in to every image reflexively: it costs this.
6. **One accent colour, one word at a time** (4 films). One hue carries every emphasis, in one film 0.13 % of all pixels.
7. **The loudest frame is often an absence** (3 films): something leaving, or the frame flooding with flat colour. An emptying is the one we never use.
8. **A container that holds while its contents change** (4 films). One frame, pill, ring or window stays put and what is inside swaps: the cheapest continuity device. Recolour the container to match its new contents.
9. **Escalate the unit, not just the pace** (2 films). Single words under a second, then sentences at four: beat length and meaning grow together.
10. **Word, proof, word, proof** (1 film, the strongest product-demo shape seen). A hero type card states a claim and the next shot shows it in real product UI; a scale collapse (a word larger than the canvas resolving to a caption) recurs as one punctuation gesture.

Single-film findings worth stealing: one object can be the whole film; a true continuous object (an input pill becomes a window becomes an application, on one ground, with no cut); grade as punctuation; a palette can be the only thread; frame the photograph rather than move it; camera travel over one white plane is the strongest case for building from travel rather than cuts, and its static background is earned by a subject that never stops moving, so argue it per film. Study a reference with `bin/vawe see <ref.mp4> --spec` and `bin/vawe frame --vs`. Keep the reading, not the pixels: no frame, crop or copy of another person's film goes into the repo.

## Sources

Murch, In the Blink of an Eye; StudioBinder (Rule of Six, sound bridge, Soviet montage); Wikipedia (match
cut, long take); School of Motion (match cuts; Explainer Camp animatic); Ordinary Folk (process); Issara
Willenskomer, UX in Motion Manifesto (transformation, masking, cloning, dolly and zoom); Art of the Title
(The Inner Workings; Lolo); Filmmakers Academy (bookends); FilmDaft (motif); Eisenstein's five methods of
montage; We Design Motion (kinetic type).
