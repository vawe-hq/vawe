# Thumbnail grid

**Use when** the film steps back from one scene to show where it sits among others: the scene shrinks
into a thumbnail, and the pull back reveals its neighbours; the grid is the next scene ("all projects",
"your library", "the whole roadmap"). One camera move does it: a pull back in log space, centred on the
starting scene, with no push after. The neighbours were always there, off the edge of the frame, so
nothing arrives and nothing fades. Clip: [thumbnail-grid.mp4](clips/thumbnail-grid.mp4). Demo:
[demo/thumbnail-grid.html](demo/thumbnail-grid.html). Not [grid-tile-flip](grid-tile-flip.md), which flips
tiles over to shot B.

```js
import { easeFn } from '../../core/motion/presets.js';
const settle = easeFn('settle');
const AT = 0.7, DUR = 1.5, S_END = 0.22, GAP = 6 * u;               // 3 x 3 cells, each one frame (W x H) in the world
// cell (c, r) sits at ((c - 1) * (W + GAP), (r - 1) * (H + GAP)) from the centre; the middle one is shot A
vawe.onFrame((t) => {
  const p = settle(clamp((t - AT) / DUR)), s = Math.exp(Math.log(S_END) * p);   // one scale, about the centre: A is the middle cell
  world.style.transform = `scale(${s})`;                                       // .world is a 0 x 0 box at the frame centre
  cells.forEach((c) => { c.style.borderRadius = `${7 * u * p}px`; });          // A starts square: it is the full frame
});
// after the pull back: the title and a ring round A enter on EASE.land; A's own bar was moving before it started, and the neighbours' bars fill in during the hold
```

Sound: none; the pull back is felt, and the title takes the one cue.

The scale ends at 0.22: the grid fills about 68 percent of the frame, which leaves room for a title
above it. Pull back to 0.35 or more and the neighbours read as clipped; under 0.2 the cell text is
too small to read, so set the labels at 8 to 9 percent of frame height in world units. Put the shot you leave in the middle cell: the camera then needs only a scale about
the frame centre, with no pan, and the move reads as one gesture. If it must sit in a corner, scale
about the pivot `P = (C - s_end * G) / (1 - s_end)` (C the frame centre, G the grid centre) so the scale
and the pan are one motion, never two.

Neighbour cells need real content in the same scale as the first (a label, a number, a bar), set in
world units so they read as scenes, not as tiles. Radius and gap are world units too: set them from
the progress so the first frame has square corners and the last frame has the look's radius. The
selection ring (the shot you came from) enters after the move has settled, on `EASE.land`. The
camera never moves back; if the next beat needs a closer look at a tile, that is a second move, after a hold.

Looks (ground, type, radius, accent) live in `demo/demo.css`; this snippet keeps neutral tokens.
