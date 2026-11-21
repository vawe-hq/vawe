# Halftone field

**Use when** a quiet ground should have texture and one soft form: a title card, an editorial or print-led film.
Clip: [halftone-field.mp4](clips/halftone-field.mp4). Demo: [demo/halftone-field.html](demo/halftone-field.html).

Look: warm bone paper with one ink, like a newspaper print. A 45 degree dot screen of 28 px cells covers the frame.
The dot area follows the shade of one lit sphere at the right, so the size ramp from tiny to nearly touching dots is the
light. The sphere throws a soft shadow down and right. Dots stay on their cells; only their size changes. Type sits left,
where the dots are tiny.

How it moves: the headline rises out of a mask on `EASE.land` and the lead fades up, held to the left 55 percent so it never crosses the sphere. The key light turns once round
over the clip, so the shade slides over the sphere and the last frame matches the first. The copy leaves on `leave`.

```glsl
vec2 g = vec2(p.x + p.y, p.y - p.x) * 0.7071 / CELL;        // 45 degree screen, CELL = 0.026 of the frame height
vec3 n = vec3(q, sqrt(1.0 - r2));                            // q: the cell centre on the sphere, r2 below 1
float cover = 0.08 + 0.7 * (1.0 - clamp(dot(n, L), 0.0, 1.0));   // dark side: big dots
float radius = sqrt(min(cover, 0.76) / 3.14159);             // area to radius, in cell units
vec3 L = normalize(vec3(-0.55 + 0.22 * sin(u_time * TURN), 0.55 + 0.12 * cos(u_time * TURN), 0.62));
```

Sound: none.

Common mistake: a dot screen with a fixed radius and a changing tone. It reads as a flat texture. Make the dot area carry the
shade, so a form shows, and keep the dots on a fixed grid.

Looks (ground, type, radius, accent) live in `demo/demo.css`; this snippet keeps neutral tokens.
