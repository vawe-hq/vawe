# Highlight sweep

**Use when** a key word in a held line should hand the film to the next panel: a highlight sweeps across the word, keeps going past the end of the line, and grows into the next panel's background. One shape carries over from scene A into scene B, so there is no cut and no crossfade. The detail that sells it is that the edge never stops at the word: the sweep reads as a highlight while it crosses the word and as a colour wipe once it is past, at one speed. Clip: [highlight-sweep.mp4](clips/highlight-sweep.mp4). Demo: [demo/highlight-sweep.html](demo/highlight-sweep.html).

The shared element is the next panel itself, `.b`, drawn over scene A and cut by one `clip-path`. It holds a copy of the same line with every word transparent but the key word, set at the same coordinates in the on-accent ink. The clip box is first the word's bar, so the word flips to dark ink exactly at the edge, as in [marker-highlight](marker-highlight.md). The same box then opens to the frame.

```js
import '../../core/engine/page-api.js';
import { easeFn } from '../../core/motion/presets.js';
const sweep = easeFn('swap'), open = easeFn('carry'), launch = easeFn('launch'), land = easeFn('land');
const T0 = 0.95, DUR = 1.05, EXP = 0.6, PAD = 0.06 * H, SLANT = 0.012 * W;
const reach = (u) => 0.5 * u + 0.5 * sweep(u);                       // half linear: the speed through the word is the speed past it
const edge = (t, L) => lerp(L, W + PAD + SLANT, reach(clamp((t - T0) / DUR)));
vawe.onFrame((t) => {
  const r = word.getBoundingClientRect();                            // per frame: the face may load after the first paint
  let tE = T0; while (tE < T0 + DUR && edge(tE, r.left) < r.right + 0.05 * W) tE += 0.005;   // the edge is past the word
  const q = open(clamp((t - tE) / EXP)), x = edge(t, r.left);
  const top = lerp(r.top + 0.12 * r.height, -PAD, q), bot = lerp(r.bottom - 0.04 * r.height, H + PAD, q), left = lerp(r.left, -PAD, q);
  b.style.clipPath = `polygon(${left}px ${top}px, ${x + SLANT * (1 - q)}px ${top}px, ${x}px ${bot}px, ${left}px ${bot}px)`;
  const tC = tE + EXP + 0.1;                                         // the carried word leaves once the panel is whole
  carry.style.translate = `0 ${-120 * launch(clamp((t - tC) / 0.28))}%`;   // its line is clipped, so it exits through the line's top edge
  head.style.translate = `0 ${(1 - land(clamp((t - tC - 0.14) / 0.8))) * 110}%`;
});
```

Sound: none; the sweep is the cause and the headline rising out of the line is the cue point, so a cue belongs there only if the film has an effects row.

- The z-order is fixed: scene A under, `.b` over it, and nothing else changes in z. The carried word lives in `.b`, so the highlight needs no second layer and no z swap.
- Open the box to the frame when the edge is past the word, not when it ends. The top, bottom and left edges then leave the word's cap height on `EASE.carry` (still fast at the key), so the panel opens while the sweep carries on.
- The leading edge is slanted by 1.2 percent of the frame width (the marker look) and straightens as the box opens.
- Exits are faster than entrances: the carried word leaves in 0.28 s on `EASE.launch`, the new headline rises over 0.8 s on `EASE.land`, 0.14 s after the word has started to leave so the two never share a line box for long.
- Scene B repeats scene A's structure: an eyebrow, the headline at the same coordinates, then a row of format chips and the URL that rise one after the other. The line box of the headline has bottom padding so the mask never cuts a glyph.
- What goes wrong: a sweep that eases to a stop at the word end reads as a highlight followed by a wipe, two moves. A key word at the end of a long line leaves no room to run off it, so put it at 50 to 70 percent of the frame width. The headline and the carried word must share one font and one position, or the dark word shifts when the bar reaches it.

Looks (ground, type, radius, accent) live in `demo/demo.css`; this snippet keeps neutral tokens.
