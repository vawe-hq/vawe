# Luma matte dissolve

**Use when** the next shot should arrive through its own light: its bright areas appear first, its midtones follow and its dark ground fills in last. The matte is not a shape: it is the next shot's luminance, blurred, mixed with soft noise and thresholded by a value that falls from above white to below black. Clip: [luma-matte-dissolve.mp4](clips/luma-matte-dissolve.mp4) (4.2 s). Demo: [demo/luma-matte-dissolve.html](demo/luma-matte-dissolve.html).

```html
<filter id="luma" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
  <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0.2126 0.7152 0.0722 0 0" result="L"/>
  <feGaussianBlur in="L" stdDeviation="20" result="LB"/>
  <feTurbulence type="fractalNoise" baseFrequency="0.004 0.006" numOctaves="3" seed="4" result="N0"/>
  <feColorMatrix in="N0" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  2.6 0 0 0 -0.8" result="N"/>
  <feComposite in="LB" in2="N" operator="arithmetic" k1="0" k2="0.5" k3="0.5" k4="0" result="LM"/>
  <feComponentTransfer in="LM" result="M"><feFuncA id="ramp" type="linear" slope="2.5" intercept="-2.5"/></feComponentTransfer>
  <feComposite in="SourceGraphic" in2="M" operator="in"/>
</filter>
```

```js
import { EASE, easeFn } from '../../core/motion/presets.js';
const S = 2.5, t0 = 0.9, dur = 2.0;                       // S: the edge is 1/S of the luminance range wide
const sweep = easeFn('settle');                         // a wipe travel that starts and ends at rest
shotB.style.filter = 'url(#luma)';                      // shot A sits under it, unchanged
vawe.onFrame((t) => {
  const u = Math.min(1, Math.max(0, (t - t0) / dur)), th = 1 + 1 / S - (1 + 2 / S + 0.02) * sweep(u);
  ramp.setAttribute('intercept', (-S * th).toFixed(4));   // alpha = S x (luminance - th): visible where the pixel is brighter than th
});
// both shots push 3.5 percent over the clip on the camera ease; shot B starts at 1.05 so its photo edge stays outside the frame
img.animate([{ scale: 1.05 }, { scale: 1.085 }], { duration: 4200, easing: EASE.glide, fill: 'both' });
```

Sound: none; the next shot arrives through its own light, and a soft cut stays soft.

Common mistake: a hard threshold (a steep slope, no blur) on a shot whose bright part is a rectangle. The edge then reads as a box wipe. Keep the edge soft (`S` 2.5, a blur of about 1.5 percent of the frame) and break the straight lines with low-frequency noise mixed half and half into the luminance. Pick a shot B with a spread of brightness: a lit sky, a mid-tone falloff and a dark ground.

The threshold starts above white plus one edge width and ends below black minus one edge width, so the first frame shows nothing and the last shows everything. Read the filter in sRGB (`color-interpolation-filters`), or the linear-light luminance shifts every threshold.
