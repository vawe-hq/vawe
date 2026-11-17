---
id: blur-follows-motion
step: motion
principle: Blur follows motion: a still thing never blurs. A velocity-derived streak sells speed on fast moves.
limit: none
range: skip it on slow drifts and on small body text held mid-move; blur-resolve entrance from about 24 px to 0 over about 0.4 s
break-when: never
instead: real motion blur makes a word illegible: for type echo the glyph outline in a second colour under the type. A blurred still looks fast; a half-opacity still looks broken.
print-motion: blur only what moves fast and echo the glyph outline for type, not a blurred still
check: judge
judge: Does any resting element carry a blur?
prevents: doc MOTION-CRAFT and GRAMMAR: blur dissolves small text held mid-move.
status: active
scored: no
numbers: {}
craft: motion-craft
---

## Example

Type arrives at 24 px blur and resolves in 0.4 s.

Why and sources: [motion-craft](../craft/motion-craft.md).
