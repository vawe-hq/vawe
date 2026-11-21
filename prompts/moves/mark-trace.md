# Mark trace

**Use when** the logo mark is a line shape and should draw itself. A thin white line traces the
mark with an accent dot on its leading end; the line then thickens to the final weight, the dot
sinks into it, and an accent bar runs the finished mark to the last frame. Clip:
[mark-trace.mp4](clips/mark-trace.mp4). Demo: [demo/mark-trace.html](demo/mark-trace.html).

Use once per film: the accent bar is a stock device (rule no-tells), never the idea.

```html
<svg viewBox="0 0 100 100">
  <path class="ink" d="M12 24 L34 78 L50 38 L66 78 L88 24"/>
  <path class="run" pathLength="1" d="M12 24 L34 78 L50 38 L66 78 L88 24"/>
  <circle class="tip" r="4" cx="12" cy="24"/>
</svg>
<style>
path { fill: none; stroke-linecap: round; stroke-linejoin: round; }
.ink { stroke: #fff; stroke-width: 2.5; }
.run { stroke: var(--accent); stroke-width: 9; stroke-dasharray: 0.2 1; opacity: 0; }
.tip { fill: var(--accent); transform-box: fill-box; transform-origin: center; }   /* else scale pulls it to the svg origin */
</style>
<script type="module">
import '../../core/engine/page-api.js';
import { EASE, easeFn } from '../../core/motion/presets.js';
const smooth = easeFn('settle');
const len = ink.getTotalLength(); ink.style.strokeDasharray = len;
const t0 = 0.08, dur = 0.9;
vawe.onFrame((t) => {   // line and tip read one function per frame, so the tip is always on the leading end
  const u = Math.min(1, Math.max(0, (t - t0) / dur));
  ink.style.strokeDashoffset = ((1 - smooth(u)) * len).toFixed(2);
  const p = ink.getPointAtLength(smooth(u) * len);
  tip.setAttribute('cx', p.x.toFixed(2)); tip.setAttribute('cy', p.y.toFixed(2));
});
tip.animate([{ opacity: 1, scale: 1 }, { opacity: 0, scale: 0.4 }], { duration: 220, delay: 980, easing: EASE.launch, fill: 'both' });
ink.animate([{ strokeWidth: 2.5 }, { strokeWidth: 9 }], { duration: 520, delay: 950, easing: EASE.landSoft, fill: 'both' });
run.animate([{ opacity: 1, strokeDashoffset: 0.2 }, { opacity: 1, strokeDashoffset: -1 }], { duration: 750, delay: 1250, easing: EASE.settle, fill: 'both' });
</script>
```

Sound: droplet at 0.95 s into the move, when the line thickens and the tip sinks into it (default gain).

The trace is `EASE.settle` at 0.9 s: even speed with soft ends. `EASE.land` draws the whole
mark in 0.4 s and then waits, which reads as a wipe. The tip is set from the same function as the
line, so it never drifts off the leading end (rule 4: a mark rides its parent). Dashes on the
`.ink` path use its real length, not `pathLength`, so the tip and the line agree. The thin-to-thick
step is what turns a drawn line into a logo. Keep the accent bar under 25 percent of the path.

Looks (ground, type, radius, accent) live in `demo/demo.css`; this snippet keeps neutral tokens.
