# Letter 3D swap

**Use when** a line of text changes its words and each letter should turn over like a block: a status, a
headline that updates, a changing word. Clip: [letter-3d-swap.mp4](clips/letter-3d-swap.mp4). Demo:
[demo/letter-3d-swap.html](demo/letter-3d-swap.html).

Look: a row of pale blocks on warm bone paper, one letter on each block, a hairline edge and a top highlight. Each block is
a real box in 3D: the front face, the next face on top and a third face behind. The face that turns away darkens, the face
that arrives lights up. Each block has its own perspective.

How it moves: each block rolls forward 90 degrees about its own centre, left to right, 40 ms between letters. The roll is a
sampled spring (stiffness 160, damping 25, about 0.75 s). The line rolls twice: "rough draft", "final print", "live today".
The row arrives on `arrive` and leaves on `leave`.

```js
import { springLinear, springDuration } from '/core/motion/springs.js';
const K = 160, D = 25, STAGGER = 40;
const spring = { duration: springDuration(K, D) * 1000, easing: springLinear(K, D), fill: 'forwards' };
// block: preserve-3d, translateZ(-depth / 2). Faces: f0 translateZ(depth / 2); f1 rotateX(-90deg) translateZ(depth / 2); f2 rotateX(-180deg) translateZ(depth / 2)
block.animate([{ transform: `translateZ(calc(var(--depth) / -2)) rotateX(${90 * r}deg)` },
               { transform: `translateZ(calc(var(--depth) / -2)) rotateX(${90 * (r + 1)}deg)` }], { delay: at + i * STAGGER, ...spring });
face.shade.animate([{ opacity: 0 }, { opacity: 0.5 }], { delay: at + i * STAGGER, ...spring });   // the face turning away; the arriving face goes 0.5 to 0
```

Sound: tick on the first block of each roll (default gain); no tick per letter.

Common mistake: a fade or a slide inside a clipped box. It reads as a vertical text swap, not a cube. Give each block a depth, three faces,
a perspective, and a shade on the face that turns away. Never set `opacity` on the block: it flattens the 3D. Fade the flat parent.

Looks (ground, type, radius, accent) live in `demo/demo.css`; this snippet keeps neutral tokens.
