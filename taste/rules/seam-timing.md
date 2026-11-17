---
id: seam-timing
step: transitions
principle: A seam is felt, not measured: round to the frame, give each type its own speed, and keep the joint full. The transition is the verb and the timing is the adverb. The outgoing beat ends at the seam and the incoming beat starts at it, so the frame never goes empty across a joint.
limit: none
range: match on action overlap 0.06 to 0.16 s; whip 0.27 to 0.40 s (fast and blurred); quick dissolve 0.40 to 0.50 s; standard slide, push or dissolve 0.50 to 1.0 s; zoom 0.50 to 0.85 s; fade to black 0.66 to 1.33 s; a handoff where one element's last pose is the next one's first runs 0.8 to 1.0 s on EASE.carry or EASE.glide (0.4 s is too fast to read as travel). Thrown seams use a ramp (slow, fast, slow); an exit rushes, an entrance brakes
break-when: a persistent morph element spans the cut
instead: write a ramp with an EASE name (carry into a cut, land out of it). Feather a wipe edge: a hard edge reads as a slide deck. A wipe can sweep at any angle. One velocity personality per film. A handoff eases at both ends: EASE.land on a handover reads as two objects. A blend of the frame before and the frame after turns copy into an unreadable double, so end the outgoing text at the seam. A full-bleed layer above a moving layer must not start mid-move and hide it: start the cover after the move ends, or raise the mover.
more-storyboard: time each seam by its type (whip 0.27 to 0.4 s, slide 0.5 to 1 s, fade 0.66 to 1.33 s) and end the outgoing text at the seam, not a double blend
check: judge
judge: Does every seam ride one gentle curve at one speed? Does a handoff read as one object moving? At each seam, is old and new copy on screen together, or is the frame empty?
prevents: doc TRANSITIONS: a film whose seams all ride one gentle curve feels repetitive however many effects it uses; a one-frame luminance dip is a flash, several frames of emptiness mean the outgoing beat left before the incoming one arrived. The old table gave frames at 30 fps; finals render at 60.
status: active
scored: no
numbers: {"whip_min_s":0.27,"whip_max_s":0.4,"dissolve_quick_min_s":0.4,"dissolve_quick_max_s":0.5,"slide_min_s":0.5,"slide_max_s":1,"fade_min_s":0.66,"fade_max_s":1.33,"handoff_min_s":0.8,"handoff_max_s":1}
craft: transitions
---

## Example

A 0.33 s whip, then a 0.8 s push. The outgoing line exits 0.1 s before the cut and the next line enters at the cut. A headline travels 0.9 s on EASE.carry into the next label.

Why and sources: [transitions](../craft/transitions.md).
