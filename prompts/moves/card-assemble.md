# Card assemble

**Use when** a page of cards or a form is the subject and it should build in front of the viewer, not fade
in whole. The clip copies a hosted invoice page in a browser window: the amount and the line items on
the left, a card payment form on the right. The window lands first. Then each part travels in from the side
its slot is on: the left column from the left, the form from the right, the items and the totals from
below. The parts start 110 ms apart, the rule draws, and the pay button lands last on a pop. After that the
email field types, so the page stays alive. Clip: [card-assemble.mp4](clips/card-assemble.mp4). Demo:
[demo/card-assemble.html](demo/card-assemble.html).

```js
import { EASE } from '../../core/motion/presets.js';
// the window arrives first (arrive() in demo/assets/stage.js); each part has data-from="x y" for its side
parts.forEach((el, i) => {
  const at = 450 + i * 110;
  if (el.classList.contains('rule')) { el.animate([{ opacity: 1, scale: '0 1' }, { opacity: 1, scale: '1 1' }], { duration: 600, delay: at, easing: EASE.land, fill: 'both' }); return; }
  el.animate([{ opacity: 0, translate: el.dataset.from, filter: 'blur(6px)' }, { opacity: 1, translate: '0 0', filter: 'blur(0px)' }],
    { duration: 900, delay: at, easing: el.id === 'pay' ? EASE.pop : EASE.land, fill: 'both' });
});
```

```html
<div class="iv-brand part" data-from="-14vh 0">...</div>   <!-- the person and the money: from the left -->
<div class="iv-item part" data-from="0 9vh">...</div>      <!-- the rows: from below -->
<div class="iv-pay part" id="pay" data-from="0 12vh">Pay $4,280.00</div>
```

Sound: droplet at 2.5 s, when the pay button lands (default gain); no tick per part.

Each part has an origin the eye can name, so the build explains the page. The blur is 6 px and clears as the
part lands, so a still part is never soft. The parts take 900 ms because they travel 9 to 14 vh. A shorter
run reads as a pop. Use real content (a name, a due date, amounts that add up), never lorem ipsum. Keep the
dark fill for the one action. The window is the real surface and does not scale.

Common mistake: fading the whole card in and then moving the parts. The parts must arrive on an empty shell,
each from its own side, or the build explains nothing.

Looks (ground, type, radius, accent) live in `demo/demo.css`; this snippet keeps neutral tokens.
