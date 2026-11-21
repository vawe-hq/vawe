# Counter dive

**Use when** a title hands over to the next scene by entering one of its letters: the camera pushes
into the counter (the hole) of an "o" and the next scene is inside it. The hole shows scene B from the
first frame as a tiny world, so the dive is a reveal that was already there, and there is no cut. It is
a different move from [zoom-through](zoom-through.md), which dives into a plain disc and swaps shots at
the end; here the letter's own shape is the portal. Clip: [counter-dive.mp4](clips/counter-dive.mp4). Demo:
[demo/counter-dive.html](demo/counter-dive.html).

```js
import { easeFn } from '../../core/motion/presets.js';
const settle = easeFn('settle');
const AT = 0.7, DUR = 1.5;
const ri = 0.24 * disc.width;                                       // the counter of the drawn "o": a disc in ink, a hole cut out of scene A
const R = (1.15 * Math.hypot(W / 2, H / 2)) / ri;                   // the scale at which the hole covers the frame corners
a.style.clipPath = `path(evenodd, 'M0 0H${W}V${H}H0Z M${ox + ri} ${oy}A${ri} ${ri} 0 1 0 ${ox - ri} ${oy}A${ri} ${ri} 0 1 0 ${ox + ri} ${oy}Z')`;
vawe.onFrame((t) => {
  const p = settle(clamp((t - AT) / DUR)), s = Math.exp(Math.log(R) * p);   // log space: equal share of the zoom every frame
  const px = ox + (W / 2 - ox) * p, py = oy + (H / 2 - oy) * p;             // the counter's centre drifts to the middle
  a.style.transform = `translate(${px - s * ox}px, ${py - s * oy}px) scale(${s})`;           // transform-origin 0 0
  const k = s / R;                                                                        // scene B is full frame at the end
  b.style.transform = `translate(${px - k * W / 2}px, ${py - k * H / 2}px) scale(${k})`;
});
```

Sound: none; the dive carries the eye, and the next scene's own entrance takes the cue.

Draw the "o" as an ink disc and cut the counter out of the whole of scene A with an even-odd path,
not as a CSS border: the hole and the ring edge are then one circle, and scene B shows through it with
no mask layer. Scene B sits behind and scales by `s / R`, so it is one world from the miniature in the
hole to full frame at the last frame. Its ground must differ from the letter's ink (here lemon on
white type) or the ring disappears and the "o" reads as a plain disc. Hide scene A once `s` passes
95 percent of `R`: its hole already covers the frame.

The zoom runs in log space on one `EASE.settle`, 1.5 s for about 20 times: faster than 1 s loses the
miniature, and a push that goes past `R` and back reads as a bounce. Zoom blur is real: 8 copies at
shutter times, opacities 1, 1/2, 1/3 and so on, shown as one copy when the frame is still. Keep the
word short and put the "o" away from the frame edge: a long dive off-centre makes the counter's
centre travel, and the hold before it reads as drift.

Looks (ground, type, radius, accent) live in `demo/demo.css`; this snippet keeps neutral tokens.
