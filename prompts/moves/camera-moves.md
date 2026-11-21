# Camera moves

**Use when** a whole world should feel like it is seen through a lens that moves: lean in on a hold,
pull back to reveal, whip to the next world. The clip runs a push over a real product page (a browser
window with a dashboard). The window is the subject, a fine grid is the ground behind it, and a hover
tooltip floats in front. The three layers scale by different amounts, so they separate the way real depth
does. Each move is a transform on one wrapper (or on one layer, see the layered depth section of
[parallax-dive](parallax-dive.md)), so it is deterministic under the seek. Clip:
[camera-moves.mp4](clips/camera-moves.mp4). Demo: [demo/camera-moves.html](demo/camera-moves.html).

**One slow camera ease per shot is the house default.** A push, pull or glide of 1 to 2 s or more on
`EASE.glide` or `settle`, under about 400 px/s, keeps a hold alive and is never flagged. A film that must hold
still says `camera: still` in DESIGN.md, and then the taste rule constant-camera names a camera that moves
for over 60 percent of the film or over 4 worlds in a row.

```js
import { camera, EASE } from '../../core/motion/presets.js';
const w = document.querySelector('[data-world="hero"]');
camera(w, { kind: 'push', at: 0, duration: 2.4, origin: '66% 56%' });      // 1 to 1.12, EASE.glide: never quite stops
camera(w, { kind: 'pull', at: 0, duration: 1.4 });                          // 1.15 to 1, EASE.settle: reveals
camera(oldWorld, { kind: 'whipOut', at: 5.0, duration: 0.3 });             // the old world leaves on EASE.launch
camera(newWorld, { kind: 'whipIn', at: 5.0, duration: 0.3 });              // the new one arrives on EASE.land
```

**Push toward a subject.** Scale the world toward the subject, not the frame centre. Scale the ground less
and the part in front more. The demo pushes 2.6 s on `EASE.glide`:

```js
const S = { ground: 1.04, world: 1.14, front: 1.2 };
[['#grid', S.ground], ['#world', S.world], ['#front', S.front]].forEach(([sel, to]) => {
  const el = document.querySelector(sel);
  el.style.transformOrigin = `${O.x}px ${O.y}px`;                           // one origin for all three layers
  el.animate([{ scale: 1 }, { scale: to }], { duration: 2600, delay: 900, easing: EASE.glide, fill: 'both' });
});
// a part on the front layer lands on its target after both layers scale: place it at O + (target - O) * S.world / S.front
```

Sound: a whoosh at the start of a whip, one per film; the push, pull and drift are felt, not heard.

Push 8 to 20 percent over the beat. Under 5 percent the eye reads a mistake. Over 30 percent it is a
punch-in ([crash-zoom](crash-zoom.md)) and needs a faster curve. A camera move under 2 s takes
`EASE.land`. A move of 2 s or more takes `EASE.glide`, which keeps the lean going to the last frame. End the
push before the hold, and keep the hold alive with a part that moves (here a hover that steps from one bar to
the next) or one slow camera ease over the shot.

Common mistake: one scale on a flat card over a flat ground. Nothing separates, so the push reads as a zoom.
Give the move a real page, a ground that scales less and a part in front that scales more.

Looks (ground, type, radius, accent) live in `demo/demo.css`; this snippet keeps neutral tokens.
