# Type match cut

**Use when** two shots are about the same word: the word grows in shot A, holds its exact place, the
frame cuts around it (new ground, new ink), and in shot B it is part of a new line. The word is one
node that lives above both shots, so the cut cannot move it. Clip: [type-match-cut.mp4](clips/type-match-cut.mp4).
Demo: [demo/type-match-cut.html](demo/type-match-cut.html).

```html
<section class="shot" id="a"><p class="line" id="la">Everything we ship is <span class="slot" id="sa">fast</span></p></section>
<section class="shot" id="b"><p class="line" id="lb">The feature is <span class="slot" id="sb">fast</span></p></section>
<span class="hold" id="hold">fast</span>   <!-- one node above both; .slot is visibility:hidden and only reserves the room -->
```

```js
await document.fonts.ready;
// the held word sits at one point P: each shot's line is shifted until its slot is centred on P
const P = { x: innerWidth * 0.8 - wB / 2, y: innerHeight * 0.5 };
for (const [line, slot] of [[la, sa], [lb, sb]]) {
  line.style.left = `${P.x - (slot.offsetLeft + slot.offsetWidth / 2)}px`;
  line.style.top = `${P.y - (slot.offsetTop + slot.offsetHeight / 2)}px`;
}
const s0 = wA / wB;                                    // slot widths: the word starts at the size of its slot in A
hold.animate([{ transform: `scale(${s0})` }, { transform: `scale(${s0})`, offset: GROW_AT / CUT, easing: EASE.settle }, { transform: 'scale(1)' }], { duration: CUT * 1000, fill: 'both' });
const swap = (el, from, to) => el.animate([from, to], { duration: CUT * 1000, easing: 'steps(1, jump-end)', fill: 'both' });
swap(a, { visibility: 'visible' }, { visibility: 'hidden' });   // the cut: one frame
swap(b, { visibility: 'hidden' }, { visibility: 'visible' });
swap(hold, { color: lemon }, { color: paperInk });
enter(lb, { at: CUT + 0.02, band: 'gravity', from: '-0.5em 0' });
```

Sound: a hit on the cut second (CUT), low and short; the grow before it is silent.

## The numbers that make it look expensive

- The word grows 0.65 s (`EASE.settle`) and the cut lands on the frame it stops: the eye is on the word at the cut, so the new ground reads as the word moving into place, not as a jump.
- The rest of shot A leaves in 0.26 s on `EASE.launch` as the word starts to grow, so the word never runs over its neighbours. The cut itself is `steps(1, jump-end)`: one frame, no fade.
- Shot B's other words enter 20 ms after the cut, from the side, so the first frame of B is the word alone on the new ground.
- The ink flips with the cut (accent to dark on white). Contrast is 4.5:1 or more in both shots.
- Match centre to centre, not left edge to left edge: the word scales about its centre, so the centre is the one point that does not move.
- Wait for `document.fonts.ready` before measuring slots, or the match is off by a font swap.

## The common mistake

Two copies of the word, one per shot, lined up by eye. They differ by a pixel or a sub-pixel of
kerning and the word shivers at the cut. One node, measured slots, and nothing else moves it.

Looks (ground, type, radius, accent) live in `demo/demo.css`; this snippet keeps neutral tokens.
