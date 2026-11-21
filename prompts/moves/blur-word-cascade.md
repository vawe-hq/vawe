# Blur word cascade

**Use when** a line of copy arrives word by word and must feel soft, not sliced: each word resolves
from blur with a slight rise, one after another. There is no mask and no clip, so nothing cuts a
descender. Clip: [blur-word-cascade.mp4](clips/blur-word-cascade.mp4). Demo:
[demo/blur-word-cascade.html](demo/blur-word-cascade.html).

```css
/* near-black on off-white (#0b0b0b on #f2f1ec), a grotesk set large and tight, left and off-centre */
p { font: 600 calc(var(--u) * 16)/1.02 var(--sans); letter-spacing: -0.052em; text-wrap: balance; }
.w { display: inline-block; opacity: 0; filter: blur(0.14em); translate: 0 0.22em;
     animation-name: resolve; animation-duration: 0.8s;
     animation-delay: calc(0.12s + var(--i) * 0.09s);
     animation-timing-function: var(--soft); animation-fill-mode: both; }
@keyframes resolve { 45% { opacity: 1; } to { opacity: 1; filter: blur(0); translate: 0 0; } }
/* the word the line is about changes face, not colour: an italic serif, 1.14em to match x-heights */
.w.hot { font: italic 400 1.14em/0.9 'Instrument Serif', serif; letter-spacing: -0.02em; }
```

```js
line.innerHTML = line.textContent.split(' ').map((t, i) => `<span class="w${t === 'hand' ? ' hot' : ''}" style="--i:${i}">${t}</span>`).join(' ');
document.documentElement.style.setProperty('--soft', EASE.land);
```

Sound: none; soft copy resolving from blur has no event to mark.

## The numbers that make it look expensive

- 90 ms between words, 0.8 s per word. Each word is still softening when the third one after it
  starts, so the cascade reads as one wave.
- The blur starts at 0.14em and the rise is 0.22em: small enough that the word is readable while it
  is soft.
- Opacity reaches 1 at 45 percent of the keyframes. The blur is what the eye tracks, not the fade.
- Black type on paper needs no accent colour. Mark the one word with a second face (a grotesk line,
  one italic serif word); the blur reads cleaner on a light ground because the halo is grey, not a glow.
- Keep the spaces between the inline-block spans as real text spaces, so wrapping is unchanged.

## The common mistake

Hiding each word under a mask box. That is [mask-rise.md](mask-rise.md): a hard edge, and every
descender needs padding. This move is for soft copy. Also never blur a word that is not moving: at
rest the filter is `blur(0)`, so the `to` keyframe must set it, and `fill-mode: both` holds it.

Looks (ground, type, radius, accent) live in `demo/demo.css`; this snippet keeps neutral tokens.
