---
id: overshoot
step: motion
principle: Overshoot is a claim about mass. Type, UI, devices and a counting number do not overshoot by default, and a number never passes its final figure. A film with no spring at all is fine; a spring goes only on a thing with mass.
limit: at most 61 percent of the arrivals that move overshoot, and none is fine; a count never passes its final figure
range: reference films overshoot 21 to 41 percent of their arrivals (p10 to p90), but our default is none for UI and devices; EASE.pop (about 15 percent) only where the move is a press or a pop, named in the page, and only on things that then hold still; roll-up 0.8 to 1.4 s, the last 30 percent of the time covers the last 5 percent of the count
break-when: the brief asks for a playful register (the one reference profile where overshoot is right is a playful consumer app), or one deliberate stiff register (a terminal, a ticker) the brief names, or a copy of a real product surface that does not overshoot (a terminal, a dashboard)
instead: arrive fast, land soft: EASE.land, or approach(k 0.12 to 0.19), with no spring. When a thing has mass (a ball, a sticker, a dropped card) give that one arrival EASE.pop, or curveToLinear(CURVES.overshoot) from core/motion/springs.js. Never on text, UI or a device (they wobble). Ease a count with expo-out or quart-out: the deceleration is the weight; counting to a small number is a stunt, cut it.
check: judge, overshoot-share
judge: Does any word, UI element or count overshoot with no stated reason? Does any count pass its final figure and fall back? Does any arrival settle past its rest position and return, or do none?
prevents: measured over 22 reference films (harness/dev/bar-from-refs.mjs): they overshoot 21 to 41 percent of arrivals, our films 0 to 11 percent. doc banned-defaults: a big bounce on every word reads as a children's app. A film that says 1,822 and paints 1,900 on the way breaks the rule to use real figures.
status: active
scored: yes
numbers: {"pop_overshoot_pct":15,"count_min_s":0.8,"count_max_s":1.4,"share_max_pct":61,"arrivals_min":6,"tolerance":0.01,"min_travel_px":4,"past_share":0.03,"past_px_min":1}
print-motion: land arrivals on EASE.land with no spring, not a spring on UI or a count; keep one for a thing with mass
craft: motion-craft
---

## Example

Of nine card arrivals, one (a dropped sticker) uses EASE.pop and eight use EASE.land. A "Send" button presses with EASE.pop; the headline lands on EASE.land; 0 to 1,822 runs over 1.1 s on an expo-out.

Draft check, overshoot-share: The draft check reads the easing of each element's entering moves from its animations (a fade alone cannot overshoot, and a curve it cannot read is not counted). A page that paints in window.seek has no animations to read: its arrivals are read from element boxes (a move or a size change that starts faded out and ends faded in, a corner of the box past its end by 3 percent of its travel or 1 px; a pop that grows in place counts). It needs 6 arrivals. Over 61 percent (1.5 times the reference p90) it gives advice; under that, including none, it is silent.

Why and sources: [motion-craft](../craft/motion-craft.md).
