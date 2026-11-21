# Hand drawn notes

**Use when** a held line needs the margin notes of a person: a loose circle around one word, an arrow
from a written label to it, and an underline under another, each drawn on like a pen. Every stroke
is an SVG path revealed with `stroke-dashoffset`, built with a seeded wobble, so the marks are
uneven and the same on every render. Clip: [hand-drawn-notes.mp4](clips/hand-drawn-notes.mp4).
Demo: [demo/hand-drawn-notes.html](demo/hand-drawn-notes.html).

```js
const rand = rng(7);                                  // core/motion/springs.js: seeded, never Math.random
const wob = (amount) => (rand() * 2 - 1) * amount;
// a circle of 1.06 turns whose radius drifts out 7 percent, so the end overshoots the start
const ring = Array.from({ length: 14 }, (_, i) => {
  const a = -2.5 + (i / 12) * Math.PI * 2 * 1.06, grow = 1 + (i / 13) * 0.07 + wob(0.025);
  return [cx + Math.cos(a) * rx * grow, cy + Math.sin(a) * ry * grow];
});
function stroke(d, at, dur, easing) {                 // d: Catmull-Rom points written as cubic Beziers
  const p = document.createElementNS(NS, 'path');
  p.setAttribute('d', d); p.setAttribute('pathLength', '1');
  svg.append(p);
  p.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { delay: at * 1000, duration: dur * 1000, easing, fill: 'both' });
}
stroke(smooth(ring), 0.45, 0.6, EASE.settle);
label.animate([{ clipPath: 'inset(-10% 100% -10% 0)' }, { clipPath: 'inset(-10% 0 -10% 0)' }], { delay: 1100, duration: 450, fill: 'both' });
```

```css
svg path { fill: none; stroke: var(--accent); stroke-linecap: round; stroke-dasharray: 1; stroke-dashoffset: 1; }
.label { font: 700 9vh/1 'Caveat', cursive; color: var(--accent); }
```

Sound: none; or a dry pen scratch under each stroke, as a short recorded effect.

## The numbers that make it look expensive

- Order is the story: circle (0.6 s), then the label writes on (0.45 s) while the arrow draws from it to the circle (0.35 s) and its head flicks in (0.2 s), then the underline (0.45 s). Strokes overlap by a third.
- A pen starts slow, runs, and stops: `EASE.settle` for the long strokes, `EASE.landSoft` only for the arrow head.
- The wobble is small and seeded: 2.5 percent of the radius on the circle, 1 percent of the font size on the shaft. More reads as a bad drawing, none as a vector ellipse.
- The circle overshoots its start by 6 percent of a turn: a closed circle is a shape, an overlapped one is a gesture.
- The label is written on a hard left-to-right clip, not a fade, and sits in a handwriting face (Caveat) against the sans line. One accent colour for every mark, 4.5:1 on the ground.
- Underline under the descender line of the word, as in [underline-draw.md](underline-draw.md), with a slight sag.

## The common mistake

Using `Math.random` for the wobble, or a fresh draw per frame: the strokes shiver and no two renders
match. Seed once at load. Also draw the marks after the line has landed; strokes on a moving word slip off it.

Looks (ground, type, radius, accent) live in `demo/demo.css`; this snippet keeps neutral tokens.
