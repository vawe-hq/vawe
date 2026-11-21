# Spin transition

**Use when** a cut should carry energy and change axis after straight wipes: the camera rolls 90
degrees. Shot A rolls from 0 to 45 degrees, speeding up, the cut lands at full speed, and shot B rolls
from -45 to 0 and lands soft. Two details sell it. The frame scales up by exactly as much as each
angle needs to keep covering the frame (2.0x at 45 degrees for 16:9), so no corner of the ground ever
shows. And the blur is rotational: 16 copies of the frame at angles fanned across half of one frame's
turn, stacked at opacities 1, 1/2, 1/3 and so on, so the edges streak in arcs and the centre stays
sharp. Clip: [spin-transition.mp4](clips/spin-transition.mp4). Demo: [demo/spin-transition.html](demo/spin-transition.html).

```js
import '../../core/engine/page-api.js';
import { easeFn } from '../../core/motion/presets.js';
const W = innerWidth, H = innerHeight, N = 16, clamp = (u) => Math.min(1, Math.max(0, u));
const T0 = 0.45, DUR = 0.5, ROLL = 90;
const whip = easeFn('swap');   // full speed at the cut
const P = (t) => whip(clamp((t - T0) / DUR));
const cover = (deg) => {                                  // the smallest scale at which the turned frame still covers the frame
  const r = Math.abs(deg) * Math.PI / 180, c = Math.cos(r), s = Math.sin(r);
  return Math.max((W * c + H * s) / W, (W * s + H * c) / H);
};
vawe.onFrame((t) => {
  const p = P(t), spread = 0.5 * (P(t + 1 / 60) - p);   // a 180 degree shutter
  const moving = spread * ROLL * (Math.PI / 180) * (W / 2) > 0.5;
  layers.forEach((l, j) => {                            // layer j: opacity 1 / (j + 1), holds a copy of shot A and of shot B
    l.el.style.visibility = j === 0 || moving ? 'visible' : 'hidden';
    const pj = clamp(p + (j / (N - 1) - 0.5) * spread), inB = pj >= 0.5;
    const deg = ROLL * pj - (inB ? ROLL : 0);
    l.a.style.display = inB ? 'none' : 'block';
    l.b.style.display = inB ? 'block' : 'none';
    l.el.style.transform = `rotate(${deg}deg) scale(${cover(deg)})`;
  });
});
```

Sound: none; the roll is the seam, and the film keeps its one whoosh for a whip.

Show one copy when the frame is still. Stacked translucent copies that are rotated fall on Chromium's
256 px compositor tiles, and on a flat light ground the tile seams show as a faint vertical band. Each
copy picks its own shot by its own time, so copies either side of the cut mix A and B, which is what a
real shutter records. A 0.5 s roll reads as a spin; under 0.35 s it is a flash of blur. Roll the
other way at the next spin, and keep type away from the frame corners: they travel the farthest and
blur the most.

Looks (ground, type, radius, accent) live in `demo/demo.css`; this snippet keeps neutral tokens.
