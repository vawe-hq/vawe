# CTA morph press

**Use when** the film closes from "this is who we are" to "this is what you do". One brand plate changes
shape into a button: width, height and radius share one curve, and the fill goes from white to ink. A cursor
arrives on a bowed path and the button shows the real states of a button: hover (the fill lightens), pressed
(a dip, the fill darkens), loading (the label gives way to a spinner) and done (a check and "You're in").
One action, one element, no surrounding UI. Clip: [cta-morph-press.mp4](clips/cta-morph-press.mp4). Demo:
[demo/cta-morph-press.html](demo/cta-morph-press.html).

```js
import { spring } from '../../core/motion/springs.js';
import { easeFn } from '../../core/motion/presets.js';
const at = { morph: 1.0, go: 1.35, arrive: 2.3, down: 2.4, release: 2.55, busy: 2.65, done: 3.55 };   // seconds
const plate = { w: 100 * u, h: 46 * u, r: 3 * u }, button = { w: 84 * u, h: 22 * u, r: 3.4 * u };   // u = frame height / 100
vawe.onFrame((t) => {
  const m = easeFn('land')(clamp((t - at.morph) / 0.8));        // one curve drives all three, so the plate is the button at every frame
  el.style.width = `${lerp(plate.w, button.w, m)}px`;
  el.style.height = `${lerp(plate.h, button.h, m)}px`;
  el.style.borderRadius = `${lerp(plate.r, button.r, m)}px`;
  const pressed = seg(t, at.down, at.down + 0.09) - spring(t - at.release, 300, 13);   // a fast dip, then a spring back that overshoots a little
  el.style.scale = 1 - pressed * 0.03;
  // fill: white to ink with the morph, a lighter ink while the cursor hovers, darker while pressed
  // labels swap in sequence, never two at half opacity: plate out, "Start free" in, spinner, then the check
  spin.style.rotate = `${((t - at.busy) / 0.8 * 360) % 360}deg`;   // the spinner turns once in 0.8 s
});
```

Sound: droplet at 2.4 s on the press (default gain); nothing on the morph or the approach.

The button is a real size (84 by 22 units), never a chip beside the plate. The fill changes after the shape,
so the plate is never a muddy half colour: the plate label leaves first, and the new label arrives once the
fill is dark. The release stays a physical spring (`spring(t, 300, 13)`): no `EASE` segment rings back past the
press. The cursor rides a quadratic bow and `land` on the parameter makes it decelerate into the press. The
cursor leaves before the result holds, and a note under the button confirms the result.

Common mistake: a button with only a press. A real button shows hover, pressed, loading and done, and the
loading state keeps the button size, so the width does not jump.

Looks (ground, type, radius, accent) live in `demo/demo.css`; this snippet keeps neutral tokens.
