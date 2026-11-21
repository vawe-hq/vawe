# Wordmark cascade

**Use when** the name is the last beat. Each letter falls onto a rail, one after the other, each
gap shorter than the last, so the word speeds up as it lands; the full stop is the accent and lands
last. After the landing a short accent bar runs along the rail, so the tail is never still. Clip:
[wordmark-cascade.mp4](clips/wordmark-cascade.mp4). Demo: [demo/wordmark-cascade.html](demo/wordmark-cascade.html).

Use once per film: the accent bar is a stock device (rule no-tells), never the idea.

```html
<div class="stage">
  <h1><span>v</span><span>a</span><span>w</span><span>e</span><span class="dot">.</span><i class="base" style="display:inline-block;width:0;height:0"></i></h1>
  <div class="rail"><div class="run"></div></div>
</div>
<style>h1 span { display: inline-block; } .rail { position: absolute; left: 0; right: 0; height: 1.3vh; overflow: hidden; background: rgba(255,255,255,0.2); }
.run { position: absolute; inset: 0 auto 0 0; width: 22%; background: var(--accent); translate: -100% 0; }</style>
<script type="module">
import { EASE } from '../../core/motion/presets.js';
rail.style.top = `${base.getBoundingClientRect().top - stage.getBoundingClientRect().top}px`;   // the rail sits on the baseline
const at = [100, 190, 260, 315, 360];   // ms: gaps of 90, 70, 55, 45
letters.forEach((s, i) => {
  s.animate([{ translate: '0 -0.85em', filter: 'blur(10px)' }, { translate: '0 0', filter: 'blur(0px)' }],
    { duration: 620, delay: at[i], easing: EASE.pop, fill: 'both' });
  s.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 90, delay: at[i], easing: 'linear', fill: 'both' });
});
run.animate([{ translate: '-100% 0' }, { translate: '450% 0' }], { duration: 800, delay: 1050, easing: EASE.settle, fill: 'both' });
</script>
```

Sound: droplet at 0.55 s into the move, when the accent full stop lands on the rail (default gain); no tick per letter.

The gaps run 90, 70, 55, 45 ms: inside the 30 to 80 ms band except the first, which is the hook.
The letters blur only while they fall and are sharp on landing. The rail is on screen from frame 0
so the first frame has a subject. The bar on the rail is the last-frame motion; a landed wordmark
held still is what the rule moving-tail bans. Use `EASE.pop` (a small overshoot).

Looks (ground, type, radius, accent) live in `demo/demo.css`; this snippet keeps neutral tokens.
