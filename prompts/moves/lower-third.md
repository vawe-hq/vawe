# Lower third

**Use when** a person is on screen and the viewer must learn who they are: an interview, a customer, a
speaker. A thin accent rule grows up at the lower left, a plate wipes open from it, the name rises out
of a mask, then the role rises 140 ms behind. It holds for about 1.7 s, the text drops, and the plate
closes toward the rule faster than it opened. The photo keeps a slow push underneath, so the frame is
alive while the name holds. Clip: [lower-third.mp4](clips/lower-third.mp4). Demo:
[demo/lower-third.html](demo/lower-third.html).

```css
.third { position: absolute; left: 9vh; bottom: 11vh; display: flex; align-items: stretch; }   /* inside the title-safe margin, clear of the subject */
.rule { width: 1.3vh; background: var(--accent); transform-origin: 50% 100%; }
.plate { padding: 3.2vh 6vh 3.6vh 4.4vh; background: var(--surface); }
.mask { overflow: hidden; padding: 0.06em 0 0.14em; margin: -0.06em 0 -0.14em; }   /* tall enough for descenders */
```

```js
import { EASE } from '../../core/motion/presets.js';
const at = { rule: 420, plate: 520, name: 760, role: 900, exit: 2600 };   // ms
shot.animate([{ scale: 1.0 }, { scale: 1.05 }], { duration: 3200, easing: EASE.glide, fill: 'both' });   // the picture never sits still

// in: the rule grows up, the plate wipes open from it, the name rises out of its mask, then the role
rule.animate([{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }], { duration: 380, delay: at.rule, easing: EASE.landSoft, fill: 'both' });
plate.animate([{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)' }], { duration: 560, delay: at.plate, easing: EASE.land, fill: 'both' });
name.animate([{ translate: '0 105%' }, { translate: '0 0' }], { duration: 520, delay: at.name, easing: EASE.land, fill: 'both' });
role.animate([{ translate: '0 120%' }, { translate: '0 0' }], { duration: 460, delay: at.role, easing: EASE.landSoft, fill: 'both' });

// out, left off the clip so it ends on the held card: text first (160 ms), then the plate closes toward the rule in 260 ms, then the rule drops; no `from` fill over the entrance
name.animate([{ translate: '0 0' }, { translate: '0 105%' }], { duration: 160, delay: at.exit, easing: EASE.launch, fill: 'forwards' });
role.animate([{ translate: '0 0' }, { translate: '0 120%' }], { duration: 160, delay: at.exit + 40, easing: EASE.launch, fill: 'forwards' });
plate.animate([{ clipPath: 'inset(0 0% 0 0)' }, { clipPath: 'inset(0 100% 0 0)' }], { duration: 260, delay: at.exit + 120, easing: EASE.launch, fill: 'forwards' });
rule.animate([{ transform: 'scaleY(1)' }, { transform: 'scaleY(0)' }], { duration: 240, delay: at.exit + 260, easing: EASE.launch, fill: 'forwards' });
```

Sound: none; a name card is a read, not an event.

Put the plate on the side away from the person's face and out of the lower 10 percent of the frame.
Two lines only: a name in the headline face and one role line in small tracked capitals; a third line
never gets read. The plate is opaque, so the contrast of the text never depends on the photo behind it.
The in move is an overlap of four beats 100 to 240 ms apart, and the out move runs in the reverse order
on shorter times (160, 260, 240 ms), so the card leaves faster than it came. Hold the card at least
1.5 s: the name needs a full read after the role lands. Use an invented person and a role, never a real one.

Looks (ground, type, radius, accent) live in `demo/demo.css`; this snippet keeps neutral tokens.
