# Caret door

**Use when** a typed command is done and the next screen should open out of the caret. The clip copies a
shell: the command runs, the output prints, and the block caret waits on the next prompt. Then the caret
grows tall and becomes the hinge of a door. The door turns open under perspective and shows the next
screen (a video player with its controls and the three formats). There is no cut and no crossfade.
Clip: [caret-door.mp4](clips/caret-door.mp4). Demo: [demo/caret-door.html](demo/caret-door.html).

```js
import { easeFn } from '../../core/motion/presets.js';
const land = easeFn('land'), settle = easeFn('settle'), launch = easeFn('launch');
const T_GROW = 3.0, D_GROW = 0.5, T_OPEN = 3.5, D_OPEN = 0.9, RETRACT = 0.3, PERSPECTIVE = 1.7 * W;
vawe.onFrame((t) => {
  const r = nextPrompt.getBoundingClientRect(), cx = r.right + 1.2 * u, cy = (r.top + r.bottom) / 2;   // the caret sits at the end of the prompt
  const g = land(clamp((t - T_GROW) / D_GROW)), dip = Math.sin(Math.PI * clamp((t - T_GROW + 0.12) / 0.12)) * 0.08;   // gather 8 percent, then rise
  const h = (4.8 * u * (1 - dip) + (1.04 * H - 4.8 * u) * g) * (1 - launch(clamp((t - T_OPEN) / RETRACT)));
  const cw = 2.4 * u - 1.2 * u * g;                                  // the block narrows to a bar as it grows
  Object.assign(caret.style, { left: `${cx - cw / 2}px`, width: `${cw}px`, height: `${h}px`, top: `${cy - h / 2 + (H / 2 - cy) * g}px` });
  door.style.left = `${cx - W}px`; door.style.width = `${2 * W}px`;   // two frames wide, centred on the caret
  face.style.left = `${W - cx}px`;                                     // the screen on the door lines up with the frame when it lands
  door.style.visibility = t >= T_OPEN ? 'visible' : 'hidden';
  door.style.transform = `perspective(${PERSPECTIVE}px) rotateY(${90 * (1 - settle(clamp((t - T_OPEN) / D_OPEN)))}deg)`;
  win.style.display = t > T_OPEN + D_OPEN + 0.05 ? 'none' : 'flex';   // the door covers the shell: remove it, so the exit shows empty ground
});
```

Sound: none; a key tick per typed character is the film's, and the door adds no cue of its own.

- The shell types and prints in whole steps, as a terminal does. The caret is a solid block while keys
  arrive and blinks every 0.28 s on the last prompt.
- Order, bottom to top: the shell, the door, the caret. The door starts edge-on under the caret, so its
  first visible frame is a sliver beside a bar of the same height. The caret then draws back to nothing
  on `EASE.launch` in 0.3 s, as the axis the door turns on.
- The door turns on `EASE.settle` in 0.9 s. A fast-start ease makes the leaf jump to half open in two
  frames, because the width of a leaf that turns from edge-on goes with the sine of the angle.
- Perspective is 1.7 frame widths. Less makes the far side collapse to a point. More flattens the swing.
- The door is 1.4 frames tall, so its far edge still covers the top and bottom while the angle is small.
- The player progress and its time run from the landing, so the page is alive in the hold.

Common mistake: a door narrower than two frames leaves a strip of the shell at one side when it lands.
Hinging at the left edge of the door puts the caret on the edge, not in the middle of the opening.

Looks (ground, type, radius, accent) live in `demo/demo.css`; this snippet keeps neutral tokens.
