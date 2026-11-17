---
id: constant-camera
step: motion
principle: The camera holds still by default and moves only with a reason: the spectacle, a reveal. A hold stays alive through a part that moves inside the frame, not through a camera drift on every beat.
limit: the camera moves for 60 percent of the film or less, and for 4 worlds in a row at most
range: one deliberate camera move at the spectacle second (it is not counted); the reference films move the camera for a median 36 percent of their time, p90 95
break-when: a film built as one continuous shot (a tracking move through a space) the brief names
instead: hold the camera still and give the hold an element motion: a line typing, a counter, a glint, a secondary action. Keep camera() for the spectacle or a reveal.
more-motion: hold the camera still and give the hold an element motion, moving it for at most 60 percent of the film and 4 worlds in a row, not a drift on every beat
check: constant-camera
judge: Does the camera move in every beat, or only where the film earns it?
prevents: agents satisfied live-hold the lazy way, with a slow camera drift on every hold, so every film had a constantly moving camera (owner, 2026-10-10).
status: active
scored: no
numbers: {"share_max_pct":60,"worlds_max":4,"move_min_s":0.6,"still_min_s":0.3}
digest: The camera holds still; one move at the spectacle at most. A part moving inside the frame keeps a hold alive.
craft: motion-craft
---

## Example

A 20 s film holds the camera in every world and pushes in once on the spectacle at 14 s. The type line in world 3 types out while the camera rests.

Draft check: reads the whole-frame transforms from the animations (camera(), or a scale, translate or rotate on an element that covers 60 percent of the frame, for 0.6 s or more). A move that holds the spectacle second is left out. It fires over 60 percent of the film, or over 4 worlds in a row with a move over half of each.

Numbers and source: 60 percent is about p75 of the camera-moving share of film time in the 19 in-scope reference films (spec.json camera block of each shot, a zoom of 2 percent or a pan of 8 px counts as moving; median 0.36, p75 0.63, p90 0.95; shares of 0, 0, 0, 0, 0, .03, .11, .26, .35, .36, .48, .53, .53, .59, .67, .91, .94, .99, 1). 4 worlds is the p90 of the longest run of consecutive moving shots (median 2, p90 4). The references are generous with the camera, so the bar is conservative: it catches a camera that never rests, not a film that uses one. A reference film measures every shot's own camera; ours measures what the page animates.
