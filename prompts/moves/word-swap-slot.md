# Word swap slot

**Use when** a held sentence has one open word that changes value: "We make films that feel fast,
loud, clean, alive". The word sits in a slot, rolls up through 3 or 4 values and lands on the last
one, and the sentence reflows its width as the slot grows and shrinks. Reference: HyperFrames
kinetic-type-swap. Clip: [word-swap-slot.mp4](clips/word-swap-slot.mp4). Demo:
[demo/word-swap-slot.html](demo/word-swap-slot.html).

```css
.slot { position: relative; display: inline-block; vertical-align: baseline;
        clip-path: inset(-0.35em -0.1em -0.35em -0.1em); }   /* window = one 1.7em row */
.col { position: absolute; left: 0; top: -0.35em; }
.col b { display: block; height: 1.7em; line-height: 1.7em; font-weight: inherit; }
```

```js
const w = words.map((b) => { const r = document.createRange(); r.selectNodeContents(b); return r.getBoundingClientRect().width / px; });
const seg = [380, 380, 650], total = 1410, at = [0, 0.27, 0.54, 1];   // cumulative share of total
const easing = [EASE.swap, EASE.swap, EASE.pop];
const opts = { delay: 200, duration: total, fill: 'both', easing: 'linear' };
col.animate(at.map((o, i) => ({ offset: o, translate: `0 ${-i * 1.7}em`, easing: easing[i] })), opts);
slot.animate(at.map((o, i) => ({ offset: o, width: `${w[i]}em`, easing: easing[i] })), opts);
```

Sound: pluck at 1.15 s into the move, when the last word lands (default gain); no tick per value.

Each word is measured with a `Range` after `await document.fonts.load(...)`, so the width in `em` is
exact. `<span>` in the slot holds a zero-width space so the slot has a baseline.

## The numbers that make it look expensive

- Each word dwells about 0.25 s and then rolls: the roll easing `EASE.swap` is slow
  at the start and fast at the end, so the eye reads every value.
- The last segment uses `EASE.pop`: the final word drops in, dips 8 percent past its row
  and settles. The last word takes the accent colour.
- The width animates on the same keyframes and the same easing as the roll, so the words after the
  slot (or the centred sentence) move with the word, never before or after it.
- A small blur (0.05em) peaks at the middle of each roll and is gone at rest.

## The common mistake

Using `overflow: hidden` on the slot. It moves the baseline to the bottom edge of the box and cuts
descenders. Use `clip-path: inset()` with a window as tall as one row (1.7em) and rows spaced by the
same 1.7em, so the neighbour is never visible at rest and no glyph is cut. And never swap the text
in place with a cross-fade: the roll is the whole move.

Looks (ground, type, radius, accent) live in `demo/demo.css`; this snippet keeps neutral tokens.
