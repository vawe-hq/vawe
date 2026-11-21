# Smear stretch

**Use when** a cut should feel elastic and fast, like an animator's smear frame: shot A's content
stretches toward the exit on `carry` until it is streaks of its own colours, the cut lands at the
peak, and shot B's content arrives as the same streak from the other side and snaps back to shape on
`pop`. The detail that sells it is volume: the content thins as it stretches (scaleY
0.9) and bulges a few percent as the pop passes rest (scaleX 0.91, scaleY 1.08), so it reads as
rubber, not as a scaled picture. Clip: [smear-stretch.mp4](clips/smear-stretch.mp4). Demo: [demo/smear-stretch.html](demo/smear-stretch.html).

```html
<svg width="0" height="0" style="position: absolute"><filter id="smear" x="-5%" width="110%"><feGaussianBlur id="mb" stdDeviation="0 0"/></filter></svg>
<div class="shot b"><div class="fg" style="transform-origin: 100% 50%; filter: url(#smear)">...</div></div>
<div class="shot a"><div class="fg" style="transform-origin: 0 50%; filter: url(#smear)">...</div></div>
<script type="module">
import '../../core/engine/page-api.js';
import { easeFn } from '../../core/motion/presets.js';
const clamp = (u) => Math.min(1, Math.max(0, u));
const OUT = 0.5, OUT_DUR = 0.16, IN_DUR = 0.62, PEAK = 9, carry = easeFn('carry'), pop = easeFn('pop');
const cut = OUT + OUT_DUR;
const stretch = (t) => (t < cut ? carry(clamp((t - OUT) / OUT_DUR)) : 1 - pop(clamp((t - cut) / IN_DUR)));
vawe.onFrame((t) => {
  const s = stretch(t);
  const sx = s > 0 ? 1 + (PEAK - 1) * s : 1 + 0.6 * s, sy = s > 0 ? 1 - 0.1 * Math.min(1, s * 1.5) : 1 - 0.5 * s;
  a.style.visibility = t < cut ? 'visible' : 'hidden';
  (t < cut ? fa : fb).style.transform = `scale(${sx}, ${sy})`;   // fa, fb: the .fg of each shot
  blur.setAttribute('stdDeviation', `${Math.abs(stretch(t + 1 / 60) - s) * PEAK * 14} 0`);
});
</script>
```

Sound: none; the streak already says speed, and the film keeps its one whoosh for a whip.

Stretch the content, never the shot's ground: a ground squashed below full width shows a gap at the
edge. The two origins are opposite (A anchored at its left, B at its right), so the streak runs one way
through the cut. A peak of 8 to 10x turns type into clean streaks; under 5x it reads as a distorted
word. `EASE.pop` passes rest once by about 15 percent; scale that undershoot by 0.6 so the
squash is a few percent, since the full stretch factor makes it a bounce. Exit 0.16 s, entrance 0.62 s.

Looks (ground, type, radius, accent) live in `demo/demo.css`; this snippet keeps neutral tokens.
