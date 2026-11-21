# Approval gate

**Use when** an agent must ask before it acts. A copy of the real Claude Code permission prompt: the agent says what it will do, names a command, the prompt replaces the input box in one frame, the selection marker steps to option 2, Enter runs the command, the input box returns and the work continues to the answer. Nothing in the terminal eases: no pop, no scale, no fade. Clip:
[approval-gate.mp4](clips/approval-gate.mp4) (6 s, light; `approval-gate-dark.mp4` is the dark theme). Demo: [demo/approval-gate.html](demo/approval-gate.html).

```js
import { arrive, show, runDot, leave } from '../../prompts/moves/demo/assets/stage.js';
// only the window arrives (clip framing); every terminal row prints on one frame
show(commandHead, 2350); runDot(commandDot, 2350, 3500);
// the prompt takes the input box's place in one frame: the box goes hidden, the prompt goes visible, at 2.45 s
show(perm, 2450, 3500);
// selection: the marker and the colour step to option 2 at 2.85 s (hard steps); Enter at 3.35 s
// the result and the next tool call print 0.15 s apart: show(result, 3500); show(nextHead, 3650)
```

Sound: none. The clip is silent.

The clip copies Claude Code's permission dialog: `Bash command`, the command, its description, `This command requires approval`, `Do you want to proceed?`, three numbered options with the `›` marker and the selected option in the product's permission blue (#4a5bd9 light, #b1b9f9 dark), the `Esc to cancel · Tab to amend` hint, inside a thin blue rounded box. An earlier turn is already in the session. The window, header line, ruled composer, typing and Enter are the terminal-run parts (`demo/assets/terminal.css`): 62 percent of the frame width, 88 percent of its height. The task, command and numbers are our own (clearing a build cache). The prompt holds 1.0 s with the marker moving from option 1 to option 2, as a person reads it. The 1.0 s final hold is still but for the blinking input caret, declared with the measured window. Nothing here overshoots because a terminal does not.
