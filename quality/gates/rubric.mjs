// quality/gates/rubric.mjs: the criteria a vision judge is scored against.
//
// Two rubrics, deliberately different.
//
// `craftRubric` grades ONE film against a house style: all 11 dimensions, including brand and asset
// fidelity, because conformity to a named brand is the point when there is a brand to conform to.
//
// `abRubric` grades one film AGAINST ANOTHER, and drops dimensions 4 and 5 unless a brand is named.
// Those two score conformity to a house style; run unchanged across a campaign of fifteen films they
// reward sameness, and the library gets more similar while every individual verdict says "better".
// That is the failure `similarity.mjs` exists to catch, so the A/B loop must not manufacture it.
import fs from 'node:fs';
import path from 'node:path';
import { scratchBase } from '../../harness/lib/scratch.mjs';
import { structuredCriteria } from '../../harness/lib/judge-axes.mjs';
import { tricksPrompt } from '../../harness/lib/judge-tricks.mjs';
import { isMain } from '../../harness/lib/is-main.mjs';

export function houseStyleFor(brand) {
  const p = brand && path.join('assets', 'brands', brand, 'house-style.md');
  return p && fs.existsSync(p) ? fs.readFileSync(p, 'utf8')
    : `(no house-style for "${brand || '?'}", judge on the craft rubric + general brand-fidelity only)`;
}

const DIMENSIONS = [
  '**Readability**: text legible at size, contrast sufficient (no muddy/low-contrast copy).',
  '**Hierarchy**: ONE clear focal point; the eye knows where to land first.',
  '**Composition**: centered/aligned/on-thirds ON PURPOSE. Off-center-by-accident, mis-anchored\n   annotations (an underline not under its word), floating elements = FAIL. (This is the argus-pass class.)',
  '**Brand fidelity**, matches the house style: dominance, ONLY brand colours, the real face, the\n   SIGNATURE DETAILS present, the NEVERs absent.',
  '**Asset fidelity**: for a real brand or product, real captured assets (logos/mascots/UI), never a recreated-from-memory lookalike. An invented brand has no capture: its own mark and world are the asset, so never ask for one.',
  // DIMENSION 6 USED TO READ "crafted density; not a word-on-empty-space slide", which instructs the
  // judge to score density UP. That is length bias written into the rubric: a judge already leans that
  // way by default, scoring the longer, busier answer higher whether or not it is better. And CLAUDE.md
  // spends a whole section arguing the opposite case (active versus passive whitespace, "IS THE EMPTY
  // PART OF THE FRAME DOING A JOB?"), noting that no gate sees it. The rubric saw it and scored against
  // it. Asked as a question about whether the emptiness is WORKING, both a dense frame and a spare one
  // can pass, and neither passes by being what it is.
  '**Produced-not-generated**: every element in the frame is doing a job, and so is the empty part.\n   A dense frame where two elements repeat the same point FAILS. A spare frame whose emptiness\n   isolates the subject PASSES. Ask what the space is doing, never how much of it there is.',
  '**Value**: this frame teaches/proves/delights something no other frame does.',
  // Every dimension above grades ONE frame. A ground flip only exists BETWEEN two frames: a beat that
  // whites out then blacks out reads fine on each still in isolation. ground-arc.mjs used to measure
  // this pre-render (is a flip DECLARED against the scene's own schedule); it was a TASTE gate and was
  // retired. Its measurement lives on in harness/lib/ground-flip.mjs
  // for the OBJECTIVE plan-vs-render check; whether the CUT ITSELF reads as a jarring flash across the
  // sheet needs an eye on the sequence, which is what this dimension asks for now, alone.
  '**Ground continuity**: where the background changes light/dark between adjacent frames, is it a\n'
  + '   planned beat change carried across the join (a crossfade, a colour that follows the content), or\n'
  + '   does it flash cold from one still to the next with nothing bridging it? A carried change PASSES\n'
  + '   even when it happens more than once; an unbridged flash FAILS regardless of how brief it is.',
  // The three below are named dimensions from VBench++ (arxiv.org/abs/2411.13503), a benchmark built
  // to score generated video the way this rubric scores a frame: named axes, not a vibe. A key-frame
  // sheet cannot show motion directly, so each asks what the ADJACENT frames imply, and CANNOT TELL
  // (below) is the honest answer when the sheet does not carry enough to say.
  '**Motion smoothness** (VBench++): between adjacent key frames, does a moving element\'s path look like\n'
  + '   one continuous move (consistent direction, plausible in-between position), or does it jump/teleport?',
  '**Temporal flicker** (VBench++): does anything that should be STATIC between adjacent frames (a\n'
  + '   background, an unrelated layer) change colour, brightness or position when nothing in the film says\n'
  + '   it should?',
  '**Aesthetic quality** (VBench++): independent of brand or composition rules, does the frame look\n'
  + '   professionally graded (colour, light, depth) rather than flat and undesigned?',
];

// Binary checks, not 1-5 scored: each is a yes/no fact about the pixels, not a craft judgement.
const CHECKS = [
  '**Edge clipping**: at every frame the sheet shows AT REST (not mid-transition), is any text or\n'
  + '   essential graphic cut off by the frame edge? Name the frame and which edge.',
  '**Blank frame at transition**: at every transition/cut boundary the sheet shows, is there a frame that\n'
  + '   reads as empty/black/white when it should be carrying content (a drop frame, an unrendered gap)?\n'
  + '   Name the transition.',
];

const numbered = (list) => list.map((d, i) => `${i + 1}. ${d}`).join('\n');

// The eye is not the first check to look at these pixels. quality/audit.mjs and sweep-static.mjs
// already measured 18 kinds of defect against this SAME render before this rubric was written; a
// finding here is a FACT about the frames, not a lead to re-verify by squinting. Grouped by severity so
// a HARD (ship-blocking) finding cannot hide among warnings, and a waived one still shows, the same
// "still printed, tagged, and counted separately" rule audit.mjs itself holds for a waiver.
function measuredSection(findings, source = 'quality/audit.mjs + sweep-static.mjs') {
  if (!findings.length) {
    return `## Measured findings (${source})\nNone. The scripts ran against this render and found nothing to report.\n`;
  }
  const line = (r) => `- \`${r.code}\` [${r.severity === 'error' ? 'HARD' : r.severity.toUpperCase()}]` +
    `${r.waived ? ' (waived)' : ''}: ${r.summary}${r.at ? ` [${r.at}]` : ''}${r.fix ? ` Fix: ${r.fix}` : ''}`;
  return `## Measured findings (${source})
These were measured on the rendered pixels, not guessed. Treat each as true unless the frame you are
looking at plainly disagrees; a waived one is a known, deliberate exception, not a bug to re-report.

${findings.map(line).join('\n')}
`;
}

// What a fix must look like, and the default. The score threshold stays at 7 (owner rule, see
// harness/lib/judge-consensus.mjs); this section only makes a finding something an author can act on.
const FIX_SHAPE = `## Name every problem as a fix an author can apply
For each problem write ONE entry with all five parts. A finding missing a part is not a finding.
1. **Where**: the shot and the frame number (the sheet labels carry both), e.g. "shot 3, f44".
2. **What is wrong**: what you SEE, one sentence.
3. **Why it looks worse**: the effect on the viewer, and against the reference when there is one.
4. **The exact fix**: a number and a direction, e.g. "the card lands 6 frames early, delay it to f44";
   never "improve the timing".
5. **Confidence**: sure, or CANNOT TELL from these frames.

**Every fail names a time stamp in seconds and one concrete fix.** A fail with no time stamp, or with a
fix that is not a number and a direction, does not count.

End with the **top 5 fixes**, ranked by how much each raises the film. Fewer than five is fine when
fewer are real.

## The default is reject
You are asked to REJECT unless the film earns a pass. Look for the reason it is not ready, and pass only
when you cannot find one. A pass needs an \`overall\` of 7 or more out of 10 and no fix in your top list
that a viewer would notice at first watch. "Renders fine" is not a pass.
`;

const referenceSection = (reference) => (reference ? `## The reference
Every tile pair is frame-locked: LEFT is the REFERENCE (\`${reference}\`), RIGHT is the film, both at the
same time. Grade the film by how far it is from the reference at that frame: layout, type, colour, light,
and what is moving. Say which side is better and by how much. A difference the reference does not have is
a defect unless the film's own intent explains it.
` : '');

// harness/media/see.mjs --measure wrote these: the page read from its DOM, the reference from its pixels.
const deltasSection = (deltas) => (deltas ? `## Measured deltas (numbers are settled facts)
Code measured everything below on both sides. Do NOT re-measure it by eye and do not argue with a number.
Your eyes are for taste, composition, hierarchy and brand. The one exception is a line marked
"confirm by eye": look at the frame it names and say what you see. A fix you write for a measured line
uses the number already given.

${deltas.replace(/^# .*\n+/, '').replace(/^## /gm, '### ')}
` : '');

export function craftRubric({ name, frames, landscape, brand, dir = path.join(scratchBase(), 'judge'), findings = [], reference = null, measuredSource, deltas = '' }) {
  return `# Judge sheet, ${name} (${frames} key frames, ${landscape ? 'landscape' : 'portrait'})

READ \`${dir}/sheet.png\` and score EACH labeled frame against the rubric below. Be adversarial:
your job is to catch what the static gates can't SEE. Do NOT rationalize a flaw you notice, flag it.

## The brand's house style (the scoring key)
${houseStyleFor(brand)}

${measuredSection(findings, measuredSource)}
${deltasSection(deltas)}
${referenceSection(reference)}
## Craft rubric: for EACH dimension, write the evidence FIRST, then the score
For every dimension below, on every frame: name what you actually SEE (a timestamp/beat, the exact
element, the exact defect) before you write the 1-5 score. A score with no evidence line above it is
not a finding, it is a guess wearing one. "beat 3 (1.8s), hierarchy: the CTA and the stat both sit at
the same size and weight, neither wins → 2/5" is the shape; a bare "hierarchy: 4" is not acceptable.
${numbered(DIMENSIONS)}

## Checks: yes/no, with the evidence that answers it
${numbered(CHECKS)}

${FIX_SHAPE}
## Return this verdict (structured)
- **Per frame, per dimension:** evidence first (timestamp/beat + what you see), then the score.
- **The fixes**, in the five-part shape above, then the top 5.
- **Worst frame overall** + why.
- **Verdict:** \`PASS\` only when the default-reject test above is met. Otherwise \`FIX\` + the ranked list, each fix with its time stamp. Record it with
  \`--verdict FIX --at <seconds> --top-fix "<the top fix>"\` (or \`--verdict PASS\`): that writes out/<film>.judge.json.

## You may say you cannot tell, and you must when it is true
A still cannot carry every dimension. Speed, direction, easing and whether a background is alive are
properties of MOTION, and a sheet of key frames is not motion: a background was once judged "matched"
on one still and was, running, 2.5x too fast with folds half the size. If a dimension asks something
these frames cannot answer, write \`CANNOT TELL\` for it and name the evidence that would settle it
(a 4-frame strip across the beat, the seam frames, the rendered mp4), instead of guessing.

\`CANNOT TELL\` is a real answer and costs you nothing. A guess dressed as a finding costs the author a
render, and it arrives in the same shape as a true one, so nobody downstream can tell them apart. If
every dimension a frame CAN answer is clear and the rest are \`CANNOT TELL\`, the frame is not a FIX.

## The sheet is a grid of separate frames, not a filmstrip
Each tile's row/column position is a layout choice, not a moment in time. Do not compare an element's
position across tiles in different rows and call it a "jump"; do not call a device that is meant to
stay on screen across several tiles a "ghost". Read motion and position claims off same-scale,
full-resolution stills in real time order, or off \`probe-frame\` numbers, never off where a tile sits.
`;
}

// structuredRubric: the same craft rubric, but the REQUIRED answer is JSON, one entry per criterion,
// {score, evidence, t}, split into LOOK (light, colour, type, camera, composition) and MOTION (timing,
// easing, transitions, continuity), scored as two SEPARATE passes: a single vision judge repeats its
// own rating on the same clip roughly two times in three (Video-Bench), so one pass, one number, one
// rubric is not a verdict, it's a coin with a thumb on it. `run` names which of the (at least two,
// independent) judges is answering; `--compare` in judge.mjs then flags any criterion where the two
// runs disagree by more than 2 points.
export function structuredRubric({ name, subject, frames, landscape, dir, run, outFile, reference = null, deltas = '' }) {
  const criteria = structuredCriteria();
  const look = criteria.filter((c) => c.axis === 'look');
  const motion = criteria.filter((c) => c.axis === 'motion');
  const section = (label, list) => `### ${label}\n${list.map((c) => `- \`${c.code}\`: ${c.label}`).join('\n')}\n`;
  return `# Structured judge, ${name} (${frames} key frames, ${landscape ? 'landscape' : 'portrait'}), run ${run}

READ \`${dir}/sheet.png\`. Score EVERY criterion below. A score with no evidence is refused, not
recorded: \`node quality/gates/judge.mjs\` checks each entry has a non-empty \`evidence\` string and a
\`t\` (seconds) before it writes anything down.

${deltasSection(deltas)}
${referenceSection(reference)}
${section('LOOK (score this pass; static, per-frame)', look)}
${section('MOTION (score from what adjacent frames imply; write CANNOT_TELL in evidence if a still cannot answer it)', motion)}

## Write this JSON to \`${outFile}\`, and nothing else
\`\`\`json
{
  "run": "${run}",
  "criteria": {
${criteria.map((c) => `    "${c.code}": {"score": 1-5, "evidence": "<quoted visual observation>", "t": <seconds>}`).join(',\n')}
  },
  "overall": 1-10,
  "verdict": "PASS|FIX",
  "fixes": [{"t": 1.47, "shot": 3, "frame": 44, "wrong": "<what you see>", "why": "<why it looks worse>", "fix": "<number and direction>"}]
}
\`\`\`
Every \`evidence\` string must name what you actually SEE (a timestamp/beat, the exact element, the
exact defect), never a bare number. \`overall\` is YOUR OWN holistic 1-10 read of this cut, never
averaged with the other judge's: \`vawe ship\` requires both independent judges at 7 or above.
\`fixes\` is the top 5, ranked, each with all five fields and a \`t\` in seconds; a FIX verdict with an empty list is
incomplete. The default is reject: pass only when you cannot find the reason the film is not ready. Then
record it:
\`node quality/gates/judge.mjs ${subject} --verdict-json ${outFile} --run ${run}\`
`;
}

export function abRubric({ rows, landscape, brand, dir, judge }) {
  // 1,2,3,6,7 plus the show-don't-tell question. 4/5 only when a brand is named to conform to.
  const dims = brand ? DIMENSIONS : DIMENSIONS.filter((_, i) => i !== 3 && i !== 4);
  return `# Blind comparison, ${rows} paired beats (${landscape ? 'landscape' : 'portrait'})

You are judge ${judge ?? 'N'} of three, working independently. Two cuts of the same film are laid side by
side: **LEFT** and **RIGHT**. You are not told which is which, who made either, or which came first.
Nothing about the order implies anything. Judge only what is in the frames.

## What to open
- \`${dir}/sheet.png\`: every paired beat, LEFT beside RIGHT, in order.
- \`${dir}/beat-NN.png\`: the SAME pair at full render resolution. **Open at least one of these.** A call
  about readability made from the contact sheet alone is a guess; the sheet is for structure and pace.

Where one side reads \`(no beat)\`, that cut has no beat at that index. A differing beat count is itself a
signal about pace, not an error to correct for.

## Dimensions
${numbered(dims)}
${dims.length + 1}. **Does the graphic encode the claim**, is there a picture doing work the words cannot, or
   is the frame type with decoration around it?

## The one field that matters most
\`graphicEarnsIt.whatItEncodes\`: **in your own words, what does the picture MEAN?** What quantity,
proportion, change, or real thing is it showing? You have not been told what it was supposed to show.
If you cannot say, write \`"nothing: it is decoration"\`. That answer is a legitimate and useful verdict.

## Return EXACTLY this JSON, and nothing else
Write it to \`${dir}/verdicts/${judge ?? 'N'}.json\`. Every field names a POSITION (LEFT/RIGHT), never a file.

\`\`\`json
{
  "judge": "${judge ?? 'N'}",
  "perBeat": [{"beat": 1, "winner": "LEFT|RIGHT|TIE", "dimension": "…", "why": "one sentence"}],
  "graphicEarnsIt": {"side": "LEFT|RIGHT|NEITHER", "whatItEncodes": "…"},
  "overall": {"winner": "LEFT|RIGHT|TIE", "margin": "clear|narrow", "why": "…"},
  "worstFrame": {"side": "LEFT|RIGHT", "beat": 3, "flaw": "…"},
  "wouldShip": {"LEFT": "yes|no", "RIGHT": "yes|no"}
}
\`\`\`

\`wouldShip\` is independent of \`overall\`. One cut can win and both can still be \`no\`; say so when true.
A \`TIE\` is a real answer. Do not break one to look decisive.
`;
}

// Guarded so importing this module for its exports never runs a CLI-only check.
if (isMain(import.meta.url) && process.argv.includes('--self-test')) {
  // The real defect this guards: a ground flip only exists BETWEEN frames, which no per-frame
  // dimension above can see. Adding the dimension without checking it landed would ship a rubric that
  // still cannot ask the question.
  if (!DIMENSIONS.some((d) => /Ground continuity/.test(d))) {
    console.error('rubric must carry a Ground continuity dimension'); process.exit(1);
  }
  const sheet = craftRubric({ name: 'x.mp4', frames: 3, landscape: true });
  if (!/Ground continuity/.test(sheet)) { console.error('craftRubric output must include Ground continuity'); process.exit(1); }

  // abRubric drops indices 3/4 (brand/asset fidelity) unless a brand is named. Appending the new
  // dimension at the END must not shift those indices: this is the case that would silently break if
  // a future edit inserted the new dimension in the middle instead of appending it.
  const noBrand = abRubric({ rows: 2, landscape: true, dir: scratchBase() });
  if (/Brand fidelity/.test(noBrand) || /Asset fidelity/.test(noBrand)) {
    console.error('abRubric with no brand must still drop Brand/Asset fidelity'); process.exit(1);
  }
  if (!/Ground continuity/.test(noBrand)) { console.error('abRubric must keep Ground continuity even with no brand'); process.exit(1); }

  console.log('  ✓ rubric self-test: Ground continuity is present in both craftRubric and abRubric,');
  console.log('    and appending it did not shift the brand/asset-fidelity exclusion in abRubric');
  process.exit(0);
}

export const FRESH_AXES = {
  film: [
    ['hook', 'the first second gives one clear, strong thing to look at'],
    ['motion', 'curves, continuity between moves, overlap; nothing snaps or stops dead'],
    ['scenes', 'the world turns every 1 to 2 beats; count the distinct worlds and say the number'],
    ['type', 'faces, scale contrast, spacing, hierarchy, reading time'],
    ['colour', 'palette discipline, light, contrast, one accent used with intent'],
    ['sound', 'final only: subtle cues that mark the beats, with the mix left as written (near -20 LUFS scores well; do not ask for -14 LUFS or more hits unless the brief asks). Score 0 when the stage is not final'],
    ['pace', 'density per frame and rhythm; readable holds, no dead air'],
    ['expensive', 'looks made by a person with taste, not assembled from a template'],
  ],
  stills: [
    ['concept', 'one idea, said in one glance, different from the other directions'],
    ['focal', 'one clear focal point and eye path'],
    ['colour', 'palette discipline and light'],
    ['type', 'faces, scale, hierarchy'],
    ['template', 'distance from a generic template (10 = unmistakably its own)'],
  ],
};

/** The scoring instructions for a fresh judge. `stage` is stills, draft or final. */
export function freshRubric({ stage }) {
  const axes = FRESH_AXES[stage === 'stills' ? 'stills' : 'film'];
  const list = axes.map(([k, d]) => `- ${k}: ${d}`).join('\n');
  return `Score each axis 1 to 10. Default to reject: 8 is good work, 10 is rare, and a score under 8 needs a fix.
The reader must be able to check every score, so name the moment you looked at.
Axes:
${list}

${tricksPrompt({ stage })}

Return ONLY one JSON object, no prose around it:
{"scores":{${axes.map(([k]) => `"${k}":n`).join(',')}},
 "worlds":n or null,
 "fixes":[{"axis":"...","score":n,"at":"seconds like 1.4, or the frame name for stills","fix":"ONE concrete change an author can make in one edit","what":"the one thing it changes, 2 to 4 words","now":"its measured value on the frames now","want":"the value to reach"}],
 "fixFirst":"the one fix with the most effect"${stage === 'stills' ? '' : ',\n "tricks":[{"trick":"a known trick id","at":seconds like 1.4,"evidence":"what you saw at that second"}]'}}
Add one entry to "fixes" for every axis scored under 8, and none for the others.`;
}
