# Spin rotation

**Use when** a loading state turns into the loaded state and the spinner should carry over: the ring that was waiting
becomes the status mark of the result. Clip: [spin-rotation.mp4](clips/spin-rotation.mp4). Demo:
[demo/spin-rotation.html](demo/spin-rotation.html).

Look: a browser window on the flat neutral ground. First a centred ring spinner (a grey track and a green arc, rounded ends) with a muted
"Loading workspace" line. Then the page: a header with a green check circle, "Workspace ready", a green pill, a sync note and three grey stat tiles.

How it moves: the arc turns at one speed (330 degrees a second) from 0.4 s. At 1.6 s the turn brakes to a stop in 0.7 s on `EASE.land` while the arc
grows to a full circle on the same ease. The ring then flies to the header mark spot and shrinks to its size in 0.55 s on `EASE.land`, in the same green. A check draws inside it in 0.35 s. The header and the stat tiles fade in with a 1 vh rise, 70 ms apart: the tiles from 2.35 s, the note at 2.6 s and the title at 2.65 s, so the page is never empty and the ring never crosses the text. The window arrives and leaves
on `arrive` and `leave`. Only the circle turns; the check never rotates.

```js
const head = (t) => (t < BRAKE_AT ? OMEGA * Math.max(0, t - SPIN_AT)                     // constant speed
  : OMEGA * (BRAKE_AT - SPIN_AT) + (OMEGA * BRAKE_S / 4.8) * land(clamp((t - BRAKE_AT) / BRAKE_S)));   // land starts at 4.8 times the average speed
spin.style.transform = `rotate(${head(t)}deg)`;                                           // the circle group only
arc.style.strokeDasharray = `${C * (0.25 + 0.75 * land(clamp((t - BRAKE_AT) / 0.7)))} ${C}`;   // the arc closes as it brakes
ring.style.transform = `translate(${dx * p}px, ${dy * p}px) scale(${1 - (1 - S1) * p})`;      // p = land over 0.55 s from 2.3 s
check.style.strokeDashoffset = String(60 * (1 - land(clamp((t - 2.7) / 0.35))));
```

Sound: pluck when the check lands, at 3.05 s (default gain).

Common mistake: a wipe or a clock sweep that reveals the next page. It is a stock transition and ignores the ring. Brake the spin into
the shape of the next state, and end on a real success mark.

Looks (ground, type, radius, accent) live in `demo/demo.css`; this snippet keeps neutral tokens.
