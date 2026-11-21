# Grain field

**Use when** a quiet, printed or filmic frame must breathe: a flat warm tone with one soft light from the top, and
fine film grain that turns over 24 times a second on top. The type stays clean. The grain is a hash of the pixel
cell and the frame number, taken from the seek time, so every render draws the same grain. It rises from a trace to
its full strength over the first 1.4 s, so the viewer sees the film "switch on". Clip:
[grain-field.mp4](clips/grain-field.mp4). Demo: [demo/grain-field.html](demo/grain-field.html).

```js
import '../../core/engine/page-api.js';
import { shaderField } from '../../core/surfaces/shader-field.js';
const frag = `
uniform vec3 u_ground, u_lift;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7)) + u_seed * 17.0) * 43758.5453); }
void main() {
  float aspect = u_res.x / u_res.y;
  vec2 p = gl_FragCoord.xy / u_res.y;
  float key = smoothstep(1.0, 0.0, distance(p, vec2(0.6 * aspect, 1.1)) / 1.2);   // one soft light from the top edge
  vec3 col = mix(u_ground, u_lift, key);
  float frame = floor(u_time * 24.0 + 0.001);                                     // the grain turns over at 24 fps, from the seek
  vec2 cell = floor(gl_FragCoord.xy / 2.0) + vec2(frame * 17.31, frame * 5.77);   // a 2 px grain
  float grain = hash(cell) + hash(cell + 41.7) - 1.0;                             // two hashes: a triangular spread, no hard speckle
  float amp = 0.012 + 0.04 * smoothstep(0.2, 1.4, u_time);                        // from a trace to about 13 levels of 255
  gl_FragColor = vec4(col + grain * amp, 1.0);
}`;
const field = shaderField(frag, { seed: 5, uniforms: { u_ground: rgb('--raised'), u_lift: rgb('--ground') } });
vawe.onFrame((t) => field.draw(t));                                               // never Math.random: the virtual clock owns it
```

Sound: none; a held ground is quiet.

A 2 px cell survives the downscale and the encode. A 1 px cell vanishes in it, and grain at 60 fps doubles the
change per frame and starts to shimmer. Keep the base tone mid-light: on a near-black ground the encoder flattens
the grain, and on a near-white ground it clips. The ground is flat: the two tones differ by a few percent and
only the light at the top shows. The ink has 10:1 contrast against the lightest and darkest pixel behind it.

Common mistake: seeding the grain with `Math.random`. The page clock replaces it, and a grain built from earlier
frames breaks the seek. Also avoid blurred blobs of tone under the grain: they read as a glow, not as film.

Looks (ground, type, radius, accent) live in `demo/demo.css`; this snippet keeps neutral tokens.
