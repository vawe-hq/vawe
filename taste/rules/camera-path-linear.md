---
id: camera-path-linear
step: transitions
principle: A camera flight through one space replaces the cut. Constant speed on interior legs; ease at the ends.
limit: none
range: linear on interior legs of a multi-key path (keys()); eased start and stop; give layers different depths or the flight reads as a slide
break-when: the beats are unrelated claims: use cuts
instead: an eased curve at each stop zeroes velocity and breaks one flight into N hops: compute the tangent at a waypoint key from its neighbours. Each station has a centre, a zoom, a flight time and a dwell.
print-storyboard: fly the camera through one space at constant speed on interior legs and ease only at the ends, not an eased stop at every waypoint
check: none
judge: Does the flight read as one movement, or hops?
prevents: doc TRANSITIONS and MOTION-CRAFT: three keys read as two moves with a full stop between.
status: active
scored: no
numbers: {}
craft: transitions
---

## Example

Four stations on one canvas; one camera, one path.

Why and sources: [transitions](../craft/transitions.md).
