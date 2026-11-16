// The taste rule lines for a stage or a topic. Lines come from taste/build/steps.json through harness/lib/taste-steps.mjs, the
// same source the hooks print; taste steers here, it never refuses.
import { TASTE_STEPS } from '../lib/taste-steps.mjs';

// The stages the Claude Code hook prints a taste step at.
const HOOK_STEPS = { states: 'frames', board: 'storyboard', motion: 'motion' };

const STAGE_STEPS = {
  brief: 'explore', study: 'explore', moves: 'explore', design: 'explore',
  skills: 'frames', states: 'frames',
  ideas: 'storyboard', board: 'storyboard', plan: 'storyboard',
  draft: 'motion', motion: 'motion', critique: 'check', judge: 'check', approve: 'check', ship: 'check',
};

const TOPICS = {
  type: { doc: 'taste/craft/typography.md', match: /type|font|text|cap height|word|line|glyph/ },
  colour: { doc: 'taste/craft/color.md', match: /colou?r|accent|palette|gradient|ground|hue|contrast/ },
  motion: { doc: 'taste/craft/motion-craft.md', match: /ease|enter|exit|move|motion|spring|stagger|overshoot|speed|hold|physics/ },
  cuts: { doc: 'taste/craft/transitions.md', match: /cut|seam|crossfade|world|eye|handoff|wipe/ },
  sound: { doc: 'taste/craft/sound.md', match: /sound|cue|voice|loud|peak|audio/ },
  layout: { doc: 'taste/craft/layout.md', match: /layout|frame|focal|space|align/ },
};

/** The step the hook prints a taste card for at `stage`, or undefined. */
export const stepOf = (stage) => HOOK_STEPS[stage];

const lineOf = (l) => `${l.text} (rule ${l.rule})`;

/** Topics `tasteFor` knows. */
export const TASTE_TOPICS = Object.keys(TOPICS);

/**
 * The short rule lines for a stage, narrowed to a topic when one is given: `<text> (rule <id>)`. A topic also adds the craft doc to
 * read, as `read <path>`. An unknown stage gives no stage lines; an unknown topic throws, naming the valid ones.
 */
export function tasteFor(stage, topic = null) {
  const own = TASTE_STEPS[STAGE_STEPS[stage]]?.lines ?? [];
  if (topic == null) return own.map(lineOf);
  const t = TOPICS[topic];
  if (!t) throw new Error(`tasteFor: no topic "${topic}"; valid: ${TASTE_TOPICS.join(' ')}`);
  const fits = (l) => t.match.test(`${l.rule} ${l.text}`.toLowerCase());
  const all = Object.values(TASTE_STEPS).flatMap((s) => s.lines);
  const seen = new Set();
  const picked = [...own.filter(fits), ...all.filter(fits)].filter((l) => !seen.has(l.rule) && seen.add(l.rule));
  return [...picked.map(lineOf), `read ${t.doc}`];
}
