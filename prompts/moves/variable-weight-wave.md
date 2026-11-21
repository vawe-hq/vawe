# Variable weight wave

**Use when** one hero word must feel alive on arrival: a crest of weight and width travels through
its letters from left to right, then every letter settles at a firm weight. The axes are real
(Anybody carries `wght` 100 to 900 and `wdth` 75 to 125), so stems thicken and glyphs widen, and the
word breathes in width as the crest passes. Clip: [variable-weight-wave.mp4](clips/variable-weight-wave.mp4).
Demo: [demo/variable-weight-wave.html](demo/variable-weight-wave.html).

```css
@font-face { font-family: 'Anybody'; font-weight: 100 900; font-stretch: 75% 125%; font-display: block;
             src: url('/assets/fonts/Anybody.woff2') format('woff2'); }
h1 { display: flex; font: 300 24vh/1 'Anybody', sans-serif; font-stretch: 80%; letter-spacing: -0.02em; }
h1 span { display: block; animation-name: crest; animation-duration: 1.1s; animation-timing-function: linear;
          animation-delay: calc(0.1s + var(--i) * 0.085s); animation-fill-mode: both; }
@keyframes crest {
  0%   { font-weight: 300; font-stretch: 80%;  animation-timing-function: var(--rise); }
  38%  { font-weight: 900; font-stretch: 125%; animation-timing-function: var(--settle); }
  100% { font-weight: 640; font-stretch: 100%; }
}
```

```js
// --rise: EASE.carry, --settle: EASE.land
word.innerHTML = [...word.textContent].map((c, i) => `<span style="--i:${i}">${c}</span>`).join('');
```

Sound: none; or one low swell from the first letter's second to the last crest.

## The numbers that make it look expensive

- 85 ms between letters and 1.1 s per letter: the crest (38 percent, 0.42 s in) of one letter passes while the next is still rising, so the wave is one shape, not seven pops.
- The rise is `EASE.carry` (the letter gathers), the fall is `EASE.land` (it lets go and settles). The word rests at 640, not at the start weight: the start is light, the end is firm, so the move also lands the word.
- Weight and width move together on the same keyframes. Weight alone is [weight-morph.md](weight-morph.md); the width axis is what makes the wave read at a glance.
- Start at 300, not 100: a hairline vanishes on the ground and the first frames read as empty.
- Set `font-weight` and `font-stretch`, never `font-variation-settings`: the properties keep working with a fallback face. The `@font-face` must declare both ranges, or the browser snaps to the nearest static instance and nothing morphs.
- The flex row and the letters' changing width re-centre the word each frame. That is the breathing; pin the first letter's left edge instead if the word must not move.

## The common mistake

Animating one `font-weight` on the whole `h1` and staggering nothing: it is a morph, not a wave. And a
face with one weight: check `wght` and `wdth` in the font file before you write the keyframes.

Looks (ground, type, radius, accent) live in `demo/demo.css`; this snippet keeps neutral tokens.
