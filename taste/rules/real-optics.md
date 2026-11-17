---
id: real-optics
step: look
principle: Lens, blur, bloom, fringe and depth of field are real optics the renderer draws (the lens surface), never a CSS filter or a gradient that imitates one.
limit: none
range: none
break-when: the brief asks for a flat graphic look, not a photographic one
instead: use the lens surface (prompts/moves/lens.md) for bloom, fringe, focus and flares; a CSS blur or radial gradient is not a lens.
more-frames: draw bloom, fringe, focus and flares with the lens surface, not a CSS blur or radial gradient that imitates one
check: judge
judge: Is every optical effect a real lens effect, or a CSS fake (blur filter, radial gradient glow, offset copy)?
prevents: owner rule, 2026-10-10: optical effects are real (lens), never CSS fakes.
status: active
scored: no
numbers: {}
digest: Lens, blur, bloom and fringe are real optics (the lens surface), never a CSS fake.
craft: motion-craft
---

## Example

A film that wants bloom and chromatic fringe sets them on the lens surface and measures them with `vawe see`, not with a text-shadow and an offset copy.
