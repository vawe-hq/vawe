---
id: living-ground
step: look
principle: A ground has depth. Soft colour, light or texture sits behind the content. One flat colour behind one element is a slide, not a frame.
limit: no more than half of the frames show one flat ground
range: a gradient, a blurred colour blob, an image or a canvas layer over at least 15 percent of the frame that differs from the ground behind it by at least 6 percent of the colour range; the reference films show a glow, a blob or a camera on most frames
break-when: a flat ground is the idea (a stark payoff or a title card): declare living-ground in the page with a reason
instead: put two or three large soft blobs, clearly lighter or more saturated than the ground, behind the content: the Grounds moves in prompts/moves/README.md (gradient-mesh-field, aurora-drift, light-pool, grain-field). Keep the text on a calm part of the blob. Shader and noise sources and their licences: resources/README.md. The ground is a field behind the content: it does not need to move, and a ground drift is never what keeps a hold alive (rule live-hold). Light that should read as a lens effect (bloom, flare, a pool of light on a screen) is real lens work (prompts/moves/lens.md), not a CSS gradient.
check: living-ground
judge: Is there a frame with one element on one flat colour and nothing behind it?
prevents: the side-by-side judge lost our film on craft to Raycast and Linear twice: "Raycast's pink light that blooms on black gives depth and glow; our grounds are flat warm fields", "most of our frames are one element on a flat ground".
status: active
scored: no
numbers: {"ground_layer_area_pct_min":15,"flat_samples_share_max_pct":50,"ground_layer_strength_min":0.06}
print-frames: put soft colour blobs behind the content, not one flat fill
digest: A ground is never one flat fill: soft blobs or a real field behind it.
craft: color
---

## Example

Wrong: a warm field with one headline. Right: the same field with two blurred blobs behind the headline.

Draft check: The layout read counts a gradient or image background (also on a `::before` or `::after`), a blur filter, an image, a video or a canvas as a layer. It names every flat frame, and adds the limit when they pass it. SVG is not read. A frame is flat when the layers that paint cover under 15 percent of it. A layer paints when its colour stops differ from the ground by 6 percent of the range (harness/lib/ground-paint.mjs): grain, a blend-mode overlay, a tiled noise image, a faint gradient and an empty canvas are texture and do not count. `bin/vawe frame --world all` reads one frame per world; the draft reads its layout samples.

Why and sources: [color](../craft/color.md).
