---
id: type-scale
step: look
principle: A frame uses few text sizes, and each size step is visible. Many near sizes read as no decision.
limit: no frame with more than six distinct text sizes
range: at most 6 distinct sizes in one frame; steps at least 1.25 apart (steps under 1.2 read muddy)
break-when: a product screen shown as it is: its own type scale is the content (mark UI texture data-chrome)
instead: pick three sizes (hero, support, label) and set every text to one of them.
more-frames: use three text sizes (hero, support, label) with at most six in a frame, not many near sizes
check: type-sizes
judge: How many text sizes does the frame hold, and can you tell two neighbours apart?
prevents: research harnesses 1 (impeccable, Refactoring UI, Utopia, trydemotion): 4 to 6 sizes per family; steps 1.1 apart read as uncommitted.
status: active
scored: no
numbers: {"sizes_max":6}
craft: typography
---

## Example

Hero 140 px, support 56 px, label 28 px: three sizes.

Why and sources: [typography](../craft/typography.md).

Draft check: The draft check counts text that holds still for 0.5 s and is not data-chrome.
