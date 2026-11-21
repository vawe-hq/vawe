# Shape morph wipe

**Use when** the next shot should grow out of a shape already on screen (a status dot, an avatar, a
button) and become the frame: the mask is born as that shape, grows as a circle, then widens and
squares off into a rounded card and on past the frame edges. Unlike `iris-wipe`, the shape itself
changes on the way. The detail that sells it is the order: size first, shape second. The circle
stays round for the first third, then the width outruns the height and the corners tighten, so the
viewer sees a circle turn into a card, not a box that was always a box. Clip:
[shape-morph-wipe.mp4](clips/shape-morph-wipe.mp4). Demo: [demo/shape-morph-wipe.html](demo/shape-morph-wipe.html).

```js
import '../../core/engine/page-api.js';
import { easeFn } from '../../core/motion/presets.js';
const E = easeFn('land'), W = innerWidth, H = innerHeight, clamp = (u) => Math.min(1, Math.max(0, u));
const whip = easeFn('swap');
const grow = (u) => 0.35 * u + 0.65 * whip(u), lerp = (p, q, u) => p + (q - p) * u;
const r = dot.getBoundingClientRect(), o = { x: r.left + r.width / 2, y: r.top + r.height / 2, d: r.width };
const T0 = 0.4, DUR = 0.85, PAD = 0.04 * H;                         // PAD: the box ends past every edge, so no corner shows shot A
vawe.onFrame((t) => {
  const u = clamp((t - T0) / DUR), g = grow(u);
  const h = lerp(o.d, H + 2 * PAD, g);                               // a circle of diameter h grows first
  const w = h + (W - H) * grow(clamp((u - 0.3) / 0.7));             // then it widens into the frame's shape
  const cx = lerp(o.x, W / 2, g), cy = lerp(o.y, H / 2, g);
  const rad = (Math.min(w, h) / 2) * lerp(1, 0.07, E(clamp((u - 0.35) / 0.55)));   // round, then a card corner
  next.style.visibility = t < T0 ? 'hidden' : 'visible';
  next.style.clipPath = `inset(${cy - h / 2}px ${W - cx - w / 2}px ${H - cy - h / 2}px ${cx - w / 2}px round ${rad}px)`;
  nextInner.style.transform = `scale(${lerp(1.12, 1, E(u))})`;       // the new shot settles inside the window
  prev.style.transform = `scale(${lerp(1, 0.94, g)})`;               // the old shot steps back under it
});
```

Sound: none; the shape grows from a dot the eye is already on, and the new shot's own entrance takes the cue.

`inset(... round r)` is one clip shape that is a circle when the box is square and r is half its
side, and a card when r is small, so one property carries the whole morph. Start from a shape at
least 4 percent of the frame high, or the first third is invisible. The new shot's content moves
toward the viewer (1.12 to 1) while the old one moves away (1 to 0.94): two depths, one direction.

Looks (ground, type, radius, accent) live in `demo/demo.css`; this snippet keeps neutral tokens.
