# Vertical cut reveal

**Use when** a line of type must arrive hard-edged and fast: every character (or word, or line) rises
from under its own invisible edge, one after another, and the stagger can start at the first item, the
last, the middle or any index. It is a port of the `vertical-cut-reveal` component of fancy, so the
numbers below are the original's. Clip: [vertical-cut-reveal.mp4](clips/vertical-cut-reveal.mp4). Demo:
[demo/vertical-cut-reveal.html](demo/vertical-cut-reveal.html).

The function is in the demo page (about 30 lines): copy it with the CSS. Time is the seek: there is no
trigger, `at` is the second the animation starts.

```css
.vcr { display: flex; flex-wrap: wrap; white-space: pre-wrap; }
.vcr.lines { flex-direction: column; }
.vcr-word { display: inline-flex; overflow: hidden; }       /* the clip box: one per word */
.vcr-char { position: relative; white-space: pre-wrap; }
.vcr-glyph { display: inline-block; }                       /* the part that moves */
```

```js
import { motionSpring } from '../../core/motion/motion-spring.js';
// verticalCutReveal(el, text, { splitBy, staggerFrom, stagger, reverse, spring, delay, at, seed }) returns frame(t)
const spring = { stiffness: 200, damping: 21 };
const lines = [
  verticalCutReveal(a, 'Cut from below,', { splitBy: 'characters', stagger: 0.025, spring, at: 0.1 }),
  verticalCutReveal(b, 'then from above,', { splitBy: 'characters', stagger: 0.025, staggerFrom: 'last', reverse: true, delay: 0.5, spring, at: 0.1 }),
];
vawe.onFrame((t) => lines.forEach((f) => f(t)));
// inside: y = (reverse ? -100 : 100) * (1 - motionSpring(spring, 100)(t - at - delay - itemDelay)), as translateY(y%)
```

Sound: none; a type reveal has no event to mark.

## The numbers (the original's defaults)

- Spring: stiffness 190, damping 22, mass 1 by default; the demo uses 200 and 21. The spring is the
  motion library's, in [core/motion/motion-spring.js](../../core/motion/motion-spring.js): it
  settles in about 0.5 s and overshoots by under 1 percent.
- `staggerDuration` 0.2 s by default (words). For `splitBy: 'characters'` use 0.025 s.
- `staggerFrom`: `first`, `last`, `center`, `random` or an index. Center is `floor(total / 2)`, and
  `total` counts the spaces between words, but the item index does not: for `characters` the centre
  sits about one item to the right of the true middle. Random draws one centre per item from the seeded `seed`.
- `reverse` starts each item at `-100%` (it falls into place) instead of `100%`.
- Structure: one `overflow: hidden` box per word, one inline-block glyph inside it. The box is the
  line height, so a tight `line-height` clips descenders. Give the line 1.1 or more.
- `splitBy`: `characters`, `words`, `lines` (the container becomes a column) or any separator string.
- `delay` adds to every item (the original's `transition.delay`).

## Fidelity

Checked against the live component at 60 fps with a virtual clock. The y of every glyph matches the
original to 0.2 percent of the line height, and each line's layout box matches to 0.06 px. The same
frames match to an SSIM of 0.98 once the page's own buttons are masked; the rest is font smoothing.

## The common mistake

Moving the clip box instead of the glyph, or clipping the whole line with one mask. The cut is per
word: the glyph slides inside its own box, so words that have not started are invisible while the
others already stand. For one mask over a whole line use [mask-rise](mask-rise.md).

Credit: port of fancy by Daniel Petho, MIT, https://github.com/danielpetho/fancy
(component `vertical-cut-reveal`, https://www.fancycomponents.dev/docs/components/text/vertical-cut-reveal).
