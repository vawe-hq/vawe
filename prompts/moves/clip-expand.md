# Clip expand from a point

**Use when** a panel, a capture or a colour field grows out of one point. Put something at that point first (a
dot, a cursor, the word that becomes the panel) so the eye is already there when the expansion starts. The clip
copies a course page: a lesson card with a play dot on its thumbnail. The cursor presses the dot and a circle
grows from it into a full-bleed video player with a title, a chaptered scrubber, the time and the controls. The
video then plays: the time and the scrubber advance. Clip: [clip-expand.mp4](clips/clip-expand.mp4). Demo:
[demo/clip-expand.html](demo/clip-expand.html).

```js
import { EASE } from '../../core/motion/presets.js';
const d = dot.getBoundingClientRect();
const P = { x: d.left + d.width / 2, y: d.top + d.height / 2 };            // the point, named once
const FAR = Math.max(...[[0, 0], [W, 0], [0, H], [W, H]].map(([x, y]) => Math.hypot(P.x - x, P.y - y)));   // to the farthest corner
player.animate([{ clipPath: `circle(${0.9 * u}px at ${P.x}px ${P.y}px)` }, { clipPath: `circle(${FAR + 2 * u}px at ${P.x}px ${P.y}px)` }],
  { duration: 900, delay: 2000, easing: EASE.settle, fill: 'both' });      // the press is at 1.9 s
```

```html
<div class="thumb"><img ...><div class="dot" id="dot">...play icon...</div></div>   <!-- the point -->
<div class="pl" id="pl"><img ...><div class="top">...</div><div class="bot">...scrubber and controls...</div></div>
```

Sound: bloom at 2.0 s, as the circle opens from the point; its slow attack follows the growth (default gain).

The player controls and title arrive 0.7 s into the growth with a short fade, so they do not slide in with the
circle. The cursor presses with a 14 percent dip and leaves with a fade once the circle covers it. For a
rectangular reveal use `inset()` with the same origin: a circle reads as a burst, an inset as a window opening.

Common mistake: a circle that starts from the frame centre or from a dot that is not on screen. The viewer must see
the point first, then the click, then the growth.

Looks (ground, type, radius, accent) live in `demo/demo.css`; this snippet keeps neutral tokens.
