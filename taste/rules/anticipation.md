---
id: anticipation
step: motion
principle: A small opposite wind-up readies the eye before a hero move. Use it on hero moments only.
limit: none
range: a scale dip of 2 to 4 percent for about 4 frames; or a counter-move of 10 to 20 percent of the travel, then the main move with no hold
break-when: informational motion and anything the viewer already looks at
instead: a heavy object anticipates longer.
more-motion: give a hero move a small opposite wind-up (2 to 4 percent dip), not an anticipation on every move
check: anticipation
judge: Is anticipation on a hero move only?
prevents: doc DIRECTION and AE techniques: wind-up on every move reads as wobble.
status: active
scored: no
numbers: {"dip_pct_min":2,"dip_pct_max":4,"counter_travel_pct_min":10,"counter_travel_pct_max":20,"counter_floor_pct":2,"reveal_from_share":0.25,"atmosphere_share":0.4}
craft: after-effects-techniques
---

## Example

The hero dips 3 percent, then scales up.

Why and sources: [after-effects-techniques](../craft/after-effects-techniques.md).

Draft check: anticipation looks at the one move near `<meta name="spectacle">` (the strongest run within 0.75 s of it). It passes with a counter-move of 2 to 20 percent of the travel against the direction, or a size dip of 2 percent or more before it grows. Nothing else is checked: a wind-up on every move reads as wobble. If the strongest move grows from under a quarter of its size (a bloom, a ripple), or its box covers 40 percent of the frame or more (a light, a ground, a camera), it carries no weight and is not asked. This keeps films/examples/colour-sting quiet: its spectacle is a 1087 px glow, 57 percent of the frame. Both numbers are chosen to clear that film; the reference mp4 files have no element boxes. `enter(el, { anticipate: 0.12 })` adds the counter-move in one call (core/motion/presets.js). The 2 percent floor is the lowest the sampled boxes can tell from noise at 25 samples a second.
