# Scale punch

**Use when** one hero word is the beat and has to hit: a number, a verb, the product name on the
music accent. The word lands from 1.4x on the overshoot curve, which dips to about 0.97 and comes
back; that recoil is what reads as impact, where a plain ease-out reads as a fade. Clip:
[scale-punch.mp4](clips/scale-punch.mp4). Demo: [demo/scale-punch.html](demo/scale-punch.html).

```css
h1 { scale: 1.4; opacity: 0;
     animation-name: punch, appear; animation-duration: 0.55s, 0.12s;
     animation-delay: var(--beat-1), var(--beat-1);
     animation-timing-function: var(--recoil), linear; animation-fill-mode: both, both; }
@keyframes punch { to { scale: 1; } }
@keyframes appear { to { opacity: 1; } }
.dot { display: inline-block; width: 0.16em; height: 0.16em; margin-left: 0.06em; border-radius: 50%;
       background: var(--accent); scale: 0;
       animation-name: pop; animation-duration: 0.35s; animation-delay: calc(var(--beat-1) + 0.22s);
       animation-timing-function: var(--recoil); animation-fill-mode: both; }
@keyframes pop { to { scale: 1; } }
```

```html
<h1>punch<span class="dot"></span></h1>
<script type="module">
import { EASE } from '../../core/motion/presets.js';
document.documentElement.style.setProperty('--recoil', EASE.pop);
</script>
```

Sound: pluck at --beat-1 + 0.20 s, the frame the word crosses scale 1.0 (default gain); the full stop at +0.22 s shares the cue.

Opacity runs 0.12 s, linear: the word is solid while it is still large, so the eye sees a mass
arriving, not a ghost. The full stop pops 0.22 s after the word on the same curve: the second hit
sells the first. Cut the sound on the frame the scale crosses 1.0 (about 0.2 s in), not on the beat
start. Never put this on more than one word in a beat.

Looks (ground, type, radius, accent) live in `demo/demo.css`; this snippet keeps neutral tokens.
