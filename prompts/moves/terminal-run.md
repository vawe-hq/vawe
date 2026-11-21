# Terminal run

**Use when** a coding agent does a task in a terminal. A copy of a real Claude Code session in a macOS terminal window: an earlier turn is already in the log, the task is typed in the ruled composer, Enter reprints it in place, a status line counts seconds and tokens, then tool calls print one by one (Read, Update with a red and green diff, Bash with a result that swaps from Running to Tests passed) and the answer prints. A terminal never eases its text: every character, row and swap lands in whole steps on one frame. Only the window's entrance and exit are clip framing. Clip:
[terminal-run.mp4](clips/terminal-run.mp4) (6 s, light; `terminal-run-dark.mp4` is the dark theme). Demo: [demo/terminal-run.html](demo/terminal-run.html).

```js
import { arrive, show, runDot, typeTimes, typedCount, leave } from '../../prompts/moves/demo/assets/stage.js';
// the window fades in 0.22 s (clip framing); the session inside is already running
arrive(win, 100, { ms: 220, from: '0.8vh' });
// the task types at 22 chars/s from 0.6 s; text shown = task.slice(0, typedCount(times, ms))
const times = typeTimes(task, 600);
// Enter at 2.1 s: the prompt line is reprinted in place on one frame, no flight, no scale
show(youLine, 2100);
// status line: seconds and tokens are a pure function of t (0.63 tokens a ms, shown in steps of 40); the spinner turns in 30 degree steps every 120 ms
// a tool call: its head on one frame, its dot blinks grey until the result, which prints on one frame (hard steps, no fade, no rise)
const step = (sel, at, runMs = 150) => { show(head, at); runDot(dot, at, at + runMs); show(result, at + runMs); };
// the diff rows print one per frame pair: 34 ms apart from 3.2 s
rows.forEach((row, i) => show(row, 3200 + i * 34));
show(running, null, 4400); show(passed, 4400);   // Running... to Tests passed in place
```

Sound: none. The clip is silent.

The clip copies current Claude Code: a plain header line (`Claude Code`, the working folder), an earlier prompt and answer, the shaded echo of the prompt, `● Read(path)` with its `⎿` result, `● Update(path)` with the diff (removed row red, added row green, the changed words darker, the reference's saturated pair), `● Bash(command)`, the orange status line `Cogitating… (2s · ↓ 1.5k tokens)`, the composer ruled above and below, the `accept edits on` footer. The window takes the reference's crop: 62 percent of the frame width and 88 percent of its height (a 640 x 515 pt terminal shown at 1.85x), a 2.2 percent mono face, the terminal's own colour in the title bar under a hairline, and one layered neutral shadow (`mengto/beautiful-shadows`). Geist Mono stands in for the user's face. The task, files, diff and numbers are our own (an invoice tax fix); only the product's strings (`Read`, `Update`, `Bash`, `Cogitating…`) are the product's. Layout is reserved, so every line is in place and shown by `visibility`: nothing reflows. Terminal findings: the final hold of 1.0 s is still but for the blinking input caret, declared with the measured window. Shared look: `demo/assets/terminal.css` (also used by approval-gate); the window frame is `.win.term`. The owner rule behind it (2026-10-19): a terminal's motion is respected by default; creative motion only when the user asks.
