---
id: readable-text-size
step: look
principle: A line the viewer must read has a cap height of at least 6 percent of the frame height (about 65 px at 1080p). UI that is the subject of the film (a desktop or app mock) is sized like a real screen: its own floor is 3 percent.
limit: cap height at least 6 percent of frame height; UI that is the subject (inside data-ui) at least 3 percent; product UI labels shown as texture (data-chrome) at least 2.5 percent. A DESIGN.md `type-scale` or `ui-scale` line replaces the matching floor
range: none
break-when: text is texture: aria-hidden or data-chrome text that is also texture by measure (cap height under 2 percent of the frame, the same words 3 or more times on the page, or a data-texture="reason" of 12 characters or more)
instead: raise the font until the cap height is 6 percent of the frame (about 93 px at 1080p), never shrink the line (taste/craft/typography.md). A mock screen whose UI is the subject goes in a `data-ui` element and keeps its real proportions: 3 percent, or the `ui-scale` the film's DESIGN.md declares.
check: text-cap-height
judge: Measure the cap-height band in one full frame: is it at least 6 percent?
prevents: judge1: 50 px tagline, fix 64 to 72 px. judge2: "about 4% of frame height".
status: active
scored: yes
numbers: {"cap_height_pct":6,"chrome_cap_height_pct":2.5,"ui_cap_height_pct":3,"held_min_s":0.5,"texture_cap_pct_max":2,"texture_repeats_min":3,"texture_reason_min_chars":12,"texture_share_max_pct":50}
print-frames: set a read line at a 6% cap height (UI that is the subject, in data-ui: 3%) and hold it 0.6 s a word from 4 words (a 4 word tagline 2.4 s), fewer words max(1.2 s, words/3), not a small tagline that flashes by
craft: typography
---

## Example

At 1080p a 6 percent cap height is about 65 px, a font near 93 px. A desktop mock in `<div data-ui>` with window text at 3.5 percent passes; the same text outside data-ui reads as copy and needs 6.

DESIGN.md declarations (`harness/lib/design-decls.mjs`): `type-scale: 4%` sets the copy floor, `ui-scale: 2.5%` sets the data-ui floor. The acceptance row prints which line it followed.

Why and sources: [typography](../craft/typography.md).
