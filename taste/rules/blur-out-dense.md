---
id: blur-out-dense
step: motion
principle: Faces, cards and dense grids leave through focus, not through space. Sliding many elements at once reads as chaos.
limit: none
range: animate filter: blur() with opacity during the exit only
break-when: a single simple shape may still slide
instead: blur out and fade; the blur runs only during the exit itself.
more-motion: blur out and fade faces, cards and dense grids on exit, not a slide of many elements at once
check: judge
judge: Does a dense layer slide out as one block of motion?
prevents: doc blur-out-dense and DIRECTION: sliding 50 elements is chaos.
status: active
scored: no
numbers: {}
craft: direction
---

## Example

A 12 card grid blurs and fades in 0.25 s.

Why and sources: [direction](../craft/direction.md).
