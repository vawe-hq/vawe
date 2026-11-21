# Dot grid wave

**Use when** a clean product or data frame needs a ground that reads as a fine texture and shows a wave
only when it passes. The clip is a flat neutral ground with a field of ink dots, 2.4 percent of the frame
height apart. A band of larger, darker dots travels across the field on a diagonal, twice in 5 s. The dots behind
the copy fade to 30 percent, so the title stays clean. The copy rises in a mask and the lead resolves word by word.
It is SVG with the look's ink, no shader. Clip: [dot-grid-wave.mp4](clips/dot-grid-wave.mp4). Demo:
[demo/dot-grid-wave.html](demo/dot-grid-wave.html).

```js
import '../../core/engine/page-api.js';
const PITCH = 0.024, BASE = 0.0016, PEAK = 0.0036, PASSES = [0.5, 2.7], SPEED = 0.7, SIGMA = 0.15;   // radii and pitch: shares of the frame height
const W = innerWidth, H = innerHeight;
const dots = [];   // one <circle> per grid point; s is its place along the band's direction, keep fades it behind the copy
for (let y = PITCH * H / 2; y < H; y += PITCH * H) {
  for (let x = PITCH * H / 2; x < W; x += PITCH * H) {
    // ...create the circle at (x, y) in the <svg class="grid">...
    dots.push({ c, s: (x * 0.94 + y * 0.34) / W, keep });
  }
}
vawe.onFrame((t) => {
  for (const d of dots) {
    let w = 0;                                                    // the band is a bell curve that travels: a pure function of t
    for (const t0 of PASSES) { const e = (d.s - (-0.35 + (t - t0) * SPEED)) / SIGMA; w = Math.max(w, Math.exp(-e * e)); }
    d.c.setAttribute('r', (H * (BASE + (PEAK - BASE) * w)).toFixed(2));
    d.c.setAttribute('opacity', (d.keep * (0.2 + 0.7 * w)).toFixed(3));
  }
});
```

Sound: none; a held ground is quiet.

The dots are 1.2 px at rest and 2.6 px in the band on a 720 p frame, in the ink colour at 20 and 90 percent
opacity. Smaller dots vanish in the encode, and dots in an accent colour read as decoration. The band is narrow
(half-width 0.15 frame widths), so the eye sees a wave pass and then a quiet field. Both passes start off screen
and end off screen, so the first and the last frame show the same resting grid.

Common mistake: moving `cx` or `cy`. A grid whose dots move reads as a swarm. Change only the radius and the
opacity, and the grid stays a grid.

Looks (ground, type, radius, accent) live in `demo/demo.css`; this snippet keeps neutral tokens.
