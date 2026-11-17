---
id: shared-edges
step: look
principle: Text blocks in one frame share a few left edges. Each extra edge is a decision the eye must re-read.
limit: no frame with more than three distinct left edges among left-aligned text blocks
range: at most 3 distinct left x values per frame, within 4 px at 1920 wide; a block centred on the frame is not a left edge
break-when: a scattered layout is the idea and the brief says so
instead: snap the blocks to one margin and one indent; centre a lone title instead of nudging it.
more-frames: snap text blocks to at most three left edges in one frame, not a new edge for each block
check: left-edges
judge: Do the text blocks line up on a few edges, or does each one start somewhere new?
prevents: research harnesses 26 (Swiss style, Refactoring UI): shared edges, at most 3 distinct left x values per frame.
status: active
scored: no
numbers: {"left_edges_max":3,"edge_tol_px_1920":4}
craft: layout
---

## Example

Headline, support line and label all start at x = 134 px.

Why and sources: [layout](../craft/layout.md).

Draft check: The draft check skips text on a card, a panel or a button (product UI) and text that does not hold still for 0.5 s.
