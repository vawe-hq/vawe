# Logo sting

**Use when** a film ends on the brand, or opens on it, in under 2 s. The mark lands on the overshoot
curve, one light band crosses it, then the word opens out from behind the mark while the lockup
re-centres. A slow push runs to the last frame, so the lockup is never frozen. Clip:
[logo-sting.mp4](clips/logo-sting.mp4). Demo: [demo/logo-sting.html](demo/logo-sting.html).

Use once per film: the sheen band is a stock device (rule no-tells), never the idea.

```html
<div class="drift"><div class="lockup">
  <div class="mark"><svg viewBox="0 0 100 100"><path d="M22 32 L36 70 L50 44 L64 70 L78 32"/></svg><div class="sheen"></div></div>
  <span class="word">vawe</span>
</div></div>
<style>
.mark { position: relative; overflow: hidden; z-index: 1; opacity: 0; scale: 0.9; }   /* z-index: the word slides out from behind */
.sheen { position: absolute; inset: 0; translate: -130% 0;
         background: linear-gradient(105deg, transparent 38%, rgba(255,255,255,0.5) 50%, transparent 62%); }
.word { display: block; clip-path: inset(-0.3em 100% -0.3em 0); }
</style>
<script type="module">
import { EASE } from '../../core/motion/presets.js';
const shift = (word.getBoundingClientRect().width + gap) / 2;   // the mark starts centred
mark.animate([{ scale: 0.9 }, { scale: 1 }], { duration: 550, delay: 60, easing: EASE.pop, fill: 'both' });
mark.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 110, delay: 60, easing: 'linear', fill: 'both' });
sheen.animate([{ translate: '-130% 0' }, { translate: '130% 0' }], { duration: 650, delay: 380, easing: EASE.land, fill: 'both' });
lockup.animate([{ translate: `${shift}px 0` }, { translate: '0 0' }], { duration: 650, delay: 520, easing: EASE.land, fill: 'both' });
word.animate([{ clipPath: 'inset(-0.3em 100% -0.3em 0)', translate: `-${w * 0.35}px 0` },
              { clipPath: 'inset(-0.3em -0.3em -0.3em 0)', translate: '0 0' }], { duration: 650, delay: 520, easing: EASE.land, fill: 'both' });
drift.animate([{ scale: 1 }, { scale: 1.045 }], { duration: 1800, easing: EASE.glide, fill: 'both' });
</script>
```

Sound: chime at 0.52 s into the move, when the word opens from behind the mark; its second note at +0.09 s rides the reveal (default gain).

The sheen starts before the word (0.38 s against 0.52 s), so the eye is on the mark when it lands
and follows the light into the word. Opacity runs 110 ms linear because the overshoot curve would
dip it. The clip box is padded 0.3 em above and below so no glyph is cut. The 4.5 percent push over
the whole clip is the last-frame motion; without it the tail reads as a still. The light is on the
mark only, never on the text.

Looks (ground, type, radius, accent) live in `demo/demo.css`; this snippet keeps neutral tokens.
