# Media between text

**Use when** a line of text has a gap that a picture can fill on hover or on a beat: "that's a nice ( ) chair!".
The line stays one line and the picture opens inside it. Clip: [media-between-text.mp4](clips/media-between-text.mp4). Demo:
[demo/media-between-text.html](demo/media-between-text.html).

Look: one line of light grotesque type, large, on warm bone paper. A rounded photo, 28 u tall (2.8 times the type size of 10 u, so taller than the cap
height), sits between two parentheses. A small dark pointer shows the cause: the picture opens while the pointer is over
the line and closes when it leaves.

How it moves: on enter the photo width goes from 0 to 34 u on a critically damped spring (stiffness 532.6, damping 46.15,
no bounce, about 0.4 s). On leave it closes in 0.3 s on `EASE.land`. The text on both sides re-centres with it, so the line
never wraps. The pointer travels between stops on `EASE.land`. The clip hovers twice.

```js
const OPEN = { k: 532.6, d: 46.15 }, CLOSE_S = 0.3, HOVERS = [[0.55, 1.95], [2.8, 3.75]];   // [enter, leave] in seconds
const widthAt = (t) => {
  for (let i = HOVERS.length - 1; i >= 0; i--) {
    const [enter, out] = HOVERS[i];
    if (t >= out) return WIDTH * (1 - easeFn('land')(Math.min((t - out) / CLOSE_S, 1)));
    if (t >= enter) return WIDTH * spring(t - enter, OPEN.k, OPEN.d);   // spring from core/motion/springs.js
  }
  return 0;
};
window.seek = (t) => { media.style.width = `${widthAt(t)}px`; };       // media: overflow hidden, the img inside keeps its own width
```

Sound: none.

Common mistake: a photo smaller than the text. It reads as a speck, and the line wraps while the gap opens. Make the photo
taller than the cap height, keep the line on one row, and open the width, not the height.

Looks (ground, type, radius, accent) live in `demo/demo.css`; this snippet keeps neutral tokens.
