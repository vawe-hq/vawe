# Caret typing

**Use when** a command, a prompt or a name is typed in. The clip copies a shell window: earlier
commands above, a block caret that follows each typed character, and output that prints in whole
rows. When the command runs, the caret moves to the next prompt line. Clip:
[caret-typing.mp4](clips/caret-typing.mp4). Demo: [demo/caret-typing.html](demo/caret-typing.html).

```js
import { typeTimes, typedCount, show } from '../../prompts/moves/demo/assets/stage.js';
const times = typeTimes('vawe ship launch', 700);              // 30 ms a character, 70 ms more after a space, seeded jitter
const lit = (ms, since) => ms - since < 500 || Math.floor((ms - since) / 500) % 2 === 0;   // solid after a key, then 1 Hz
vawe.onFrame((s) => {
  const ms = s * 1000;
  typed.textContent = 'vawe ship launch'.slice(0, typedCount(times, ms));
  const since = ms < 1900 ? times.filter((t) => t <= ms).pop() ?? 0 : 3300;   // 1900 ms: Enter, 3300 ms: the next prompt
  c1.style.visibility = ms < 1900 && lit(ms, since) ? 'visible' : 'hidden';
  c2.style.visibility = ms >= 3300 && lit(ms, since) ? 'visible' : 'hidden';
});
[[r1, 2100], [r2, 2420], [r3, 3200], [next, 3300]].forEach(([el, at]) => show(el, at));   // output rows print whole, never fade
```

```css
.blk { display: inline-block; width: 0.6em; height: 1.2em; background: var(--ink); }   /* a block caret is one character wide */
```

Sound: pluck at the first key and at Enter (default gain); never one per character.

The text is a function of the time, so the seek shows the same frame every run. A terminal does
not ease anything: the characters, the caret and the output rows appear in one frame each. Only the
window enters and leaves.

Common mistake: a thin bar caret that blinks from the start of the clip. A shell caret is a solid
block, and it stays lit while keys arrive.

Looks (ground, type, radius, accent) live in `demo/demo.css`; this snippet keeps neutral tokens.
