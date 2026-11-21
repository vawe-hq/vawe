# Anchor cycle

**Use when** the claim is "it works for everyone" or "everything changes, this stays". One phrase is
pinned and never moves; a tape beside it is slapped over with a new word on each hard cut, slow at first
and then faster until it is a flurry, and the last phrase holds. Then a brand lockup drops in below the
still anchor. The stillness of the anchor is what the viewer reads. Clip: [anchor-cycle.mp4](clips/anchor-cycle.mp4).
Demo: [demo/anchor-cycle.html](demo/anchor-cycle.html).

```css
.row { position: absolute; left: 14vh; top: 42%; translate: 0 -50%; width: max-content; display: flex; align-items: center; gap: 5vh; }
.anchor, .tape { flex: none; white-space: nowrap; text-transform: uppercase; }
.tape { padding: 1.6vh 5vh 1.2vh; border-radius: 4.6vh; background: var(--accent); color: var(--on-accent); }
.tape.b { background: var(--tile-alt); color: #fff; }   /* alternate two tones on the cuts */
```

```js
import '../../core/engine/page-api.js';
// the hold shrinks by about a fifth per swap: a roll call that turns into a flurry, then one held phrase
const states = ['Chefs', 'Pilots', 'Nurses', 'Teachers', 'Founders', 'Designers', 'Farmers', 'Every team'];
const holds = [0.55, 0.45, 0.36, 0.29, 0.23, 0.18, 0.14];   // seconds per state; the last one holds
const start = 0.85, edges = holds.reduce((a, h) => [...a, a[a.length - 1] + h], [start]);
const tilt = [-1.6, 1.2, -0.8, 1.6, -1.2, 0.8, -1.6];

vawe.onFrame((t) => {
  const i = t < start ? -1 : edges.filter((e) => t >= e).length - 1;   // the state index is a pure function of t
  tape.style.visibility = i < 0 ? 'hidden' : 'visible';
  if (i < 0) return;
  tape.textContent = states[i];                                         // a hard cut: no fade, no slide
  tape.classList.toggle('b', i % 2 === 1 && i < states.length - 1);
  tape.style.rotate = i === states.length - 1 ? '0deg' : `${tilt[i]}deg`;   // slapped on at a tilt, squared on the last
});
lock.animate([{ translate: '0 3vh', opacity: 0 }, { translate: '0 0', opacity: 1 }], { duration: 480, delay: 3850, easing: EASE.pop, fill: 'both' });
```

Sound: none under the cycle; pluck at 3.85 s into the move, when the lockup lands (default gain).

The anchor enters once, in the first 0.6 s, and then has no transform of any kind: no drift, no breathe.
The tape grows to the right, away from it, and the row is sized for the longest state so nothing reaches
the frame edge or touches the anchor. Changing the width of the tape on each cut is the point; do not
tween it. Eight states read as "everyone", three read as a list. The flurry ends on the longest
phrase and holds for about a second before the lockup joins, so the eye has a beat of quiet after the
acceleration. Name the class `.tape`, not `.chip`: `.chip` is a fixed-size square in `demo/demo.css`.

Looks (ground, type, radius, accent) live in `demo/demo.css`; this snippet keeps neutral tokens.
