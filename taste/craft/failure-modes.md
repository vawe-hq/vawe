---
when: "it \"renders fine but feels cheap\""
answers: "the guardrails you break by default, the failure-modes catalog, restraint, continuity"
group: story
---

# Failure modes: what not to do, and how each choice makes the viewer feel

[motion-craft.md](motion-craft.md) says how to move a thing. This page says what it feels like when you
do it wrong. Reach for it when a film renders fine but feels cheap. [selection.md](selection.md) turns
an intent into the specific cut, face and ease. The numbers are in the rules (`taste/README.md`).

> Rather no motion than bad motion. Rather one clean idea than five effects.

Every rule below is a corollary. When two rules collide, this one wins.

## Guardrails: you know these rules and you break them

Borrowed from reference motion-design notes, with the receipts from this repo.

- **One ease on every tween.** Your default is the same designed ease everywhere. Vary eases like you vary font weights ([named-eases](../rules/named-eases.md)).
- **One speed on everything.** Your default is a duration near the middle of the range. The slowest move is several times the fastest ([speed-bands](../rules/speed-bands.md)).
- **Everything enters from one direction.** Your default is a short translateY plus a fade on every element. A 28 s film shipped with a fade on nearly every one of 31 hand-written layers. Vary the origin: from left, from right, from scale, opacity only, letter-spacing ([entrance-origin](../rules/entrance-origin.md)).
- **One stagger everywhere.** Each scene needs its own rhythm ([stagger](../rules/stagger.md)).
- **An ambient zoom on every scene.** Pick a different ambient motion per scene, or nothing ([live-hold](../rules/live-hold.md)).
- **Everything starts at frame 0 into an empty frame.** Something of the subject is on screen at frame 0, and its motion may start a beat later ([first-frame](../rules/first-frame.md)).
- **The ease direction backwards.** You get this backwards: a slow-start entrance feels sluggish, a decelerating exit feels reluctant ([entrance-ease](../rules/entrance-ease.md), [exits-shorter](../rules/exits-shorter.md)).
- **Subtle reads as static at 30 fps.** Two films written as improvements on a third both came out slower, at 0.95 and 0.85 events per second against a library median of 1.20. Check the measured event rate before you call a draft safe.
- **A spring or an overshoot on a counting number.** Overshoot paints a number that is not true for several frames ([overshoot](../rules/overshoot.md)).

## The failure-modes catalog: name the smell, then the fix

- **Effect soup** (the primary failure): a different look, shader or 3D toy every beat, so the film is a demo reel and the eye never rests. Effects are seasoning ([no-tells](../rules/no-tells.md)). Reserve them for the hero reveal, an act break, the CTA. Bolding every word is bolding none.
- **Slideshow**: every beat is a card that animates once and freezes, cut and replace. Carry one or two elements across the cut (a headline shrinks into the next label, a card moves and is not replaced) ([thread](../rules/thread.md)).
- **The white flash**: a moving cut or a fading background reveals a light page behind dark content. Match the ground to the content, and never fade a full-bleed background out ([ground-jump-cover](../rules/ground-jump-cover.md)).
- **The monotone**: every entrance is the same duration. It reads as a machine narrating. Timing is a voice ([speed-bands](../rules/speed-bands.md)).
- **The chord that should be an arpeggio**, and the reverse: a group that all lands at once, or a stagger too wide ([stagger](../rules/stagger.md)).
- **Cheap aliveness**: something loops or breathes near text being read. Stillness with one part moving slowly, or one slow camera ease, is honest "alive"; a slow camera ease over each shot is the house default ([constant-camera](../rules/constant-camera.md)).
- **The invisible effect**: a displacement wash on smooth material, a glow on dark content, a blinds slat nobody can perceive ([legible-effect](../rules/legible-effect.md)).
- **The unearned claim**: copy says "26 looks" and 26 looks do not appear ([claim-backed](../rules/claim-backed.md)).
- **Centred everything**: one size, everything centred, a generic face, a blue to purple gradient. Asymmetry over centred; one huge hero and one tiny caption; a committed non-generic face; one accent hue ([asymmetry](../rules/asymmetry.md), [typeface-default](../rules/typeface-default.md), [no-tells](../rules/no-tells.md)).
- **The dead final frame**: the CTA fades out, or the last word sits over an emptied plate. Do not fade the payoff, and do not freeze it either ([moving-tail](../rules/moving-tail.md)).
- **The stray dot and the cut letters**: a mark that does not ride its parent, a reveal mask that slices descenders ([mark-rides-parent](../rules/mark-rides-parent.md), [reveal-mask-pad](../rules/reveal-mask-pad.md)).

## Restraint: an effect must be earned

A shader transition or a strong look is for two or three moments: the hero reveal, an act break, the
CTA, a music punctuation. Everything else is a hard cut on the beat ([hard-cut-default](../rules/hard-cut-default.md)).

| the beat's role | reach for |
|---|---|
| hero reveal, act break, CTA, the one "wow" | a special transition, look or 3D moment |
| connective tissue, rapid-fire, fast pacing | a hard cut, nothing else |
| a held, readable beat | one part moving (typing, a counter, a glint), the camera at rest ([live-hold](../rules/live-hold.md)) |

One cut family per film. One accent hue. Mixing whip and iris in one piece, or a new look every beat,
is five fonts on a slide ([hard-cut-default](../rules/hard-cut-default.md)).

The budget flexes with the register ([motion-craft.md](motion-craft.md#registers-restraint-depends-on-the-film)): quiet (UI-adjacent, explainer) treats
motion as a cost the viewer pays, so one loud moment against a calm field is right. Kinetic (launch,
sting, hype) makes sustained motion the content, so a still beat is the cost.

## Continuity: one continuous film

- Shared elements travel. The strongest "directed" signal is one persistent element that repositions and
  resizes across beats, not two layers that cut and replace. The headline becomes the label. The card
  slides to its next mark.
- Match the seam: match direction and speed on both sides. Pair exits with entrances by direction, never
  enter-and-retreat ([paired-exit-direction](../rules/paired-exit-direction.md)).
- Cover a hard ground jump (dark to light) with an effect that peaks at the cut. Leave same-ground cuts raw.

## Every beat declares its feeling

A beat that cannot say what it does to the viewer is decoration ([beat-earns-time](../rules/beat-earns-time.md)).
In the brief, every beat states a persuasion move (`pain agitation`, `negative contrast`, `future pacing`,
`social proof`, `risk reversal`, `inevitability`) and a feeling arc (`anxiety to relief`, `aspiration to
trust`, `curiosity to payoff`). A beat with neither is a frame occupying time: cut it. The role table is
in [story.md](story.md).

Nothing checks these rules by machine except `bin/vawe check page-check` and `anim-traps`. Whether it
feels right is judged by an eye: yours, then a fresh critic's (`guides/SUBAGENTS.md`).
