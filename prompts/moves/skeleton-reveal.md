# Skeleton reveal

**Use when** a real UI should arrive without pop-in. A copy of a real store dashboard loading in a
browser window: the shell (top bar, side list) is already there, and the main area shows flat light
grey blocks in the shape of the content under one faint moving light. Then each region loads and its
real content fades in. Clip: [skeleton-reveal.mp4](clips/skeleton-reveal.mp4) (6 s, light;
`skeleton-reveal-dark.mp4` is the dark theme). Demo: [demo/skeleton-reveal.html](demo/skeleton-reveal.html).

Use once per film: the moving light is a stock device (rule no-tells), never the idea.

```js
// one light crosses the page: each block plays the same sweep, shifted by its own left edge
band.animate([{ translate: `${-w - left}px 0` }, { translate: `${page.width - left}px 0` }], { duration: 1400, delay: 300, iterations: 3, easing: 'linear', fill: 'both' });
// a region loads: the skeleton goes in 120 ms and the real content fades in over 250 ms, with no rise and no blur
real.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 250, delay: t, easing: 'ease-out', fill: 'both' });
skeleton.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 120, delay: t, easing: 'linear', fill: 'both' });
```

The chart bars grow from the axis on `EASE.land` (600 ms, 40 ms apart): `b.animate([{ scale: '1 0' }, { scale: '1 1' }], { duration: 600, delay: 3400 + i * 40, easing: EASE.land, fill: 'both' })`.

Common mistake: a skeleton that does not match the loaded layout, so the page jumps when the content arrives. Draw each grey block where its real content lands.

Sound: none. The clip is silent.

## How it looks and moves

- The blocks are flat paint: 8 percent of the ink colour on the card, no glass and no glow. The
  light is a 24 u wide band at 60 percent of the surface colour, so it is faint.
- The blocks have the layout of the final content: a round one for an avatar, bars at the chart's
  own heights, three stat cards, three order rows. Each region is a one-cell grid holding the real
  content and its skeleton, so nothing shifts when they swap.
- The shell is real from the first frame, as in the product: a skeleton shows only where data is
  still on its way.
- Regions load 250 ms apart (header, stats, chart, orders). The chart draws its bars from the axis
  on load. Nothing else animates.
- After the load the page holds still but for the online counter, which ticks twice.

Names, shop and numbers are our own (a ceramics shop dashboard).
