# Arrival spring

**Use when** the brief asks for a playful register, or a thing with mass arrives (a ball, a sticker, a
dropped card). The default is no spring: type, UI and devices land on `EASE.land` (rule overshoot).
`EASE.nudge` passes its mark by about 6 per cent and settles back. `EASE.pop` passes by 15 per cent and
is for the one arrival with mass that is the point.

```js
import { enter, stagger, EASE } from '../../core/motion/presets.js';
// every 3rd sticker lands on EASE.nudge, the rest on EASE.land
stagger(document.querySelectorAll('.stickers i'), { at: 0.2, band: 'professional', from: '0 0.5em', nudgeEvery: 3 });
// the one arrival that matters: a deeper spring
enter(document.querySelector('.hero'), { at: 1.2, duration: 0.7, scale: 0.7, ease: 'pop' });
```

Sound: a soft tick on each overshooting arrival is enough; none on the rest.

Pick the springs, do not spread them: in a playful film at most one arrival in three on `nudge`,
at most one or two on `pop`, the rest on `land`. Put the spring on the arrival the eye is on, not on
the ground. A scene may use two eases (`land` and `nudge`); a third (`pop`) counts as one more, so
use `pop` on the spectacle beat only. The dev check `overshoot-share` counts an arrival as overshooting
when its easing peaks above 1.01, so `nudge` (peak 1.06) and `pop` (1.15) are both counted. A move under
20 px has no room to overshoot by a pixel: give the spring to the larger moves.
