// harness/lib/judge-axes.mjs: the two axes a structured judge scores SEPARATELY. Studios review LOOK
// (light, colour, type, camera, composition) on styleframes before any MOTION work starts, then
// review motion on its own pass; this is that split, applied to JUDGE_CODES (harness/lib/judge-codes.mjs)
// so both halves of the pipeline share one closed set of criteria, never two.
import { JUDGE_CODES } from './judge-codes.mjs';
import { isMain } from './is-main.mjs';

// motion-smoothness/temporal-flicker are named VBench++ motion axes; blank-frame is a transition
// defect (a dropped frame at a cut), which is a motion-timeline fact even though the sheet shows it as
// a still. Every other code is a property of ONE frame: LOOK.
const MOTION_CODES = new Set(['motion-smoothness', 'temporal-flicker', 'blank-frame']);

export const axisOf = (code) => (MOTION_CODES.has(code) ? 'motion' : 'look');

const LABELS = {
  readability: 'text legible at size, sufficient contrast',
  hierarchy: 'one clear focal point, the eye knows where to land',
  composition: 'centered/aligned/on-thirds on purpose, nothing mis-anchored',
  'brand-fidelity': 'matches the house style: colours, face, signature details',
  'asset-fidelity': 'real captured assets, never a recreated-from-memory lookalike',
  'produced-not-generated': 'every element and every empty part is doing a job',
  value: 'this frame teaches/proves/delights something no other frame does',
  'aesthetic-quality': 'professionally graded (colour, light, depth), not flat',
  'edge-clip': 'no text or graphic cut off by the frame edge',
  'motion-smoothness': 'a moving element reads as one continuous move, never a teleport',
  'temporal-flicker': 'nothing static changes colour/brightness/position between frames',
  'blank-frame': 'no empty/black/white frame at a transition boundary',
};

// the closed criteria list a structured verdict must answer against, one entry per JUDGE_CODES entry.
export function structuredCriteria() {
  return JUDGE_CODES.map((code) => ({ code, axis: axisOf(code), label: LABELS[code] || code }));
}

if (isMain(import.meta.url) && process.argv.includes('--self-test')) {
  const missing = JUDGE_CODES.filter((c) => !LABELS[c]);
  if (missing.length) { console.error(`judge-axes: missing a label for ${missing.join(', ')}`); process.exit(1); }
  const criteria = structuredCriteria();
  if (criteria.length !== JUDGE_CODES.length) { console.error('judge-axes: criteria count must match JUDGE_CODES'); process.exit(1); }
  if (!criteria.some((c) => c.axis === 'look') || !criteria.some((c) => c.axis === 'motion')) {
    console.error('judge-axes: both axes must have at least one criterion'); process.exit(1);
  }
  console.log('  ✓ judge-axes self-test: every JUDGE_CODES entry has a label and an axis');
  process.exit(0);
}
