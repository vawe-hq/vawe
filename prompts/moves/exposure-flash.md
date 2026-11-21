# Exposure flash

**Use when** a film cuts between worlds and the cut must read as a camera over-exposing: the frame blows
out for 3 frames, the shot swaps inside the peak, and the new shot starts over-bright and settles in 0.15 s.
A 0.3 s white div at partial opacity is not this: it is a fade, not a flash. The clip cuts between three
photographs, each with a caption, a slow push and a running timecode. Clip:
[exposure-flash.mp4](clips/exposure-flash.mp4). Demo: [demo/exposure-flash.html](demo/exposure-flash.html). The helper
is `core/motion/exposure.js`. The flash is a real exposure change, not a CSS look. The glow, mask and colour
fringe of a screen are lens work: do not fake them with CSS.

```html
<div id="host"><div class="shot">...</div><div class="shot">...</div></div>
<div id="white" style="position:absolute;inset:0;background:#fff;opacity:0"></div>
<script type="module">
import '../../core/engine/page-api.js';
import { flashAt } from '../../core/motion/exposure.js';
const CUTS = [1.4, 2.9];
vawe.onFrame((t) => {
  const { white: w, brightness, shot } = flashAt(t, CUTS);   // { fps: 30, frames: 3, peak: 0.75, over: 2, settle: 0.15 }
  shots.forEach((s, i) => s.toggleAttribute('data-on', i === shot));
  host.style.filter = brightness === 1 ? 'none' : `brightness(${brightness})`;
  white.style.opacity = w;
});
</script>
```

Sound: a recorded hit at each cut, or one soft swell that stops dead on the cut (the film's one swell, on one flash only).

- The peak is `frames / fps` seconds centred on the cut: white at 0.75 alpha lifts a mean luma of 60 to about 200.
  `shot` counts the cuts passed, so the swap happens in the middle of the peak and the viewer never sees it.
- After the peak the shot is at `brightness(2)` and eases to 1 on a squared curve over `settle` s. This is the
  falloff that makes it read as light.
- `flashAt` flashes at most 3 cuts in any one second (`flashCuts`). A fourth cut in that second still cuts,
  without the flash. Keep flashes to a few per film; they are accents.
- Use it once or twice a film, on the strongest beats only. Held for 6 frames or more it is a strobe.
- Each shot has a slow push (`EASE.glide`, 6 percent) up to its cut, so the last frame before a flash is not a
  still. The timecode keeps the hold alive.
- The renderer flags an all-white frame: declare it with `<meta name="blank" content="1.35-1.45">`.

Common mistake: three flat colour slates with a white fade between them. The shots must be real pictures with
detail, so the viewer sees the highlights blow out and the detail return.

Looks (ground, type, radius, accent) live in `demo/demo.css`; this snippet keeps neutral tokens.
