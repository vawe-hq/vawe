# Model picker

**Use when** a model or tier choice is the point. A copy of the claude.ai new-chat screen in a Chrome window: a prompt is typed (the suggestion chips leave with the first key, as in the product), a pointer travels to the model name, the menu opens with a short fade and scale, the pointer moves to Opus, the press moves the check from Sonnet to Opus in one frame, the menu closes and the label swaps to the new name in one frame. Clip:
[model-picker.mp4](clips/model-picker.mp4) (6 s, light; `model-picker-dark.mp4` is the dark theme). Demo: [demo/model-picker.html](demo/model-picker.html).

```js
import { arrive, show, typeTimes, typedCount, between, leave } from '../../prompts/moves/demo/assets/stage.js';
import { EASE } from '../../core/motion/presets.js';
// typing 0.6 s (22 chars/s); the send button wakes 0.4 to 1 with the first key; the chips fade out 0.15 s
// pointer: hop(from, to, atMs, ms) is a translate on EASE.land; start 1.9 s to the trigger 0.65 s, to the Opus row 0.42 s from 2.9 s
ptr.animate([{ translate: from }, { translate: to }], { duration: 650, delay: 1900, easing: EASE.land, fill: 'both' });
// press: the pointer dips 14 percent in 0.2 s at 2.55 s and 3.35 s
// menu: opens 0.15 s on EASE.land at 2.65 s (origin top right, no overshoot), closes 0.12 s on EASE.launch at 3.8 s
menu.animate([{ opacity: 0, scale: 0.96 }, { opacity: 1, scale: 1 }], { duration: 150, delay: 2650, easing: EASE.land, fill: 'both' });
// the check appears on Opus at 3.45 s and the label swaps at 3.85 s, each on one frame
show(opusCheck, 3450);
show(sonnetLabel, null, 3850); show(opusLabel, 3850);
```

Sound: none. The clip is silent.

The clip copies claude.ai: the greeting with the spark in a serif face (Instrument Serif stands in for the product's), the composer with the plus and tools buttons, the model name with a chevron and the orange send button, the chips Write, Learn, Code, Life stuff, Claude's choice, and the model menu with the four model names and their number keys, a check on the current one and More models; the greeting names no one. Colours are the product's own (#faf9f5 page, #c6613f orange; dark #262624 and #d97757). Model names are the current Claude tiers as the reference clip shows them (Opus 5.5, Fable 5.1, Sonnet 5.5, Haiku 5.5); the prompt is our own. The pointer leaves after the pick. Nothing overshoots but the pointer's press dip. The 1.7 s hold keeps the blinking caret alive.
