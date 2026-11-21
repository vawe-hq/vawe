# Toggle horizon

**Use when** a setting switches the whole product into a new state: dark mode, focus, night. The clip shows a settings
screen, one switch, and the screen restyling itself in place. Clip: [toggle-horizon.mp4](clips/toggle-horizon.mp4). Demo:
[demo/toggle-horizon.html](demo/toggle-horizon.html).

Look: a phone screen (80 u wide, 45 percent of the frame width, cropped by the frame bottom) on the flat neutral ground, in the style of a mobile settings list: a large title,
rounded white groups, rows with a title and a muted line, and switches 12.7 by 7.7 u. A switch is a pill track and a white thumb with a
soft shadow; when on, the track is green. No finger is drawn: the wider thumb is the press. The six colours of the screen (page, group, ink, muted,
line, switch off) are tokens registered as colours, so they animate.

How it moves: on the press (1.0 s) the thumb grows 22 percent wider, as a
real switch does. 0.14 s later it travels to the right on a sampled spring (stiffness 380, damping 26) while the track turns green. The
screen then changes all six tokens together in 0.35 s on `EASE.land`. A second tap, on Reduce motion at 2.8 s, flips that switch in the
dark screen. Then the phone leaves on `leave`.

```js
import { spring } from '/core/motion/springs.js';
const K = 380, D = 26, HOLD = 0.14;                              // thumb spring; seconds before the thumb moves
const on = spring(t - tap.at - HOLD, K, D);                       // 0 to 1, from vawe.onFrame
th.style.translate = `${TRAVEL * on - (THUMB * 0.22 * stretch) * on}px 0`;
th.style.width = `${THUMB * (1 + 0.22 * stretch)}px`;             // stretch: 1 while pressed, back to 0 as the thumb leaves
screen.animate([LIGHT, DARK].map((p) => Object.fromEntries(Object.entries(p).map(([k, v]) => [`--s-${k}`, v]))),
  { duration: 350, delay: (tap.at + HOLD + 0.05) * 1000, easing: EASE.land, fill: 'both' });
```

Sound: tick at 1.0 s, on the press (default gain); a quieter tick at 2.8 s.

Common mistake: a new scene (a sunset, a glow) that replaces the screen. A real appearance switch restyles the same screen, so every row stays in
its place and only the colours change. Never put a spring on the colours, and never move the layout.

Looks (ground, type, radius, accent) live in `demo/demo.css`; this snippet keeps neutral tokens.
