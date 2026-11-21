# Drift hold

**Use when** one line must sit still on screen long enough to read and you want a living ground behind it as a deliberate option. The line never moves; only the ground behind it drifts, slowly, like a breath. This is a ground option, not the hold's life: a ground drift does not keep a hold alive (rule live-hold), so the held seconds still need an element motion on a part of the frame. Clip:
[drift-hold.mp4](clips/drift-hold.mp4). Demo: [demo/drift-hold.html](demo/drift-hold.html).

```html
<div class="ground"></div>                         <!-- inset: -8%, a dot grid or a texture -->
<div class="light"></div>                          <!-- one soft radial patch, lighter than the ground -->
<h1 class="line">Held, not <em>frozen.</em></h1>   <!-- no transform, ever -->
<script type="module">
import '../../core/engine/page-api.js';
import { noise1 } from '../../core/motion/springs.js';
const layers = [
  { el: ground, seed: 1, amp: 1.6, grow: 0.03 },   // vh of travel, share of scale gained over 2 s
  { el: light,  seed: 2, amp: 5,   grow: 0.06 },
];
const rate = 0.5;                                  // noise steps per second: a new direction every 2 s
vawe.onFrame((t) => {
  const vh = innerHeight / 100;
  layers.forEach(({ el, seed, amp, grow }) => {
    const x = noise1(t * rate, seed * 10) * amp * vh, y = noise1(t * rate, seed * 10 + 5) * amp * vh * 0.7;
    el.style.transform = `translate(${x}px, ${y}px) scale(${1 + grow * t / 2})`;
  });
});
</script>
```

The ground drift is the ground's life (rule living-ground). It is a whole-frame move, so it does not count for live-hold: give the held line's seconds an element motion too (a glint, a caret, a counter).

Sound: none; a hold is quiet, and the quiet before the spectacle is the point.

`noise1` is seeded, so frame `t` is the same on every render and depends on no earlier frame. Put
the drift only on layers behind the text: the moment the line itself drifts, the eye reads a move
and not a hold. The grid travels 1 to 2 vh; the light patch may travel more because its edge is
soft. Keep the patch within a few percent of the ground's lightness, so it reads as light and not
as a shape. It never blurs. Use it under a held line, not as a substitute for a beat: the hold
still needs its own words-times-0.6 s.

Looks (ground, type, radius, accent) live in `demo/demo.css`; this snippet keeps neutral tokens.
