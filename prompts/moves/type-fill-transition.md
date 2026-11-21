# Type fill transition

**Use when** a word is on screen and the next shot should grow out of it. The camera scales into one
letter, in the next shot's colour, until the stem is the whole frame; that colour is the ground of
shot B, so there is no cut to hide. The detail that sells it is the geometry: the zoom is aimed at the
middle of a stem (an `I`, an `L`, a `T`), the other letters fly off the frame as it grows, and the
letter drifts to the middle of the frame so the fill is even. Clip:
[type-fill-transition.mp4](clips/type-fill-transition.mp4). Demo:
[demo/type-fill-transition.html](demo/type-fill-transition.html).

```js
import { EASE, easeFn } from '../../core/motion/presets.js';
const E = easeFn('land'), W = innerWidth, H = innerHeight, t0 = 0.35, dur = 1.0, COVER = 0.62;
const whip = easeFn('swap');
vawe.onFrame((t) => {
  const ox = word.offsetLeft + letter.offsetLeft + letter.offsetWidth / 2;    // offset metrics ignore transforms
  const oy = word.offsetTop + letter.offsetTop + letter.offsetHeight / 2;
  const S = (1.1 * W) / (0.4 * letter.offsetWidth);                           // a stem is about 0.4 of its box wide
  const u = Math.min(1, Math.max(0, (t - t0) / dur)), p = 0.4 * u + 0.6 * whip(u);
  const s = Math.exp(Math.log(S) * p);                                        // log path: equal steps, equal speed
  const px = ox + (W / 2 - ox) * p, py = oy + (H / 2 - oy) * p;
  world.style.transform = `translate(${px - s * ox}px, ${py - s * oy}px) scale(${s})`;
  const covered = u >= COVER;                                                 // the letter colour equals shot B's ground
  world.style.visibility = covered ? 'hidden' : 'visible'; shotB.style.opacity = covered ? 1 : 0;
});
// shot B's lines rise from a mask at t0 + dur * COVER, as in mask-rise
```

Sound: none; the letter filling the frame is the cut, and the film keeps its one swell for a stronger one.

Pick a letter with one solid stem; an `o` or `a` puts the counter in the middle of the frame. Set
`COVER` by looking at the frames: it is the moment the frame is one flat colour, and shot B's text
must start rising there, or the clip has a blank beat (the render refuses a flat run over 0.1 s).
The last doubling of scale is the fastest movement of the stem's edges: that is correct, it is
what a zoom looks like, so do not slow the end to hide it. Type must be heavy (800 and up): a thin
stem needs a scale so large that the fill takes the whole move.

Looks (ground, type, radius, accent) live in `demo/demo.css`; this snippet keeps neutral tokens.
