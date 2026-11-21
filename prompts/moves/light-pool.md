# Light pool

**Use when** a held, matte frame needs one slow event behind the type: a single soft key light that
wanders over a lit surface. Clip: [light-pool.mp4](clips/light-pool.mp4). Demo: [demo/light-pool.html](demo/light-pool.html).

Look: a warm grey wall of vertical ribs. Each rib has a bright left edge, a flat middle and a dark right edge. A second
layer holds the same ribs in a lighter tone and shows only inside a soft round mask, so each rib lights where the pool
is and stays dim elsewhere. A faint dark vignette sits over the wall. The type is dark ink and reads on both tones.

How it moves: the headline rises out of a mask on `EASE.land` and the lead fades up. The pool wanders on a seeded noise
path (about 1.3 steps a second) and never stops. The copy leaves on `leave`; the wall and the light stay.

```js
const RATE = 1.3, AMP_X = 0.36, AMP_Y = 0.26;                 // noise steps a second; travel as shares of the frame
vawe.onFrame((t) => {                                          // noise1 from core/motion/springs.js: frame t is the same on every render
  const W = innerWidth, H = innerHeight, mw = 1.2 * H, mh = 0.92 * H;   // the mask size
  lit.style.setProperty('--px', `${W * (0.52 + AMP_X * noise1(t * RATE, 11)) - mw / 2}px`);
  lit.style.setProperty('--py', `${H * (0.45 + AMP_Y * noise1(t * RATE, 23)) - mh / 2}px`);
});
// .lit: the bright ribs, mask-image: radial-gradient(closest-side, #000, transparent), mask-position: var(--px) var(--py)
```

Sound: none; a held ground is quiet.

Common mistake: a coloured radial glow drifting behind the type. It lights nothing and reads as a blob. Light a surface that has
a form (ribs, plaster, fabric), and keep the light neutral and warm.

Looks (ground, type, radius, accent) live in `demo/demo.css`; this snippet keeps neutral tokens.
