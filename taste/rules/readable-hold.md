---
id: readable-hold
step: look
principle: A line the viewer must read holds fully legible long enough to be read. When a hold is short, add hold time; never slow the move.
limit: a line stays at most max(2.8 s, its read time + 1.5 s); no held frame under 1.2 s; short or non-prose text max(1.2 s, words / 3); prose (4 or more words) words x 0.6 s; each element is its own line, and rows that appear together need the longest row plus 1/3 s per extra row, at most the ceiling
range: one line holds at most about 5 s; past 8 words cut the line; reference films hold a word on screen 0.7 to 2.8 s (p10 to p90), so a line past its read time by 1.5 s is idle
break-when: text is a counter, an axis label, a chip, a credit or a watermark: looked at, not read; the end card (rule cta-last-short asks 3 to 5 s), and a line still on screen at the last sample is not measured for lingering
instead: hold each line max(1.2 s, words / 3), prose words x 0.6 s, from its last settled character, and cut past 8 words; keep the move quick (taste/craft/typography.md). The clock starts when the last character settles. Motion stays quick; exits still run shorter than entrances.
check: read-hold, text-lingers
judge: Count the legible tiles per line on the 5 fps sheet against the read-hold facts in the prompt (the same numbers as the draft check): is each line held long enough, and no longer than needed? Is any line still on screen well after it has been read?
prevents: measured over 22 reference films (harness/dev/bar-from-refs.mjs): they hold a word 2.8 s or less at p90, two of our films held a word 3 to 4 s. feedback vawe-flow-2: "a little too fast", "still too fast", chose the 15 percent slower cut. doc readable-hold: "the fix is always a hold".
status: active
scored: yes
numbers: {"hold_floor_s":1.2,"prose_s_per_word":0.6,"short_words_per_s":3,"prose_min_words":4,"ceiling_s":5,"hold_ref_p90_s":2.8,"read_margin_s":1.5}
digest: Read lines: cap height 6 percent of the frame or more (UI that is the subject, in data-ui: 3 percent), held max(1.2 s, words / 3); prose words x 0.6 s. Add hold, never slow the move.
print-storyboard: hold a line of 4 or more words 0.6 s per word once settled (a 4 word line 2.4 s), fewer words max(1.2 s, words / 3), and take it off when read plus 1.5 s, not hold it for the beat
craft: typography
---

## Example

A 3 word line holds 1.2 s and may stay 2.8 s. A 10 word line holds 6 s, so cut it to 8 words or fewer.

Draft check, text-lingers: reads each line's time on screen from the text samples (words of one element that show together are one line). A line that passes the lower bound (0.9 times the read time) and the world limit (read time + 0.8 s) fits under this ceiling.

Why and sources: [typography](../craft/typography.md).
