# Push with directional blur

**Use when** a panel pushes in and should feel fast. The blur follows the panel's speed on the same
curve: SVG filters cannot be keyframed, so `vawe.onFrame` sets `stdDeviation` every frame to half of
one frame's travel, x only. A still panel gets zero blur; a moving one blurs along its motion, never
across it. Clip: [push-blur.mp4](clips/push-blur.mp4). Demo: [demo/push-blur.html](demo/push-blur.html).

```html
<svg width="0" height="0" style="position: absolute"><filter id="motion" x="-30%" width="160%"><feGaussianBlur id="mb" stdDeviation="0 0"/></filter></svg>
<div class="panel" style="filter: url(#motion)">in</div>
<script type="module">
import '../../core/engine/page-api.js';
import { EASE, easeFn } from '../../core/motion/presets.js';
const panel = document.querySelector('.panel'), blur = document.getElementById('mb');
const t0 = 0.1, dur = 0.7, travel = 0.6 * window.innerWidth;   // t0 is the beat, in seconds
panel.animate([{ translate: `${travel}px 0` }, { translate: '0 0' }],
  { duration: dur * 1000, delay: t0 * 1000, easing: EASE.land, fill: 'both' });
vawe.onFrame((t) => {
  const u = Math.min(1, Math.max(0, (t - t0) / dur)), du = 1 / 240;
  const slope = (land(Math.min(1, u + du)) - land(u)) / du;
  const pxPerFrame = (slope / dur) * travel / 60;
  blur.setAttribute('stdDeviation', `${(u > 0 && u < 1 ? pxPerFrame * 0.5 : 0).toFixed(2)} 0`);
});
</script>
```

Sound: none; the blur already says speed, and the film keeps its one whoosh for a whip.

The filter region (`x="-30%" width="160%"`) is wider than the panel so the blur is not clipped at its
edges. For a vertical push swap the two `stdDeviation` numbers and the translate axis.

Looks (ground, type, radius, accent) live in `demo/demo.css`; this snippet keeps neutral tokens.
