export const STAGES = ['new', 'study', 'design', 'page', 'frames', 'ideas', 'storyboard', 'board', 'dev', 'motion', 'critique', 'judge', 'fix', 'approve', 'ship'];

const OPTIONAL = new Set(['judge', 'fix', 'approve', 'ship']);
const STUDY_VERBS = new Set(['refs', 'see', 'sheet', 'compare', 'look', 'looks', 'spec', 'strip', 'onion', 'velocity']);
const MOTION_VERBS = new Set(['onion', 'velocity']);

const BOARD = /--(board|directions)\b/;
const MOVE = /--(cuts|onion|velocity)\b/;
const ONE_FRAME = /--at[= ]\s*\d+(\.\d+)?(\s|$)/;

/** The stage of a `frame` call: its mode decides, and the study modes turn into the motion pass once a draft exists. */
function frameStage(args, seen) {
  if (/--(world|looks)\b/.test(args)) return 'frames';
  if (BOARD.test(args)) return 'storyboard';
  if (/--(box|auto)\b/.test(args) || (ONE_FRAME.test(args) && !/--(cuts|moment|sheet|vs)\b/.test(args))) return null;
  return !seen.dev ? 'study' : MOVE.test(args) ? 'motion' : null;
}

/** The loop stage a verb call belongs to, or null when its verb names none. `seen` holds the stages already used. The run log and the trace review both call this. */
export function verbStage({ verb, args }, seen) {
  if (verb === 'frame') return frameStage(args, seen);
  if (verb === 'see' && /--plan\b/.test(args)) return 'storyboard';
  if (verb === 'dev') return /--studio\b/.test(args) ? null : /--animatic\b/.test(args) ? 'board' : (seen.critique || seen.judge) && /--(from|to)\b/.test(args) ? 'fix' : 'dev';
  if (verb === 'ship') return /--(status|wait)\b/.test(args) ? null : 'ship';
  if (verb === 'critique' || verb === 'judge') return verb;
  if (STUDY_VERBS.has(verb)) {
    if (!seen.dev) return 'study';
    return MOTION_VERBS.has(verb) || (verb === 'strip' && /--cuts/.test(args)) ? 'motion' : null;
  }
  return { new: 'new', animatic: 'board', frames: 'frames', storyboard: 'storyboard', timeline: 'storyboard', approve: 'approve' }[verb] ?? null;
}

function writeStages({ what, text }) {
  if (what === 'page') return ['page'];
  if (what === 'design' || what === 'kit') return ['design'];
  return [/\bIdeas?\b/.test(text) && 'ideas', /\bBoard\b|Rhythm|Spectacle/.test(text) && 'board'].filter(Boolean);
}

/** First-use second of each stage of the AGENTS.md loop, from the calls in order. Pure. */
export function stageFirstUse(calls, events, startMs) {
  const first = {};
  const seen = {};
  const note = (stage, ms) => {
    if (!stage) return;
    first[stage] ??= Math.round((ms - startMs) / 1000);
    seen[stage] = true;
  };
  for (const call of calls) {
    for (const verb of call.verbs.filter((v) => !v.help)) note(verbStage(verb, seen), call.ms);
    for (const write of call.writes) writeStages(write).forEach((stage) => note(stage, call.ms));
  }
  return first;
}

/** Skipped stages (before the furthest one reached) and inversions ("dev<frames": dev came first, frames later). Pure. */
export function stageOrder(first) {
  const used = STAGES.filter((s) => s in first);
  const reached = used.length ? STAGES.indexOf(used.at(-1)) : -1;
  const skipped = STAGES.filter((s, i) => i < reached && !(s in first) && !OPTIONAL.has(s));
  const inversions = [];
  for (const [i, a] of used.entries()) {
    for (const b of used.slice(i + 1)) if (first[a] > first[b]) inversions.push(`${b}<${a}`);
  }
  return { skipped, inversions };
}
