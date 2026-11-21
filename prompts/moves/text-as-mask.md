# Text as mask

**Use when** a title should carry a picture instead of a flat fill: huge, heavy type is a window onto
a rich image, and the image keeps moving inside the fixed letters. The clip opens tight, so the
frame is mostly image, and pulls back until the letters read as a title. The image here is made in
CSS and SVG (a sky gradient, a sun, two ridges); use the product shot or a capture the same way.
Clip: [text-as-mask.mp4](clips/text-as-mask.mp4). Demo: [demo/text-as-mask.html](demo/text-as-mask.html).

```css
.title { font: 900 33vh/0.86 var(--sans); font-stretch: 125%; text-transform: uppercase; white-space: nowrap;
         color: transparent; -webkit-background-clip: text; background-clip: text; background-repeat: no-repeat;
         filter: drop-shadow(1.3vh 1.3vh 0 #000);
         background-image: url(near-ridge.svg), url(far-ridge.svg), radial-gradient(circle, #fff6dc 0 24%, #ffcf70 27% 40%, transparent 70%),
                           radial-gradient(ellipse 60% 70% at 62% 70%, rgba(255,140,60,.85), transparent 72%), linear-gradient(180deg, #1d2b4f, #6b4a6e 30%, #d9704a 60%, #f6b35a 88%);
         background-size: 150% 34%, 130% 48%, 46% 92%, 100% 100%, 100% 100%; }
```

```js
import '../../core/engine/page-api.js';
import { easeFn } from '../../core/motion/presets.js';
const land = easeFn('land'), glide = easeFn('glide');
const S = 3.2, t0 = 0.05, dur = 1.15, lerp = (a, b, u) => a + (b - a) * u;
vawe.onFrame((t) => {
  const p = land(Math.min(1, Math.max(0, (t - t0) / dur)));
  const k = Math.min(1, t / 2);
  stage.style.scale = Math.exp(Math.log(S) * (1 - p)) * (1 + 0.035 * k);          // pull back on a log path, then a slow push
  const sunY = lerp(100, 46, glide(Math.min(1, t / 1.8)));
  title.style.backgroundPosition = `${lerp(0, 22, k)}% 100%, ${lerp(0, 12, k)}% 100%, 62% ${sunY}%, 50% 100%, 0 0`;   // one value per layer
});
```

Sound: bloom at 0.05 s into the move, with the pull back from the picture (default gain).

The type is fixed and the picture moves under it, so the letters read as a window and not as a
filled shape. Layers move at different speeds (near ridge 22 percent, far ridge 12, the sun rises
out of the far ridge), which is parallax inside the glyphs. Use the heaviest weight and a wide
stretch: a thin face leaves no window, and a serif hairline loses the picture. Keep the scene
tall enough to fill two lines, with one bright point (the sun) crossing the join between them. A
hard offset shadow gives the shape an edge; `-webkit-text-stroke` draws the glyph overlaps of a
variable font as inner lines, so do not use it here.

Looks (ground, type, radius, accent) live in `demo/demo.css`; this snippet keeps neutral tokens.
