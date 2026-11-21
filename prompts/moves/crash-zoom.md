# Crash zoom

**Use when** one detail must hit on a beat ("look at this!"): the camera holds wide, then in 0.13 s
it slams in to 2.6x on the detail, overshoots 5 percent and recoils in 0.32 s. Where the push in [camera-moves](camera-moves.md) says
"please look", this says "look now". The push accelerates into the hit (`EASE.carry`), the
opposite of a normal entrance, because the stop is the impact. The detail that sells it is real zoom
blur: 16 copies of the frame at scales fanned across half of one frame's change, stacked at
opacities 1, 1/2, 1/3 and so on so they average to one exposure. The streaks point at the detail and
vanish the frame the camera stops. It breaks rule entrance-ease on purpose, so declare it in the page: `"allow": ["entrance-ease"], "_why": {"entrance-ease": "at 0.55 s the push accelerates for 0.13 s into the hit; the stop is the impact"}`. Clip: [crash-zoom.mp4](clips/crash-zoom.mp4). Demo: [demo/crash-zoom.html](demo/crash-zoom.html).

```js
import '../../core/engine/page-api.js';
import { easeFn } from '../../core/motion/presets.js';
const W = innerWidth, H = innerHeight, N = 16, clamp = (u) => Math.min(1, Math.max(0, u));
const land = easeFn('land'), carry = easeFn('carry'), HIT = 0.55, PUSH = 0.13, S = 2.6, OVER = 1.05, RECOIL = 0.32;    // beat (s), push (s), rest scale, overshoot, recoil (s)
const scaleAt = (t) => {
  if (t < HIT) return 1 + 0.02 * t;                                     // a slow creep while it holds wide
  const u = clamp((t - HIT) / PUSH);
  if (u < 1) return 1.011 + (S * OVER - 1.011) * carry(u);
  const v = land(clamp((t - HIT - PUSH) / RECOIL));
  return S * OVER + (S - S * OVER) * v + 0.08 * Math.max(0, t - HIT - PUSH - RECOIL);
};
vawe.onFrame((t) => {
  const s0 = scaleAt(t), spread = 0.5 * (scaleAt(t + 1 / 60) - s0);    // a 180 degree shutter
  layers.forEach((w, j) => {                                           // layer j (opacity 1 / (j + 1)) holds a copy of the world, transform-origin 0 0
    const s = s0 + (j / (N - 1) - 0.5) * spread, k = clamp((s - 1) / (S - 1));
    const px = target.x + (W / 2 - target.x) * k, py = target.y + (H / 2 - target.y) * k;   // the detail travels to the centre
    w.style.transform = `translate(${px - s * target.x}px, ${py - s * target.y}px) scale(${s})`;
  });
});
```

Sound: pluck at 0.68 s into the move, the frame the push stops at 2.6x (default gain); never an impact, since the overshoot is the hit.

Keep the push between 0.1 and 0.15 s: past 0.2 s it reads as an ordinary push. Eight copies show
as separate ghosts at this speed; sixteen blend into streaks. Measure the target's rect once at load.
The detail must be live type or vector, since it is seen at 2.6x for the rest of the shot; a small
screenshot goes soft. No camera shake on the stop: the overshoot is the impact. Use it at most twice
in a film, and put the hit on the sound's transient.

Looks (ground, type, radius, accent) live in `demo/demo.css`; this snippet keeps neutral tokens.
