# House style: argus

> The persisted Design Read for argus. `bin/vawe-dev judge` reads this file as the scoring key for brand
> fidelity, so keep it short and declarative.

## Measured facts
- **Dominance:** light-first (bg `#ffffff`, luma 1.00)
- **Faces:** sans `Archivo` · serif `Archivo` · mono `JetBrains Mono`
- **Palette (use ONLY these):** bg `#ffffff` · text `#16181d` · accent `#4772f5` · up `#1a9e57` · down `#e5484d`
- **Motion:** easing `easeOutExpo` · settle 0.4 · stagger 0.04 · bounce 0.08

## Identity
- **References it borrows from:** Linear (clean technical restraint) + indie-playful (the pixel mascot, marker underline) + X-native.
- **What it refuses to be:** not corporate-SaaS gradient, not austere-minimal-without-personality. Clean but with a wink.
- **The extremes** (details WRONG for any other brand): the **8-bit pixel-eye mascot** (Argus, the many-eyed watchman) · a **hand-drawn cobalt underline** under a key word · the **X logo inline in the headline** as a black chip.

## Type
- **Headline:** `Archivo` **300** (light!), tracking -0.035em. A light, tightly-tracked display. Confident but airy, never bold-shouty.
- **Rule:** one big light-weight statement + a tiny `JetBrains Mono` label. Numbers/metrics in JetBrains Mono.

## Colour
- **Accent usage:** cobalt `#4772f5` is the ONLY colour on an otherwise black-on-white page. The mascot, the CTA, the underline, the "start" link. Use it for exactly the payoff element per beat, nothing decorative.
- **Dominance:** light / white-first. Pure white fields, near-black ink.

## Shape & surface
- Pill buttons/chips (radius 999px). Soft, rounded, friendly. Cards are white with a hairline; minimal shadow.

## Motion
- Clean with a wink: a small bounce (0.08) on the mascot/payoff, snappy elsewhere. Not austere, not cartoon.

## Signature details (what this brand does that nothing else does)
- The pixel-eye mascot (blinks, watches). · The hand-drawn cobalt underline. · X-native surfaces (tweets, replies, analytics). · lowercase everything.

## Background
- White with a **very subtle dot-grid** (the site has it). Use `dotmatrix`/`paperDots` at low opacity on ONE beat (the hook), plain elsewhere. Never a loud pattern.

## NEVER
- Gradients as decoration · a second colour (cobalt is the only accent) · bold-heavy headlines (the brand is light-weight) · Title Case (lowercase) · em-dashes on screen · stock imagery.

## Assets
- pixel-eye mascot + `sections/` under `assets/brands/argus/`
