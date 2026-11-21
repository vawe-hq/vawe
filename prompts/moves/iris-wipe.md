# Iris wipe

**Use when** a click, a cursor or a mark is the thing the eye is on and the next scene should answer
it. Shot A is clipped to a circle that closes on that point, and shot B waits underneath and settles
from 1.1x to 1 as it is uncovered. It is the closing iris of silent film, so it says "this action
caused that scene". Clip: [iris-wipe.mp4](clips/iris-wipe.mp4). Demo: [demo/iris-wipe.html](demo/iris-wipe.html).

```js
import { EASE } from '../../core/motion/presets.js';
const px = 0.66 * innerWidth, py = 0.63 * innerHeight;      // the point the eye is on
const R = Math.hypot(px, py);                               // to the farthest corner
const at = `${px}px ${py}px`;
shotA.animate([{ clipPath: `circle(${R}px at ${at})` }, { clipPath: `circle(0px at ${at})` }],
  { duration: 650, delay: 550, easing: EASE.settle, fill: 'both' });
shotB.animate([{ scale: 1.1 }, { scale: 1 }], { duration: 1100, delay: 550, easing: EASE.land, fill: 'both' });
```

Sound: none; the click that closes the iris carries the cue.

Use pixels in the keyframes: a `var()` inside a `clip-path` keyframe does not interpolate, it flips
at 50 percent. Start the radius at the farthest corner, not the diagonal, or the first tenth of a
second closes outside the frame. An accelerating-only curve spends all its travel in the last 0.1 s
and reads as a snap; ease in, peak at the midpoint, close soft. Let the cursor press first (the button
dips to 0.95) so the wipe has a cause. Put the point where the cursor tip is, not the centre of the frame.

Looks (ground, type, radius, accent) live in `demo/demo.css`; this snippet keeps neutral tokens.
