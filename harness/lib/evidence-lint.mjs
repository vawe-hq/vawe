// harness/lib/evidence-lint.mjs: is a structured judge's `evidence` string a real observation, or
// filler wearing one? `{"score": 2, "evidence": "readability looks fine"}` passes the old check (a
// non-empty string) and records nothing anyone can act on. Four rules, all heuristic (word lists, not
// vision): name an element/text plus one concrete property (position/size/colour/motion/timing),
// don't just echo the criterion's own name back, disagree in sign with a low score never, and never
// repeat across two criteria in the same verdict, the tell that every field was filled from one template.
import { isMain } from './is-main.mjs';

const ELEMENT_RE = /\b(text|headline|title|subtitle|cta|button|logo|icon|background|bg|caption|label|image|photo|badge|card|cursor|stat|number|chart|graphic|layer|word|line|copy|heading|paragraph|bar|dot|arrow|shape|panel|nav|menu|footer|header|thumbnail|avatar|price|tag|frame|edge|element|underline|graph)\b/i;
const QUOTED_RE = /["'][^"']{2,}["']/;

const POSITION_RE = /\b(left|right|top|bottom|center|centre|corner|edge|above|below|overlap\w*|off-frame|offscreen|anchored|aligned|misaligned|mis-anchored)\b/i;
const SIZE_RE = /\b(large\w*|small\w*|tiny|oversized|undersized|cramped|cut ?off|clipped|shrinks?|grows?|scaled?|\d+\s?px|too (big|small))\b/i;
const COLOUR_RE = /\b(red|blue|green|yellow|orange|purple|pink|black|white|gr[ae]y|dark\w*|light\w*|contrast\w*|muddy|colou?r\w*|hue|tint|saturat\w*|bright\w*|washed out)\b/i;
const MOTION_RE = /\b(slides?|fades?|moves?|jumps?|teleports?|eases?|easing|accelerat\w*|decelerat\w*|pans?|zooms?|drifts?|flickers?|stutters?|snaps?)\b/i;
const TIMING_RE = /(\d+(\.\d+)?\s?(s|sec|seconds|ms)\b|@\s?\d|beat\s?\d+|frame\s?\d+|timestamp)/i;

const FILLER_RE = /\b(looks|is|seems|reads as|scores?|checks out|being)\s+(fine|good|ok|okay|great|nice|poor|bad|weak|strong|correct|acceptable)\b/i;
const STOPWORDS = new Set(['the', 'a', 'an', 'is', 'at', 'to', 'of', 'and', 'this', 'that', 'it', 'its', 'on', 'in', 'for']);

const DEFECT_RE = /\b(no|not|n't|fails?|failing|cut ?off|clipped|overlap\w*|muddy|flat|unreadable|illegible|mismatch\w*|jumps?|teleports?|flicker\w*|blank|missing|off-?center|misaligned|mis-anchored|washed out|weak|low contrast|drops?|stutters?)\b/i;

function words(s) {
  return String(s || '').toLowerCase().split(/[^a-z]+/).filter(Boolean);
}

// One entry's own reasons, independent of any other criterion's evidence.
export function lintEvidence(evidence, { code = '', label = '', score } = {}) {
  const text = String(evidence || '').trim();
  const reasons = [];
  if (!text) { reasons.push('evidence is empty'); return reasons; }

  const hasElement = ELEMENT_RE.test(text) || QUOTED_RE.test(text);
  const hasProperty = POSITION_RE.test(text) || SIZE_RE.test(text) || COLOUR_RE.test(text)
    || MOTION_RE.test(text) || TIMING_RE.test(text);
  if (!hasElement || !hasProperty) {
    reasons.push('no concrete visual observation: name an element or text, plus its position, size, colour, motion or timing');
  }

  const nameWords = new Set([...words(code), ...words(label)]);
  const contentWords = words(text).filter((w) => !nameWords.has(w) && !STOPWORDS.has(w));
  if (FILLER_RE.test(text) && contentWords.length < 3) {
    reasons.push(`repeats the criterion name/verdict with no content ("${text}")`);
  }

  if (typeof score === 'number' && score <= 2 && !DEFECT_RE.test(text)) {
    reasons.push('a score of 1-2 needs a named defect in the evidence');
  }
  return reasons;
}

// The whole verdict: same rules per entry, plus the cross-criterion check no single entry can make on
// its own, that two criteria never carry the identical evidence string (one template, many labels).
export function lintCriteriaSet(criteria) {
  const byCode = {};
  const seenAt = new Map();
  for (const [code, entry] of Object.entries(criteria || {})) {
    const reasons = lintEvidence(entry?.evidence, { code, label: entry?.label || '', score: entry?.score });
    const norm = String(entry?.evidence || '').trim().toLowerCase();
    if (norm) {
      const other = seenAt.get(norm);
      if (other) reasons.push(`evidence identical to "${other}" (must differ across criteria)`);
      else seenAt.set(norm, code);
    }
    if (reasons.length) byCode[code] = reasons;
  }
  return byCode;
}

if (isMain(import.meta.url) && process.argv.includes('--self-test')) {
  const good = [
    'the CTA button sits 40px left of centre, off its grid column',
    'headline text fades in 0.3s late against the beat 2 @1.4s hold',
    'the background is washed out grey where the house style calls for cobalt',
  ];
  const bad = ['readability looks fine', 'hierarchy is good', 'looks fine (composition)'];
  for (const e of good) {
    if (lintEvidence(e, { code: 'readability', label: 'text legible at size' }).length) {
      console.error(`evidence-lint: good example wrongly rejected: "${e}"`); process.exit(1);
    }
  }
  for (const e of bad) {
    if (!lintEvidence(e, { code: 'readability', label: 'text legible at size' }).length) {
      console.error(`evidence-lint: bad example wrongly accepted: "${e}"`); process.exit(1);
    }
  }
  console.log('  ✓ evidence-lint self-test: 3 good examples pass, 3 filler examples are rejected');
  process.exit(0);
}
