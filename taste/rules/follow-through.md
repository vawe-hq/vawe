---
id: follow-through
step: motion
principle: A trailing property finishes after the main one: scale after position, a shadow after its card. Followed motion reads as weight.
limit: none
range: delay the trailing property 0.05 to 0.15 s; a child lags its parent 1 to 3 frames
break-when: rigid things: a card that drags reads as jelly
instead: when the trailing thing is a separate element, delay it as its own move. Stagger is not follow-through: stagger delays siblings.
more-motion: finish a trailing property 0.05 to 0.15 s after the main one (scale after position, shadow after card), not everything ending on one frame
check: follow-through
judge: Do all properties of one element stop on one frame?
prevents: doc MOTION-CRAFT: a card whose every property stops on one frame reads as a slide changing.
status: active
scored: no
numbers: {"trail_min_s":0.05,"trail_max_s":0.15,"end_spread_max_s":0.017}
craft: motion-craft
---

## Example

The card lands at 0.6 s, its rotation settles at 0.7 s.

Why and sources: [motion-craft](../craft/motion-craft.md).

Draft check: follow-through reads the animation records. An element with an entrance of two or more properties whose animations all end within one frame at 60 fps (0.017 s) fires, once for the film. A scripted page, read from boxes, is not measured. There is no reference measure of property end times (the reference films are mp4 files); the one frame is the rule's own meaning of "on one frame". enter() passes: its fade ends at 40% of the move.
