# Tracking collapse

**Use when** a title or a wordmark arrives: the letters converge from wide tracking while the
word sharpens from a blur. This is the After Effects tracking animator, the most used text move in
title sequences and brand stings. Clip: [tracking-collapse.mp4](clips/tracking-collapse.mp4). Demo:
[demo/tracking-collapse.html](demo/tracking-collapse.html).

```css
h1 { white-space: nowrap; text-transform: uppercase; letter-spacing: 0.35em; text-indent: 0.35em;
     opacity: 0; filter: blur(0.06em);
     animation-name: converge, sharpen; animation-duration: 0.9s, 0.5s;
     animation-delay: var(--beat-1), var(--beat-1);
     animation-timing-function: var(--settle), var(--settle); animation-fill-mode: both, both; }
@keyframes converge { to { letter-spacing: 0.02em; text-indent: 0.02em; } }
@keyframes sharpen { to { opacity: 1; filter: blur(0); } }
```

```html
<h1>Converge</h1>
<script type="module">
import { EASE } from '../../core/motion/presets.js';
document.documentElement.style.setProperty('--settle', EASE.land);
</script>
```

Sound: bloom at --beat-1; its 0.14 s attack follows the blur clearing over 0.5 s (default gain).

`letter-spacing` adds its gap after the last letter too, so a centred word drifts left as it
collapses; `text-indent` of the same value, animated with it, cancels that. The blur clears in 0.5 s
while the tracking runs 0.9 s: the word is readable before it is still. Size the word for its first
frame (1.8x the settled width at 0.35em), not its last: the demo runs 14vh where a plain title runs 16.

Looks (ground, type, radius, accent) live in `demo/demo.css`; this snippet keeps neutral tokens.
