# Stack cover

**Use when** a new panel must lie over the screen you are on: a form, a composer, a detail. The sheet rises from the bottom edge. The page behind scales back a little, rounds its corners and dims, so the two sit at different depths. Clip: [stack-cover.mp4](clips/stack-cover.mp4) (5 s). Demo: [demo/stack-cover.html](demo/stack-cover.html).

```js
import { springDuration, springLinear } from '../../core/motion/springs.js';
const SHEET = { duration: springDuration(313, 35.4) * 1000, easing: springLinear(313, 35.4) };   // the system sheet: a critically damped spring, no overshoot
sheet.animate([{ translate: `0 ${H}px` }, { translate: '0 0' }], { ...SHEET, delay: 1150, fill: 'both' });
page.animate([{ scale: 1, translate: '0 0', borderRadius: '0px' }, { scale: 0.94, translate: `0 ${1.6 * u}px`, borderRadius: `${2.4 * u}px` }], { ...SHEET, delay: 1150, fill: 'both' });
dim.animate([{ opacity: 0 }, { opacity: 0.3 }], { ...SHEET, delay: 1150, fill: 'both' });
// dismiss: the same three, reversed, in 440 ms, with fill 'forwards' so the first set keeps its start state
```

Sound: none; a soft tick at the tap is the only cue a film needs.

## How it looks and moves

- The clip copies an iPad screen in its light style: a status bar, a blue "+" and "Edit", a large "Renders" title, an inset grouped list (thumbnails, name, size, status, chevron) on the system grey. The content is our own.
- A grey touch dot shows the tap on "+" at 1.0 s, as in a screen recording. The sheet starts 0.15 s later.
- The sheet is 64 percent of the width and rises from the bottom edge in 0.52 s on a critically damped spring (the system sheet does not overshoot). It has rounded top corners (2.4 u), a grabber, a bar (Cancel, title, Add) and an inset grouped form. It does not spring or overshoot.
- The page behind scales to 94 percent, moves down 1.6 u, rounds to 2.4 u and dims by 30 percent on the same curve. The ground around it is black, as on the device.
- The name field has focus: the text types in whole steps and the caret blinks every 0.5 s.
- A tap on Cancel at 3.8 s dismisses the sheet in 0.44 s on a faster spring of the same kind. The clip ends on the page from frame 0.
- Common mistake: a sheet that scales or fades in from the middle, or a page that does not move behind it. The sheet rises from the bottom edge and the page behind it shrinks, rounds and dims on the same curve.
