---
id: constant-camera
step: motion
principle: One slow camera ease per shot is the house default. The check runs only when DESIGN.md says `camera: still`: then the camera moves only with a reason, the spectacle or a reveal, and a hold stays alive through a part that moves inside the frame.
limit: the camera moves for 60 percent of the film or less, and for 4 worlds in a row at most
range: one deliberate camera move at the spectacle second (it is not counted); the reference films move the camera for a median 36 percent of their time, p90 95
break-when: a film built as one continuous shot (a tracking move through a space) the brief names
instead: for a film declared still, give the hold an element motion: a line typing, a counter, a glint, a secondary action. Keep camera() for the spectacle or a reveal. Otherwise one slow ease per shot is fine.
more-motion: ease the camera once per shot, not on every beat of a film declared `camera: still` (at most 60 percent of the film and 4 worlds in a row)
check: constant-camera
judge: Only for a film declared `camera: still`: does the camera move in every beat, or only where the film earns it?
prevents: agents satisfied live-hold the lazy way, with a slow camera drift on every hold, so every film had a constantly moving camera (owner, 2026-10-10).
status: active
scored: no
numbers: {"share_max_pct":60,"worlds_max":4,"move_min_s":0.6,"slow_px_per_s":400,"still_min_s":0.3}
digest: One slow camera ease per shot is the default; `camera: still` keeps it to the spectacle.
craft: motion-craft
---

## Example

A 20 s film holds the camera in every world and pushes in once on the spectacle at 14 s. The type line in world 3 types out while the camera rests.

Draft check: reads the whole-frame transforms from the animations (camera(), or a scale, translate or rotate on an element that covers 60 percent of the frame, for 0.6 s or more). A move that holds the spectacle second is left out. It fires over 60 percent of the film, or over 4 worlds in a row with a move over half of each.

Numbers and source: 60 percent is about p75 of the camera-moving share of film time in the 19 in-scope reference films (spec.json camera block of each shot, a zoom of 2 percent or a pan of 8 px counts as moving; median 0.36, p75 0.63, p90 0.95; shares of 0, 0, 0, 0, 0, .03, .11, .26, .35, .36, .48, .53, .53, .59, .67, .91, .94, .99, 1). 4 worlds is the p90 of the longest run of consecutive moving shots (median 2, p90 4). The references are generous with the camera, so the bar is conservative: it catches a camera that never rests, not a film that uses one. A reference film measures every shot's own camera; ours measures what the page animates.
