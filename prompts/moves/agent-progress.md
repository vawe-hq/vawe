# Agent progress

**Use when** the feature is an AI agent doing several steps for the viewer, and the proof is visible
work. The clip copies an agent session in a terminal window: a todo list of four items, a status
line with a spinner, a verb, the elapsed time and a token count, and a tool call below the list. The
items close one by one, 0.8 s apart. The last item stays open, so the work reads as ongoing. Clip:
[agent-progress.mp4](clips/agent-progress.mp4). Demo: [demo/agent-progress.html](demo/agent-progress.html).

```js
import { show, runDot } from '../../prompts/moves/demo/assets/stage.js';
const DONE = [1700, 2500, 3300], STARTS = [700, ...DONE];   // ms: item n is active from STARTS[n]
show(todo, 700);                                             // the list prints in one frame
rows.forEach((row, n) => {
  const [open, active, done] = row.querySelectorAll('.slot > span');   // three states stacked in one grid cell
  show(open, null, STARTS[n]);
  show(active, STARTS[n], DONE[n]);                          // the active item is bold
  if (DONE[n]) show(done, DONE[n]);                          // a closed item is struck and grey
});
verbs.forEach((v, n) => show(v, n ? STARTS[n] : null, STARTS[n + 1]));   // the status verb swaps whole
runDot(bashDot, 3500, 6000);                                 // the tool call dot blinks while it runs
vawe.onFrame((s) => {                                        // the spinner turns in 30 degree steps, 120 ms each
  spin.style.rotate = `${Math.floor((s * 1000 - 700) / 120) * 30}deg`;
});
```

Sound: pluck at 1.7 s when the first item closes (default gain); no tick per item.

A terminal prints text, it does not ease it, so every state is one frame: the item flips from open to
bold to struck, the verb changes, the star steps. Start each close after the item became active, with
uneven spacing if the real task has it. Keep the last item open: a full list stops the eye.

Common mistake: a card with rings, ticks and a progress bar. An agent session has none of them. Copy
the plain list and the status line.

Looks (ground, type, radius, accent) live in `demo/demo.css`; this snippet keeps neutral tokens.
