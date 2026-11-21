# Glow record

**Use when** a film shows an idle tool turning into a live state: a screen recorder, a call, a live stream. The
clip copies a screen recorder over a document. A dark recorder bar waits at the bottom left with a red dot
and "Start recording". The cursor presses it. The bar goes, a round countdown (25 u wide, top right, clear of the text) shows 3, 2, 1 at the top right of the
screen, and the bar returns as a recording pill: the red dot (now pulsing), a timer that counts and the stop
button. The red dot is the object that carries the idea from "ready" to "live". There is no flood and no glow:
the real UI is the effect. Clip: [glow-record.mp4](clips/glow-record.mp4). Demo:
[demo/glow-record.html](demo/glow-record.html).

```js
import { EASE, UI } from '../../core/motion/presets.js';
const T = { bar: 600, press: 2000, hide: 2150, count: 2300, n2: 2900, n1: 3500, rec: 4300 };   // ms
arrive(idle, T.bar, { ms: 220, from: '0.8vh' });                                              // the bar fades in with a small rise
idle.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 150, delay: T.hide, easing: EASE.launch, fill: 'forwards' });
cd.animate([{ opacity: 0, scale: 0.96 }, { opacity: 1, scale: 1 }], { duration: 220, delay: T.count, easing: EASE.land, fill: 'both' });
const roll = (el, inAt, outAt) => {                                                           // a numeral rolls up and out, the next rolls in
  const { outMs, inMs, rise } = UI.roll;
  if (inAt != null) el.animate([{ opacity: 0, translate: `0 ${rise}` }, { opacity: 1, translate: '0 0' }], { duration: inMs, delay: inAt + outMs, easing: EASE.land, fill: 'both' });
  if (outAt != null) el.animate([{ opacity: 1, translate: '0 0' }, { opacity: 0, translate: `0 -${rise}` }], { duration: outMs, delay: outAt, easing: EASE.launch, fill: 'forwards' });
};
roll(n3, null, T.n2); roll(n2, T.n2, T.n1); roll(n1, T.n1, null);
arrive(rec, T.rec, { ms: 220, from: '0.8vh' });
vawe.onFrame((s) => {
  const run = Math.max(0, s * 1000 - T.rec);
  tc.textContent = `00:0${Math.floor(run / 1000)}`;                                          // the timer ticks once a second
  dot.style.opacity = 0.55 + 0.45 * (0.5 + 0.5 * Math.cos(2 * Math.PI * run / 1000));         // the dot pulses at 1 Hz between 55 and 100 percent
});
```

Sound: a click on the press at 2.0 s; one soft tick per numeral (default gain); nothing on the pill.

Draw the recorder as the real tool does: a dark pill, a red dot of about 4 units, a light label, and a solid fill
with no blur behind it. The countdown is a dark disc with a white numeral, not a full-screen colour. The pill
keeps its left edge and its red dot from the idle state to the live state, so the dot reads as the same thing.
The page behind holds still, as a recorded page does, and the timer and the dot keep the hold alive.

Common mistake: flooding the frame with red to mean "live". No recorder does that. The state change is the
bar, the countdown and a pulsing dot.

Looks (ground, type, radius, accent) live in `demo/demo.css`; this snippet keeps neutral tokens.
