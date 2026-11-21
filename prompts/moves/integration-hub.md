# Integration hub

**Use when** the beat is "works with your tools": the product mark holds the centre from frame 0,
tool logos fly in from past the frame edges on curved paths and land on a ring around it, then every
wire draws in the same frames and a pulse rides each wire into the hub. Two beats: the tools land
(staggered 50 ms), then they connect together, so the ecosystem reads as one gesture, not six deals.
Clip: [integration-hub.mp4](clips/integration-hub.mp4). Demo: [demo/integration-hub.html](demo/integration-hub.html).

```js
import '../../core/engine/page-api.js';
import { easeFn } from '../../core/motion/presets.js';
const E = easeFn('land'), H = innerHeight, cx = innerWidth / 2, cy = H / 2, R = 0.36 * H;
const clamp = (u) => Math.min(1, Math.max(0, u));
const quad = (p, q, r, u) => (1 - u) * (1 - u) * p + 2 * (1 - u) * u * q + u * u * r;
const plan = tools.map((el, i) => {                      // tools: the logo chips, centred on their own origin
  const a = -Math.PI / 2 + (i * 2 * Math.PI) / tools.length + Math.PI / 6, far = 0.625 * innerWidth;
  return { el, at: 0.05 + i * 0.05, spin: i % 2 ? 40 : -40,
    end:   { x: cx + 1.5 * R * Math.cos(a),       y: cy + R * Math.sin(a) },          // the ring is 1.5x wider than tall
    start: { x: cx + 1.3 * far * Math.cos(a + 0.5), y: cy + far * Math.sin(a + 0.5) },           // past the frame edge
    bend:  { x: cx + 2.1 * R * Math.cos(a - 0.35), y: cy + 1.4 * R * Math.sin(a - 0.35) } };
});
vawe.onFrame((t) => {
  for (const p of plan) {
    const u = E(clamp((t - p.at) / 0.62));
    const x = quad(p.start.x, p.bend.x, p.end.x, u), y = quad(p.start.y, p.bend.y, p.end.y, u);
    p.el.style.transform = `translate(${x}px, ${y}px) rotate(${p.spin * (1 - u)}deg)`;
    const w = E(clamp((t - 0.95) / 0.22));               // every wire on the same frames
    // draw the wire from the chip toward the hub by w; a dot at phase ((t - 1.17) / 0.5) % 1 rides it inward
  }
});
```

Sound: droplet at 1.17 s into the move, when every wire is drawn and the first pulses ride in (default gain); no tick per tool.

The start point sits half a radian off the landing bearing and the bend point off the other side,
so each path is an S that swings in; straight rays read as a starburst. `EASE.land` lands them soft,
and the small counter-rotation that unwinds on landing is what makes them feel thrown. Keep wires
drawn in one window: a stagger here reads as one tool at a time. Invent the logos (a glyph in a
chip); never use real brand marks without the brand's permission. A slow turn of the whole ring
(0.018 rad per second) and the looping pulses keep the held map alive.

Looks (ground, type, radius, accent) live in `demo/demo.css`; this snippet keeps neutral tokens.
