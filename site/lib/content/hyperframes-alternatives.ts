import { REPO_URL } from "../schema";
import type { QA } from "./alt-evidence";
import type { Crumb, Link, Meta, NextBlock, Table } from "./types";

export const HYPERFRAMES_ALTERNATIVES = {
  path: "/hyperframes-alternatives",
  meta: {
    title: "HyperFrames alternatives: vawe, Remotion, Motion Canvas",
    description:
      "HyperFrames alternatives: vawe, Remotion, Motion Canvas and Lottie, compared by how you author each, its licence and the job it fits, in one table.",
  } as Meta,
  crumb: { group: "Compare", current: "HyperFrames alternatives" } as Crumb,
  h1: "HyperFrames alternatives.",
  lede: "HyperFrames is HeyGen’s open-source framework that turns HTML, CSS and seekable animations into MP4. People look for an alternative for an authoring model, a determinism rule or a different job. Four tools are worth a look. Each has its own comparison page.",
  note: "Read 2026-10-03.",
  toc: [
    { href: "#table", label: "The table" },
    { href: "#alternatives", label: "Four alternatives" },
    { href: "#faq", label: "Questions" },
    { href: "#stay", label: "Stay on HyperFrames" },
  ] as Link[],
  table: {
    title: "The short table.",
    data: {
      head: ["tool", "authoring", "licence", "output"],
      rows: [
        { cells: [["HyperFrames"], ["HTML with data attributes"], ["Apache-2.0"], ["MP4"]] },
        { vawe: true, cells: [["vawe"], ["One HTML page"], ["Apache-2.0"], ["MP4"]] },
        { cells: [["Remotion"], ["React components"], ["Source-available, free up to 3 employees"], ["MP4"]] },
        { cells: [["Motion Canvas"], ["TypeScript generators"], ["MIT"], ["Image sequence or MP4"]] },
        { cells: [["Lottie"], ["JSON from After Effects"], ["MIT players"], ["Playback in apps"]] },
      ],
    } as Table,
  },
  alternatives: [
    {
      name: "vawe",
      href: "/vs/hyperframes",
      cta: "vawe vs HyperFrames",
      body: "The closest peer. Both are Apache-2.0, both drive headless Chrome, and both aim at an agent that writes the file. vawe takes timing from CSS keyframes, element.animate() or a seek(t) function, and replaces Date, timers and Math.random with versions that follow the seek. HyperFrames forbids those calls instead.",
    },
    {
      name: "Remotion",
      href: "/vs/remotion",
      cta: "vawe vs Remotion",
      body: "Video from React components, with a Studio editor and distributed rendering on AWS Lambda and Cloud Run. Its licence is free up to 3 employees in a for-profit company. It publishes Agent Skills for coding agents.",
    },
    {
      name: "Motion Canvas",
      href: "/vs/motion-canvas",
      cta: "vawe vs Motion Canvas",
      body: "A TypeScript library for vector animation, written as generator functions, with a real-time editor. MIT licence. It fits diagram and explainer animation synced to a voice-over.",
    },
    {
      name: "Lottie",
      href: "/vs/lottie",
      cta: "vawe vs Lottie",
      body: "A JSON format for vector animation, exported from After Effects and played inside apps. It is a playback format, not an MP4 renderer. Pick it for animated icons and loaders in a product.",
    },
  ],
  faq: [
    {
      q: "What is the main difference between vawe and HyperFrames?",
      a: [
        "How each handles time. HyperFrames forbids ",
        { code: "Date" },
        ", timers and ",
        { code: "Math.random" },
        " in a composition. vawe lets a page call them and replaces them with versions that follow the seek; ",
        { text: "the virtual clock reference", href: "/blog/page-clock" },
        " lists what it owns.",
      ],
    },
    {
      q: "Which one renders faster?",
      a: [
        "Neither project publishes a side-by-side number, so we do not claim one. vawe’s own figure: capture of a 20 s film fell from 140 s to 47 s with one Chrome per lane, in ",
        { text: "faster headless Chrome rendering", href: "/blog/fast-drafts" },
        ".",
      ],
    },
    {
      q: "Which is better for an AI agent?",
      a: [
        "Both aim at an agent that writes the file. vawe’s film is one plain HTML page with no private attributes to learn; the rules are in ",
        { text: "render HTML to video: the page contract", href: "/blog/page-contract" },
        ". HyperFrames ships 21 agent skills and a block catalog.",
      ],
    },
    {
      q: "Is Lottie an alternative if I need an MP4?",
      a: ["Not directly. Lottie is a playback format for apps, exported from After Effects. Pick one of the HTML-to-video tools when the output is a video file."],
    },
  ] as QA[],
  stay: {
    title: "When to stay on HyperFrames.",
    body: "HyperFrames has a Studio browser editor, a catalog of reusable blocks, 21 agent skills, and cloud rendering on Lambda, Cloud Run and HeyGen. If you want those, stay. The HyperFrames comparison page lists them with sources.",
    sources: [
      { href: "https://github.com/heygen-com/hyperframes", label: "HyperFrames README" },
      { href: "https://hyperframes.heygen.com/introduction", label: "HyperFrames introduction" },
    ] as Link[],
  },
  next: {
    title: "Compare vawe with HyperFrames.",
    primary: { href: "/vs/hyperframes", label: "vawe vs HyperFrames" },
    secondary: { href: REPO_URL, label: "Star vawe on GitHub" },
    related: [
      { href: "/remotion-alternatives", label: "Remotion alternatives, categorized" },
      { href: "/determinism", label: "How vawe keeps renders deterministic" },
      { href: "/ai-agents", label: "How an agent writes and checks a film" },
      { href: "/blog/page-contract", label: "How vawe renders HTML to video" },
      { href: "/blog/programmatic-video-javascript", label: "Six JavaScript video tools compared" },
    ],
  } as NextBlock,
};
