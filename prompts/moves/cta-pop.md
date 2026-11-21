# CTA pop

**Use when** the film ends on an action. The line is already on screen; the button pops in under it
on the overshoot curve, growing from the line's left edge and 3vh below its slot, and it is the
only accent in the frame. After it lands the arrow leans right and returns twice, so the button
invites a click and the tail is never still. Clip: [cta-pop.mp4](clips/cta-pop.mp4). Demo:
[demo/cta-pop.html](demo/cta-pop.html).

```html
<h1>Your first film<br>is one page away.</h1>
<div class="cta"><span>Start free</span><svg viewBox="0 0 24 24"><path class="arrow" d="M4 12 H19 M13 6 L19 12 L13 18"/></svg></div>
<style>
.cta { display: inline-flex; align-items: center; gap: 2.4vh; padding: 3.8vh 6vh 3.8vh 7vh; border-radius: 999px;
       background: var(--accent); color: #fff; transform-origin: 0 50%; opacity: 0; }
.cta path { fill: none; stroke: #fff; stroke-width: 2.6; stroke-linecap: round; stroke-linejoin: round; }
</style>
<script type="module">
import { EASE } from '../../core/motion/presets.js';
cta.animate([{ scale: '0.86', translate: '0 3vh' }, { scale: '1', translate: '0 0' }], { duration: 650, delay: 300, easing: EASE.pop, fill: 'both' });
cta.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 100, delay: 300, easing: 'linear', fill: 'both' });
[1200, 1600].forEach((at) => arrow.animate([{ translate: '0 0' }, { translate: '4px 0', offset: 0.4 }, { translate: '0 0' }],
  { duration: 520, delay: at, easing: EASE.landSoft, fill: 'both' }));
</script>
```

Sound: droplet at 0.45 s into the move, when the button crosses its full size on the overshoot (default gain).

The start scale is 0.86, never 0 (taste rule 5). The recoil of the overshoot curve is the pop; use
it on this one element only, since a second bouncy thing in the frame turns the beat into a toy.
The button is 8.4vh type in one solid colour with no glow, so the label stays readable when it
lands. The arrow moves 4 units in a 24-unit box; more than that reads as a wiggle, less is lost at
640 px. Give the pop 300 ms of head start so the line is read before the button asks for a click.

Looks (ground, type, radius, accent) live in `demo/demo.css`; this snippet keeps neutral tokens.
