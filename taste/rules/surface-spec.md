---
id: surface-spec
step: look
principle: Lock a bespoke surface in one page of tokens before authoring, then check the frame against it.
limit: none
range: tokens: colours, 1 to 3 faces at measured weights, radius scale, border hairline, shadows, spacing rhythm, motion character, components
break-when: a one-off fragment with no reuse
instead: build a reusable surface standalone first (`bin/vawe frame <page> --at t` renders one frame in seconds); glass needs a moving gradient behind it. Check: every colour is in the palette, families and weights match with no silent swap, radii match the scale, no forbidden component appears.
check: judge
judge: Does every colour, face, radius and shadow in the frame match the declared spec?
prevents: doc SURFACES.md: a face was swapped silently more than once; glass over nothing has no blur to work on.
status: active
scored: no
numbers: {}
craft: surfaces
---

## Example

Spec: radius 12, border 1.5 px at 14 percent white, shadow none.

Why and sources: [surfaces](../craft/surfaces.md).
