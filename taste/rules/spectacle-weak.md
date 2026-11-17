---
id: spectacle-weak
step: motion
principle: The spectacle second carries the strongest move of the film. No other moment moves faster than it.
limit: no element peak elsewhere is more than 1.25 times the fastest peak within 0.75 s of the spectacle second, and that peak is at least 1.3 times the median mover
range: the spectacle second is the one big moment (recipe 15); quiet comes before it, so its move is the film's fastest or longest
break-when: the spectacle is a held reveal, a sound or a colour change that needs no travel; say so in the brief and waive with the reason
instead: give the second the Board names the fastest or longest move of the film, with quiet before it. The checks read the Board's Spectacle second, so moving the meta changes nothing.
print-motion: give the spectacle second the fastest or longest move of the film, with quiet before it, not a stronger peak elsewhere
check: spectacle-weak
judge: Does the eye go to the spectacle second as the biggest moment of the film?
prevents: films/tidepool: the hero chip at the spectacle second moved 0.29 frame heights per second while a strip at 4.8 s peaked at 5.0, so the big moment was one of the quietest.
status: active
scored: no
numbers: {"stronger_margin":1.25,"window_s":0.75,"exaggeration_min":1.3,"shared_dip_min":2}
craft: motion-craft
---

## Example

A spectacle at 12 s where the strongest element peaks at 3.1 frame heights per second, while an element at 4.8 s peaks at 5.0, fires. A near tie (under 1.25 times) does not.

Draft check: The draft check reads the same element boxes as the speed-bands check (a camera or ground over 60 percent of the frame is not an element). It compares the fastest element peak within 0.75 s of `<meta name="spectacle">` with the fastest peak elsewhere. A spectacle second outside the drafted seconds is not measured.

Exaggeration floor: the spectacle peak must reach 1.3 times the median peak of the moving elements (5 or more, over 0.2 frame heights per second). Source: in the 22 reference films (`node harness/dev/bar-from-refs.mjs --measures`, 17 with a median over 0.3) the p90 peak speed over the median peak speed has p10 1.3, median 9.8, p90 16.4. A film at the p10 is the weakest key moment the references hold, so a spectacle under 1.3 times the median is below every reference. Our colour-sting is quiet on it.
