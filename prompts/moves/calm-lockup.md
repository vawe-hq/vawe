# Calm lockup

**Use when** the film ends quietly: the logo and one line settle slowly and nothing lands hard. The clip is a
flat warm ground with one soft light from the top edge, a dark app tile with a light edge and a layered shadow,
a light wordmark and one line. The brand settles over 1 s with a blur that clears, and the line follows 140 ms
later. Then the mark draws itself on the tile, a hairline draws under the line, and one sheen crosses the tile.
The lockup holds still after that. Clip: [calm-lockup.mp4](clips/calm-lockup.mp4). Demo:
[demo/calm-lockup.html](demo/calm-lockup.html).

```js
import { EASE } from '../../core/motion/presets.js';
[['#brand', 100], ['#line', 240]].forEach(([sel, at]) => {
  q(sel).animate([{ translate: '0 2.2vh', filter: 'blur(8px)' }, { translate: '0 0', filter: 'blur(0px)' }], { duration: 1000, delay: at, easing: EASE.land, fill: 'both' });
  q(sel).animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, delay: at, easing: EASE.land, fill: 'both' });
});
mark.style.strokeDasharray = mark.getTotalLength();                           // the mark draws on its own path
mark.animate([{ strokeDashoffset: len }, { strokeDashoffset: 0 }], { duration: 900, delay: 1000, easing: EASE.land, fill: 'both' });
rule.animate([{ scale: '0 1' }, { scale: '1 1' }], { duration: 800, delay: 1300, easing: EASE.land, fill: 'both' });
sheen.animate([{ translate: '0 0' }, { translate: '420% 0' }], { duration: 1200, delay: 2600, easing: EASE.glide, fill: 'both' });   // one pass, inside the tile
```

```css
.key { background: radial-gradient(ellipse 75% 60% at 50% 0%, rgb(255 255 255 / 0.6), transparent 72%); }   /* the one key light */
.tile { box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.16), 0 0.4vh 0.7vh rgb(42 37 32 / 0.1), 0 1.4vh 2.4vh rgb(42 37 32 / 0.14), 0 4vh 7vh rgb(42 37 32 / 0.12); }
```

Sound: bloom at 0.1 s, with the brand entrance; its 0.14 s attack matches the slow settle (default gain).

This is the gravity band (0.5 to 0.8 s and up): the entrance is long and small, 2.2 vh of travel, so it settles
and does not arrive. The depth comes from one light: a pale top edge on the ground, a 1 px highlight on the tile
and a shadow in three layers. There is no glow, no blob and no gradient fill. The line is 6.4 u, above the 2.5
percent text floor. Use it once per film. Give the hold one last move (here the sheen), never a camera float.

Common mistake: drifting coloured lights behind the logo to keep the end card alive. They read as a screensaver.
Let one part of the lockup do the last move.

Looks (ground, type, radius, accent) live in `demo/demo.css`; this snippet keeps neutral tokens.
