#!/usr/bin/env node
// node harness/dev/palette.mjs [--id seed-021 | --from <key>]: the verb behind `vawe palette`.
// Picks one OKLCH brand seed with the mood it evokes and prints how to compose the full palette around it.
// Derived from impeccable's palette picker (Apache-2.0, see NOTICE).
import { SEEDS, pickSeed, fmtOklch, hueWord } from '../lib/palette-seeds.mjs';
import { isMain } from '../lib/is-main.mjs';

export function guide(seed) {
  const [, , H] = seed.oklch;
  const moodHint = seed.mood ? ` (one read: "${seed.mood}")` : '';
  const strategyHint = seed.strategy ? `\n   - one example strategy: ${seed.strategy}` : '';
  return `BRAND SEED · ${seed.id}

Seed color (anchor for your primary brand color):
  ${fmtOklch(seed.oklch)} - ${hueWord(H)}${moodHint}

This is the brand's anchor: a single color. Compose the rest of the palette
around it with your judgment, the brief (brief.md, the film's DESIGN.md) and
the colour rules below.

How to use:

1. Read the brief. Write one specific phrase for the mood this film calls for.
   Be granular. Good: "1970s travel poster: sun-baked warmth, considered",
   "midnight jazz club: smoky brass, saxophone light", "Scandinavian winter
   morning: quiet light through frost". Bad: "modern and clean", "warm and
   inviting". The first lets you compose. The second gives a generic palette.

2. The seed's hue (${H.toFixed(0)} deg) anchors your primary brand color. You
   choose L and C to match the mood. The same hue can be deep and velvet,
   bright and confident, or pale and faded. Keep the primary's hue within
   10 deg of the seed.${strategyHint}

3. Compose the full palette in OKLCH (5 more roles):
     - bg      the most important architectural choice.
               The mood lives in the BRAND COLORS (primary and accent) and
               the type, not in the surface. Putting warmth in both the
               primary and the bg is the AI cliche.

               DEFAULT A, PURE white: exactly oklch(1.000 0.000 0).
                 Not 0.99, not chroma 0.002. Do not add hidden warmth.
               DEFAULT B, PURE black or near-black: L 0.04 to 0.12, chroma
                 exactly 0.000, no hue tint. Pick L for the mood.
               ALT, TINTED: chroma 0.015 to 0.05. Use it only when
                 (a) the mood is explicitly environmental: the surface IS
                     part of the brand (lacquered interior, leather
                     library, ceramic studio, hotel lobby), or
                 (b) the seed is desaturated (chroma under 0.10) and needs
                     a tinted surface to read as a brand.
                 "Feels warm", "modern and warm" or "moody" is not enough.
                 With no named environment, use pure white and let the
                 primary carry the warmth.

               HEURISTIC: seed chroma above 0.10 and a product-focused mood
               is almost always pure white. Across many palettes aim for
               about 50% pure white, 25% pure black, 25% tinted.
     - surface bg pulled slightly toward ink (10 to 15% mix), same hue
               family as bg. For cards, panels, sections.
     - ink     body text. At least 7:1 contrast against bg. In light mode it
               can carry the brand hue at low chroma.
     - accent  a SECOND brand color, distinct from the primary in both hue
               AND lightness. For badges, status pills, links, accent rules.
     - muted   secondary text. Ink pulled 40% toward bg, keeping ink's hue.
               At least 3.5:1 contrast against bg.

4. Pick a color STRATEGY:
     - Restrained: tinted neutrals, accent 10% or less (product default)
     - Committed: one saturated color carries 30 to 60% (identity-driven)
     - Full palette: 3 to 4 named roles each used on purpose (brand work)
     - Drenched: the surface IS the color (campaign, hero, statement)
   The brief picks the strategy. A startup dashboard is not a perfume brand.

Hard rules:

  - OKLCH only. Never #RRGGBB.
  - ink vs bg WCAG contrast at least 7.
  - primary chroma at most 0.23 (above it the primary glows and no text on
    it reads).
  - if primary L is above 0.78, primary chroma at most 0.18.
  - primary vs accent contrast at least 1.7: visually distinct, not two
    variants of one hue at similar lightness.
  - the accent must carry readable text on a filled badge: saturated
    (chroma 0.10 or more), or clearly light (L 0.85 or more), or clearly
    dark (L 0.30 or less). Never a muddy mid-tone (L 0.45 to 0.72 with
    chroma under 0.10).
  - avoid the AI attractor zones: warm-cream bg with a dusty brown primary,
    forest green on cream, purple on white, navy and cream with orange.

TEXT ON COLOR FILLS: pick by perceptual contrast, not only WCAG. This holds
for any text on a saturated fill: buttons, badges, status pills, tags,
filled callouts. On a saturated mid-luminance fill (L 0.42 to 0.78, chroma
0.08 or more) use WHITE text, or near-white from your bg, even when dark text
passes WCAG: saturated colors look brighter than their luminance says, and
dark text on them reads muddy. Dark text is right only on PALE fills (L above
0.85) or pure-neutral fills (chroma near 0).

Write the palette as CSS custom properties in OKLCH, then build with it.
The seed is the start, not the recipe.
`;
}

function parseFlags(argv) {
  const flags = { id: null, from: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--id') flags.id = argv[++i];
    else if (argv[i] === '--from') flags.from = argv[++i];
  }
  return flags;
}

if (isMain(import.meta.url)) {
  try {
    const flags = parseFlags(process.argv.slice(2));
    process.stdout.write(guide(pickSeed(SEEDS, { ...flags, from: flags.from ?? process.env.VAWE_PALETTE_SEED })));
  } catch (err) {
    console.error(`vawe palette: ${err.message}`);
    process.exit(2);
  }
}
