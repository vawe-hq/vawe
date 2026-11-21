# Liquid wipe

**Use when** the cut should feel organic: a gooey edge floods the frame from one side onto the next
shot. Eight bars with round heads run in from the left, each at its own speed, and a blur followed
by a hard alpha contrast (the goo filter) fuses them into one wet edge with lumps and meniscus
between rows. The detail that sells it is the second edge: an accent band leads the next shot by
7 percent of the width, so the liquid has a body and a colour of its own. Clip:
[liquid-wipe.mp4](clips/liquid-wipe.mp4). Demo: [demo/liquid-wipe.html](demo/liquid-wipe.html).

```js
import { rng } from '../../core/motion/springs.js';
import { EASE, easeFn } from '../../core/motion/presets.js';
const E = easeFn('land'), rand = rng(5), N = 8, rh = H / N, R = rh * 0.8, blur = rh * 0.42;
const rows = Array.from({ length: N }, (_, i) => ({ y: (i + 0.5) * rh, lag: rand() * 0.22, dur: 0.85 + rand() * 0.25 }));
const prog = (row, t) => Math.min(1, Math.max(0, (t - 0.25 - row.lag) / row.dur));
const front = (row, t) => -R - 3 * blur + (W + 2 * R + 6 * blur + W * 0.14) * E(prog(row, t));   // starts fully outside the frame
const goo = (t, lead) => {      // an SVG image used as a CSS mask: bars + round heads, blurred, then alpha x24 - 10
  const shapes = rows.map((r) => { const x = front(r, t) + lead * Math.min(1, prog(r, t) * 6);
    return `<rect x="-20" y="${r.y - rh * 0.85}" width="${Math.max(0, x + 20)}" height="${rh * 1.7}"/><circle cx="${x}" cy="${r.y}" r="${R}"/>`; }).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><filter id="g" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="${blur}"/><feColorMatrix values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 24 -10"/></filter><g fill="#fff" filter="url(#g)">${shapes}</g></svg>`;
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
};
vawe.onFrame((t) => { shotB.style.maskImage = goo(t, 0); rim.style.maskImage = goo(t, W * 0.07); });   // rim: an accent full-frame div under B
```

Sound: none; the flood is soft and wet to the eye, and a cue on it is a whoosh on every cut.

Stack three layers: shot A, the accent rim, shot B; the last two carry the mask. Rows that start
apart (a 0.22 s seeded lag, 0.85 to 1.1 s each) give the lumps; rows that start together give a
straight wipe. The alpha contrast (x24 - 10) is what makes the blur read as liquid and not as a soft
edge: with a plain blur the edge looks like a feathered mask. Start the fronts a full blur radius
outside the frame, or a pale seam shows at the edge on the first frame. Shot A drifts 6 percent away and B settles from 1.08x, so both shots move
under the edge. The mask is a pure function of time: no random, no state.

Looks (ground, type, radius, accent) live in `demo/demo.css`; this snippet keeps neutral tokens.
