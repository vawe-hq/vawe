# Grid tile flip

**Use when** the change between shots should be a physical object turning over: the frame is a wall
of tiles, each carrying its slice of shot A on the front and shot B on the back, and a wave of flips
crosses the wall from one corner. The detail that sells it is the 3D: one perspective on the whole
grid (not one per tile), each tile rises toward the camera as it turns and darkens as it goes
edge-on, so the wave has depth and light. Clip: [grid-tile-flip.mp4](clips/grid-tile-flip.mp4). Demo:
[demo/grid-tile-flip.html](demo/grid-tile-flip.html).

```js
import { EASE } from '../../core/motion/presets.js';
const COLS = 8, ROWS = 5, tw = W / COLS, th = H / ROWS;
const dur = 690;
// .grid { perspective: 1400px }  .tile { transform-style: preserve-3d }  .face { backface-visibility: hidden; overflow: hidden }
// .face.back { transform: rotateY(180deg) }: each face holds a full-frame copy of its shot at left -c*tw, top -r*th
for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
  const delay = 220 + Math.hypot(c, (ROWS - 1 - r) * 1.15) * 58;             // ms: distance from the bottom-left corner
  tile.animate([{ transform: 'translateZ(0) rotateY(0deg)' },
                { transform: 'translateZ(90px) rotateY(90deg)', offset: 0.5 },   // edge-on: highest and darkest
                { transform: 'translateZ(0) rotateY(180deg)' }], { duration: dur, delay, easing: EASE.settle, fill: 'both' });
  for (const f of [front, back]) f.shade.animate([{ opacity: 0 }, { opacity: 0.7, offset: 0.5 }, { opacity: 0 }], { duration: dur, delay, easing: EASE.settle, fill: 'both' });
}
grid.animate([{ scale: 1 }, { scale: 1.045 }], { duration: 1400, easing: EASE.glide, fill: 'both' });   // the wall pushes in the whole time
```

Sound: none; the wave of flips is the seam, and a cue on it is a whoosh on every cut.

Tiles are 1 px larger than their cell: without the overlap, hairline seams show on the settled
shot. The ground behind the wall is near black, so the gaps at edge-on read as depth, not as
holes. Eight columns and five rows put a tile near the size of a letter, so the wave slices the type
and the eye reads the turn; fewer than 6 columns look like doors, more than 12 like a dissolve.
`EASE.settle` starts from rest and settles softly; a linear or ease-in-out flip looks
like a card trick. The wave should cross the wall in about half a second; slower than that and shot
A is already forgotten.

Looks (ground, type, radius, accent) live in `demo/demo.css`; this snippet keeps neutral tokens.
