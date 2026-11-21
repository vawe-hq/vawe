# Ticker takeover

**Use when** a line with a cycling word should be replaced by the real answer, and the replacement should
read as an impact, not a dissolve: "your work lives in a spreadsheet, a doc thread, a chat app" and then
the product crashes in and shoves the whole line off the frame. The line types in, the word in its slot
rolls through three values, then the hero arrives from the right on a long decelerating slide and pushes
the text group out by its left edge. Clip: [ticker-takeover.mp4](clips/ticker-takeover.mp4). Demo:
[demo/ticker-takeover.html](demo/ticker-takeover.html).

```js
import '../../core/engine/page-api.js';
import { EASE, easeFn } from '../../core/motion/presets.js';
const land = easeFn('land');
const clamp = (u) => Math.min(1, Math.max(0, u));
const W = innerWidth, unit = innerHeight / 100, LEAD = 'Your work lives in a';
const groupRight = group.getBoundingClientRect().right, heroW = hero.getBoundingClientRect().width;   // measure with the text in place
const at = { type: [0.15, 0.95], words: [1.0, 1.5, 2.0], hit: 2.4, settle: 1.0 };   // seconds

// the slot rolls: the old word leaves up in 140 ms, the next rises in 300 ms; three words, never more
words.forEach((w, i) => {
  w.animate([{ opacity: 0, translate: '0 70%' }, { opacity: 1, translate: '0 0' }], { duration: 300, delay: at.words[i] * 1000, easing: EASE.land, fill: 'both' });
  if (at.words[i + 1]) w.animate([{ opacity: 1, translate: '0 0' }, { opacity: 0, translate: '0 -70%' }], { duration: 140, delay: at.words[i + 1] * 1000 - 140, easing: EASE.launch, fill: 'forwards' });
});

vawe.onFrame((t) => {
  typed.textContent = LEAD.slice(0, Math.round(LEAD.length * clamp((t - at.type[0]) / (at.type[1] - at.type[0]))));
  const u = clamp((t - at.hit) / at.settle), p = land(u);
  const heroX = (W / 2 + heroW / 2) * (1 - p);                     // from off the right edge to centre, fast then heavy
  hero.style.translate = `calc(-50% + ${heroX}px) -50%`;
  blur.setAttribute('stdDeviation', `${unit * 5 * Math.max(0, 1 - u * 3.2) ** 2} 0`);   // horizontal streak, gone by 0.3 s
  const heroLeft = W / 2 - heroW / 2 + heroX, follow = Math.min(0, heroLeft - groupRight - unit * 2);
  const carry = -W * 0.9 * land(clamp((t - at.hit - 0.17) / 1.2));   // momentum after contact
  const x = t < at.hit ? 0 : Math.min(follow, carry);              // the hero's edge pushes, the group then carries on
  group.style.transform = `translateX(${x}px) rotate(${-4 * clamp(-x / (W * 0.4))}deg)`;
});
```

Sound: impact at 2.57 s into the move, when the hero's edge meets the text (default gain); nothing on the typing or the roll.

The shove is computed, not keyed: the group's x is the smaller of "stay one gap left of the hero's edge"
and a free carry curve, so the text is never overlapped and the contact is exact at any speed. The hero
lands heavy: an `EASE.land` over 1.0 s gives a fast hit and a long settle, with no bounce (a bounce reads
as light). Give the hero a horizontal-only blur while it is fast. The text group tilts 4 degrees as it
is knocked aside. More than three cycling words reads as filler.

Looks (ground, type, radius, accent) live in `demo/demo.css`; this snippet keeps neutral tokens.
