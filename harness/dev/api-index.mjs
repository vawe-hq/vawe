// Writes skills/vawe-page/API.md: the motion presets and lens options of a page, read from the code. Run with --write after a change to core/motion/presets.js or core/surfaces/lens.js.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { BANDS, EASE_HANDLES, bandSeconds, enterSpecs, leaveSpecs, cameraSpecs, focusSpecs, rampSpeeds, staggerTimes, layerTiming } from '../../core/motion/presets.js';
import { LOOKS, OFF, PALETTES, resolveOptions } from '../../core/surfaces/lens.js';

export const INDEX_PATH = fileURLToPath(new URL('../../skills/vawe-page/API.md', import.meta.url));

const json = (v) => JSON.stringify(v).replace(/"([a-zA-Z]+)":/g, '$1: ').replace(/,/g, ', ');
const handle = (h) => (typeof h === 'string' ? h : `${h.influence}%@${h.speed}`);
const keyframesOf = (specs) => specs[0].keyframes;

function motionLines() {
  const enter = enterSpecs();
  const [enterFrom, enterTo] = keyframesOf(enter);
  const leave = leaveSpecs();
  const [, leaveTo] = keyframesOf(leave);
  const camera = ['push', 'pull', 'drift'].map((kind) => {
    const [a, b] = keyframesOf(cameraSpecs({ kind }));
    return `${kind} ${a.scale} to ${b.scale}${b.translate ? ` slide ${b.translate}` : ''}`;
  });
  const focus = focusSpecs();
  const [focusFrom] = keyframesOf(focus);
  const ramps = ['scaleOut', 'scaleIn', 'x', 'y'].map((kind) => {
    const r = rampSpeeds({ kind });
    return `${kind} ${r.amount}/${r.inAmount}`;
  });
  const ramp = rampSpeeds();
  const layer = layerTiming();
  return [
    '## Motion: `import { ... } from "../../core/motion/presets.js"`',
    '',
    `- bands (s): ${Object.entries(BANDS).map(([name, [lo, hi]]) => `${name} ${lo}-${hi} (mid ${bandSeconds(name)})`).join(', ')}. Default band: gravity.`,
    `- ease names for \`ease:\`, \`EASE.<name>\` (CSS linear()) and \`easeFn(name)\`: ${Object.entries(EASE_HANDLES).map(([name, [out, into]]) => `${name} [${handle(out)}, ${handle(into)}]`).join(', ')}.`,
    `- enter(el, { at, band | duration, from, scale, blur, ease, anticipate, vary }): from ${JSON.stringify(enterFrom.translate)}, scale ${enterFrom.scale} to ${enterTo.scale}, ease land, ${enter[0].timing.duration} ms, the fade takes ${enter[1].timing.duration} ms; anticipate 0 to 0.2.`,
    `- leave(el, { at | end, entrance, to, blur, ease }): to ${JSON.stringify(leaveTo.translate)}, ease launch, ${leave[0].timing.duration} ms by default; 0.6 of the element's enter() when it has one.`,
    `- stagger(els, { at, gap, seed, nudgeEvery, ...enter opts }): the start times of 3 elements by default are ${staggerTimes(3).join(', ')}; gaps 30 to 80 ms, the run fits 0.5 s.`,
    `- layer(main, secondary, { at, overlap, band, secondary: { ... } }): the secondary starts at ${layer.at} s in the next slower band (${layer.band}).`,
    '- keys(el, prop, [[t, value, handle?], ...]): an After Effects key table; a handle shapes both sides of a key, or `{ in, out }`; none is linear.',
    `- camera(wrapper, { kind, at, band | duration, from, to, origin, strength, dir, travel, ease }): kind ${camera.join(', ')}, whipOut, whipIn (travel in % of the frame); ${cameraSpecs()[0].timing.duration} ms by default; one scale animation per wrapper at a time.`,
    '- parallax([[el, depth], ...], cameraOpts): camera() on each layer with `strength` = depth (1 is the camera, under 1 ground, over 1 front).',
    `- ramp(outEl, inEl, { at, kind, duration, amount, inAmount, blur, fade, dir, origin }): out/in travel by kind ${ramps.join(', ')} (scale units; x and y in % of the frame), ${+(ramp.dOut + ramp.dIn).toFixed(3)} s by default.`,
    `- focus(el, { at, blur, scale, opacity, ease, band | duration }): blur ${focusFrom.filter.slice(5, -1)}, scale ${focusFrom.scale}, opacity ${focusFrom.opacity}, ease settle, ${focus[0].timing.duration} ms.`,
    '- Each verb has a pure `<verb>Specs` twin that returns the keyframes and timing without an element. Product UI timings: `UI` in `core/motion/ui.js`.',
  ];
}

function lensLines() {
  const defaults = resolveOptions({}, {});
  const options = Object.entries(defaults).map(([key, value]) => `- \`${key}\`: ${json(value)}`);
  const looks = Object.entries(LOOKS).map(([name, own]) => `${name} (${Object.keys(own).join(', ') || 'no effect'})`);
  return [
    '## Lens: `import { lens, htmlSource, PALETTES, OFF } from "/core/surfaces/lens.js"`',
    '',
    '`const cam = lens(htmlSource(el, { scale: 2 }), options); vawe.onFrame((t) => cam.draw(t))`. An option is a number, an array or a function of t. `look: "<name>"` starts from a look and your options go over it. `OFF` flattens every effect. Detail: `prompts/moves/lens.md`.',
    '',
    `Looks (\`bin/vawe frame <page> --looks --at <s>\` shows each): ${looks.join('; ')}.`,
    '',
    `Palettes for \`palette: { stops: PALETTES.<name>, amount, keepColor }\`: ${Object.keys(PALETTES).join(', ')}.`,
    '',
    `Options and their defaults with no look (\`OFF\` zeroes ${Object.keys(OFF).join(', ')}):`,
    ...options,
  ];
}

export function indexText() {
  return [
    '# Page API index',
    '',
    'Generated by `node harness/dev/api-index.mjs --write` from `core/motion/presets.js` and `core/surfaces/lens.js`: do not edit. `tests/motion/api-index.test.mjs` fails when it is stale.',
    '',
    ...motionLines(),
    '',
    ...lensLines(),
    '',
  ].join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url) && process.argv.includes('--write')) fs.writeFileSync(INDEX_PATH, indexText());
