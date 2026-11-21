# Mask rise

**Use when** a line of type enters from under an invisible edge, and something in the scene can time it: a walker, a hand, a door passes and the word rises behind it. The mask box is taller than the line: 0.25em below for descenders (g, y, p) and 0.2em above for the overshoot, pulled back with negative margins so the layout does not move. Without that padding the descenders are cut on the way up and the settled word still looks clipped. Clip: [mask-rise.mp4](clips/mask-rise.mp4) (6 s, real footage). Demo: [demo/mask-rise.html](demo/mask-rise.html).

```css
.mask { display: block; overflow: hidden; padding: 0.2em 0.1em 0.25em; margin: -0.2em -0.1em -0.25em; }
.mask > span { display: block; translate: 0 118%; animation: rise 0.5s var(--ease) var(--in) both; }
@keyframes rise { from { opacity: 0; } to { translate: 0 0; opacity: 1; } }
```

```html
<h1 class="hero">
  <span class="mask"><span style="--in: 0.55s; --ease: var(--land)">Light</span></span>
  <span class="mask"><span style="--in: 2.3s; --ease: var(--pop)"><em>follows</em>.</span></span>
</h1>
<script type="module">
import { EASE } from '../../core/motion/presets.js';
document.documentElement.style.setProperty('--land', EASE.land);
document.documentElement.style.setProperty('--pop', EASE.pop);
</script>
```

Sound: none. The clip is silent.

The scene is a woman in silhouette walking across a sunset, mirrored so she walks left to right (Mixkit, free licence; source and licence in `demo/assets/mask-rise/credits.json`). The camera is still, so she crosses the frame at about 0.095 of its width per second (measured on frames 0.9 s apart: x 0.20 at 0.4 s, 0.73 at 5.8 s). Each word is timed to her position: she is under the centre of "Light" (x 0.27) at 0.5 s and the word starts to rise at 0.55 s; she is under the centre of "follows." (x 0.43 to 0.47) at 2.2 to 2.5 s and that word starts at 2.3 s. Each word starts within about 0.2 s of her reaching its centre, so the rise reads as caused by her passing. The type is Instrument Serif 400 (the italic for the second word), 14 percent of the frame height, dark ink `#1c0d05` on the bright sky (the cream tried first read 1.9:1 and failed), placed in the sky above the walker's head and clear of the pine.

Timing. "Light" rises on `EASE.land` and "follows." on `EASE.pop`, 0.5 s each (the hero travels 118 percent of its line, so it takes the longer band). The lead word overshoots its rest by 15 percent of its travel. Both words have landed by 2.8 s and hold to 5.5 s while she keeps walking. The scene leaves in 0.3 s (`leave()` in `demo/assets/stage.js`, 5.6 to 5.9 s) and the footage dips to the dark ground in 0.18 s (5.72 s), shorter than the 0.3 s dip in at the start. Frame 0 and the last frame are the same dark ground (`#0b0604`), so the loop does not jump to the walker's other position. The two words are 2 arrivals, so the overshoot share does not print; the lead overshoots 15 percent.

Footage in a page. The renderer does not seek a `<video>`. Load the file as a blob (`URL.createObjectURL(await (await fetch(src)).blob())`, because the preview server does not answer range requests and a streamed file clamps every seek to the start), set `video.currentTime` inside `window.seek(t)` and wait for `seeked`, then `drawImage` the frame to a canvas. The canvas mirrors the frame with `ctx.setTransform(-1, 0, 0, 1, width, 0)`. The raw file (`walker.source.mp4`) is not committed.

Looks (ground, type, radius, accent) live in `demo/demo.css`; this snippet keeps neutral tokens.
