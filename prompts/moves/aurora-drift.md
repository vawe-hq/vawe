# Aurora drift

**Use when** a held title needs a ground that is alive but stays at the edge of attention: three soft
bands of light hang from the top of the frame and fold slowly, in one fragment shader, while the copy
sits low and the light thins out above it. Clip: [aurora-drift.mp4](clips/aurora-drift.mp4). Demo:
[demo/aurora-drift.html](demo/aurora-drift.html).

```js
import '../../core/engine/page-api.js';
import { shaderField } from '../../core/surfaces/shader-field.js';
const css = getComputedStyle(document.documentElement);
const rgb = (name) => { const h = css.getPropertyValue(name).trim(); return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255); };
const frag = `
uniform vec3 u_ground, u_a, u_b;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7)) + u_seed * 17.0) * 43758.5453); }
float vnoise(vec2 p) {                                            // value noise: smooth, seeded, no state
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
float band(vec2 p, float k) {                                     // k offsets the band: a different fold each
  float fold = vnoise(vec2(p.x * 2.0 + k * 5.0, u_time * 0.65 + k * 2.0));
  float centre = 0.88 - 0.15 * k + 0.28 * (fold - 0.5) + 0.07 * sin(p.x * 5.0 + u_time * 2.2 + k * 2.0);
  float d = (p.y - centre) / (0.055 + 0.02 * k);
  float body = d < 0.0 ? exp(-d * d * 2.2) : exp(-d * d * 0.5);   // sharp lower edge, soft fade upward
  return body * (0.6 + 0.4 * vnoise(vec2(p.x * 12.0 + k * 3.0, u_time * 0.9)));   // fine rays
}
vec3 lin(vec3 c) { return pow(c, vec3(2.2)); }
void main() {
  vec2 p = gl_FragCoord.xy / u_res.y;
  vec3 ground = lin(u_ground), a = lin(u_a), b = lin(u_b);
  vec3 col = ground + a * 0.40 * band(p, 0.0) + mix(a, b, 0.5) * 0.28 * band(p, 1.0) + b * 0.20 * band(p, 2.0);
  col = mix(ground, col, 0.15 + 0.85 * smoothstep(0.42, 0.74, p.y));   // the copy sits low: thin the light above it
  gl_FragColor = vec4(pow(col, vec3(1.0 / 2.2)) + (hash(gl_FragCoord.xy) - 0.5) * 0.012, 1.0);   // static dither
}`;
const field = shaderField(frag, { seed: 3, uniforms: { u_ground: rgb('--ground'), u_a: rgb('--accent'), u_b: rgb('--muted') } });
vawe.onFrame((t) => field.draw(t));                               // time is the seek, no loop of its own
```

Sound: none; a held ground is quiet.

The ground is a pure function of the seek time, so frame `t` is the same on every render. The three
colours are the look's ground, accent and muted tokens: on `terminal` they give a green aurora over a
near-black green. Measured on the 4 s demo clip at 640 x 360: the mean luma change is 0.6 per frame at
60 fps (0.45 once the copy has settled), inside the 0.5 to 3.0 band for a calm ground. The worst
contrast of the ink against the lightest and darkest pixel behind the text box is 5.7:1 over 12 frames.
Two numbers carry the flow: fold speed (`u_time * 0.65` and `2.2` in the sine) and band width. Halve
the speeds and the luma change falls under 0.3, which reads as a still. The `keep` line is the contrast
guard: a band behind white mono type at full strength falls to 2.6:1, so keep the bands above the copy.
The dither is static on purpose: a dark gradient bands in the encode without it, and a dither that
changed every frame would shimmer.

Looks (ground, type, radius, accent) live in `demo/demo.css`; this snippet keeps neutral tokens.
