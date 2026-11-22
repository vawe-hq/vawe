// core/color/index.js: hand-rolled, dependency-free colour operations for the engine and authoring
// tools. Pure functions, deterministic, no DOM, node-and-browser safe.
//
// engine.js owns the engine's ONE colour grammar (parseColor/colorAlpha/parseColorRGB) and its
// canonical WCAG contrast/lightness check (isLightBg/contrastRatio/ensureContrast). This package
// WRAPS it rather than re-implementing it (see parse.js, linear.js) and adds what engine.js does not
// need: a {r,g,b,a} object shape that throws on garbage, linear-light mixing, HSL, and hue-wheel
// harmonies.
//
// engine.js's own `contrastRatio` is NOT re-exported here: linear.js already has one, taking a
// different colour-like shape, and re-exporting both would silently drop one or the other from a
// wildcard export. A caller that wants the raw array/string form imports it from './engine.js'.
export { parse, format, asColor } from './parse.js';
export { srgbToLinear, linearToSrgb, relativeLuminance, contrastRatio, readableOn } from './linear.js';
export { mix, lighten, darken, withAlpha } from './mix.js';
export { toHsl, fromHsl } from './hsl.js';
export { complementary, analogous, triad } from './harmony.js';
export { parseColor, colorAlpha, parseColorRGB, isLightBg, ensureContrast } from './engine.js';

// ---------- self-check ----------
// `node core/color/index.js` runs this. No framework, no fixtures: asserts that fail loudly if the
// maths regresses.
if (process.argv[1] && import.meta.url === (await import('node:url')).pathToFileURL(process.argv[1]).href) {
  const { parse, format } = await import('./parse.js');
  const { contrastRatio, readableOn } = await import('./linear.js');
  const { mix } = await import('./mix.js');
  const { toHsl, fromHsl } = await import('./hsl.js');
  const { complementary, analogous, triad } = await import('./harmony.js');

  const assert = (cond, msg) => { if (!cond) throw new Error(`color self-check failed: ${msg}`); };

  // parse/format round-trip
  assert(format(parse('#ff8800')) === '#ff8800', 'hex round-trip');
  assert(format(parse('#f80')) === '#ff8800', 'short hex expands');
  const rgba = parse('rgba(255, 136, 0, 0.5)');
  assert(rgba.r === 255 && rgba.g === 136 && rgba.b === 0 && rgba.a === 0.5, 'rgba parse');
  let threw = false;
  try { parse('not a colour'); } catch { threw = true; }
  assert(threw, 'parse throws on garbage');

  // WCAG contrast
  assert(contrastRatio('#000000', '#ffffff') === 21, 'black/white contrast is 21');
  assert(readableOn('#ffffff') === '#000000', 'ink on white is black');
  assert(readableOn('#000000') === '#ffffff', 'ink on black is white');

  // linear-light mix: brighter than the naive sRGB midpoint (#808080)
  const mid = format(mix('#000000', '#ffffff', 0.5));
  assert(mid === '#bcbcbc', `white/black linear midpoint is #bcbcbc, got ${mid}`);

  // HSL round-trip
  const hsl = toHsl('#3366cc');
  const back = format(fromHsl(hsl));
  assert(back === '#3366cc', `hsl round-trip, got ${back}`);

  // harmonies
  assert(complementary('#ff0000')[0] === '#00ffff', `red complementary is cyan, got ${complementary('#ff0000')[0]}`);
  assert(analogous('#ff0000').length === 2, 'analogous returns 2');
  assert(triad('#ff0000').length === 2, 'triad returns 2');

  console.log('core/color: all self-checks passed');
}
