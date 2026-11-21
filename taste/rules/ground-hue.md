---
id: ground-hue
step: look
principle: One tinted near-black ground with one key light and one strong hue is the default, and one hue family across the film is fine. The check only compares with a reference the brief names: where that reference turns its ground and ours stays in one family, the draft says so.
limit: three or more shots whose ground stays within one 40 degree hue family
range: the reference films change the ground at about half of their cuts; a ground that turns is a new hue, a new value or a new light, not the same hue made lighter or darker
break-when: one colour world is the idea (a mono film): declare ground-hue in the page with a reason that names the hue degrees and the seconds
instead: when a named reference turns its ground and the film should too, give two or more worlds a ground in another hue family, taken from the palette. Otherwise keep the one family. The reference's own changes are in the line the draft prints (bin/vawe refs frames <id> shows its palette per shot).
more-frames: keep one tinted near-black ground with one key light, not a ground that flips light and dark on every cut
check: ground-hue
judge: Only when the brief names a reference: does it turn its ground where ours stays in one hue family?
prevents: colour scored 6 or 7 in four films (crave, moths, moths-3d, flower) with "one blue-grey scale" or "one red ramp" while the references turn the ground.
status: active
scored: no
numbers: {"hue_span_deg_max":40,"chroma_min":6,"shots_min":3}
digest: Default ground: tinted near-black, one key light, one strong hue.
craft: color
---

## Example

Wrong: six worlds on blue-grey grounds from L 18 to L 64. Right: two of the six worlds on a warm or green ground from the palette.

Draft check: `bin/vawe dev` reads the ground of every world (the median colour of the frame edge, the measure that read the reference films) and prints one line when three or more worlds stay within 40 degrees of hue. A ground with Lab chroma under 6 is neutral and has no hue, so a film that mixes neutral and tinted grounds is not flagged. When the brief names a reference, the line adds where that reference turns its ground. Advice only.

Why and sources: [color](../craft/color.md).
