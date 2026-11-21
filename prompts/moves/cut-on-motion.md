# Cut on motion

**Use when** a hard cut should not feel like one. One shape rides one path across both scenes; the
scene under it changes at 50% with a step, and the shape only flips colour. A symmetric curve puts
the shape mid-frame at peak speed exactly on the cut, which is what hides the cut. Clip:
[cut-on-motion.mp4](clips/cut-on-motion.mp4). Demo: [demo/cut-on-motion.html](demo/cut-on-motion.html).

```css
.scene { position: absolute; inset: 0; }
.after { background: var(--ink); color: var(--ground); animation-name: cut; animation-duration: 1s; animation-timing-function: linear; animation-fill-mode: both; }
@keyframes cut { 0%, 49.9% { opacity: 0; } 50%, 100% { opacity: 1; } }

.ball { position: absolute; top: calc(var(--u) * 38); left: calc(var(--u) * -14); width: calc(var(--u) * 14); height: calc(var(--u) * 14); border-radius: 50%; background: var(--accent);
        animation-name: travel, flip; animation-duration: 1s, 1s;
        animation-timing-function: var(--through), linear; animation-fill-mode: both, both; }
@keyframes travel { to { translate: 118vw 0; } }
@keyframes flip { 0%, 49.9% { background: var(--accent); } 50%, 100% { background: var(--ground); } }
```

```html
<div class="scene before">before</div>
<div class="scene after">after</div>
<div class="ball"></div>
<script type="module">
import { EASE } from '../../core/motion/presets.js';
document.documentElement.style.setProperty('--through', EASE.swap);
</script>
```

Sound: pluck at 0.53 s into the move, two frames after the cut at 0.50 s (default gain).

The shape can be a word, a card edge or a cursor; what matters is that its path does not stop at the
cut. Put the cut two frames before the sound cue, never after it.

Looks (ground, type, radius, accent) live in `demo/demo.css`; this snippet keeps neutral tokens.
