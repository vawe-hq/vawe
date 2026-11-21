---
id: world-turns
step: look
principle: The world (ground, palette, composition) turns at each beat, about every 4 to 6 s; a beat holds one slow camera ease. Tone changes per beat; the backdrop is always a decision, never a default.
limit: at most 8 near-identical tiles in a row on the 5 fps sheet, at most 4 at the tail; no data-world element visible longer than 7 s; adjacent worlds with the same ground and the same words are one world
range: a scene of 4 to 6 s; a new element, a cut or a ground swap at each scene
break-when: a declared hold (world-held@a-b, tile-run@a-b waiver with a reason) for a held wordmark or a camera-travel film whose subject never stops moving
instead: start a new data-world with a new object and words at each beat, 4 to 6 s apart; a world past 7 s needs a cut (taste/craft/film-structure.md). Change the ground at a cut the film already has; carry the change across the join (a colour that follows the content), never a cold flash. Judge a moving backdrop at 4 or more timestamps, never one still. A ruled grid is a design tool's canvas: use it only if you can say what it does in one clause.
check: world-held
judge: The turns are the page's data-world spans, a new world is a turn even on the same ground. Count identical adjacent tiles on the sheet. Does each world last 7 s or less?
prevents: feedback: "the world should turn every 1-2 beats; 7 beats on one colour field are events, not scenes". vawe-sting: cobalt held 2.3 to 5.0 s. judge1: static 1.1 s tail. judge2: 1.4 s static lockup. ref: ground inverts at 5.5, 7.7, 19.3, 21.3 s; a new word cuts in every 0.5 to 1.5 s. 82 percent of 135 library scenes painted one backdrop for the whole runtime.
status: active
scored: yes
numbers: {"scene_seconds":5,"turn_seconds_max":7,"run_tiles_max":8,"tail_tiles_max":4,"sheet_fps":5,"near_identical_diff":4.5,"blank_run_s":0.3,"blank_edge_s":0.5,"blank_grid_span_max":0.06,"blank_grain_spread":0.06}
print-storyboard: turn the world every 4 to 6 s (a new element, a cut, a ground swap), not one lockup held
craft: film-structure
---

## Example

Right: cobalt ground to paper ground at 1.8 s, a new word at 2.6 s. Wrong: one colour field with one lockup from 2.3 s to 5.0 s.

Why and sources: [film-structure](../craft/film-structure.md#the-motion-grammar-ten-patterns-that-recur).
