---
id: text-contrast
step: look
principle: A headline sits on a flat patch, not a moving blob or a gradient hot spot. Measure contrast on the rendered pixels where the text holds.
limit: contrast at least 3:1 for large text (24 px and up, or 18.7 px bold), 4.5:1 for body
range: aim for about 7:1 on headlines: motion, grain and compression erode contrast
break-when: never
instead: keep drifting background elements off any text during its hold, or park the text over a flat part of the field.
print-frames: set a headline on a flat patch with 3:1 contrast for large text and 4.5:1 for body, not on a moving blob or gradient hot spot
check: text-contrast
judge: Where text holds, is the ground behind it flat and the contrast above the floor?
prevents: doc text-on-flat: a patch that passed at frame one can fail by frame thirty as a blob drifts under the headline.
status: active
scored: no
numbers: {"large_ratio":3,"body_ratio":4.5,"aim_ratio":7}
craft: color
---

## Example

A white headline on a flat ink ground at 15:1.

Why and sources: [color](../craft/color.md).
