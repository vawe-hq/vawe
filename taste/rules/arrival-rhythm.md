---
id: arrival-rhythm
step: motion
principle: Motion order is reading order. Things that are not the same thing arrive irregularly across a beat; things that are the same thing arrive evenly within a cascade.
limit: none
range: across a beat: offsets differ, the next move starts at 60 to 70 percent of the last; within a cascade: intervals within 30 percent of the average; the hero moves last or largest; text enters in reading order and rises from its own baseline
break-when: never
instead: start the next move while the last still settles. Elements in one beat arrive as one phrase, with a tiny anticipation before the main move.
more-motion: start the next move while the last still settles, even steps in a cascade and irregular for different things, not a metronome
check: no-overlap
judge: Do a headline, a card and a chip begin on one frame? Does a cascade stall?
prevents: doc MOTION-CRAFT: three or more layers on one exact start read as a block; a 40 / 260 / 40 ms cascade reads as a stall.
status: active
scored: no
numbers: {"cascade_interval_tolerance":0.3,"next_start_share_min":0.6,"next_start_share_max":0.7,"chain_min":3}
craft: motion-craft
---

## Example

Headline at 0 ms, card at 180 ms, chip at 260 ms; six bullets 60 ms apart.

Why and sources: [motion-craft](../craft/motion-craft.md).

Draft check: no-overlap reads the animation records. Three or more moving entrances in a row, each starting after the one before has landed and within 0.5 s of it, fire. An entrance that starts before the last lands, or after a longer pause, breaks the chain. Data is thin (the reference films have no per-element timing); 3 is the shortest run that reads as a sequence.
