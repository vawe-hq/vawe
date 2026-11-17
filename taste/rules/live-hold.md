---
id: live-hold
step: motion
principle: A hold keeps life through a part that moves inside the frame: a line typing, a counter, a glint, a secondary action. A readable hold is good; a frozen frame is not a hold. A camera drift or push does not count, the camera holds still by default.
limit: no span longer than 0.5 s outside a declared hold where no part of the frame moves by itself (a whole-frame move does not count); a move never jumps speed from one frame to the next: stopping within one step from over 600 px/s (position) or 0.6 scale units per second (zoom) is a jolt
range: an element move with slow ease at both ends; a rest of 0.4 to 0.6 s after an element settles; ambient motion is the smallest of the three motion levels (primary, secondary, ambient): a glint or a colour shift on a part, a field at about 0.3 intensity, one overlay per film (VHS, CRT, film grain, or a real lens effect from prompts/moves/lens.md) at 0.6 to 0.9, never behind small body copy, never two together
break-when: a declared hold (static-window@a-b waiver with a reason) where stillness is the point: the held wordmark or lockup that is the last beat; the quiet beat just before the spectacle (`<meta name="spectacle">`), so the big moment lands; a line the viewer must read, held still for its read time and no longer. Anywhere else a hold keeps one part alive. A declared cut (a frame that lands on a cut is never a jolt)
instead: put one element move in every span that sits still over 0.5 s (type a line, tick a counter, pass a glint), never a camera drift (taste/craft/motion-craft.md). Do not fill the hold with a camera drift, push or pan, a scale or translate on a world or stage root, or parallax on the whole ground: the check leaves those out and constant-camera names a camera that never rests. Do not drift data: a chart whose bars drift lies. Judge local motion (something arrives in a small region), not global motion. Do not put the same ambient on every scene, do not loop anything near text being read, and do not pad a scene with ambient motion to look busy: it raises global motion and costs the film. Fix a jolt at the curve that produced it: end the move on a spring or EASE.land, never smooth the number after the fact; a linear camera station or a slow-start curve straight into a hold is the classic shape.
check: static-window, sheet-tiles, dead-stop
judge: Is there a 0.5 s span where nothing moves and no hold is declared? Does any move stop within one frame? Is the same ambient on every scene, or does anything loop near text?
prevents: doc no-jolt and MOTION-CRAFT: smooth on a storyboard, jerky on screen. doc TASTE-RULES: cheap aliveness near text being read. doc TASTE-RULES "stillness is powerful" met card "never static in the last 1 s". Measured: a reference film had a quietest window at 0.42 against a median of 1.33; a bad recreation had ten dead windows, one of 2.5 s.
status: active
scored: yes
numbers: {"still_limit_s":0.5,"rest_min_s":0.4,"rest_max_s":0.6,"jolt_px_per_s":600,"jolt_zoom_per_s":0.6}
print-motion: keep one part moving in every hold (typing, a counter, glint() or breathe() from core/motion/alive.js), not a frozen frame and not a camera drift
craft: motion-craft
---

## Example

The readable hold on the claim is 2 s: the figure counts up from 0.4 s, then a glint crosses the card, and the camera rests. A pan ends on EASE.settle, not at full speed.

Why and sources: [motion-craft](../craft/motion-craft.md).

Draft check: pixels change under a camera drift, so the pixel check alone cannot tell it from life. The draft check reads the page's animations (harness/lib/camera-moves.mjs): a whole-frame transform (camera(), or a scale, translate or rotate on an element that covers 60 percent of the frame, for 0.6 s or more) is left out, and the seconds where only such a move runs count as still. A page that paints in window.seek or on a canvas has no animations to read, so only the pixels decide there.

Draft check, typing: a few glyphs change under 2 percent of the pixels, so text that keeps changing is read from the page's text samples (harness/lib/typing-spans.mjs): 3 or more new texts, each within 0.5 s of the one before, leave the still run. A caret, as a glyph or a line of its own, is no text, and a text that flips between two states is a blink; neither keeps a hold alive.

Draft check, dead-stop: reads the element boxes the draft check samples (60 a second, at most 300 samples). A step over 600 px/s (frame of 1080 px, scaled) followed by a step that holds still fires, once for the film with the worst case. A cut (a step much longer than both neighbours) and an element that leaves the frame or fades out are no stop. Only position and size are read; zoom is not. The reference films are mp4 files with no element boxes, so the 600 px/s is the rule's own number, not a measured one. The pixel twin is the acceptance row "jerky steps" (harness/lib/smoothness.mjs).
