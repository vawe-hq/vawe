# Marker highlight

**Use when** one phrase in a line of text must be picked out the way a person does it on a page: with a highlighter pen.
Clip: [marker-highlight.mp4](clips/marker-highlight.mp4). Demo: [demo/marker-highlight.html](demo/marker-highlight.html).

Look: dark text on the flat neutral ground. The mark is translucent yellow with `mix-blend-mode: multiply`, so the text
stays dark and the ground shows through. It covers the lower two thirds of the line, tilts about half a degree and has
ragged, uneven ends. A second pen pass over the same words overlaps the first and goes darker where they meet, as ink does.

How it moves: the pen is a slanted edge that crosses the word in 0.55 to 0.65 s on `EASE.settle`. A pass can go left to
right or back. The text does not move. After the last pass the page holds, then leaves on `leave`.

```js
import { EASE } from '/core/motion/presets.js';
const stroke = (wipe, atMs, ms, rtl = false) => {
  const hide = rtl ? 'polygon(112% 0, 112% 0, 120% 100%, 112% 100%)' : 'polygon(-12% 0, -12% 0, -20% 100%, -12% 100%)';
  const show = rtl ? 'polygon(-8% 0, 100% 0, 100% 100%, 0 100%)' : 'polygon(0 0, 108% 0, 100% 100%, 0 100%)';
  wipe.animate([{ clipPath: hide }, { clipPath: show }], { duration: ms, delay: atMs, easing: EASE.settle, fill: 'both' });
};
stroke(wipes[0], 500, 650);          // .wipe: absolute inset 0, mix-blend-mode: multiply, holds the .bar
stroke(wipes[1], 1700, 650);         // .bar: #ffe14d, rotate(-0.5deg), clip-path with an uneven outline
stroke(wipes[2], 2300, 550, true);   // a second pass, right to left, on a taller .bar
```

Sound: none, or a soft pen drag under each pass (a noise swish at 0.5 s).

Common mistake: an opaque solid box with light text. A real highlighter is see-through and the text stays dark. Use `multiply`, a pale
yellow, and an uneven outline, never a brand fill.

Looks (ground, type, radius, accent) live in `demo/demo.css`; this snippet keeps neutral tokens.
