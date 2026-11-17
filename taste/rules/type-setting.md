---
id: type-setting
step: look
principle: Set display type tight and body type open. Body and caption lines keep a readable measure; display type is exempt and fills the frame instead.
limit: none
range: display tracking -0.02 to -0.05 em; leading: body 1.2 to 1.45, big headlines 1.02 to 1.1; measure 45 to 75 characters (about 66) for body and captions; light type on dark opens +0.01 em at hero size; uppercase opens, lowercase is never letterspaced
break-when: a display line short enough for one fixation (60 px and up) has no measure
instead: set display type to letter-spacing: -0.03em. For a dark scene, drop body weight from 400 to 350 and open leading by 0.05 to 0.1 by hand.
print-frames: set display type tight (letter-spacing -0.03em) and body type open at a 45 to 75 character measure, not one tracking for both
check: display-tracking
judge: Does any body line run past 75 characters or any display line sit loose?
prevents: doc TYPOGRAPHY.md and LAYOUT.md: the tracking numbers are reference-note values, not measured here; light ink on a dark ground bleeds into its counters.
status: active
scored: no
numbers: {"display_px_min_1920":84,"display_tracking_tol_em":0.01,"display_tracking_em_min":-0.05,"display_tracking_em_max":-0.02,"measure_chars_min":45,"measure_chars_max":75}
craft: typography
---

## Example

Headline -0.03 em, leading 1.05; a 66 character caption.

Why and sources: [typography](../craft/typography.md).

Draft check: The draft check reads display as 84 px and up at 1920 wide, skips capitals, and allows 0.01 em beyond the range.
