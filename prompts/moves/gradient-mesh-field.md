# Gradient mesh field

**Use when** a title and one line sit on a ground that must visibly flow, as on a modern product hero. The clip
is five layers of warm colour with crisp edges, drawn on a canvas. Each edge is a sine curve with its own phase
and speed, so the layers drift across the frame and never cross. The colour fades to the flat ground on the left,
under the copy, and reaches full strength on the right. One thin darker sand layer widens once, at 1.6 s. Each
edge has a 1 px highlight and a soft contact shadow, as layers of paper have. The copy enters with a masked rise
and a blur cascade. Clip: [gradient-mesh-field.mp4](clips/gradient-mesh-field.mp4). Demo:
[demo/gradient-mesh-field.html](demo/gradient-mesh-field.html).

```js
import '../../core/engine/page-api.js';
const LAYERS = [   // top to bottom: base height, amplitude, waves across the frame, phase, speed (rad/s), colour
  { y: 0.10, a: 0.045, f: 1.0, p: 0.0, w: 1.1, c: '#eee6d6' },
  { y: 0.52, a: 0.040, f: 1.2, p: 4.4, w: 1.3, c: '#a8855a' },   // the darker sand layer: it widens once
  // ...three more layers in the demo
];
const edge = (L, x, t, extra) => H * (L.y + extra + (x / W - 0.5) * 0.2 + L.a * Math.sin(2 * Math.PI * L.f * x / W + L.p + L.w * t));
vawe.onFrame((t) => {
  ctx.fillStyle = ground; ctx.fillRect(0, 0, W, H);
  LAYERS.forEach((L, i) => {
    // fill from the edge down to the bottom with a horizontal gradient: ground at the left, full colour at the right
    ctx.shadowColor = 'rgba(70, 45, 20, 0.2)'; ctx.shadowBlur = 2.4 * u; ctx.shadowOffsetY = -0.7 * u;   // a contact shadow above the edge
    ctx.fillStyle = gradientOf(L); fill(path(L, t));
    ctx.shadowColor = 'transparent'; ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)'; stroke(path(L, t));   // the highlight
  });
});
```

Sound: none; a held ground is quiet, and a pad under it reads as a screensaver.

The time is the seek, so every render draws the same layers. Sine edges with a spacing larger than twice the
amplitude never cross. Keep the colours inside one warm family and stay on one sand ramp. Behind the copy the layers
are within a few percent of the ground, so the headline keeps its contrast. Every layer fades from the ground with the same gradient: a layer that starts at a set x shows a vertical seam.

Common mistake: soft blurred pools of colour. A mesh that reads as a modern ground has crisp edges and flat
colour inside each layer. The flow comes from the edges moving, not from a blur.

Looks (ground, type, radius, accent) live in `demo/demo.css`; this snippet keeps neutral tokens.
