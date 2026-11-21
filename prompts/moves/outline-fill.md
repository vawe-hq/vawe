# Outline fill

**Use when** one hero word is the beat. It arrives as an outline, each letter rising 45 ms after the
last, readable at once. Then, on the beat, a solid accent floods each letter from its baseline up.
No blur and no mask hides the word at any point. Clip: [outline-fill.mp4](clips/outline-fill.mp4). Demo:
[demo/outline-fill.html](demo/outline-fill.html).

```html
<svg width="0" height="0"><filter id="ring" x="-8%" y="-8%" width="116%" height="116%">
  <feMorphology in="SourceAlpha" operator="dilate" radius="6"/><feComposite in2="SourceAlpha" operator="out" result="ring"/>
  <feFlood flood-color="#fff"/><feComposite in2="ring" operator="in"/></filter></svg>
<style>.o { filter: url(#ring); } .f { position: absolute; inset: 0; color: var(--accent); clip-path: inset(110% -0.1em -0.3em -0.1em); }</style>
<span class="ch"><i class="o">F</i><i class="f">F</i></span>   <!-- one per letter -->
<script type="module">
import { EASE } from '../../core/motion/presets.js';
chars.forEach((ch, i) => {
  ch.animate([{ opacity: 0, translate: '0 5vh' }, { opacity: 1, translate: '0 0' }], { duration: 650, delay: 40 + i * 45, easing: EASE.land, fill: 'both' });
  ch.querySelector('.f').animate([{ clipPath: 'inset(110% -0.1em -0.3em -0.1em)' }, { clipPath: 'inset(-0.3em -0.1em -0.3em -0.1em)' }],
    { duration: 720, delay: 780 + i * 35, easing: EASE.landSoft, fill: 'both' });
});
</script>
```

Sound: bloom at 0.70 s into the move, so its slow peak meets the accent flood at 0.78 s (default gain).

Draw the outline as a dilated ring around the solid glyph, not with `-webkit-text-stroke`: a
variable font's glyphs are built from overlapping shapes and a text stroke draws every overlap as an
inner line. The ring sits outside the glyph, so the fill lands exactly inside it. Set the dilate radius
to about 0.55 percent of frame height (`--vh`) so the line holds at draft size. The fill clip is padded
0.3 em past the glyph top and bottom (the reveal never cuts a letter). Fill stagger is shorter than
the entrance stagger (35 against 45 ms), so the flood reads as one wave. Keep the fill one accent
colour and the outline the ink colour.

Looks (ground, type, radius, accent) live in `demo/demo.css`; this snippet keeps neutral tokens.
