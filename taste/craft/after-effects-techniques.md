---
when: "you want the named procedure a motion designer would reach for, its dials, and the mistake it prevents"
answers: "motion-design recipes with the numbers practitioners state · when each one is wrong · the step nobody guesses · how to write it in HTML, CSS, Web Animations or canvas"
group: reference
---

# Motion recipes: the named procedures and their dials

Contents:
- [Timing and shape](#timing-and-shape)
- [Blur, light, camera](#blur-light-camera)
- [Type](#type)
- [Fields, loops and surfaces](#fields-loops-and-surfaces)
- [The velocity-hidden cut](#the-velocity-hidden-cut)
- [Sources](#sources)

A motion designer carries recipes, not effects: an ordered procedure with a name and numbers people
argue about. `overshoot` is "pass the target by this much and settle back over that long".

`[eye]`: a reference, not a gate. Every number is one practitioner's setting from a tutorial or a
video (source named where it matters). Use it as a place to start, never as a target.

Write every recipe in what you know: `element.animate()` with an easing, a `window.seek(t)` pure
function, `springLinear` from `core/motion/springs.js` (`core/motion/README.md`), SVG, canvas.

## Timing and shape

**Slow in, slow out.** Nothing real starts or stops at full speed. Easy Ease is influence 33 % both
sides; practitioners push the outgoing handle to 75 % for a snappier landing. Entrances decelerate,
exits accelerate. A tracking camera or a scrolling surface wants `linear`: an eased pan reads as a lurch.
Peak slope as a multiple of average speed: Easy Ease 1.5x, `easeInOutCubic` 3x, influence 75 both sides
4x. A default cubic is already steeper than a mild "ramp", so naming a softer curve makes a move softer.
(Source: motiondesign.school keyframe velocity; Emil Kowalski review-animations STANDARDS.)

**Stagger.** The film gap and the total cap are in [stagger](../rules/stagger.md); practitioners use a
slightly wider gap for a page-load sequence, and a gap that is too wide reads as sluggish. Past about seven
items a wave becomes a queue: stagger a few and bring the rest as one block. Direction is a decision:
top-down, left-right, or from the centre. Stagger makes a rate readable: one element with a slow and a fast lobe looks like an odd loop;
seven staggered copies read as a wave.

**Overshoot.** Each oscillation is shorter and smaller than the last. By keyframes for scale:
120, 90, 105, 97.5, 101.25, 100. By spring: a small bounce is felt once, a large one is a toy. The film default is no overshoot on type or UI
([overshoot](../rules/overshoot.md)): EASE.pop is for a press or a pop the page names. Overshoot is
a decaying sine at constant frequency. A bounce is parabolas whose frequency rises as energy drains
(Ebberts: elasticity 0.7, gravity 5000, up to 9 bounces). Wrong for dense grids and anything read at once.

**Anticipation.** A counter-move of 10 to 20 % of the travel, 2 to 4 frames at 24 fps, followed at once by
the main move with no hold. A heavy object anticipates longer. Wrong where the viewer already looks and on
anything informational.

**Follow-through.** The trailing part starts 1 to 3 frames late and stops later. Ebberts' inertial bounce:
amp 0.05, freq 4, decay 8. Wrong for rigid things: a card that drags reads as jelly. Stagger is not
follow-through: stagger delays siblings, follow-through makes a child lag a parent's continuous motion.

**Arcs.** Bow a straight travel 10 to 20 % of its length. Wrong for UI motion and for travel under about
100 px.

**Hold.** Never freeze a settled pose, and a slow scale or position ease on the stage (under 400 px/s) is a camera move and counts as life (rule [live-hold](../rules/live-hold.md)). Or give the hold an element motion on a part (type a line, tick a counter, pass a glint, blink a caret). Wrong on precise data: a chart whose bars drift lies.

**Animate on twos.** Step the clock at 12 fps in a 24 fps film (15 fps on twos and 10 fps on threes at
30 fps). Works on line work and character-ish motion, wrong on camera moves. The stepped thing must be
the subject.

**Speed ramp.** The clock accelerates, not a property: normal, 400 to 800 %, normal, eased at all three.
Wrong on synchronised material: the picture drifts from the sound.

## Blur, light, camera

**Motion blur.** Shutter 180 degrees is half the frame time; 360 doubles the smear, 90 halves it. Drop it
on a fast headline that must be read. Blur follows motion: a still thing never blurs.

**Camera shake.** Rejected as a default: the camera holds still unless the beat earns a move (rule [constant-camera](../rules/constant-camera.md)), and a CSS offset of the frame is a fake of a camera. When a brief asks for an impact shake: a hard offset ringing down over 6 to 10 frames, the layer scaled up 102 to 110 % so the frame edge hides, one per film.

**Whip pan.** A 10-frame window across the cut: directional blur peaking at the midpoint, tile
mirrored. The outgoing half accelerates, the incoming half decelerates, so the halves are not mirrors.
Wrong across different backgrounds: the smear shows the seam.

**Rack focus.** Two CSS blurs and a dim are a uniform blur with no depth: the rejected fake. A real focus pull is lens work, the `dof` option with a `focus` that follows the target ([lens](../../prompts/moves/lens.md), `core/surfaces/lens.js`). Wrong with one subject.

**2.5D parallax.** Three to five planes over Z -500 to +1500 with a 40 to 120 px truck. Move the camera,
not the layers, and rescale each plane by `1 + z / cameraZ` so its size holds. Wrong under three planes
and on small type.

**Light sweep.** A bar of CSS gradient on `screen` is a fake of light and a stock device (rule [no-tells](../rules/no-tells.md)). If the brief wants a sheen, make it once per film, on a mark, never on a paragraph; for bloom or a lit surface use the lens ([lens](../../prompts/moves/lens.md)).

**Light rig.** Light is lens work, not a CSS gradient. One light that directs the eye and doubles as the matte: the text is revealed by the light,
so where to look and what is legible are one decision. Two blur centres offset in Y give the glow volume.
One null owns the light position: never write it in two places. Dim to zero across the word change.

## Type

**Kinetic type.** One idea per hold. The hold is set by [readable-hold](../rules/readable-hold.md).
Emphasise with scale contrast, not colour. A film of pure kinetic type is still a film of type
([show-dont-tell.md](show-dont-tell.md)).

**Range-selector shape, smoothness 0.** Animate only the selector offset, never the properties.
Smoothness 0 makes each glyph swap instead of interpolate: it is the difference between a glyph that scales
away and one that vanishes, and it is not an easing. Duplicate the animator at amount 50 % with a new seed
so two populations of glyphs behave differently in one line. In HTML: per-glyph `animation-delay` from a
falloff, steps easing.

**Variable-font axis.** Animate `font-variation-settings: "wght"` with a crest travelling the line, per
glyph. It is the one text register a static face cannot fake.

**Font morph by tracking.** Two faces set the same word at two widths. Letter-space everything apart
during the swap (tracking 0 to 30 and back) and give each face its own tracking value so the widths match:
the shift hides inside a motion that reads as intended. Cut the copies with scale 0, smoothness 0.

**Write-on.** Stroke reveal with `pathLength="1"` and `stroke-dashoffset`. Long copy is wrong: past about
six words the viewer waits.

**Masked reveal.** A hard-edged clip over 10 to 14 frames, with the type rising 10 to 20 px while
uncovered. Feather 0 for editorial. Wrong over a busy photograph.

**Stylised trail for type.** Real motion blur makes a word illegible. Echo the glyph outline back in time
(60 echoes, -0.003 s, decay 0.95) and roughen the echo edge, in a second colour under the type. The matte
must be taken after the choker runs, not from the layer source, or the outline is never produced and every
value looks right while the result is wrong.

## Fields, loops and surfaces

**Broken loop.** Put the interior key on the loop's clock, not its geometry. Changing the rate keeps the
cycle and kills the screensaver feeling; changing the shape breaks the cycle. Add one bezier key to the
phase so the loop has a slow lobe and a fast lobe.

**Effector.** One moving point with a falloff radius drives many clones. Each clone reads its distance to
the point and offsets position, scale, rotation or colour in proportion. Nobody keys a clone. A stagger
expresses order in one dimension; a falloff expresses distance in two, so the same rig gives a wave, a
ripple or a brush stroke by changing only the point's path. Overshoot keeps each clone moving after the
point passes; a 1 s sticky delay turns the pass into a trail. In `seek(t)`, compute the distance per
element each frame.

**Counter-rotation.** A parent rotates its children, so words and photos turn upside down at the bottom of
the circle and the layout stops being readable at the motion peak. Cancel the parent rotation on each child
(`rotate: calc(-1 * parent)`): position travels, orientation holds. Rotation only, not scale.

**Grain keyed to a layer's alpha edge.** Push the edge-roughen border far past the plausible value (200 to
350): it stops being an edge and becomes a gradient of noise across the shape. Stack three or four in
different colours and widths so the grain reads as depth. Frame-wide grain stays the default; hold a
grain pattern 2 frames, since per-frame grain crawls on static type.

**Blob gradient.** Four ellipses with gradient fills in brand colours, matched easing, then a small box
blur and a very large directional blur (about 500, an order of magnitude past normal). The direction smears
the ellipses into one field; a large isotropic blur only gives four soft ellipses. Key the blur up from
zero so the film opens on discrete drops that become the gradient.

**Trim-paths bar growth.** Length is the number. Key end 0 to 100 % over 15 to 25 frames, strong ease-out;
start a ring at 12 o'clock with offset -90; anchor a filled bar at its base. Stagger a row 3 to 5 frames.
The number counts on the same curve as the bar so they land together.

**Counter roll-up.** 0.8 to 1.4 s, the last 30 % of the time covers the last 5 % of the count. An odometer
rolls each digit column, right columns faster. Wrong for small numbers: counting to 7 is a stunt.

**Match cut on shape.** Align the two silhouettes' centres and boxes to a few pixels and match rotation
before cutting. 20 px apart reads as a jump. Overlap 1 to 2 frames to hide a residual gap. Wrong when the
two things are unrelated: a graphic match asserts that A is B.

**Shape morph.** Both paths need the same vertex count, order and direction. Vertices travel in straight
lines, so give the ugly route its own arcs. 12 to 20 frames, strong ease-out. Wrong across different
topology: cut instead.

**Luma matte.** White shows, black hides. Animate the matte, not the content; blur a ramp 20 to 60 px for
the edge. Use it when a plain wipe will not do.

**Screen dive.** The UI as a flat layer, a push of 1.0 to 1.4 over 1.5 to 2.5 s, ending on the element the
copy names. A fake UI is spotted at once (`AGENTS.md`: a capture of the real thing, or nothing).

## The velocity-hidden cut

The swap is a hard cut and nothing about it animates. The move that hides it is on a shared parent (the
camera, or one wrapper around both shots) and runs straight through the seam.

1. Put both shots under one parent and animate one transform across the seam with a single curve.
2. Ease both keys, then make the curve flat at both ends and near vertical in the middle.
3. Cut on the frame where the curve is steepest, not on a round second and not where the copy ends.
4. Hand the velocity shape to the next shot's own property so it decelerates out of the cut.

The step nobody guesses: read the speed graph to find the frame. The eye cannot resolve a join at peak
velocity. Most authors ease the move and then cut on a beat, which puts the seam where the motion is
slowest. Pan, do not zoom, when the subject is centred: a zoom has zero displacement at the centre, where
the copy sits. Let the pan smear (blur from the velocity relative to the camera). Matching speed across the
cut is arithmetic you do: `speed: 3` on both sides hands over the same shape, not the same degrees per second.
(Source: Stephan Zammit, youtube.com/@stephanzammit, "kinetic cut", youtu.be/daa5hKgo0Tw. The name is his;
"kinetic editing" and "cutting on action" mean other things.)

## Sources

motiondesign.school (keyframe velocity), motionscript.com (Ebberts overshoot and bounce), School of Motion
(wiggle, camera shake), Richard Williams, The Animator's Survival Kit (offset, holds), provideocoalition.com
(shutter, whip pan), Stephan Zammit (velocity-hidden cut, effector, broken loop, font morph).
