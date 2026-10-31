---
when: "one element must become 8 to 12 UI states on a beat grid and loop seamlessly"
answers: "the morph brief: sum-of-springs in seek(t), a cursor that drives every change, the loop test"
group: reference
---

# UI morph: one shape, a seamless loop

Brief shape: `bin/vawe new` writes Task, Look, Spec and Acceptance sections with numbers into brief.md; fill them as `prompts/ANATOMY.md` says.

**Use when** the film is one element that becomes eight to twelve UI states and returns to the
first, on a beat grid, with a cursor driving every change. The most bookmarked prompt in the
motion-from-code ecosystem (19,303 bookmarks at the time of the snapshot) has this shape.

**Length:** 12 to 16 seconds. 7 bars at 120 BPM is 14 seconds.

## The template

```
<inputs>
Ask me for: 8 to 12 UI states the shape becomes, black-and-white or one accent, a song at about 120
BPM or "no music", the canvas, and the UI sans. If I skip one, take the default from the Questions
section and go on.
</inputs>

<direction>
Dribbble-level UI motion. One shape, never cut: every state is the same element morphing its size,
radius and colour while its content swaps with a short blur. A cursor drives every change with real
clicks and drags. Light warm-grey field, black and white components, one clean UI sans (Archivo for
vawe). Springs everywhere, a tiny overshoot at most. The camera zooms so each state fills the frame.
The page at t=duration equals the page at t=0, cursor position and velocity included.
Banned: bouncy easing, particle bursts, glows, gradients on UI chrome, mismatched icon strokes, dead
time, anything that looks like a template.
</direction>

<structure>
120 BPM, 7 bars. Something happens on every beat. Write the state list on the beat grid: state,
beat, what the cursor does, what the sound is. Show me that grid before code.
</structure>

<build>
1. One page: films/<name>/page.html, square (the renderer sets --vw/--vh and data-aspect="1:1").
   Every style is computed from time inside window.seek(t). No CSS transitions, no timers, no state
   carried between frames.
2. Springs are closed-form step responses. A value that changes target many times is the SUM of one
   spring per change, so it stays a pure function of time. Use spring(t, k, d) and
   track(t, keys, k, d) from core/motion/springs.js.
3. The tab indicator's two edges ride different springs so the leading edge stretches ahead of the
   trailing one. Same for the toggle knob.
4. Drags are direct manipulation: while the cursor is held, the value comes from its position; on
   release it springs back from wherever it was.
5. Sounds: a soft tick (<audio data-synth="pluck" data-at="<beat>" data-gain="-8">) for a click,
   "droplet" (-8 dB) for a toggle, nothing on most states. Place each by its measured peak, not its
   file start. Name each beat once in CSS (--beat-4: 3.6s) and read it from every delay in that beat.
6. Render one frame per beat before the full render: bin/vawe dev <page>. Fix anything off the
   grid, cramped or hard to read.
</build>

<gotchas>
Never put will-change on anything the camera scales or the text renders blurry. Text that swaps
inside a morphing container needs its own enter and exit timing or it overlaps. Make the page at
t=duration equal the page at t=0 or the loop stutters. The last rendered frame sits one frame step before
that, so it must not equal the first: that is a doubled frame.
</gotchas>

<start>
Ask me for the inputs, then show me the state list on the beat grid before you write any code.
</start>
```

## Questions

Ask in this order; the first changes the film most. A skipped question takes its default; never wait.

1. **States**: which 8 to 12 UI states does the shape become, in order? Default: button, loader, check, island, player, slider, toggle, tabs, chart, command palette, toast. Why: the film is only as good as the states; each one is one bar.
2. **Accent**: black and white only, or one accent (hex)? Default: black and white on warm grey `#efece6`, no accent. Why: one accent per frame is the house rule; a second colour is a second focal point.
3. **Music**: a song at about 120 BPM with its licence, or no music? Default: no music, on a 120 BPM grid, a recorded effect where one fits. Why: the grid is the structure; a real song moves the drop.
4. **Canvas and length**: 1:1, 16:9 or 9:16, and how many seconds? Default: 1:1, 14 s. Why: a morph reads best square, and the camera zoom fills the frame per state.
5. **Type**: which UI sans? Default: Archivo (vawe's own). Why: one clean sans with tight tracking; a face with no brand reason is a banned default.

## Gotchas

- The renderer applies motion blur from subframes on its own; do not fake it with CSS blur.
- A morph between two states with different content is two problems: a shape tween and a content
  swap. Give the swap its own 120 ms and blur it; the shape carries the eye.
- Loop test: `bin/vawe critique` reports the loop seam. A last frame equal to the first is a doubled frame and stalls the loop one frame.
- The camera zoom is a transform on one wrapper. Zoom the wrapper, never the element, or its springs
  fight the camera.

source: pattern from twoclipping's "One shape, a seamless UI morph loop",
https://x.com/twoclipping/status/2103273003555402193 (via
https://github.com/guanmo-ai/awesome-ai-motion, case 2103273003555402193). The creator's text is
third-party and not under the list's MIT licence; this file is our own template in the same
inputs/direction/structure/build/gotchas/start shape, retargeted to the vawe page contract.
