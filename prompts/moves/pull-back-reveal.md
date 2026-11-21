# Pull back reveal

**Use when** a film opens on a detail and the whole should arrive as an answer: a status dot, a
letter, one number. The first frame is tight on the detail (9x), and the camera pulls back to the
full composition. The detail is the hook and the wide frame is the payoff. Clip:
[pull-back-reveal.mp4](clips/pull-back-reveal.mp4). Demo: [demo/pull-back-reveal.html](demo/pull-back-reveal.html).

```js
import '../../core/engine/page-api.js';
import { easeFn } from '../../core/motion/presets.js';
const r = dot.getBoundingClientRect();                     // measured before the first frame
const d = { x: r.left + r.width / 2, y: r.top + r.height / 2 }, c = { x: innerWidth / 2, y: innerHeight / 2 };
const s0 = 9, t0 = 0.1, dur = 1.6;                         // world { transform-origin: 0 0 }
const ease = easeFn('land');     // fast, then a long soft arrival
vawe.onFrame((t) => {
  const u = Math.min(1, Math.max(0, (t - t0) / dur)), p = ease(u);
  const s = Math.exp(Math.log(s0) * (1 - p));              // zoom is multiplicative: scale on a log path
  const cam = { x: d.x + (c.x - d.x) * p, y: d.y + (c.y - d.y) * p };   // the dot is centred first, the card last
  world.style.transform = `translate(${c.x - s * cam.x}px, ${c.y - s * cam.y}px) scale(${s})`;
  const sb = Math.pow(s, 0.55);                            // the ground scales less, so it reads as far behind
  ground.style.transform = `translate(${c.x - sb * cam.x}px, ${c.y - sb * cam.y}px) scale(${sb})`;
});
```

Sound: bloom at 0.10 s into the move, when the pull back leaves the detail, so the film has sound from its first beat (default gain).

Interpolating `scale` linearly from 9 to 1 spends its first frames at a speed the eye cannot follow
and its last ones crawling; the log path keeps each frame the same percentage larger. The camera
centre moves from the detail to the frame centre on the same `p`, so the detail leaves the middle as
the card arrives. The ground layer needs a box much larger than the frame (here 700 vw) with
`transform-origin` at the frame origin, or its edge shows at 9x. Hold the tight frame 0.1 s, not
longer: the detail must be a hook, not a still. The tight frame needs one clear subject and nothing
half-cropped beside it.

Looks (ground, type, radius, accent) live in `demo/demo.css`; this snippet keeps neutral tokens.
