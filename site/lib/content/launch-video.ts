import { REPO_URL } from "../schema";
import type { Crumb, Link, Meta, NextBlock, Section } from "./types";

export const LAUNCH_VIDEO = {
  path: "/launch-video",
  meta: {
    title: "Make a product launch video with code | vawe",
    description:
      "How Vawe builds a product launch video: real captured UI, not invented mockups, one message per beat, from the site’s own palette and type.",
  } as Meta,
  crumb: { group: "Learn", current: "Launch video" } as Crumb,
  h1: "A product launch video, built from the real site.",
  lede: "A launch film is built from CAPTURE: the real UI, the real logo and the real palette of the product, carried into motion. The film reflects the site and never redesigns it.",
  toc: [
    { href: "#route", label: "The route" },
    { href: "#beats", label: "The beats" },
    { href: "#moves", label: "The video components" },
    { href: "#invent", label: "What not to invent" },
    { href: "#family", label: "Other video types" },
  ] as Link[],
  route: {
    id: "route",
    title: "The route: market a real product, from a URL.",
    blocks: [
      {
        p: [
          "The engine’s own routing table sends a request to “market or show a real product, company or site from a URL” to the brand-launch template, ahead of an explainer, a UI morph or a music video. Only a reference rebuild, where a film must match an existing video, ranks above it.",
        ],
      },
    ],
    cite: "guides/ROUTING.md, row 2",
  } as Section,
  beats: {
    id: "beats",
    title: "One message per beat, 15 to 40 seconds.",
    blocks: [
      {
        p: [
          "The beat list comes first, each beat with a timestamp, one message and the real capture that proves it. The hook is the promise, under 12 words on the first frame. Then one video component per beat:",
        ],
      },
      {
        ol: [
          ["The hook word becomes the product."],
          ["A cursor does one real thing."],
          ["The key output lands big."],
          ["A second surface."],
          ["A stat you can source."],
          ["The wordmark."],
        ],
      },
      { p: ["Under 15 seconds, a launch film is one continuous action instead."] },
    ],
    cite: "prompts/brand-launch-from-url.md",
  } as Section,
  moves: {
    title: "The video components a launch film is built from.",
    lead: "A click doing its job, a zoom to one part of the UI, a number proved, the product handed to the brand. Open a video component for its snippet and notes.",
    clips: ["cursor-click", "ui-focus-zoom", "count-up", "ui-strip-away"],
  },
  invent: {
    id: "invent",
    title: "What a launch film may not invent.",
    blocks: [
      {
        p: [
          "Every screen in the film is a capture of the real site or app, cropped, never a placeholder card. The palette, fonts and favicon come from a kit read off the site itself, and nothing else is used. A feature you did not see on the site is a feature the film must not show, so crawl past the homepage: the feature worth showing is often one click past the hero.",
        ],
      },
    ],
    cite: "prompts/brand-launch-from-url.md · scripts/brand/kit.mjs",
  } as Section,
  family: {
    id: "family",
    title: "Two other videos from the same page of code.",
    blocks: [
      {
        p: [
          "A launch film announces the product. To show how the product works, one feature at a time, read ",
          { text: "product showcase videos", href: "/product-showcase-video" },
          ". To teach a topic and sell nothing, read ",
          { text: "explainer videos", href: "/explainer-video" },
          ". The routing table picks between them: a real product from a URL is a launch or a showcase, and a topic with nothing sold is an explainer.",
        ],
      },
    ],
    cite: "guides/ROUTING.md, rows 2 and 4",
  } as Section,
  next: {
    title: "Start from the launch template.",
    lead: [
      { code: "bin/vawe new" },
      " starts from the brand-launch template unless you name another: a starter page and a brief whose questions each carry a default.",
    ],
    primary: { href: REPO_URL, label: "Start a launch film" },
    related: [
      { href: "/video-components", label: "Every video component, with its clip" },
      { href: "/ai-agents", label: "Let an agent write the film" },
    ],
  } as NextBlock,
};
