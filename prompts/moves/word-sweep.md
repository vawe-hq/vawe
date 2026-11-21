# Word colour sweep

**Use when** a headline is already on screen and one word is the point. The accent runs word by
word in reading order, lifting each from dim to white as it passes, and stays on the target word.
Every device directs the eye; this one names its target in the markup. Clip:
[word-sweep.mp4](clips/word-sweep.mp4). Demo: [demo/word-sweep.html](demo/word-sweep.html).

```html
<h1>every device directs the eye</h1>
<style>h1 { color: var(--dim); } h1 span { display: inline-block; white-space: pre; }</style>
<script type="module">
import { EASE } from '../../core/motion/presets.js';
const h1 = document.querySelector('h1');
const words = h1.textContent.split(' ').map((w, i, a) =>
  Object.assign(document.createElement('span'), { textContent: i < a.length - 1 ? w + ' ' : w }));
h1.replaceChildren(...words);
const css = getComputedStyle(document.documentElement);
const dim = css.getPropertyValue('--dim'), ink = css.getPropertyValue('--ink'), accent = css.getPropertyValue('--accent');
const beat = 150, step = 140;   // ms; step is faster than reading (about 250 ms a word), so the sweep leads the eye
words.forEach((s, i) => {
  const last = i === words.length - 1;
  s.animate([{ color: dim }, { color: accent, offset: 0.25 }, { color: last ? accent : ink }],
    { duration: 520, delay: beat + i * step, easing: EASE.land, fill: 'both' });
});
</script>
```

Sound: none; the colour points the eye without a sound.

Three colours, in this order: `--dim` (#5c5b63 on #16151a, readable but quiet), `--ink` for what has
been read, `--accent` for one word at a time. The target is the only word that stays accent. A step
slower than 250 ms follows the reader instead of leading; a step under 100 ms is a flicker. For a
target in the middle of the line, sweep to it and stop: the words after it stay dim.

Looks (ground, type, radius, accent) live in `demo/demo.css`; this snippet keeps neutral tokens.
