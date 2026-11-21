# Exits faster than entrances

**Use when** anything enters and later leaves, which is every beat. In: 0.55 s, arrives fast and lands
soft (`EASE.land`). Out: 0.22 s, accelerates, and travels less than half the entrance distance. The
exit keyframe has no `from`: a `from` would fill backwards over the entrance and hide it. Clip:
[exit-fast.mp4](clips/exit-fast.mp4). Demo: [demo/exit-fast.html](demo/exit-fast.html).

```css
h1 { animation-name: land, leave; animation-duration: 0.55s, 0.22s;
     animation-delay: var(--beat-1), var(--beat-1-out);
     animation-timing-function: var(--settle), var(--accelerate); animation-fill-mode: both, both; }
@keyframes land { from { translate: 0 12vh; opacity: 0; } to { translate: 0 0; opacity: 1; } }
@keyframes leave { to { translate: 0 -5vh; opacity: 0; } }
```

```html
<style>:root { --beat-1: 0.05s; --beat-1-out: 0.72s; }</style>
<h1>in, then out</h1>
<script type="module">
import { EASE } from '../../core/motion/presets.js';
const root = document.documentElement.style;
root.setProperty('--settle', EASE.land);
root.setProperty('--accelerate', EASE.launch);
</script>
```

Sound: none; the entrance carries the beat's cue, and an exit is never scored.

Name the beat once (`--beat-1`, `--beat-1-out`) and read it from every delay in that beat, so one
edit moves the whole beat. Declare the empty frames after the exit in `<meta name="blank">`.

Looks (ground, type, radius, accent) live in `demo/demo.css`; this snippet keeps neutral tokens.
