---
id: ground-hue
step: look
principle: The ground turns across the film. One hue family on every ground, even with the light and dark changing, reads as one scale and scores low on colour.
limit: three or more shots whose ground stays within one 40 degree hue family
range: the reference films change the ground at about half of their cuts; a ground that turns is a new hue, a new value or a new light, not the same hue made lighter or darker
break-when: one colour world is the idea (a mono film): declare ground-hue in the page with a reason that names the hue degrees and the seconds
instead: give two or more worlds a ground in another hue family, taken from the palette, and let the accent carry the thread. The reference's own changes are in the line the draft prints (bin/vawe refs frames <id> shows its palette per shot).
print-frames: turn the ground to a second hue family from the palette in two or more worlds, not three shots within a 40 degree hue span
check: ground-hue
judge: Does the ground only get lighter and darker in one hue, while the references turn it?
prevents: colour scored 6 or 7 in four films (crave, moths, moths-3d, flower) with "one blue-grey scale" or "one red ramp" while the references turn the ground.
status: active
scored: no
numbers: {"hue_span_deg_max":40,"chroma_min":6,"shots_min":3}
digest: Turn the ground across the film: some worlds take a new hue.
craft: color
---

## Example

Wrong: six worlds on blue-grey grounds from L 18 to L 64. Right: two of the six worlds on a warm or green ground from the palette.

Draft check: `bin/vawe dev` reads the ground of every world (the median colour of the frame edge, the measure that read the reference films) and prints one line when three or more worlds stay within 40 degrees of hue. A ground with Lab chroma under 6 is neutral and has no hue, so a film that mixes neutral and tinted grounds is not flagged. When the brief names a reference, the line adds where that reference turns its ground. Advice only.

Why and sources: [color](../craft/color.md).
