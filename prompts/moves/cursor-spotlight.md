# Cursor spotlight

**Use when** a click opens the next screen and the film must not cut: the cursor tip is the handoff object.
The clip copies an app window. A reports list shows an "Open report" button. After the press, a soft circle is
born at the cursor tip and grows. The report page loads inside it, in the same window: the bars draw, the
source rows appear and the number counts up. The list stays outside the circle until it covers the frame.
The press and the circle share one point, so the viewer reads "this click opened that page". Clip:
[cursor-spotlight.mp4](clips/cursor-spotlight.mp4). Demo: [demo/cursor-spotlight.html](demo/cursor-spotlight.html).

```js
import { easeFn } from '../../core/motion/presets.js';
const land = easeFn('land'), settle = easeFn('settle');
const EDGE = 1.2 * u, R0 = 0.9 * u;                                        // u = innerHeight / 100
const RMAX = FAR + EDGE * 1.5;                                             // FAR: tip to the farthest corner
vawe.onFrame((t) => {
  const k = clamp((t - 2.1) / 0.9);                                        // the circle starts 0.1 s after the press at 2.0 s
  const R = lerp(R0, RMAX, settle(k)), f = Math.min(Math.max(R * 0.3, 0.3 * u), EDGE);
  const mask = `radial-gradient(circle at ${x}px ${y}px, #000 ${Math.max(R - f, 0)}px, transparent ${R}px)`;
  shotB.style.maskImage = mask;                                            // shot B sits above shot A, the cursor above both
  shotA.style.display = t > 2.1 + 0.9 + 0.05 ? 'none' : 'block';           // once B covers the frame, A goes, so the exit shows empty ground
});
```

Sound: one soft click on the press (0.1 s before the circle is born); nothing on the growth.

- The edge is a mask, not a blur: an opaque core and a soft shoulder of constant width, 1.2 u (30 percent of the
  radius only while the circle is tiny). A shoulder in percent of the radius grows to a haze at full size. A blur
  of the edge would also blur the content inside it.
- The core, `R - edge`, must reach the farthest corner, so `RMAX = FAR + 1.5 * EDGE`. Otherwise a wedge of the
  list stays in the corner.
- The circle centre is the cursor tip, and the tip keeps drifting 2 percent of the width for 1 s after the press.
  The cursor arrives near rest and the circle is born at rest, so no speed jumps.
- Both shots are the same window: the frame, the tab strip and the address bar do not change position, only
  their text. The new page has a grey ground and white cards, so the circle edge reads on a light screen.
- Z-order is explicit: shot A z 1, shot B z 5 with the mask, cursor z 10.
- The page keeps one small part alive after it loads: the "updated" label ticks every second.

Common mistake: a hard `clip-path: circle()`. It reads as an iris wipe ([iris-wipe](iris-wipe.md)). Here the
circle opens with a soft edge from the tip, and a circle born from the button centre breaks the link to the
cursor.

Looks (ground, type, radius, accent) live in `demo/demo.css`; this snippet keeps neutral tokens.
