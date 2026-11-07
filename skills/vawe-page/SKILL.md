---
name: vawe-page
description: "Write an HTML page that renders to an mp4 video, programmatic video and motion graphics as code with CSS, SVG, canvas or three.js. Author a vawe page film: one films/<name>/page.html the renderer seeks frame by frame. Load before writing or editing any page.html: audio tags, the spring helpers, and the page-code mistakes a first draft makes. The page contract itself is in AGENTS.md."
effort: medium
license: Apache-2.0
---

# vawe-page: write the page

Run this skill inside a vawe checkout: `AGENTS.md`, `taste/` and `bin/vawe` live there. With no checkout, get one: `git clone https://github.com/vawe-hq/vawe.git && cd vawe && npm install && bin/vawe-dev doctor`.

A film is one HTML page; the renderer seeks it, screenshots every frame and mixes the audio offline.
The contract is in `AGENTS.md`, its details under "Contract details" below. Start with `bin/vawe new <name>`;
this skill holds the code a first draft gets wrong. Taste pitfalls: `taste/build/DIGEST.md`. The order of the stages and the doc for each is the loop table in `AGENTS.md`; each verb's `next:` line names the next one.

## Design system and kit (stage 3)

Write `films/<name>/DESIGN.md` and `films/<name>/kit/`: ground layers, and each moving part (word, mark, bar, card, icon,
wordmark) as its own element. Start from a PROVEN combo in `prompts/skill-combos.md` (record `Combo: <name>`; swap at most one rung, with a reason). The skill ladder, one skill per rung in order (`command npx -y ui-skills get <slug>`):
builder (`leonxlnx/soft-skill` or `emilkowalski/emil-design-eng`: the product UI and kit parts as a real, beautiful interface),
type (`jakubkrehel/better-typography` or `pbakaus/typeset`), colour (`pbakaus/colorize` or `jakubkrehel/better-colors`),
depth (`mengto/beautiful-shadows` or `mengto/progressive-blur`), then frame: compose the video frame with vawe's own rules
(about 1 line and 2 or 3 things, ground never flat, an eye path). The frame rejects web-page patterns (nav, CTA button, pill,
eyebrow, section padding), never by skipping the builder rung. Write one DESIGN.md line per rung: `Skill <rung>: <slug>: what it
decided`, or `Skipped <rung>: <reason>`, a reason that cites a reference frame path or a SPEC.md line (`bin/vawe` advises on a missing rung). Product UI inside the film is a designed
interface with real-looking data, never placeholder bars. For an invented product the UI is invented but designed.
An owner decision that differs from a house default goes under `## Declared` in DESIGN.md, one `- key: value` line each: `font`, `type-scale` (percent cap height of read text), `ui-scale` (percent for UI that is the subject, put in a `data-ui` element), `camera` (`still` or `free`). The acceptance rows and the judge follow the line and print it (`harness/lib/design-decls.mjs`).
DESIGN.md also names colour roles (ground, text, muted, one scarce accent, positive, negative), type roles (mono for every numeral; the measured brand weights) and a negative list (no nav or footer chrome, no second accent, no `back`, `bounce` or `elastic` easing unless the brand is a toy brand).
Kit format: `kit/kit.css` holds `:root` tokens (palette roles, light positions) and one rule per part (`.ground-*`,
light devices, `.grain`, `.lockup`, `.word`, `.line`), each moving part its own element; `kit/kit.html` is an optional
sheet that shows every part once. Example: `films/examples/colour-sting/DESIGN.md` and `kit/`.

## Board and motion (stages 4 to 7)

Each `data-world` is a static state from the kit first (`bin/vawe frame <page> --world all`): about 1 line and 2 or 3 things, a ground that is never flat (a light, grain or depth device named from a reference frame, changed at each world turn).
The Board is a plan for time, not frames: rhythm (cuts not all equal: one under 0.4 s, one over 0.9 s), the spectacle second (also `<meta name="spectacle">`; recipe 15 in `prompts/moves/RECIPES.md`), a named move per cut (overlap, camera, what carries the eye, which arrivals overshoot: `EASE.nudge` for ordinary ones, `EASE.pop` for the hero), a handoff per cut (`vawe-transitions`), and sound (below). Ideas first: `guides/IDEATE.md`.
The camera holds still by default and moves only with a reason (the spectacle, a reveal): a hold stays alive through an element motion (typing, a counter, a glint), not a camera drift. The motion is done when overshoot-share, live-hold, constant-camera and seam-variety are clean or waived with a reason, every cut is Read (`bin/vawe frame <page> --cuts`; on the spectacle second `--moment <s> --onion` and `--velocity`) against `taste/craft/motion-craft.md` and `core/motion/README.md`, and each cut has a "Motion pass" row.
A film that uses the lens (`core/surfaces/lens.js`, `prompts/moves/lens.md`) picks its look by sight: `bin/vawe frame <page> --looks --at <s>` shows the page under every look, then set `look: '<name>'` in the lens options.

```html
<meta name="message" content="zero fees">    <!-- the one thing to remember -->
<meta name="spectacle" content="6.2">        <!-- the second of the one big moment; quiet before it -->
<audio src="assets/click.wav" data-at="0.4"></audio>   <!-- a recorded effect; a loop src only if the user gives a track -->
<audio data-synth="pluck" data-at="0.85"></audio>   <!-- a quiet tick on one key word, default gain -->
<audio data-synth="swell" data-at="1.66"></audio>   <!-- the one soft swell, ends on the cut -->
<audio src="assets/vo.wav" data-role="vo" data-at="1.0"></audio>
```

`data-trim` and `data-trim-end` cut a clip to the part you want, so there is no need for ffmpeg. `bin/vawe sound <track> --cuts <page>` gives the beat grid, the hits and each cut's frame offset for a track the user gave.

## Sound is felt, not noticed

A recorded effect first, otherwise no cue; a synth tick or one swell only when you choose it, never a bed (`taste/craft/sound.md`). `data-gain` is absolute dB and replaces the voice default (`DEFAULT_GAIN_DB` in `core/audio/kit.mjs`; a `src` file defaults to 0 dB): write it only to move one cue on purpose. Cue the first and the last key word, not every word. Name each beat once in CSS (`--beat-2: 1.85s`) and read it from every delay in that beat, so one edit moves the beat. What you write is what you hear: no normalising, and `<meta name="loudness" content="-14">` opts in to a delivery target. The mix warns when one cue peaks more than 6 dB above the median, and `bin/vawe check review <page> --final` warns outside -30 to -12 LUFS.

## Moves to copy

`prompts/moves/README.md`: the proven moves, grouped by job (reveal a title, change between shots,
point the eye, product moments), each a CSS and WAAPI snippet with a 1 s clip. Copy one; do not
approximate it by eye.

## Springs and tables

Start every entrance, exit and group from `core/motion/presets.js` (`enter`, `leave`, `stagger`,
`layer`, `BANDS`): they land on real curves, exit shorter than the entrance (rule exits-shorter) and stagger 30 to 80 ms,
and the `bin/vawe dev` motion lint names each move that breaks those rules.

```js
import { spring, track, approach, kf, springLinear, springDuration, SPRINGS, rng } from '../../core/motion/springs.js';
el.animate([...], { duration: springDuration(k, d) * 1000, easing: springLinear(k, d), fill: 'both' });
const x = track(t, [[0, 100], [1.2, 640]], 170, 26);   // a spring per target change
const zoom = approach(t * 30, 1, 1.35, 0.15);          // 15 percent of the gap per frame
const rot = kf(t * 30, [[0, 0], [24, 90], [60, 90]], 'easeInOutCubic');
```

Never approximate a curve with `cubic-bezier()`: a hand-fitted bezier starts too hard and stops too
early, and the motion reads jerky. Use the After Effects eases in `EASE` (`core/motion/presets.js`):
`land` to arrive, `landSoft` for a move under 0.4 s, `launch` or `leave` to exit, `glide` for a drift,
`settle`, `swap`, `carry`, `pop`. The ease and the time for each job (a title, a panel, an exit, a
camera move) are in the table in `taste/craft/motion-craft.md`. Each is an exact CSS `linear()` easing,
and plain CSS reads it as `var(--ease-land)`, `var(--ease-launch)` (the renderer sets them on `:root`);
in `window.seek` or `vawe.onFrame` code use `easeFn(name)`, a function of 0..1. Multi-key motion: `keys()`.
Under `vawe.layoutSeek` (the measure and layout probes) skip only canvas painting in `window.seek` and `vawe.onFrame`; still set every element's position, size and text, since the probes read the DOM.

```js
import { EASE } from '../../core/motion/presets.js';
el.animate([{ translate: '0 40px' }, { translate: '0 0' }], { duration: 700, easing: EASE.land, fill: 'both', delay: 1200 });
document.documentElement.style.setProperty('--ease-land', EASE.land); // CSS: animation-timing-function: var(--ease-land)
```

`SPRINGS.snappy` for leading edges, `heavy` for big type and logos, `playful` only when the brief
asks for overshoot. Full reference: `core/motion/README.md`.

## Before the first draft

1. Pick the film type in `guides/ROUTING.md`; `bin/vawe new <name> --from prompts/<t>.md`. Write the beat table (`prompts/beat-sheet.md`): time, message, the one thing that moves, the cue.
2. Check frames with `bin/vawe frame <page> --vs <ref.mp4> --at s,s,s` (about 4 s for 4 frames). Never render a whole range to look at a few frames. `bin/vawe dev <page> --from s --to s` is for motion. A recreation is done when `bin/vawe check coverage <film.mp4> --ref <ref.mp4>` exits 0.

## Contract details

- `<meta name="duration" content="auto">` is the last animation's end plus a hold (1.2 s or the last world's read time). `bin/vawe dev <page> --lock-length` writes the number in. A page script reads `window.vawe.duration`: 0 while the length is measured, the found length in the render (so an animation sized to it does not set the end), the stated number only in a plain browser.
- `--aspect W:H` on a render verb (any whole ratio; `frame` also takes `--size WxH`) replaces the aspect meta and joins the output name.
- One page, several looks: `bin/vawe dev|frame|ship <page> --param look=riso` (repeatable) loads `page.html?look=riso`; read it with `new URLSearchParams(location.search)`. It joins the render key and the default output name (`-look-riso`).
- `data-synth="bed"` is refused (`taste/craft/sound.md`).
- `<meta name="fps">` is optional: your frame-table rate. The render rate is separate (60 final, 30 draft) and frames are fractional.
- `--vw`/`--vh` (px lengths), `<html data-aspect>` and `window.vawe` are set before your scripts run.
- Text checks skip `aria-hidden="true"` and `data-chrome` text only when it is texture by measure: cap height under 2% of the frame, the same words 3 or more times, or `data-texture="why"` (12 characters or more). Any other hidden text is checked as copy. A `data-chrome` texture keeps the 2.5% cap floor and no read hold (`taste/rules/readable-text-size.md`).

## Video clips

A person's clip is `<video src="footage/<slug>.mp4" data-at="2" data-trim="5.2" data-trim-end="8.4" data-rate="1" data-gain="-6" data-fade-in="0.2" data-fade-out="0.3" muted data-role="vo"></video>` inside its `data-world` beat.
- Film time t shows source second s = trim + (t - at) * rate, clamped to [trim, trim-end]: before `data-at` the first frame, after the end the last. The engine seeks it every frame.
- Its sound joins the mix unless `muted`; `data-role="vo"` ducks music. Names copy `<audio>`.
- The footage verbs (`footage add` writes the proxies in `films/<film>/footage/`, `footage log` writes `footage.md`: length, shots, loudness, contact sheet, transcript with word times). Read it before the cut list. `bin/vawe new <name> --footage <folder>` runs both and starts the page.
- Mistakes: playing the video live (`play()`, `autoplay`, a timer); seeking `currentTime` yourself; hiding a clip by removing it from the DOM (hide its world or set opacity).

## Waivers

A rule broken for cause is declared in the page with its reason, nowhere else. Checks advise; only determinism, banned items
and a reason that does not count refuse. One code per check, scoped to the seconds: `static-window@a-b`, `tile-run@a-b`,
`tail-tiles@a-b`, `world-held@a-b` (the old `dead-air` waives nothing). A reason names where (a world id of the page or a second)
and what was measured (a number with its unit). "intentional", "by design", "deliberate", "stylistic", "fine", "ok" and "as intended"
do not count, and nor does one reason copied to 3 or more waivers. The draft lists every refused waiver; the judge sees every waiver.
`<script type="application/json" id="authoring">{"allow": ["world-held@3.5-6.2"], "_why": {"world-held@3.5-6.2": "world s4, 2.7 s: the wordmark is the last beat and a caret ticks on it"}}</script>`

## Page-code mistakes a first draft makes

`bin/vawe check anim-traps <page>` names, with the fix: a live clock (`Date.now()`, `requestAnimationFrame`), unseeded `Math.random()` (use `rng(seed)`), `var()` in the `animation` shorthand, a missing end keyframe, `* 0.11px` on `--vw`/`--vh`, a module-level `await` the renderer does not wait for, an absolute path in a film, and an auto length that cannot be measured. It cannot see these:

1. State carried between frames (`x += dx`). Frame 400 must not need frame 399.
2. A network font. Bundle the face in `films/<name>/assets/` and `@font-face` it; the renderer waits for `document.fonts.ready`, not for the network.
3. Opacity or filter on a `preserve-3d` element flattens it. Fade the wrapper.
4. A layout in fixed pixels for 16:9. Use `--vw`/`--vh`, container units and `[data-aspect]` selectors, then draft `--aspect 9:16` once before the final.
5. `fill: both` (or `backwards`) on an animation with a delay shows its first keyframe from frame 0; use `forwards` unless it should sit there before it starts.
6. A capture scaled below 0.6 loses its type: crop instead.

## Where to look

| need | doc |
|---|---|
| ideas for a beat or a cut | `guides/IDEATE.md` |
| transitions: the twelve handoff families | `taste/craft/transitions.md`, `skills/vawe-transitions/SKILL.md` |
| moves to copy, with clips | `prompts/moves/README.md` (`prompts/moves/RECIPES.md` chains them) |
| a new video component (clip) | `prompts/moves/README.md` Clip bar, the stage helpers in `prompts/moves/demo/assets/stage.js`, the UI presets in `core/motion/ui.js` (README Product UI presets) |
| lens: depth of field, bloom, LED grid | `prompts/moves/lens.md` |
| sound effects and where to get them | `taste/craft/sound.md`, `resources/README.md` |
| skill combos for DESIGN.md | `prompts/skill-combos.md` |
| springs, eases, motion principles | `core/motion/README.md`, `taste/craft/motion-craft.md` |
| edit a person's clips | `guides/ROUTING.md` (edit), Video clips above |

The final render (`bin/vawe ship`, then `bin/vawe wait`) needs a fresh review and the person's OK: show the draft in plain words (map: `harness/lib/plain-words.mjs`). Fix the verdict worst first on drafts until PASS; read the judge once and never tune to it.
