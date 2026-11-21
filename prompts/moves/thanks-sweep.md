# Thanks sweep

**Use when** a closing line should arrive as one gesture, not a fade. A soft mask edge crosses the
line left to right and an accent bar rides that edge; a second, smaller line follows 140 ms behind
on the same sweep. The bar leaves the moment the edge passes the last letter, and a slow linear
drift carries the finished lines to the last frame. Clip: [thanks-sweep.mp4](clips/thanks-sweep.mp4).
Demo: [demo/thanks-sweep.html](demo/thanks-sweep.html).

Use once per film: the accent bar is a stock device (rule no-tells), never the idea.

```html
<div class="sweep big"><span class="t">Thanks for watching.</span><i class="bar"></i></div>
<style>
@property --p { syntax: '<percentage>'; inherits: true; initial-value: 0%; }
.sweep { position: relative; --p: 0%; }
.sweep .t { display: block; white-space: nowrap;
  mask-image: linear-gradient(90deg, #000 calc(var(--p) - 9%), transparent var(--p)); }
.bar { position: absolute; top: 8%; bottom: 8%; left: var(--p); width: 0.9vh; margin-left: -0.45vh; border-radius: 1vh; background: var(--accent); }
</style>
<script type="module">
import { EASE } from '../../core/motion/presets.js';
sweep.animate([{ '--p': '0%' }, { '--p': '112%' }], { duration: 950, easing: EASE.land, fill: 'both' });
bar.animate([{ opacity: 1 }, { opacity: 1, offset: 0.3 }, { opacity: 0, offset: 0.42 }, { opacity: 0 }], { duration: 950, easing: 'linear', fill: 'both' });
drift.animate([{ translate: '0 0' }, { translate: '-2.4vw 0' }], { duration: 1800, easing: EASE.glide, fill: 'both' });
</script>
```

Sound: bloom at 0.00 s into the move, as the mask edge starts across the line (default gain).

The mask edge and the bar read the same `--p`, so the bar is on the edge in every frame. The edge
is a 9 percent gradient, not a hard clip, so no letter is sliced. The bar fades at offset 0.3 to
0.42 because the exponential curve reaches the end of the text at about a third of the time; a
bar left at the end points at nothing (taste rule 4). The last keyframe needs its own
`opacity: 0`; without it the browser adds an implicit end frame that brings the bar back. Put the
bar on one line only: two bars are two focal points.

Looks (ground, type, radius, accent) live in `demo/demo.css`; this snippet keeps neutral tokens.
