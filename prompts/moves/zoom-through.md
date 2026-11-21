# Zoom through

**Use when** the next shot should be entered, not cut to: the camera dives into one part of the frame
(a button, a dot, a shape) until that part is the whole frame, and the next shot comes out of it, still
moving in the same direction. Needs no shape match (unlike `match-cut`) and no cut. The detail that
sells it is real zoom blur: eight copies of the frame at slightly different scales, stacked at
opacities 1, 1/2, 1/3 and so on so they average to one exposure, spread over half of one frame's
travel. An SVG blur cannot do a radial streak; this can. Clip: [zoom-through.mp4](clips/zoom-through.mp4).
Demo: [demo/zoom-through.html](demo/zoom-through.html).

```js
import { easeFn } from '../../core/motion/presets.js';
const W = innerWidth, H = innerHeight;
const ease = easeFn('settle');
const t0 = 0.3, dur = 1.1, R = 20, S = R * 1.08, N = 8, SWAP = 12.5, EMERGE = 6.5;
const ox = 0.66 * W, oy = 0.5 * H;                                   // the part the camera dives into
const P = (t) => { const u = Math.min(1, Math.max(0, (t - t0) / dur)); return ease(u); };
vawe.onFrame((t) => {
  const p = P(t), spread = 0.5 * (P(t + 1 / 60) - P(t));             // 180 degree shutter
  layers.forEach((l, j) => {                                        // layer j: opacity 1 / (j + 1), holds a copy of shot A and of shot B
    const pj = p + (j / (N - 1) - 0.5) * spread, s = Math.exp(Math.log(S) * pj);   // log path
    const px = ox + (W / 2 - ox) * pj, py = oy + (H / 2 - oy) * pj;                // the part drifts to the middle
    l.a.style.transform = `translate(${px - s * ox}px, ${py - s * oy}px) scale(${s})`;   // transform-origin 0 0
    l.b.style.transform = `scale(${s / R})`;                                             // shot B is full frame at s = R
    l.b.style.opacity = Math.min(1, Math.max(0, (s - EMERGE) / 2.5));                    // B's type fades up inside the part
    l.el.classList.toggle('in-b', s >= SWAP);                       // part fills the frame: hide A, ground = the part's colour
  });
});
```

Sound: none; the dive carries the eye, and the next shot's own entrance takes the cue.

The part must be a plain solid colour with no glyph: a play triangle covers the frame in white before
the disc fills it. Its size sets `SWAP`: a disc of radius r covers the frame corner at about
corner / r; swap just above that or the corners pop. Shot B must have the same ground as the part.
The 0.4 linear share in `P` and the 8 percent past `R` keep the frame moving to the last frame.
Never use `Math.random` for the copies: they are a fixed fan around `p`.

Looks (ground, type, radius, accent) live in `demo/demo.css`; this snippet keeps neutral tokens.
