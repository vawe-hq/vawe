---
id: image-source-order
step: look
principle: Use the lightest visual that carries the meaning, and take it from the best source.
limit: none
range: ladder, lightest first: nothing or a solid field, a gradient, a generated card, a captured real UI, an illustration, a photo. Sources in order: a real UI capture, free openly licensed images, drawn icons and inline SVG, generated images, emoji
break-when: emoji at hero scale as a deliberate subject
instead: a clean gradient beats a mismatched photo; if a beat reads fine on a plain field, add no image. Generated images get the same treatment and grade as any other.
more-frames: use the lightest visual that carries the meaning, a clean gradient before a photo, not an image on a beat that reads fine on a plain field
check: judge
judge: Where did each image come from, and what does it add over a plain field?
prevents: doc IMAGERY.md: an untreated stock photo is worse than none. A bare `curl -o` of a removed Simple Icons mark left a zero-byte svg that rendered as an invisible hole: fetch with `curl -f`.
status: active
scored: no
numbers: {}
craft: imagery
---

## Example

A captured settings screen instead of a stock photo of a laptop.

Why and sources: [imagery](../craft/imagery.md).
