---
id: one-hero-motion
step: motion
principle: One element owns the motion in a beat; the rest support quietly. One motion idea per beat, and two properties on one element make one claim.
limit: none
range: one hero motion, at most one quiet secondary motion per beat, lower contrast and offset in time
break-when: never
instead: key the hero first at its start and end pose, check the read with nothing else moving, then add secondary and ambient in decreasing loudness. Slide up plus fade is one claim "arriving"; rise plus rotate is two claims about one object: drop one.
check: staging
judge: Which element owns the motion in each beat?
prevents: doc MOTION-CRAFT and DIRECTION: two competing animations read as none; everything moving at once reads as a block, not a hierarchy.
status: active
scored: no
numbers: {"movers_min":4,"top_share_min":0.3,"simultaneous_s":0.03,"mover_floor":0.05}
craft: motion-craft
---

## Example

The card slides in (hero); its shadow settles a beat later (secondary).

Why and sources: [motion-craft](../craft/motion-craft.md).

Draft check: staging reads the move runs of the element boxes. Movers whose runs start within 0.03 s of each other are one beat; a staggered list (30 ms or more apart) is not. A beat of 4 or more movers, each moving at least 0.05 frame heights (path plus size change, as `vawe frame --moment <s> --velocity` scores a move), where the top mover holds under 30 percent of the beat's motion, fires. Five equal movers hold 20 percent; one hero among small movers holds over 50. The reference films hold a median 6 elements per shot but have no per-beat shares; 30 percent is a conservative value that equal movers cannot reach.
