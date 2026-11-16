import { REPO_URL } from "../schema";
import type { QA } from "./alt-evidence";
import type { Crumb, Link, Meta, NextBlock, Section, Table } from "./types";

export const SHOTSTACK_ALTERNATIVES = {
  path: "/shotstack-alternatives",
  meta: {
    title: "Shotstack alternatives: Creatomate, JSON2Video, vawe, Remotion",
    description:
      "Shotstack alternatives: hosted APIs (Creatomate, JSON2Video) and self-hosted engines (vawe, Remotion, HyperFrames, Revideo), with prices cited.",
  } as Meta,
  crumb: { group: "Compare", current: "Shotstack alternatives" } as Crumb,
  h1: "Shotstack alternatives.",
  lede: "Shotstack is a hosted video API: you send edit JSON, it renders in the cloud and returns a file. People look for an alternative for price, for a different API shape, or to run the renderer themselves. This page sorts the options into hosted APIs and self-hosted engines, and says when to stay on Shotstack.",
  note: "Every fact below was read on the linked page on 2026-11-16. Prices change: check the pricing page before you decide.",
  toc: [
    { href: "#table", label: "The table" },
    { href: "#shapes", label: "Hosted API or engine" },
    { href: "#creatomate", label: "Creatomate" },
    { href: "#json2video", label: "JSON2Video" },
    { href: "#engines", label: "Self-hosted engines" },
    { href: "#stay", label: "Stay on Shotstack" },
    { href: "#faq", label: "Questions" },
  ] as Link[],
  table: {
    title: "The comparison in one table.",
    lead: "Each cell comes from the source named in the section below it.",
    data: {
      head: ["tool", "kind", "you write", "price as listed", "self-hosted"],
      rows: [
        { cells: [["Shotstack"], ["hosted API"], ["edit JSON, or a template"], ["10 free credits; Starter $39/month for 250\u00a0minutes"], ["not mentioned on the pages read"]] },
        { cells: [["Creatomate"], ["hosted API"], ["a template, or RenderScript JSON"], ["50 free credits; Essential $45/month for 2,000 credits"], ["not mentioned on the pages read"]] },
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
          "A hosted API takes a request and returns a rendered file. You run no server and no browser. You pay per minute or per credit.",
        ],
      },
      {
        p: [
          "An engine is code you run. You install it, you render on your own machine or in your own cloud, and the output is yours. You pay for the compute and no one bills you per render.",
        ],
      },
      {
        p: [
          "Shotstack and Creatomate are the first kind. If your reason to leave is the bill or the vendor, another hosted API only moves the problem. An engine removes it, and adds a renderer for you to run.",
        ],
      },
    ],
    cite: "shotstack.io/docs/guide/, github.com/vawe-hq/vawe (README.md) · read 2026-11-16",
  } as Section,
  creatomate: {
    id: "creatomate",
    title: "Creatomate: a hosted API with a template editor.",
    blocks: [
      {
        p: [
          "Creatomate says it is built around its REST API: one request turns a template into a video or image, and code can also describe a whole video without a template. Its JSON format, RenderScript, has an output format (mp4, jpg, png or gif), a canvas size and an array of elements.",
        ],
      },
      {
        p: [
          "Plans are priced in credits: Essential $45/month for 2,000 credits, Growth $108/month for 10,000 to 40,000, Beyond $274/month for 50,000 to 200,000. A credit is one image, and a 30-second HD (720p) vertical video uses 6.91 credits. The free trial is 50 credits with no card. Finished files are kept for 30 days. The pages read do not mention self-hosting. See the ",
          { text: "Creatomate alternatives page", href: "/creatomate-alternatives" },
          ".",
        ],
      },
    ],
    cite: "creatomate.com, creatomate.com/pricing, creatomate.com/docs/json/introduction · read 2026-11-16",
  } as Section,
  json2video: {
    id: "json2video",
    title: "JSON2Video: a hosted API that bills by the second.",
    blocks: [
      {
        p: [
          "JSON2Video charges 1 credit per second of rendered video, including 4K. The free plan has 600 credits and no card, and its videos carry a watermark. Paid options: a one-time pack at $49.95 for 7,200 credits, and monthly plans from Hobby ($16.63/month on the yearly plan, 3,000 credits) to Startup ($99.95/month, 30,000 credits).",
        ],
      },
      {
        p: [
          "Every subscription lists a 30-minute maximum video length, and subscription credits expire each month. The pages read do not mention self-hosting.",
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
          " renders one HTML page to an H.264 mp4 in headless Chrome. It is Apache-2.0 and free for commercial use. You need Node 22 or newer, ffmpeg and Chrome. It has no hosted API, so you run it yourself.",
        ],
      },
      {
        p: [
          { strong: "Remotion" },
          " makes video from React components. It is free for an individual, a non-profit, a company that is only evaluating it, and a for-profit organization with up to 3 employees. A larger for-profit company needs a Company License.",
        ],
      },
      {
        p: [
          { strong: "HyperFrames" },
          " is Apache-2.0. A composition is an HTML file with data attributes, rendered by seeking each frame in headless Chrome and encoding with FFmpeg.",
        ],
      },
      {
        p: [
          { strong: "Revideo" },
          " is MIT-licensed and creates video in code. Renders run through ",
          { code: "renderVideo()" },
          " or a render endpoint, anywhere Node and a headless browser run, including Google Cloud Run.",
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
    title: "When to stay on Shotstack.",
    blocks: [
      {
        p: [
          "Stay if you want one vendor for the whole path. Its pages list an Edit API, a Studio editor, an open-source Studio SDK to embed an editor in your app, SDKs for Node.js, Python, PHP and Ruby, and apps for n8n, Make and Zapier. It also lists an Ingest API for footage and AI generation of video, images, voice and music.",
        ],
      },
      {
        p: [
          "Stay if you want a dev sandbox. The API docs name a stage environment next to the production one, with the same endpoints.",
        ],
      },
      {
        p: [
          "Stay if the bill is predictable at your volume. Its pricing page lists 250\u00a0minutes a month at $39 and 2,000\u00a0minutes at $199. Minutes roll over for 3 months on subscriptions.",
        ],
      },
      {
        p: [
          "Switch if you need the renderer on your own machine, a licence with no per-minute cost, or a video that an agent writes as code.",
        ],
      },
    ],
    cite: "shotstack.io, shotstack.io/pricing/, shotstack.io/docs/guide/, shotstack.io/docs/api/ · read 2026-11-16",
  } as Section,
  faq: [
    {
      q: "Is there a free Shotstack alternative?",
      a: ["Yes. vawe, HyperFrames and Revideo are open source and free to run. You pay for your own compute. Other hosted APIs have free tiers, but they are small."],
    },
    {
      q: "Can I self-host Shotstack?",
      a: ["The pages we read (home, pricing, guide and API reference) do not mention it. Ask Shotstack if you need to know."],
    },
    {
      q: "What is the closest alternative?",
      a: ["Creatomate and JSON2Video are hosted APIs with JSON input, like Shotstack. A credit or a minute means a different thing on each, so compare the price of the video you make, not the plan."],
    },
    {
      q: "Can I move my edit JSON?",
      a: ["Not directly. Each service has its own JSON format. In vawe the film is an HTML page, so an edit is rebuilt as a page."],
    },
    {
      q: "Can an AI agent write the video?",
      a: [
        "Yes, with either group. Shotstack lists an MCP server, a CLI and skills for agents. In vawe an agent writes a plain HTML page; see ",
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
      { href: "/creatomate-alternatives", label: "Creatomate alternatives" },
      { href: "/hyperframes-alternatives", label: "HyperFrames alternatives" },
      { href: "/programmatic-video-editing", label: "Programmatic video editing" },
      { href: "/remotion-alternatives#vs-remotion", label: "vawe vs Remotion" },
      { href: "/ai-agents", label: "How an agent writes and checks a film" },
    ],
  } as NextBlock,
};
