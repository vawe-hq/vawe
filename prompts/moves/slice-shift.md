# Slice shift

**Use when** the cut should feel mechanical and fast: shot A is cut into horizontal bands that slide
off left and right in alternation and uncover shot B, which settles from 1.07x. The detail that sells
it is that no two bands move alike: each starts a few frames after its neighbour with seeded jitter
and its own duration, and each carries its own speed blur, so the frame tears apart instead of
sliding as one sheet. Clip: [slice-shift.mp4](clips/slice-shift.mp4). Demo:
[demo/slice-shift.html](demo/slice-shift.html).

```js
import { rng } from '../../core/motion/springs.js';
import { EASE, easeFn } from '../../core/motion/presets.js';
const W = innerWidth, H = innerHeight, N = 7, h = H / N, rand = rng(11);
const leave = easeFn('launch');           // slow off the mark, fastest as the band leaves the frame
for (let i = 0; i < N; i++) {
  // band i: overflow hidden, top i*h, height h+1 (the extra px hides a seam); inside it a full-frame copy of shot A at top -i*h
  const dir = i % 2 ? 1 : -1, delay = 300 + i * 42 + rand() * 30, dur = 500 + rand() * 100;   // ms
  band[i].animate([{ translate: '0 0' }, { translate: `${dir * W * 1.04}px 0` }],
    { duration: dur, delay, easing: EASE.launch, fill: 'both' });
}
shotB.animate([{ scale: 1.07 }, { scale: 1 }], { duration: 1000, delay: 450, easing: EASE.land, fill: 'both' });
// one SVG feGaussianBlur per band, stdDeviation = 0.3 x that band's travel per frame, x only, set in vawe.onFrame as in push-blur
```

Sound: none; the tear is fast and visual, and a cue on it is a whoosh on every cut.

Seven bands at a 42 ms stagger is the range that reads as a tear; three or four look like blinds and
twelve look like a glitch. The bands leave on an accelerating curve (they exit, so they get faster,
never slower). Use `rng`, never `Math.random`, so a re-render is identical. A band that starts
together with its neighbour in the same direction fuses into one block: keep the alternation.

Looks (ground, type, radius, accent) live in `demo/demo.css`; this snippet keeps neutral tokens.
