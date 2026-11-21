# Per-letter stagger

**Use when** one word is the beat and should land letter by letter. 45 ms per letter is inside the 30
to 80 ms band, so the group never lands on one frame; every letter rides the same exact curve. Clip:
[letter-stagger.mp4](clips/letter-stagger.mp4). Demo: [demo/letter-stagger.html](demo/letter-stagger.html).

```html
<h1>staggered</h1>
<style>h1 span { display: inline-block; white-space: pre; }</style>
<script type="module">
import { EASE } from '../../core/motion/presets.js';
const h1 = document.querySelector('h1');
const letters = [...h1.textContent].map((ch) => Object.assign(document.createElement('span'), { textContent: ch }));
h1.replaceChildren(...letters);
const beat = 100;   // ms, the same number the CSS --beat-1 holds
letters.forEach((s, i) => s.animate(
  [{ translate: '0 0.6em', opacity: 0 }, { translate: '0 0', opacity: 1 }],
  { duration: 550, delay: beat + i * 45, easing: EASE.land, fill: 'both' },
));
</script>
```

Sound: pluck at 0.10 s into the move, with the first letter (default gain); the stagger is the rhythm, so no tick per letter.

`white-space: pre` keeps the spaces as letters. For a heavier word use `EASE.pop` and a 0.4em
travel; for a headline of several words stagger the words, not the letters.

Looks (ground, type, radius, accent) live in `demo/demo.css`; this snippet keeps neutral tokens.
