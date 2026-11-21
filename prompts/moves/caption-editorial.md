# Caption editorial

**Use when** captions or a short quote must read like a magazine: each line carries one or two key
words set in a contrasting face (an italic serif inside a bold grotesk), and the next caption replaces
the last on a cut with a short mask, line by line. Clip: [caption-editorial.mp4](clips/caption-editorial.mp4).
Demo: [demo/caption-editorial.html](demo/caption-editorial.html).

```css
.line { display: block; overflow: clip; padding-block: 0.16em; margin-block: -0.16em; }   /* the mask */
.line > span { display: block; }
.cap { position: absolute; inset: 0 0 auto 0; margin: 0; font: 600 13vh/1.12 var(--sans); letter-spacing: -0.03em; }
.key { font: italic 400 1.16em/0.9 'Instrument Serif', serif; letter-spacing: -0.015em; }   /* 1.16em matches the x-heights */
```

```js
// [seconds the caption is cut in, seconds it is cut out]: both captions sit in one place, the masks hide the other
const CUTS = [[0.1, 1.6], [1.65, 3.6]];
caps.forEach((cap, c) => {
  const [on, off] = CUTS[c];
  [...cap.querySelectorAll('.line > span')].forEach((s, i) => {
    s.animate([{ translate: '0 135%' }, { translate: '0 0' }], { delay: (on + i * 0.07) * 1000, duration: 420, easing: EASE.land, fill: 'both' });
    if (c < CUTS.length - 1) s.animate([{ translate: '0 0' }, { translate: '0 -135%' }], { delay: (off - 0.22 + i * 0.04) * 1000, duration: 220, easing: EASE.launch, fill: 'forwards' });
  });
});
```

Sound: none; a soft tick at each cut-in second if the film wants the replace marked.

## The numbers that make it look expensive

- In 0.42 s on `EASE.land`, out 0.22 s on `EASE.launch`: the exit is about half as long as the entrance, and the new caption starts 0.05 s after the old one is gone, so the frame is never empty for long.
- The second line follows the first by 70 ms (and leaves 40 ms behind it), so a caption moves as one stack.
- Contrast is face and weight, not colour: sans 600 against a 400 italic serif. The key word is the only serif on screen.
- The mask box carries 0.16em of padding paid back by a negative margin, so descenders and the italic swashes are not cut. Travel is 135 percent, not 110: with 110 the padding lets the next line show above its own mask.
- Both captions share one place. Give the stage the height of the first so the cut never moves the centre.

## The common mistake

Cross-fading the two captions. Two bold lines at half opacity go grey and the key words mix. Cut on
the mask: the old line is gone before the new one is readable.

Looks (ground, type, radius, accent) live in `demo/demo.css`; this snippet keeps neutral tokens.
