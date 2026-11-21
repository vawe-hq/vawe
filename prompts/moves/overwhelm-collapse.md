# Overwhelm collapse

**Use when** the film turns from the problem to the fix: cards, notifications and chips flood the
frame, then all of them are pulled into one point and one clean element opens where they vanished.
The chaos is the contrast, so it has to be real: 26 items that overlap, tilt and cross the frame
edge. The detail that sells it is the rhythm: the flood accelerates (each gap shorter than the last),
holds one beat, and the collapse is faster than any arrival. Clip:
[overwhelm-collapse.mp4](clips/overwhelm-collapse.mp4). Demo:
[demo/overwhelm-collapse.html](demo/overwhelm-collapse.html).

```js
import { rng } from '../../core/motion/springs.js';
import { EASE } from '../../core/motion/presets.js';
const rand = rng(7), cx = innerWidth / 2, cy = innerHeight / 2;
let at = 120;                                   // ms; each arrival is earlier than the last gap allows
items.forEach((el, i) => {                      // el is absolutely placed at a seeded x, y; rot is +-8 deg
  el.animate([{ scale: 0.4, rotate: `${rot}deg`, opacity: 0 }, { scale: 1, rotate: `${rot}deg`, opacity: 1 }],
    { duration: 380, delay: at, easing: EASE.pop, fill: 'both' });
  at += 62 - i * 1.8;                           // 62 ms falling to 16 ms
  // dx, dy: from the item's centre to the frame centre; d: that distance as a share of the half-diagonal
  el.animate([{ translate: '0 0', scale: 1, filter: 'blur(0px)' },
              { translate: `${dx}px ${dy}px`, scale: 0.12, filter: `blur(${d * 6 + 1.5}px)`, offset: 0.9 },
              { translate: `${dx}px ${dy}px`, scale: 0.1, opacity: 0 }],
    { duration: 300, delay: 1340 + (1 - d) * 90 + rand() * 40, easing: EASE.launch, fill: 'forwards' });
});
clean.animate([{ opacity: 0, scale: 0.4 }, { opacity: 1, scale: 1 }], { duration: 640, delay: 1610, easing: EASE.pop, fill: 'both' });
clean.animate([{ translate: '0 0' }, { translate: '0 -1.2vh' }], { duration: 700, delay: 1610, easing: EASE.land, fill: 'both' });
```

Sound: bloom at 1.61 s into the move, when the clean element opens (default gain); nothing on the flood or the collapse.

Twenty or more items is the range where the frame reads as noise; under twelve it reads as a list.
The collapse starts with the outer items (they have the longest path), lasts 300 ms on a cubic-in
curve and blurs in proportion to distance, so the pull reads as speed. The clean element opens 70 ms
before the last item is gone, so the frame is never empty. It is one element with one accent: do
not answer twenty items with three.

Looks (ground, type, radius, accent) live in `demo/demo.css`; this snippet keeps neutral tokens.
