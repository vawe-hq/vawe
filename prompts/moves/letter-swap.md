# Letter swap

**Use when** a word or label must react: each letter slides out of a clip box and the same letter
slides in behind it, so the word seems to roll once. Options give four looks from one move: `forward`
(the swap plays once and resets) or `pingpong` (it holds, then plays back on `leave`), in stagger
order or in seeded `random` order. It is a port of the `letter-swap` and `random-letter-swap`
components of fancy. The hover trigger becomes a time: `at` is the second the swap starts, `leave`
the second it plays back. Clip: [letter-swap.mp4](clips/letter-swap.mp4). Demo:
[demo/letter-swap.html](demo/letter-swap.html).

The function is in the demo page (about 55 lines): copy it with the CSS.

```css
.ls { display: flex; justify-content: center; align-items: center; position: relative; overflow: hidden; }
.ls-letter { white-space: pre; position: relative; display: flex; }
.ls-p { position: relative; }          /* the letter on show: y 0 to 100% (reverse) or -100% */
.ls-s { position: absolute; }          /* the copy waiting outside: top -100% (reverse) or 100%, moves to 0 */
.ls-p.pad { padding-bottom: 0.5rem; }  /* the random variants only */
```

```js
import { motionSpring, motionSpringEasing, motionStagger } from '../../core/motion/motion-spring.js';
// letterSwap(el, label, { mode, reverse, random, stagger, from, spring, at, leave, seed }) returns frame(t)
const lines = [
  letterSwap(a, 'Swap the letters', { at: 0.3 }),                                                   // forward
  letterSwap(b, 'and swap them back.', { mode: 'pingpong', from: 'center', reverse: false, at: 0.3, leave: 2.1 }),
  letterSwap(c, 'Right here!', { random: true, mode: 'pingpong', seed: 7, at: 0.3, leave: 2.1 }),   // random order
];
vawe.onFrame((t) => lines.forEach((f) => f(t)));
```

Sound: none by default; a soft tick at `at` suits a button label.

## The numbers (the original's defaults)

- Spring: `{ duration: 0.7 }` with the motion library's default bounce 0.3 (0.8 s for the random
  variants). That is a damping ratio of 0.7 (stiffness about 198, damping about 19.7 at 0.7 s); the letter
  overshoots its slot by 4.6 percent at about 0.31 s, then settles. It is solved by `motionSpring` in
  [core/motion/motion-spring.js](../../core/motion/motion-spring.js) and ends at exactly the duration.
- Stagger: 0.03 s per letter (0.02 s random). `from` is `first`, `last`, `center` or an index; center
  is the true middle (`(n - 1) / 2`), so an even count gives two letters the same delay.
- Random order: one shuffle of the letter indexes per sweep, drawn from the seeded `rand`
  (`sort(() => rand() - 0.5)`, as the original does); letter `order[i]` starts `i * stagger` after `at`.
  A pingpong draws a second shuffle for `leave`. Pass `orders: [[...], [...]]` to set the orders.
- `reverse: true` (the default) sends the letter up and brings the copy from above.
- `forward` resets when the last letter ends (each letter's own end in random order); the reset is one
  frame late, as in the original, and invisible because both copies show the same letter.
- If `leave` comes before the swap ends, each letter turns round from where it is, with a fresh spring.
- The container is `overflow: hidden` with the line box as its height: a tight `line-height` clips
  descenders. The random variants add 0.5rem under the letter, which moves the whole slide distance.

## Fidelity

Checked against the live components at 60 fps with a virtual clock, nine lines in all (five of letter
swap, four of random letter swap). The `translateY` and `top` of every letter, over 250 frames each,
match the original with a mean absolute difference of 0.014 percent of the line height (largest
0.2 percent, on the first frame). Layout boxes match to 0.03 px. The original needs one more frame to
start a pingpong or a random swap (its hover handler is a motion event): the probe added 1/60 s to
`at` and `leave` for those, and this move does not. A random swap's first order comes from the page's
unseeded first render, so only a seeded order can match: the second order of each pingpong was
reproduced exactly from the same seeded stream.

## The common mistake

Giving the container a tight `line-height`. The container clips to one line box, so a descender or an
accent that leaves the box is cut in every frame, and the overshoot shows the cut. Use 1.1 or more.

Credit: port of fancy by Daniel Petho, MIT, https://github.com/danielpetho/fancy
(components `letter-swap`, `random-letter-swap`:
https://www.fancycomponents.dev/docs/components/text/letter-swap,
https://www.fancycomponents.dev/docs/components/text/random-letter-swap).
