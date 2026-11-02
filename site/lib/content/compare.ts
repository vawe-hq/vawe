import { MOVES } from "../moves";
import { REPO_URL } from "../schema";
import type { Link, NextBlock } from "./types";
import type { Mark, Qa, Source } from "./vs";

const READ = "2026-11-03";

export type Cell = { text: string; mark?: Mark };
export type CompareRow = { feature: string; remotion: Cell; hyperframes: Cell; vawe: Cell };

export const COMPARE_REMOTION_HYPERFRAMES = {
  path: "/compare/remotion-vs-hyperframes",
  slug: "remotion-vs-hyperframes",
  read: READ,
  metaTitle: "Remotion vs HyperFrames vs vawe: video from code",
  metaDescription:
    "Remotion writes video in React; HyperFrames and vawe use HTML. A sourced three-way comparison of authoring, time, licence, rendering and agents.",
  h1: "Remotion vs HyperFrames vs vawe.",
  intro:
    "Three tools make video from code. Remotion uses React components. HyperFrames and vawe use HTML. This page compares the three on authoring, how each handles time, licence, rendering targets and agent support. It also says where each one is stronger.",
  note: `Every fact about Remotion and HyperFrames was read from that project's own docs or repository on ${READ}. The sources are listed at the end. vawe is the site's own project, so the page leans on what it can check in its own repo.`,
  toc: [
    { href: "#choose", label: "Which to choose" },
    { href: "#table", label: "Side by side" },
    { href: "#time", label: "How each handles time" },
    { href: "#stronger", label: "Where each is stronger" },
    { href: "#faq", label: "Questions" },
  ] as Link[],
  choose: [
    {
      name: "Remotion",
      items: [
        "Your team writes React and wants video in the same component model.",
        "You need an embeddable Player, a Studio editor, or rendering on AWS Lambda.",
        "Your company has three people or fewer, or you can buy a Company License. Non-profits are free.",
      ],
    },
    {
      name: "HyperFrames",
      items: [
        "You want an Apache-2.0 HTML-to-video tool with a Studio and desktop apps.",
        "You like frame-by-frame seeking driven by GSAP, CSS or other seekable animations.",
        "You want render targets that include AWS Lambda.",
      ],
    },
    {
      name: "vawe",
      items: [
        "You want an agent to write the film as one plain HTML page, with no timing attributes in the markup.",
        "You want the clock, timers and Math.random replaced for you instead of forbidden.",
        `You want a library of ${MOVES.length} video components, motion blur and a critique step by a second session.`,
      ],
    },
  ],
  rows: [
    {
      feature: "What it is",
      remotion: { text: "A framework to make videos programmatically. Its site says: create videos and motion graphics with React." },
      hyperframes: { text: "An open-source framework that turns HTML into video. An agent builds the project; HyperFrames plays or renders it." },
      vawe: { text: "A framework that renders one HTML page to a film." },
    },
    {
      feature: "Authoring model",
      remotion: { text: "React components inside a Composition with id, component, durationInFrames, fps, width and height." },
      hyperframes: { text: "HTML files with data attributes for timing; animation by seekable libraries." },
      vawe: { text: "One HTML page. Timing from CSS keyframes, element.animate() or a window.seek(t) function." },
    },
    {
      feature: "Licence",
      remotion: { text: "The Remotion License: free for individuals and small companies, paid above that. GitHub reports no SPDX id.", mark: "partial" },
      hyperframes: { text: "Apache-2.0", mark: "yes" },
      vawe: { text: "Apache-2.0", mark: "yes" },
    },
    {
      feature: "Cost for a company of 4 or more",
      remotion: { text: "Company License: $0.01 per render with a $100 a month minimum (Automators), or $25 a month per seat (Creators). Free for individuals, non-profits and up to three people." },
      hyperframes: { text: "None. The README says: no per-render fees or commercial-use thresholds." },
      vawe: { text: "None. Apache-2.0." },
    },
    {
      feature: "How a frame gets its content",
      remotion: { text: "The component reads useCurrentFrame() and returns the frame." },
      hyperframes: { text: "The engine computes the time from the frame number and calls seekFrame(frame). GSAP timelines are paused and seeked, never played." },
      vawe: { text: "The renderer seeks the page to each frame time. CSS and Web Animations follow the seek, or window.seek(t) paints frame t." },
    },
    {
      feature: "Wall-clock and random calls in the page",
      remotion: { text: "Math.random() breaks at render; use random(seed).", mark: "partial" },
      hyperframes: { text: "Forbidden: Date.now(), requestAnimationFrame, system timers, unseeded Math.random.", mark: "partial" },
      vawe: { text: "Allowed. A virtual clock replaces Date, requestAnimationFrame, timers and Math.random with functions of the seek time.", mark: "yes" },
    },
    {
      feature: "Render targets",
      remotion: { text: "CLI (npx remotion render), Studio, server-side API, AWS Lambda, GitHub Actions. Cloud Run is in alpha and not actively developed." },
      hyperframes: { text: "Local CLI, Docker and AWS Lambda (README); HeyGen cloud and Google Cloud Run (its comparison guide)." },
      vawe: { text: "Your own machine only.", mark: "no" },
    },
    {
      feature: "Editor and preview",
      remotion: { text: "Remotion Studio to preview, edit and render; a Player to embed a video in an app.", mark: "yes" },
      hyperframes: { text: "A browser Studio (listed as available, evolving) and desktop apps.", mark: "yes" },
      vawe: { text: "No timeline editor. bin/vawe studio gives a scrubbable preview that edits the page’s literals.", mark: "partial" },
    },
    {
      feature: "Agent support",
      remotion: { text: "Agent Skills (npx skills add remotion-dev/skills), Agent Plugins and WebMCP, listed on its site.", mark: "yes" },
      hyperframes: { text: "8 published skills in its README, with /hyperframes as the entry point.", mark: "yes" },
      vawe: { text: "bin/vawe CLI, skills for brief, page, transitions, critique and reference, and a critique by a session that did not write the page.", mark: "yes" },
    },
  ] as CompareRow[],
  time: [
    {
      name: "Remotion",
      text: "A video is a function of the frame number. The component calls useCurrentFrame() and useVideoConfig() for fps and durationInFrames, then returns what that frame shows.",
    },
    {
      name: "HyperFrames",
      text: "The engine requests each exact frame. The frame time is floor(frame) / fps in integer math, and the animation library is told to seek to it. Because time is never read live, the docs forbid the calls that read it.",
    },
    {
      name: "vawe",
      text: "The renderer sets the page time for every frame. A virtual clock owns Date, requestAnimationFrame, timers and Math.random, so a page may call them and still render the same frames in any order.",
    },
  ],
  stronger: [
    { name: "Remotion", items: ["The Player and the Studio: you can embed a video in a React app or edit it in a visual editor.", "Documented distributed rendering on AWS Lambda, where many functions render parts of the video and one stitches them.", "Size of the project: about 70,000 GitHub stars on 2026-11-03."] },
    { name: "HyperFrames", items: ["Apache-2.0 plus a Studio and desktop apps.", "More render targets in its own docs than vawe has.", "Size of the project: about 77,600 GitHub stars on 2026-11-03."] },
    { name: "vawe", items: ["Ordinary web code keeps working, because time is replaced and not forbidden.", `A library of ${MOVES.length} video components with a snippet for each.`, "Critique and judging by a session that did not write the page."] },
  ],
  faq: [
    {
      q: "Which is better, Remotion or HyperFrames?",
      a: "It depends on the team. Remotion fits a React team that needs a Player or Lambda rendering. HyperFrames and vawe fit a team that wants HTML. Remotion’s licence also asks a company of four or more to pay.",
    },
    {
      q: "Is HyperFrames a Remotion alternative?",
      a: "Yes. HyperFrames publishes a comparison guide and a skill named /remotion-to-hyperframes. Both are listed in its README. The authoring model differs: React for Remotion, HTML for HyperFrames.",
    },
    {
      q: "Can an AI agent use all three?",
      a: "Yes. Remotion lists Agent Skills, HyperFrames lists 8 skills, and vawe ships a CLI and skills. An agent can also write plain HTML for HyperFrames or vawe without a framework to learn.",
    },
    {
      q: "Do I need to avoid Date.now() and Math.random?",
      a: "In HyperFrames, yes: its determinism page forbids them in a composition. In vawe, no: a virtual clock replaces them. Remotion’s docs say Math.random() breaks at render and offer random(seed).",
    },
    {
      q: "Which one renders in the cloud?",
      a: "Remotion and HyperFrames both list AWS Lambda. HyperFrames' own guide also lists HeyGen cloud and Cloud Run. vawe renders on your machine only.",
    },
  ] as Qa[],
  sources: [
    { label: "Remotion site", url: "https://www.remotion.dev/" },
    { label: "Remotion fundamentals", url: "https://www.remotion.dev/docs/the-fundamentals" },
    { label: "Remotion render docs", url: "https://www.remotion.dev/docs/render" },
    { label: "Remotion randomness docs", url: "https://www.remotion.dev/docs/using-randomness" },
    { label: "Remotion Lambda docs", url: "https://www.remotion.dev/docs/lambda" },
    { label: "Remotion Cloud Run docs", url: "https://www.remotion.dev/docs/cloudrun" },
    { label: "Remotion Agent Skills docs", url: "https://www.remotion.dev/docs/ai/skills" },
    { label: "Remotion LICENSE.md", url: "https://raw.githubusercontent.com/remotion-dev/remotion/main/LICENSE.md" },
    { label: "Remotion licence and pricing", url: "https://www.remotion.pro/license" },
    { label: "Remotion on GitHub (stars, licence field)", url: "https://github.com/remotion-dev/remotion" },
    { label: "HyperFrames introduction", url: "https://hyperframes.heygen.com/introduction" },
    { label: "HyperFrames determinism", url: "https://hyperframes.heygen.com/concepts/determinism" },
    { label: "HyperFrames vs Remotion guide", url: "https://hyperframes.heygen.com/guides/hyperframes-vs-remotion.md" },
    { label: "HyperFrames README", url: "https://raw.githubusercontent.com/heygen-com/hyperframes/main/README.md" },
    { label: "HyperFrames on GitHub (stars)", url: "https://github.com/heygen-com/hyperframes" },
  ] as Source[],
  next: {
    title: "Try vawe on one page.",
    lead: ["Write a page, run one command, get an MP4."],
    primary: { href: "/docs/html-to-mp4-with-claude-code", label: "HTML to MP4 with Claude Code" },
    secondary: { href: REPO_URL, label: "Star vawe on GitHub" },
    related: [
      { href: "/vs/remotion", label: "vawe vs Remotion" },
      { href: "/vs/hyperframes", label: "vawe vs HyperFrames" },
      { href: "/vs/revideo", label: "vawe vs Revideo" },
      { href: "/remotion-alternatives", label: "Remotion alternatives, by category" },
      { href: "/determinism", label: "How vawe keeps renders deterministic" },
    ],
  } as NextBlock,
};
