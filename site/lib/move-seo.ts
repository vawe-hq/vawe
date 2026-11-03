import { MOVES, type Move } from "./moves";
import { groupNoun } from "./move-words";

const TITLE_MAX = 60;
const DESCRIPTION_MAX = 160;
const RELATED_MAX = 6;

export function moveSeoTitle(m: Move) {
  const noun = groupNoun(m.group);
  const options = [
    `${m.title}: ${noun} animation in CSS and HTML | vawe`,
    `${m.title}: ${noun} animation in CSS | vawe`,
    `${m.title}: ${noun} in CSS | vawe`,
  ];
  return options.find((t) => t.length <= TITLE_MAX) ?? options[2];
}

function fit(text: string, max: number) {
  if (text.length <= max) return text;
  const head = text.slice(0, max - 1);
  const clause = Math.max(head.lastIndexOf(", "), head.lastIndexOf("; "), head.lastIndexOf(": "));
  return `${head.slice(0, clause > max / 2 ? clause : head.lastIndexOf(" "))}.`;
}

// The when line first, then what the snippet is, each part only if it still fits.
export function moveSeoDescription(m: Move) {
  const eases = m.eases.map((e) => e.name).join(", ");
  const parts = [
    `${m.title}: ${m.use}.`,
    m.duration ? `${m.duration} s clip.` : "",
    eases ? `Copy the CSS and Web Animations snippet with the ${eases} ease${m.eases.length > 1 ? "s" : ""}.` : "Copy the CSS and Web Animations snippet.",
    "Free, Apache-2.0.",
  ].filter(Boolean);
  let out = fit(parts[0], DESCRIPTION_MAX);
  for (const part of parts.slice(1)) if (`${out} ${part}`.length <= DESCRIPTION_MAX) out = `${out} ${part}`;
  return out;
}

// Same group first (nearest in README order), then moves that share a job.
export function relatedMoves(m: Move): Move[] {
  const index = MOVES.indexOf(m);
  const byDistance = (a: Move, b: Move) => Math.abs(MOVES.indexOf(a) - index) - Math.abs(MOVES.indexOf(b) - index);
  const sameGroup = MOVES.filter((o) => o !== m && o.group === m.group).sort(byDistance);
  const sameJob = MOVES.filter((o) => o !== m && o.jobs.some((j) => m.jobs.includes(j)));
  return [...new Set([...sameGroup.slice(0, 4), ...sameJob, ...sameGroup])].slice(0, RELATED_MAX);
}

// The rest of the move's group, nearest first, for a plain link list under the related cards.
export function moreInGroup(m: Move): Move[] {
  const shown = new Set(relatedMoves(m));
  const index = MOVES.indexOf(m);
  return MOVES.filter((o) => o !== m && o.group === m.group && !shown.has(o)).sort(
    (a, b) => Math.abs(MOVES.indexOf(a) - index) - Math.abs(MOVES.indexOf(b) - index),
  );
}
