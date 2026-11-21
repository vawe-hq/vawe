# Echo trail

**Use when** one element flies in fast and stops on a beat, and you want the After Effects Echo
effect: five time-offset copies trail it with falling opacity, then fold into it on the hit frame.
Clip: [echo-trail.mp4](clips/echo-trail.mp4). Demo: [demo/echo-trail.html](demo/echo-trail.html).

Use on the one moving object of the beat. Copies are the same element shown a few frames in the past,
never hand-placed, so the trail bends wherever the path bends.

```js
import '../../core/engine/page-api.js';
import { easeFn } from '../../core/motion/presets.js';
const HIT = 1.05, FLY = 0.85, N = 5, LAG = 0.035, SPREAD = 0.22;   // copy i shows the lead's frame i * LAG ago
const copies = Array.from({ length: N }, () => {
  const c = lead.cloneNode(true);
  c.removeAttribute('id'); c.setAttribute('aria-hidden', 'true');
  c.textContent = '';                                         // copies carry the tile shape only, never the glyph
  return c;
});
[...copies].reverse().forEach((c) => lead.before(c));         // the oldest copy sits lowest, the lead on top
const ease = easeFn('carry');                                 // accelerates into the hit
const pos = (t) => {                                          // the one path, a pure function of time
  const u = ease(Math.min(1, Math.max(0, (t - (HIT - FLY)) / FLY)));
  return { x: (1 - u) * -620, y: (1 - u) * 260 };
};
const squash = (t) => (t < HIT ? 0 : Math.exp(-14 * (t - HIT)) * Math.cos(34 * (t - HIT)));
vawe.onFrame((t) => {
  const collapse = Math.min(1, Math.max(0, (t - (HIT - SPREAD)) / SPREAD));   // 0 to 1 over the last SPREAD before the hit
  copies.forEach((c, i) => {
    const p = pos(t - (i + 1) * LAG * (1 - collapse));        // the offset in time closes to zero on the hit frame
    c.style.translate = `${p.x}px ${p.y}px`;
    c.style.opacity = 0.6 * (1 - i / N) * (1 - collapse);     // the oldest copy is the faintest
  });
  const p = pos(t), s = squash(t);
  lead.style.translate = `${p.x}px ${p.y}px`;
  lead.style.scale = `${1 - 0.18 * s} ${1 + 0.18 * s}`;       // a short squash recoil on the hit
});
```

Sound: a thud or pluck at the hit second, 1.05 s into the move (default gain).

- The squash after the hit stays a damped cosine: it rings several times, which no `EASE` segment does.
- Each copy calls the lead's own `pos(t - offset)`. For a path written as WAAPI keyframes, give each
  copy the same animation with a later `delay` (`i * 35` ms) instead: the copy then lags the same way.
- The trail is widest where the lead is fastest, so the ease accelerates into the stop. A slow ease
  leaves the copies stacked on the lead and there is nothing to see.
- Keep `N * LAG` divided by `SPREAD` under 1 (5 x 0.035 over 0.22 is 0.8). Above 1 a copy would run
  backwards in time while it closes up. Close the gap late and fast, in the last 0.22 s.
- Opacity falls per copy (0.6 down to 0.12) and all copies reach 0 on the hit, so no ghost outlives it.
- The copies are clones of the lead with the glyph removed (`textContent = ''`): a trail of bare tile
  shapes reads as motion, where cloned letters read as ghost text. Insert them oldest first so the
  nearest copy sits just under the lead and the lead, fully opaque, hides them on the hit frame.

Looks (ground, type, radius, accent) live in `demo/demo.css`; this snippet keeps neutral tokens.
