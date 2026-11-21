# Grid stagger wave

**Use when** a title needs "many things" around it: integrations, apps, customers. Clip:
[grid-stagger-wave.mp4](clips/grid-stagger-wave.mp4). Demo: [demo/grid-stagger-wave.html](demo/grid-stagger-wave.html).

Look: a white sheet on the flat neutral ground. Tiles are flat grey squares with one generic mark
each (drawn in `demo/assets/logos.js`, never a real logo), even gaps, no bevel. The title block sits
in the grid with a muted line under it.

How it moves: the title is there first. The tiles enter in a ring that spreads from the title,
70 ms for each tile of distance. Each tile starts 30 percent of a tile toward the title at 0.8
scale and is pushed to its cell on `EASE.landSoft`. No overshoot: a real grid does not bounce.
After the wave, a small green dot arrives on each tile in a second, faster ring (the app is
connected). The sheet leaves on `leave`.

```js
import { EASE } from '/core/motion/presets.js';
const src = { c: 1.5, r: 1.5 }, STEP = 70, T0 = 300, DOTS_AT = 2000;   // the title block's centre, in tile units
const d = Math.hypot(tile.c - src.c, tile.r - src.r), dx = tile.c - src.c, dy = tile.r - src.r;
tile.el.animate([{ translate: `${(-dx / d) * 30}% ${(-dy / d) * 30}%`, scale: 0.8, opacity: 0 }, { translate: '0 0', scale: 1, opacity: 1 }],
  { duration: 600, delay: T0 + d * STEP, easing: EASE.landSoft, fill: 'both' });
tile.dot.animate([{ opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1 }],
  { duration: 240, delay: DOTS_AT + d * 40, easing: EASE.land, fill: 'both' });
```

Sound: droplet at 0.3 s, when the first tiles leave the title (default gain); no tick per tile.

Common mistake: a delay by row or column. It reads as a typewriter. Use the distance from the title, and put the source on the thing the viewer must read, off centre.

Looks (ground, type, radius, accent) live in `demo/demo.css`; this snippet keeps neutral tokens.
