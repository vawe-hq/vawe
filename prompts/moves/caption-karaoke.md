# Caption karaoke

**Use when** a spoken line runs as captions and the eye must follow the voice: the word being said
turns solid yellow on its own spoken second, and the rest of the page stays white. The page never
re-wraps and no word moves. Clip: [caption-karaoke.mp4](clips/caption-karaoke.mp4) (4.4 s).
Demo: [demo/caption-karaoke.html](demo/caption-karaoke.html).

```js
// pages of captions: [start s, end s, [[word, second it is spoken], ...] per line]: one table, edited in place
const PAGES = [[0.4, 2.3, [[['Captions', 0.4], ['that', 0.95]], [['follow', 1.2], ['the', 1.55], ['voice', 1.7]]]], /* ... */];
show(page, from * 1000, to * 1000);                       // a page appears and goes on one frame
// the active word is yellow from its second to the next word (or 0.45 s): a hard colour step
vawe.onFrame((t) => words.forEach(({ w, at }) => w.classList.toggle('on', t >= at && t < end(at))));
```

```css
.caps { font: 900 11.5u Archivo; text-transform: uppercase; text-align: center; color: #fff; }
.w { -webkit-text-stroke: 1.8u #000; paint-order: stroke fill; }
.w.on { color: #ffe500; }
```

Sound: none; the voice is the sound.

## How it looks and moves

- The clip copies a short-video caption: a heavy uppercase sans, centred in the lower third of the shot, white with a thick black stroke and a soft shadow so it reads on any footage.
- A page holds 2 lines and 3 to 5 words. The next page replaces it on one frame.
- The active word is solid yellow (#ffe500). It switches on one frame, with no glide, pill or lift, as these captions do.
- The footage is a real photograph with a slow 3 percent push on the glide ease (`EASE.glide`, 4.4 s). The pages run back to back from 0.4 s to 4.1 s with no gap, and the clip ends 0.3 s after the last page. Frame 0 and the last frame show the footage without captions.
- The caption is 11.5 percent of the frame height, so it reads at once.

## The common mistake

Timing each word with a `setTimeout`, or tweening a highlight per word. Both drift from the speech. Keep one
table of spoken seconds and derive the state from `t`.
