# Colour block wipe

**Use when** a brand-colour block should carry the cut: it sweeps across, fills the frame for a beat,
and sweeps on, and the next shot is behind it. The block is the cut, so shot A is swapped for shot B
while the frame is one flat colour. Unlike `iris-wipe` it has a direction and carries the accent. The
details that sell it are the slanted leading edge with speed blur, the wordmark that rides the block,
and a second, darker block that follows 80 ms behind, so the exit shows two colour steps instead of
one flat edge. Clip: [color-block-wipe.mp4](clips/color-block-wipe.mp4). Demo:
[demo/color-block-wipe.html](demo/color-block-wipe.html).

```js
import { EASE, easeFn } from '../../core/motion/presets.js';
const E = easeFn('land'), W = innerWidth;
const tIn = 0.3, dIn = 0.36, hold = 0.04, dOut = 0.42, lag = 0.08;
const from = -1.3 * W, cover = -0.16 * W, to = 1.05 * W;       // block is 130vw wide; at `cover` it fills the frame, skew included
const pos = (t) => {
  if (t <= tIn) return from;
  if (t < tIn + dIn) return from + (cover - from) * E((t - tIn) / dIn);            // arrive fast, land soft
  const u = Math.min(1, Math.max(0, (t - tIn - dIn - hold) / dOut));
  return cover + (to - cover) * easeFn('launch')(u);                    // slow off the mark, fastest leaving
};
vawe.onFrame((t) => {
  lead.style.transform = `translateX(${pos(t)}px)`;      // .face inside is skewX(-9deg); the wordmark is not skewed
  trail.style.transform = `translateX(${pos(t - lag)}px)`;
  shotA.style.visibility = t >= tIn + dIn + 0.03 ? 'hidden' : 'visible';             // the swap happens under the block
  const v = Math.abs(pos(t + 1 / 120) - pos(t - 1 / 120)) * 60;
  blur.setAttribute('stdDeviation', `${(v / 60 * 0.3).toFixed(2)} 0`);              // one filter on both blocks, x only
});
```

Sound: none; the block is loud enough to the eye, and the film keeps its one swell for a stronger cut.

Position is a pure function of `t`, so the blur reads the same curve and never disagrees with the
move. Shot A needs its own ground (`background: var(--ground)`) or shot B shows through at the start.
Put something on the block while it covers the frame (the wordmark), or the render refuses the flat
run as a blank. A hold over 0.1 s on flat colour reads as a stall. The exit blends 30 percent linear
speed into the accelerating curve so the block does not sit still for its first tenth of a second.

Looks (ground, type, radius, accent) live in `demo/demo.css`; this snippet keeps neutral tokens.
