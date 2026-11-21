# Logo wall

**Use when** a film needs social proof: "Trusted by 4,200 teams" over a wall of customer logos. Clip:
[logo-wall.mp4](clips/logo-wall.mp4). Demo: [demo/logo-wall.html](demo/logo-wall.html).

Look: the flat neutral ground. A centred heading in two lines (the first muted, the number in ink). Under it, three lanes
of logos with hairlines between them. Every logo is the same mid grey at one optical size (a wide or mono face sets a
little smaller), and the lanes fade out at the left and right edges, as a real wall does. The brands are invented in
`demo/assets/logos.js`; a film never uses a real logo.

How it moves: the heading rises from a mask on `EASE.land`. The lanes slide in from opposite sides on `EASE.landSoft`
(1.3 s, 110 ms between lanes) while they fade in. They then keep drifting at 4 u a second in the same direction. A real wall
drifts at a constant speed, so the drift has no ease. The stage leaves on `leave`.

```js
const land = easeFn('landSoft');
const ARRIVE = 1.3, STAGGER = 0.11, RUN = 150 * u, DRIFT = 4 * u;   // s; s between lanes; px a lane slides while it arrives; px a second after
vawe.onFrame((t) => rows.forEach((row, i) => {
  const dir = i % 2 ? 1 : -1, k = clamp((t - 0.15 - i * STAGGER) / ARRIVE);
  row.style.translate = `${dir * DRIFT * t - dir * RUN * (1 - land(k))}px 0`;
  row.style.opacity = String(clamp(k * 3));
}));
```

Sound: none.

Common mistake: logos in mixed colours, weights and heights. The wall then reads as a set of ads, not proof. Set every logo in one
grey at one optical height, and never add a blur to the slide.

Looks (ground, type, radius, accent) live in `demo/demo.css`; this snippet keeps neutral tokens.
