import { REPO_URL } from "../schema";
import type { QA } from "./alt-evidence";
import type { Crumb, Link, Meta, NextBlock, Section, Table } from "./types";

export const REMOTION_ALTERNATIVES = {
  path: "/remotion-alternatives",
  meta: {
    title: "Remotion alternatives: vawe, HyperFrames, Revideo, Creatomate",
    description:
      "Remotion alternatives sorted into self-hosted engines (vawe, HyperFrames, Revideo) and hosted video APIs (Creatomate, JSON2Video, Shotstack), with Remotion’s 3-employee license rule quoted.",
  } as Meta,
  crumb: { group: "Compare", current: "Remotion alternatives" } as Crumb,
  h1: "Remotion alternatives, by category.",
  lede: "“Remotion alternative” returns two different products under one query: a hosted API you POST a JSON file to, and a self-hosted engine you run yourself. They solve different problems, so this page sorts the field first.",
  note: "Every claim below carries the page it was read on and the date. Most rows were read 2026-09-19. The Revideo and Creatomate rows were read 2026-11-03.",
  toc: [
    { href: "#table", label: "The table" },
    { href: "#shapes", label: "Two shapes" },
    { href: "#license", label: "Remotion’s license" },
    { href: "#revideo", label: "Revideo" },
    { href: "#creatomate", label: "Creatomate" },
    { href: "#faq", label: "Questions" },
  ] as Link[],
  table: {
    title: "The comparison in one row.",
    lead: "Every cell traces to a source cited on this page.",
    data: {
      head: ["project", "license", "self-hosted", "composition", "agent integration"],
      rows: [
        {
          vawe: true,
          cells: [
            ["vawe"],
            ["Apache-2.0, no size clause"],
            ["yes"],
            ["one HTML page: CSS, Web Animations, SVG, canvas, three.js"],
            ["CLI and skills (", { code: "bin/vawe" }, ", ", { code: "skills/" }, ")"],
          ],
        },
        { cells: [["Remotion"], ["free ≤3 employees, paid above"], ["yes"], ["React"], ["Agent Skills (remotion.dev/docs/ai/skills)"]] },
        { cells: [["HyperFrames"], ["Apache-2.0, no size clause"], ["yes"], ["HTML, CSS, GSAP"], ["agent-native, per its own docs"]] },
        { cells: [["Revideo"], ["MIT"], ["yes"], ["TypeScript generator functions"], ["GitHub page says Claude or Codex can generate a scene"]] },
        { cells: [["JSON2Video"], ["free tier + paid credits"], ["no, hosted only"], ["JSON to a template API"], ["not publicly stated"]] },
        { cells: [["Creatomate"], ["50 free trial credits, then paid credit plans"], ["not stated on the pages read; plans are priced in credits and storage"], ["templates or RenderScript JSON"], ["not stated on the pages read"]] },
      ],
    } as Table,
  },
  shapes: {
    id: "shapes",
    title: "Two shapes of tool.",
    blocks: [
      {
        p: [
          { strong: "Hosted JSON video APIs" },
          " (JSON2Video, Shotstack) take a JSON request over HTTPS and hand back a rendered file: no server to run, no Chrome to manage, billed by the minute or by credits. ",
          { strong: "Self-hosted rendering engines" },
          " (Remotion, HyperFrames, Revideo, vawe) are code you run: a composition format, a headless-browser render step, output you own end to end. A team choosing between JSON2Video and vawe is not really choosing an alternative, it is choosing whether to run infrastructure at all.",
        ],
      },
    ],
    cite: "json2video.com, shotstack.io (hosted) · github.com/remotion-dev/remotion, github.com/heygen-com/hyperframes (self-hosted) · read 2026-09-19",
  } as Section,
  license: {
    id: "license",
    title: "Remotion’s own license, quoted directly.",
    blocks: [
      {
        p: [
          "Remotion’s ",
          { code: "LICENSE.md" },
          " grants a free license to an individual, a non-profit, a company still evaluating the software, or “a for-profit organization with up to 3 employees.” A for-profit company past three employees needs a paid Company License to use it. That threshold is the single most common reason a team searches for a Remotion alternative in the first place: it is not a limitation of the software, it is a term of the license.",
        ],
      },
    ],
    cite: "github.com/remotion-dev/remotion/blob/main/LICENSE.md · read 2026-09-19",
    code: {
      label: "remotion license.md",
      text: `free:
  individual
  non-profit
  evaluating the software
  for-profit, up to 3 employees
paid "Company License":
  for-profit, 4+ employees`,
    },
  } as Section,
  selfHosted: {
    title: "vawe and HyperFrames are the free self-hosted ones, with Revideo in the same group.",
    blocks: [
      {
        p: [
          "vawe ships under Apache-2.0 with no company-size clause and no paid tier. A film is one HTML page. HyperFrames (HeyGen) is also Apache-2.0 and composes from HTML with data attributes. Each has its own side-by-side page: ",
          { text: "vawe vs Remotion", href: "/vs/remotion" },
          " and ",
          { text: "vawe vs HyperFrames", href: "/vs/hyperframes" },
          ". For all three at once, see ",
          { text: "Remotion vs HyperFrames vs vawe", href: "/compare/remotion-vs-hyperframes" },
          ".",
        ],
      },
    ],
    cite: "LICENSE and package.json (this repo) · github.com/heygen-com/hyperframes · read 2026-09-19",
  } as Section,
  revideo: {
    id: "revideo",
    title: "Revideo: MIT-licensed TypeScript scenes.",
    blocks: [
      {
        p: [
          "Revideo describes itself as a rendering engine for creating videos in code. A scene is a TypeScript generator function; ",
          { code: "renderVideo()" },
          " or a render endpoint makes the file, and renders can be split across workers or run on serverless platforms such as Google Cloud Run. The repository is MIT-licensed and was not archived on 2026-11-03: the last commit on main was dated 2026-07-15, and the latest tag was v0.11.0. Its README calls it the engine behind Midrender, and the old docs address now redirects to the Midrender site. See ",
          { text: "vawe vs Revideo", href: "/vs/revideo" },
          ".",
        ],
      },
    ],
    cite: "github.com/midrender/revideo, midrender.com/revideo/docs · read 2026-11-03",
  } as Section,
  creatomate: {
    id: "creatomate",
    title: "Creatomate: a hosted REST API with templates.",
    blocks: [
      {
        p: [
          "Creatomate’s docs say it is built around its REST API: one request turns a template into a video or image, and code can also describe a whole video without a template. Its JSON format, RenderScript, holds the output format, the canvas size and an array of elements, and the service renders MP4, PNG, JPEG or GIF. The pricing page lists credit plans (Essential 2,000 credits, Growth 10,000 to 40,000, Beyond 50,000 to 200,000) and a free trial of 50 credits with no card. The page text read for this site showed no monthly prices, so none are given here, and the pages read do not say whether the API can be self-hosted.",
        ],
      },
    ],
    cite: "creatomate.com/docs/api/introduction, creatomate.com/docs/json/introduction, creatomate.com/pricing · read 2026-11-03",
  } as Section,
  json2video: {
    title: "JSON2Video: a hosted API, priced by the minute.",
    blocks: [
      {
        p: [
          "JSON2Video’s public pricing page offers a free plan (600 credits, no card required), then subscriptions starting at $16.95/month for 3,000 credits and up to 50 minutes of rendered output, rising to $99.95/month for 30,000 credits. It is a reasonable choice for a team that wants zero infrastructure and does not need a custom effect vocabulary: the tradeoff is a running bill per minute rendered, and no self-hosting option on that page.",
        ],
      },
    ],
    cite: "json2video.com/pricing · read 2026-09-19",
  } as Section,
  faq: [
    {
      q: "Is there a free Remotion alternative for a company with more than three employees?",
      a: ["Yes. vawe and HyperFrames both ship under Apache-2.0, with no company-size clause and no paid tier. Remotion’s own license asks a for-profit company past three employees for a paid Company License."],
    },
    {
      q: "Can I keep my React components?",
      a: ["Not with vawe. A vawe film is one HTML page with CSS, Web Animations, SVG, canvas or three.js. If your team already writes video as React components, Remotion is the tool built for that, and the license question is the one to settle."],
    },
    {
      q: "Do I have to run servers?",
      a: ["With a self-hosted engine you run the render yourself: vawe drives headless Chrome and encodes with ffmpeg on your machine. A hosted API such as JSON2Video or Shotstack runs the render for you and bills per minute or per credit."],
    },
    {
      q: "Will the same input give the same video every time?",
      a: [
        "In vawe, yes: a virtual clock owns time and randomness, and the renderer seeks each frame. How we measured it, and the six sources of drift we fixed, are in ",
        { text: "deterministic rendering in headless Chrome", href: "/blog/determinism" },
        ".",
      ],
    },
    {
      q: "Can an AI agent write the video?",
      a: [
        "Yes. Any coding agent can write an HTML page, and vawe ships a CLI and skills for the loop. Our notes on ",
        { text: "building the harness for the weaker model", href: "/blog/weaker-model" },
        " show where agents still fail.",
      ],
    },
  ] as QA[],
  notCompared: {
    title: "Not publicly compared: everything neither project documents.",
    blocks: [
      {
        p: [
          "This page does not state a render-speed number, a reliability figure, or an output-quality opinion for any competitor, because none of that is published anywhere citable. Where a fact was not found on the project’s own site, it is left out rather than guessed. If one of the facts above has changed, the source it was read from is linked above so it can be checked again.",
        ],
      },
    ],
  } as Section,
  next: {
    title: "Compare vawe with one tool.",
    primary: { href: "/vs/remotion", label: "vawe vs Remotion" },
    secondary: { href: REPO_URL, label: "Star vawe on GitHub" },
    related: [
      { href: "/hyperframes-alternatives", label: "HyperFrames alternatives" },
      { href: "/compare/remotion-vs-hyperframes", label: "Remotion vs HyperFrames vs vawe" },
      { href: "/vs/revideo", label: "vawe vs Revideo" },
      { href: "/blog/claude-code-remotion-or-html", label: "Claude Code with Remotion or plain HTML" },
      { href: "/blog/programmatic-video-javascript", label: "Six JavaScript video tools compared" },
      { href: "/determinism", label: "Why the same page always renders the same frames" },
      { href: "/ai-agents", label: "How an agent writes and checks a film" },
      { href: "/when-determinism-matters", label: "When determinism is the reason to pick an engine" },
      { href: "/blog/page-contract", label: "How vawe renders HTML to video" },
    ],
  } as NextBlock,
};
