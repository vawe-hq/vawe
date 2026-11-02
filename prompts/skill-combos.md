---
when: "you are at phase 3 of a film and pick the ui-skills for the ladder rungs"
answers: "the named skill combos (PROVEN, PROVEN for one frame kind, REJECTED, UNTESTED), their rungs, the look, what to reject, and the films that used them"
group: reference
---
# Skill combos

A combo is a named set of ui-skills for the ladder rungs builder, type, colour and depth. The frame rung is always vawe's own rules (about 1 line and 2 or 3 things, a ground never flat, an eye path). Fetch each skill with `command npx -y ui-skills get <slug>`.

Rules:
- Start from a PROVEN combo. A combo proven for one frame kind (type frames or product-UI frames) is proven for that kind only.
- A film may swap one rung, and DESIGN.md gives the reason.
- DESIGN.md records `Combo: <name>` and then the usual `Skill <rung>: <slug>: what it decided` lines.
- An UNTESTED combo becomes PROVEN only after a still-frame test and the owner's approval. Record both in its entry here.
- A skill changes the surface (palette, type), not the composition. Reject its web-page patterns in every combo: nav, CTA button, pill, eyebrow, section padding, cluttered hero.

The combo test (2026-10-09): six arms built the same two Loomline frames (a type frame "Talk messy. Ship clean." and a product-UI summary card), judged blind by the owner. Pages: `films/combo-<arm>/` (untracked).

## Warm editorial (PROVEN: type frames and product-UI frames)

- Builder: `leonxlnx/minimalist-skill`. Type: `zeke/swiss-design` (type and grid only). Colour: `pbakaus/colorize`. Depth: `mengto/beautiful-shadows`.
- Look: warm bone ground with grain and one very soft warm light, 1 px hairlines, a light grotesque hero (Hanken Grotesk 300) with hierarchy by opacity, one terracotta accent, a layered neutral card shadow.
- Reject: minimalist-skill's ban on gradients (the ground rule wins: grain plus a soft light); its serif hero when the type rung says otherwise; swiss-design's mobile-first and breakpoints.
- Evidence: the only combo the owner picked for both frame kinds in the blind test.

## Soft light (PROVEN: product-UI frames)

- Builder: `leonxlnx/soft-skill`. Type: none needed, Geist from `assets/fonts/` (the brief lists the files). Colour: `pbakaus/colorize`. Depth: `mengto/progressive-blur`.
- Look: white ground with soft coloured light, floating glass parts with a double bezel, tinted diffused shadows, a ghost layer under a progressive blur veil.
- Reject: soft-skill's page layout and section spacing; colorize's multi-accent palettes; a blur veil over text that must be read.
- Evidence: `films/s9b-loomline`, `films/s9c-loomline` (owner: "we nailed the look"), `films/tidepool`; picked for the UI frame in the blind test, not for the type frame.
- Not enough alone: `films/design-systems` used colorize without the builder rung and the product UI became placeholder bars. Keep the builder rung.

## Sparse geometry (PROVEN: product-UI frames)

- Builder and colour: `calicastle/signal-geometry` (a 70 to 95% quiet field, matte grain, one tiny accent). Type: `zeke/swiss-design` (light weight, opacity hierarchy, tabular numbers). Depth: none.
- Look: grey paper with fibres, hairline boxes with no radius and no shadow, one cobalt accent.
- Reject: signal-geometry's image-generation parts and its "no text" default; swiss-design's mobile-first and breakpoints.
- Evidence: picked for the UI frame in the blind test, not for the type frame.

## Soft glass (PROVEN: type frames)

- Builder: `leonxlnx/soft-skill`. Type: `pbakaus/typeset`. Colour: `jakubkrehel/better-colors` (one OKLCH hue). Depth: `iart-ai/glassmorphism` plus `mengto/progressive-blur` (cap at about 3 blur layers).
- Look: a deep single-hue night ground, a frosted chip and card, grain, a short progressive blur at the foot.
- Reject: soft-skill's eyebrow pills, CTAs and entry animations; progressive-blur's `position: fixed` (use absolute inside the world).
- Evidence: picked for the type frame in the blind test, not for the UI frame.

## Real product (APPROVED by the owner, 2026-10-19: product-UI clips in `prompts/moves/`)

- Direction: copy the real product, as the everestchris reference clips do. A real screen (ChatGPT, the Vercel dashboard, a terminal) inside its own window, on a flat neutral ground measured from the references (#f3f3f0 light, #0c0c0c dark). No lights, grain, glass or ghost layer. The motion is the product's own behaviour (typing, send, stream, hover), with the reference timings in `prompts/moves/README.md` rule 3 and the move files.
- Motion (owner rule, 2026-10-19): a product copy follows the product's own motion; a terminal steps its text and never eases it, no overshoot where the real surface has none, creative motion on a real surface only when the user asks (`prompts/moves/README.md` Clip bar rule 4).
- Tokens: `html[data-look="product"]` and `.win` in `prompts/moves/demo/demo.css`; the product's colours and face live in its demo (Inter stands in for Sohne, Geist is the real Vercel face).
- Marks: simple accurate SVG only where the real UI shows them (the Vercel triangle); no knot or other logo that cannot be drawn accurately.
- Not for: type frames (those keep Warm editorial, flat, no decoration a real title card lacks) and brand stings.
- Evidence: owner decision after the clip pilot; clips `ai-stream-response` and `before-after-wipe`.

## Mature product (UNTESTED until the owner approves; the default look of a product copy)

- Builder: `ibelick/baseline-ui` (spacing, hierarchy, no gradient or glow, tabular numbers). Type: `jakubkrehel/better-typography` (unitless line height, weight 400 or more under 18 px, `tabular-nums` on changing values). Depth: `mengto/beautiful-shadows` (the `lg` recipe as the one window shadow, in u, its alpha x5 plus a 1 px ring in dark). Motion: `emilkowalski/animate` (gate first: animate only what the real surface animates, ease-out, 200 ms or less for feedback, `transform` and `opacity`, never `scale(0)`), filtered by the real-surface rule above.
- Look: flat neutral ground, one window shadow, the browser window 74 percent wide and the terminal 62 percent, the product's own colours and Chrome blue strip (#d3e3fd).
- Reject: glass, glow, blurred light blobs, gradients behind the window, decorative pills and eyebrows (the suggestion chips of a real screen stay); baseline-ui's "no animation unless asked" (the clip is the ask) and its Tailwind and React rules; emilkowalski's springs and pops on a surface that has none; better-typography's rem units (the demos size in u).
- Evidence: not tested. Applied to `terminal-run`, `approval-gate`, `ai-stream-response`, `model-picker`, `diff-card` and `before-after-wipe`.

## Rejected in the blind test

- Brutalist telemetry: `leonxlnx/brutalist-skill`, `jakubkrehel/better-typography`, `jakubkrehel/oklch-skill`, `mengto/container-lines`. Picked for neither frame.
- Apple material: `emilkowalski/emil-design-eng`, `emilkowalski/apple-design`, `jakubkrehel/better-colors`, `mengto/progressive-blur`. Picked for neither frame.

## Crisp product (UNTESTED)

- Builder: `emilkowalski/emil-design-eng`. Type: `jakubkrehel/better-typography`. Colour: `jakubkrehel/better-colors`. Depth: `mengto/beautiful-shadows`.
- Status: not tested as written; Apple material, which shares its builder and colour rungs, was rejected.

## Evidence

The S5 tournament ran 11 single-skill arms (bolder, swiss-design, soft-skill, emil-design-eng, minimalist-skill, overdrive, frontend-design, landing-page, taste-skill, design-first-ui-prompting, gpt-tasteskill). All looked decent and all were cluttered web heroes. This is why a combo plus the frame rung is the unit, not one skill.
