import { MOVES } from "../moves";
import { REPO_URL } from "../schema";
import type { Crumb, Link, Meta, NextBlock, Para } from "./types";
export type Status = "solved" | "progress" | "parked";

export type Problem = {
  id: number;
  title: string;
  status: Status;
  why: string;
  does: string;
  figure: string;
  figureLabel: string;
};

export const STATUS_LABEL: Record<Status, string> = {
  solved: "Solved",
  progress: "In progress",
  parked: "Parked",
};

export const PROBLEMS: Problem[] = [
  {
    id: 1,
    title: "A browser is not a video renderer",
    status: "solved",
    why: "A web page reads the clock, runs timers and calls Math.random. Two renders of the same page give two different films.",
    does: "A virtual clock owns Date, requestAnimationFrame, timers and Math.random. The renderer seeks CSS and Web Animations to any fractional time. A script error in the page stops the render. Tests check that frames are identical.",
    figure: "1 clock",
    figureLabel: "owns Date, rAF, timers and Math.random",
  },
  {
    id: 2,
    title: "No private format",
    status: "solved",
    why: "An agent writes best what it already knows. A private format is one more thing to learn, and agents get it wrong more often.",
    does: "A film is one HTML page. vawe had its own JSON engine, ran an A/B test, and removed the engine. Agents now write HTML, CSS and Web Animations.",
    figure: "1 file",
    figureLabel: "one HTML page is the whole film",
  },
  {
    id: 3,
    title: "Motion blur and finish",
    status: "solved",
    why: "A browser draws sharp frames, so fast motion looks like a slide show. Smooth gradients show bands, and the files are large.",
    does: "Adaptive motion blur uses up to 32 subframes, set from the measured travel of each edge. It covers clips and rotation. Dither removes banding. Final files are smaller, and a short AV1 copy serves the web.",
    figure: "35 to 17\u00a0MB",
    figureLabel: "per 5\u00a0s final, plus a 2 to 4\u00a0MB AV1 web copy",
  },
  {
    id: 4,
    title: "Designed motion",
    status: "solved",
    why: "Browser eases suit interface changes. Film motion needs the speed and influence handles that motion designers set in After Effects.",
    does: `vawe uses After Effects speed and influence eases, fitted to real keyframes. All ${MOVES.length} video components use them.`,
    figure: "1,339",
    figureLabel: "real keyframe segments used for the fit",
  },
  {
    id: 5,
    title: "A weaker model can do the work",
    status: "solved",
    why: "A framework that needs the strongest model costs more per film and fails when the budget is small.",
    does: "On a 22\u00a0s film, Sonnet matched Opus: the best draft scored 52 of 70 for both. Sonnet also raised its measured acceptance table from 5 to 15 of 17 rows.",
    figure: "52 of 70",
    figureLabel: "best draft score, Sonnet and Opus",
  },
  {
    id: 6,
    title: "Fast iteration",
    status: "solved",
    why: "Each draft costs time, and the agent must read what the draft prints. Slow drafts and long logs both limit how many tries a film gets.",
    does: "A 5\u00a0s draft takes 20\u00a0s, down from 27\u00a0s. Draft output is 4 lines, down from 28.",
    figure: "27\u00a0s to 20\u00a0s",
    figureLabel: "for a 5\u00a0s draft; output 28 lines to 4",
  },
  {
    id: 7,
    title: "Learning from traces",
    status: "solved",
    why: "Agents fail in ways the author does not predict. The failures show only in what the agents did.",
    does: "vawe studied 147 agent transcripts. In them, 443 of 5,520 shell calls had failed. The causes were fixed.",
    figure: "443 of 5,520",
    figureLabel: "shell calls failed in 147 transcripts",
  },
  {
    id: 8,
    title: "Every AI film looks the same",
    status: "progress",
    why: "Models pick the same first idea, so their films share one brand, one shape and one subject.",
    does: "Of 8 early films, 4 named the brand “Vesper” and all 8 had a glowing circle. An attractor check fixed those. Then all 3 complete films chose a finance tool. The convergence moves to the next attractor.",
    figure: "4 of 8",
    figureLabel: "early films named the brand “Vesper”",
  },
  {
    id: 9,
    title: "Judging taste with an AI",
    status: "progress",
    why: "An AI judge scores the same film differently on different runs. A score that moves cannot guide a fix.",
    does: "The judge varies by about 1 point per axis. A ledger, settled frames and pixel sizes reduced that. No complete film has passed every axis at 8 or more yet. A pairwise judge is next.",
    figure: "about 1 point",
    figureLabel: "judge variation per axis",
  },
  {
    id: 10,
    title: "Making good measurable",
    status: "progress",
    why: "A check can only enforce what it can measure. Much of what makes a film good has no number yet.",
    does: "The acceptance table has 17 rows. Code measures 16 of them and the judge scores 1. One idea, the eye path and a thread through the film are not measured yet.",
    figure: "16 of 17",
    figureLabel: "acceptance rows measured by code, 1 by the judge",
  },
  {
    id: 11,
    title: "Final render speed",
    status: "progress",
    why: "A final render captures every frame at full size and rate, and capture is the slow part.",
    does: "A 22\u00a0s film takes about 28\u00a0minutes to render. Most of that time goes to screenshots.",
    figure: "28\u00a0min",
    figureLabel: "for a 22\u00a0s final, mostly screenshots",
  },
  {
    id: 12,
    title: "Reliability",
    status: "progress",
    why: "A long render can crash late, and an agent that runs unattended does not see it.",
    does: "A final render crashed at 96 percent and nobody saw it. A fix that resumes the render and reports the crash is next.",
    figure: "96%",
    figureLabel: "where a final render crashed unseen",
  },
  {
    id: 13,
    title: "Sound",
    status: "parked",
    why: "A synthesized cue sounds machine-made. Good sound needs a better source than synthesis.",
    does: "Sound work is parked. The synthesized cues sound machine-made, so vawe does not claim sound as a strength.",
    figure: "parked",
    figureLabel: "synthesized cues sound machine-made",
  },
];

export const SOLVED = PROBLEMS.filter((p) => p.status === "solved");
export const OPEN = PROBLEMS.filter((p) => p.status !== "solved");

export type Visual =
  | { kind: "poster"; move: string; alt: string }
  | { kind: "clip"; move: string; alt: string }
  | { kind: "curve"; ease: "land" | "settle" | "pop" | "leave"; alt: string }
  | { kind: "code"; text: string };

export const VISUALS: Record<number, Visual> = {
  1: { kind: "poster", move: "speed-ramp-freeze", alt: "A frame from the speed-ramp-freeze video component, held still. The same frame renders every time." },
  2: { kind: "code", text: '<meta name="duration" content="6">\n<h1>2.0</h1>\n<style>\n  h1 { animation: in .6s both }\n</style>' },
  3: { kind: "clip", move: "push-blur", alt: "The push-blur video component: fast motion drawn as one soft streak." },
  4: { kind: "curve", ease: "land", alt: "The land ease: value against time, a fast start and a long soft stop. A straight line is drawn for comparison." },
  5: { kind: "poster", move: "ai-stream-response", alt: "A frame from the ai-stream-response video component." },
  6: { kind: "poster", move: "agent-progress", alt: "A frame from the agent-progress video component." },
  7: { kind: "poster", move: "count-up", alt: "A frame from the count-up video component." },
  8: { kind: "poster", move: "light-pool", alt: "A frame from the light-pool video component: a glowing pool of light, the shape that many agent films reach for." },
  9: { kind: "poster", move: "before-after-wipe", alt: "A frame from the before-after-wipe video component, two versions side by side." },
  10: { kind: "poster", move: "chart-build", alt: "A frame from the chart-build video component." },
  11: { kind: "poster", move: "exposure-flash", alt: "A frame from the exposure-flash video component." },
  12: { kind: "poster", move: "success-check", alt: "A frame from the success-check video component." },
};

export const PROBLEMS_PAGE = {
  path: "/problems",
  title: "The hard problems in agent-made motion graphics, and where vawe stands",
  datePublished: "2026-10-03",
  meta: {
    title: "vawe · hard problems in agent-made motion graphics",
    description:
      "Thirteen problems that decide whether an agent can make a good film: determinism, blur, eases, model cost, taste and render speed. Seven are solved, with numbers. Six are open.",
  } as Meta,
  crumb: { group: "Project", current: "Hard problems" } as Crumb,
  h1: "The hard problems in agent-made motion graphics.",
  lede: `An agent can write a page of HTML in a minute. Turning that page into a film that looks designed is the hard part. These are the ${PROBLEMS.length} problems vawe works on, with the measured result for each. ${SOLVED.length} are solved. ${OPEN.length} are still open. The acceptance table has 17 rows: 16 are measured by code and 1 by the judge.`,
  note: [
    "The plan for the open problems is in ",
    { text: "the roadmap", href: "#roadmap" },
    " at the end. Numbers come from vawe’s own runs and tests. vawe runs on your machine, needs no account and has no per-render fee.",
  ] as Para,
  tocLabel: "Jump to",
  toc: [
    { href: "#solved", label: `Solved (${SOLVED.length})` },
    { href: "#open", label: `Still solving (${OPEN.length})` },
    { href: "#roadmap", label: "Roadmap" },
  ] as Link[],
  solved: { title: "Solved", lead: "Each of these has a mechanism in the engine and a measured result." },
  open: { title: "Still solving", lead: "These are open. Each entry says what is known and what is not." },
  labels: { why: "Why it is hard", stands: "Where vawe stands" },
  next: {
    title: "See the engine at work.",
    lead: ["Every video component in the library uses the eases from problem 4. The determinism page shows the clock from problem 1."],
    primary: { href: "/video-components", label: `Browse the ${MOVES.length} video components` },
    secondary: { href: REPO_URL, label: "Follow the work on GitHub" },
    related: [
      { href: "/determinism", label: "Why the same page renders the same frames" },
      { href: "/ai-agents", label: "How an agent writes and checks a film" },
      { href: "/remotion-alternatives#vs-remotion", label: "vawe vs Remotion" },
    ],
  } as NextBlock,
};
