# Split-flap resolve

**Use when** a name, a number or a status is decided on screen: a departure board, a counter, a
status locking in. A copy of a real split-flap board: five rows (time, destination, gate) in a dark
frame, each character on its own matte slat with a light condensed letter and a split line across
the middle. Every slat turns through its drum in order (blank, then A to Z, or 0 to 9) and stops on
the real character, so a far letter takes longer than a near one and the rows settle one after the
other. Clip: [flap-resolve.mp4](clips/flap-resolve.mp4) (6 s, light; `flap-resolve-dark.mp4` is the dark
theme). Demo: [demo/flap-resolve.html](demo/flap-resolve.html).

```js
// every tile is a pure function of t: one leg is { at, from, to } on its drum
const k = (ms - leg.at) / 70;               // 70 ms for each flap
const steps = (leg.to - leg.from + drum.length) % drum.length;
// k < steps: flap number n = floor(k) is falling, p = k - n
const angle = 180 * p * p;                  // gravity: it speeds up and stops on the next slat
flap.style.transform = `rotateX(${-angle}deg)`;
// front face: the old top half; back face: the next bottom half
```

Sound: none. The clip is silent.

## How it looks and moves

- The frame is near black with a rounded rim and a darker plate. The slats are dark matte grey, the
  letters warm white in Big Shoulders 700. Axle pins show at both ends of each split line.
- The top half of the old letter falls over the hinge. Its back face carries the bottom half of the
  next letter and lands on the lower slat. The upper slat shows the next letter behind it.
- The falling flap darkens as it turns away from the light. The slats under it take a soft shadow.
- No spring and no overshoot: the flap stops on the next slat.
- Rows start 170 ms apart and columns 45 ms apart. The destination letters are the long drums, so
  `ATHENS` and `DUBLIN` settle last (about 3.4 s).
- At 4.0 s one gate (B7) turns on to B9 and the board holds. Only the window has an entrance and an
  exit.

## The common mistake

Rotating the whole glyph is a card flip, not a split flap. Build two halves per tile, one flap with
a front and a back face, and step the characters in drum order, never at random.
