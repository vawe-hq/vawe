# Shadow handoff

**Use when** a product moves from a light theme to a dark one on screen: a theme control is picked and the whole page
recolours. Clip: [shadow-handoff.mp4](clips/shadow-handoff.mp4). Demo: [demo/shadow-handoff.html](demo/shadow-handoff.html).

Look: a browser window on the flat neutral ground, holding a weekly report: a stat card with a number, a delta pill and a
seven day bar chart, and two small cards. The page has a Light and Dark segmented control at the top right. The colours are
twelve tokens on the page (ground, card, ink, muted, line, control, bars, delta, tooltip), registered as colours so they animate.

How it moves: the pointer travels to Dark on `EASE.land` and presses (a 12 percent dip). The control thumb slides one slot in
200 ms on `EASE.landSoft`. Then every token goes from its light to its dark value together in 0.32 s on `EASE.land`. There is no
shadow, no glow and no spread: a real theme change is one crossfade of all surfaces. The pointer then goes to the Friday bar and
a tooltip fades in. The window and the pointer leave on `leave`.

```js
for (const k of Object.keys(LIGHT)) CSS.registerProperty({ name: `--a-${k}`, syntax: '<color>', inherits: true, initialValue: LIGHT[k] });
ind.animate([{ translate: '0 0' }, { translate: `${indW}px 0` }], { duration: 200, delay: 1400, easing: EASE.landSoft, fill: 'both' });
app.animate([LIGHT, DARK].map((p) => Object.fromEntries(Object.entries(p).map(([k, v]) => [`--a-${k}`, v]))),
  { duration: 320, delay: 1450, easing: EASE.land, fill: 'both' });
```

Sound: tick at 1.4 s, on the press (default gain).

Common mistake: one layer fading over another, or a shadow that grows across the page. Recolour the tokens, so every surface moves
together and the layout does not change by a pixel.

Looks (ground, type, radius, accent) live in `demo/demo.css`; this snippet keeps neutral tokens.
