# Rack focus

**Use when** two things at different depths share a frame and the story passes from one to the other: the
draft in front, the shipped result behind. The lens pulls focus: one plane resolves while the others go soft. Clip:
[rack-focus.mp4](clips/rack-focus.mp4). Demo: [demo/rack-focus.html](demo/rack-focus.html). Code: `core/surfaces/lens.js`.

Look: a real photo as the far plane, always soft, with two pale paper cards over it at two depths (0.2 and 0.55; the photo
sits at 0.95). The cards are drawn on a 2D canvas with a soft contact shadow, a mono label, a large word and a status
line. Each card is sharp only when the focus is on its depth.

How it moves: the cards arrive on `EASE.land` (a 0.4 s fade with a 14 px rise, 150 ms apart). Focus sits on the near card for
1.2 s, then moves to the second card in 1.0 s on `EASE.settle`: the near card melts, the second resolves. Focus holds,
then the cards leave on `EASE.launch`. The soft parts are a true depth of field: the circle of confusion grows with the depth
difference, so the card next to the photo is less soft than the photo.

```js
import { lens, canvasSource, OFF } from '/core/surfaces/lens.js';
const NEAR = 0.2, MID = 0.55, FAR = 0.95;                         // depth, 0 near to 1 far
const rack = (t) => NEAR + (MID - NEAR) * easeFn('settle')(clamp((t - 1.2) / 1.0));
// paint(t) draws the photo and the cards into `color`, and each shape in its depth grey into `depth` (red channel)
const cam = lens(canvasSource(color, { depth }), { ...OFF, dof: { blur: 0.9, focus: rack, bokeh: 8 } });
vawe.onFrame(async (t) => { paint(t); await cam.draw(t); });
```

Sound: none; a focus pull is felt, never heard.

Common mistake: two `filter: blur()` layers swapped on one curve. A uniform blur has no depth, so the plane between them
never shows. Give each shape a depth and let the lens `dof` blur by distance from the focus.

Looks (ground, type, radius, accent) live in `demo/demo.css`; this snippet keeps neutral tokens.
