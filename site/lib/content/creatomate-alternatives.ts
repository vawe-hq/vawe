import { REPO_URL } from "../schema";
import type { QA } from "./alt-evidence";
import type { Crumb, Link, Meta, NextBlock, Section, Table } from "./types";

export const CREATOMATE_ALTERNATIVES = {
  path: "/creatomate-alternatives",
  meta: {
    title: "Creatomate alternatives: Shotstack, JSON2Video, vawe, Remotion",
    description:
      "Creatomate alternatives: hosted APIs (Shotstack, JSON2Video) and self-hosted engines (vawe, Remotion, HyperFrames, Revideo), with prices cited.",
  } as Meta,
  crumb: { group: "Compare", current: "Creatomate alternatives" } as Crumb,
  h1: "Creatomate alternatives.",
  lede: "Creatomate is a hosted video API with a template editor. People look for an alternative for price, for a different API, or to run the renderer themselves. This page sorts the options into hosted APIs and self-hosted engines, and says when to stay on Creatomate.",
  note: "Every fact below was read on the linked page on 2026-11-16. Prices change: check the pricing page before you decide.",
  toc: [
    { href: "#table", label: "The table" },
    { href: "#shapes", label: "Hosted API or engine" },
    { href: "#shotstack", label: "Shotstack" },
    { href: "#json2video", label: "JSON2Video" },
    { href: "#engines", label: "Self-hosted engines" },
    { href: "#stay", label: "Stay on Creatomate" },
    { href: "#faq", label: "Questions" },
  ] as Link[],
  table: {
    title: "The comparison in one table.",
    lead: "Each cell comes from the source named in the section below it.",
    data: {
      head: ["tool", "kind", "you write", "price as listed", "self-hosted"],
      rows: [
        { cells: [["Creatomate"], ["hosted API"], ["a template, or RenderScript JSON"], ["50 free credits; Essential $45/month for 2,000 credits"], ["not mentioned on the pages read"]] },
        { cells: [["Shotstack"], ["hosted API"], ["edit JSON, or a template"], ["10 free credits; Starter $39/month for 250\u00a0minutes"], ["not mentioned on the pages read"]] },
        { cells: [["JSON2Video"], ["hosted API"], ["JSON"], ["600 free credits, watermarked; Professional $49.95/month for 12,000 credits"], ["not mentioned on the pages read"]] },
        { vawe: true, cells: [["vawe"], ["engine"], ["one HTML page"], ["Apache-2.0, no paid tier"], ["yes"]] },
        { cells: [["Remotion"], ["engine"], ["React components"], ["free up to 3 employees in a for-profit company, a Company License above that"], ["yes"]] },
        { cells: [["HyperFrames"], ["engine"], ["HTML with data attributes"], ["Apache-2.0"], ["yes"]] },
        { cells: [["Revideo"], ["engine"], ["TypeScript scenes"], ["MIT"], ["yes"]] },
      ],
    } as Table,
  },
  shapes: {
    id: "shapes",
    title: "A hosted API or an engine you run.",
    blocks: [
      {
        p: [
          "A hosted API takes a request and returns a rendered file. You run no server and no browser. You pay per credit or per minute, and your files sit on the vendor’s storage for a while.",
        ],
      },
      {
        p: [
          "An engine is code you run. You install it, you render on your own machine or in your own cloud, and the output is yours. You pay for the compute and no one bills you per render.",
        ],
      },
      {
        p: [
          "The choice is mostly about running infrastructure, not about features. Settle that first, then compare tools inside the group.",
        ],
      },
    ],
    cite: "creatomate.com/docs/api/introduction, github.com/vawe-hq/vawe (README.md) · read 2026-11-16",
  } as Section,
  shotstack: {
    id: "shotstack",
    title: "Shotstack: a hosted API built on edit JSON.",
    blocks: [
      {
        p: [
          "Shotstack describes a video as an “edit”: clips, text, audio and effects on a timeline, in JSON. Its API renders the edit in the cloud and returns a video, image or audio file. Renders run in parallel and webhooks tell you when each is ready. A template is a saved edit with merge fields.",
        ],
      },
      {
        p: [
          "Its pricing page lists a $10 pay-as-you-go pack (50\u00a0minutes), Starter at $39/month (250\u00a0minutes), Pro at $99/month (750\u00a0minutes) with 4K, and Scale at $199/month (2,000\u00a0minutes). A free account gets 10 credits for 30 days. The page says rendering pauses when you run out of minutes.",
        ],
      },
      {
        p: [
          "For agents it lists an MCP server, a CLI and skills. Neither the home page nor the pricing page mentions self-hosting. See the ",
          { text: "Shotstack alternatives page", href: "/shotstack-alternatives" },
          " for the full list.",
        ],
      },
    ],
    cite: "shotstack.io, shotstack.io/pricing/, shotstack.io/docs/guide/ · read 2026-11-16",
  } as Section,
  json2video: {
    id: "json2video",
    title: "JSON2Video: a hosted API that bills by the second.",
    blocks: [
      {
        p: [
          "JSON2Video charges 1 credit per second of rendered video, including 4K. The free plan has 600 credits and no card, and its videos carry a watermark. Paid plans start with two one-time packs ($49.95 for 7,200 credits, $99.95 for 15,600) and monthly plans: Hobby at $16.63/month on the yearly plan, Professional at $49.95/month, Startup at $99.95/month.",
        ],
      },
      {
        p: [
          "Every subscription lists a 30-minute maximum video length. Subscription credits expire at the end of each month. The pages read do not mention self-hosting.",
        ],
      },
    ],
    cite: "json2video.com/pricing/ · read 2026-11-16",
  } as Section,
  engines: {
    id: "engines",
    title: "Self-hosted engines: vawe, Remotion, HyperFrames, Revideo.",
    blocks: [
      {
        p: [
          { strong: "vawe" },
          " renders one HTML page to an H.264 mp4 in headless Chrome. It is Apache-2.0 and free for commercial use. You need Node 22 or newer, ffmpeg and Chrome. It has no hosted API: you run it yourself, and there is no per-render fee. It is built so that a coding agent can write the page.",
        ],
      },
      {
        p: [
          { strong: "Remotion" },
          " makes video from React components. Its license is free for an individual, a non-profit, a company that is only evaluating it, and a for-profit organization with up to 3 employees. A larger for-profit company needs a Company License.",
        ],
      },
      {
        p: [
          { strong: "HyperFrames" },
          " is Apache-2.0. A composition is an HTML file with data attributes, and the renderer seeks each frame in headless Chrome and encodes it with FFmpeg.",
        ],
      },
      {
        p: [
          { strong: "Revideo" },
          " is MIT-licensed and creates video in code. Renders run through ",
          { code: "renderVideo()" },
          " or a render endpoint, and can run anywhere Node and a headless browser run, including Google Cloud Run.",
        ],
      },
      {
        p: [
          "Side by side: ",
          { text: "vawe vs Remotion", href: "/remotion-alternatives#vs-remotion" },
          ", ",
          { text: "vawe vs HyperFrames", href: "/hyperframes-alternatives#vs-hyperframes" },
          " and ",
          { text: "vawe vs Revideo", href: "/remotion-alternatives#vs-revideo" },
          ".",
        ],
      },
    ],
    cite: "README.md and LICENSE (this repo) · github.com/remotion-dev/remotion/blob/main/LICENSE.md · github.com/heygen-com/hyperframes · github.com/midrender/revideo · read 2026-11-16",
  } as Section,
  stay: {
    id: "stay",
    title: "When to stay on Creatomate.",
    blocks: [
      {
        p: [
          "Stay if non-developers edit templates. Creatomate describes itself as an editor made for automation: you build a template, mark the parts that change, and call the API from your app, a script or a workflow. It lists SDK examples for Node.js, Python, PHP and Ruby, an Embed and Preview SDK, and Zapier and Make guides.",
        ],
      },
      {
        p: [
          "Stay if you do not want to run a renderer. The cost is paid per credit. On its pricing page, a 30-second HD (720p) vertical video uses 6.91 credits, and the Essential plan ($45/month) has 2,000 credits. That is about 289 such videos a month, by our arithmetic. Finished files are kept for 30 days.",
        ],
      },
      {
        p: [
          "Switch if you need the renderer on your own machine, a licence with no per-render cost, or a video that an agent writes as code.",
        ],
      },
    ],
    cite: "creatomate.com, creatomate.com/pricing · read 2026-11-16",
  } as Section,
  faq: [
    {
      q: "Is there a free Creatomate alternative?",
      a: ["Yes. vawe, HyperFrames and Revideo are open source and free to run. You pay for your own compute. Hosted alternatives such as Shotstack and JSON2Video have free tiers, but they are small and limited."],
    },
    {
      q: "Can I self-host Creatomate?",
      a: ["The pages we read (home, pricing, API and JSON docs) do not mention it. Ask Creatomate if you need to know."],
    },
    {
      q: "What is the closest API alternative?",
      a: ["Shotstack. Both are REST APIs that render from JSON or a template. Compare the prices on each pricing page, because a credit means a different thing on each."],
    },
    {
      q: "Can I keep my templates?",
      a: ["Not directly. A Creatomate template or RenderScript file is its own format. vawe uses an HTML page, so a template would be rebuilt as a page."],
    },
    {
      q: "Can an AI agent write the video?",
      a: [
        "Yes, with either group. Shotstack lists an MCP server for agents. In vawe an agent writes a plain HTML page; see ",
        { text: "how an agent writes and checks a film", href: "/ai-agents" },
        ".",
      ],
    },
  ] as QA[],
  notCompared: {
    title: "What this page does not claim.",
    blocks: [
      {
        p: [
          "It gives no render-speed number and no opinion on output quality for any tool, because none of that was measured here. A fact that was not on the tool’s own pages is left out.",
        ],
      },
    ],
  } as Section,
  next: {
    title: "Read more.",
    primary: { href: "/remotion-alternatives", label: "Remotion alternatives" },
    secondary: { href: REPO_URL, label: "Star vawe on GitHub" },
    related: [
      { href: "/shotstack-alternatives", label: "Shotstack alternatives" },
      { href: "/hyperframes-alternatives", label: "HyperFrames alternatives" },
      { href: "/programmatic-video-editing", label: "Programmatic video editing" },
      { href: "/remotion-alternatives#vs-remotion", label: "vawe vs Remotion" },
      { href: "/ai-agents", label: "How an agent writes and checks a film" },
    ],
  } as NextBlock,
};
