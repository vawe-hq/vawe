import { REPO_URL } from "../schema";
import { INSPIRATION, INSPIRATION_PATH, titleOf } from "../inspiration";
import { LAUNCH_VIDEO } from "./launch-video";
import type { Crumb, Link, Meta, NextBlock, Section } from "./types";
import type { FaqItem } from "../faq";

// /product-showcase-video and /explainer-video: two use-case pages beside /launch-video, built from
// guides/ROUTING.md (rows 2 and 4), prompts/brand-launch-from-url.md, prompts/story-explainer.md and
// prompts/moves/RECIPES.md. Each fact below has its source in the `cite` line of its section.

export type Example = { href: string; title: string; by: string };

export type VideoTypePage = {
  path: string;
  meta: Meta;
  crumb: Crumb;
  h1: string;
  lede: string;
  toc: Link[];
  contains: Section;
  timing: Section;
  examples: { title: string; lead: string; items: Example[]; all: Link };
  moves: { title: string; lead: string; clips: string[] };
  make: Section;
  faq: FaqItem[];
  next: NextBlock;
};

function example(id: string): Example {
  const post = INSPIRATION.find((p) => p.id === id);
  if (!post) throw new Error(`inspiration post ${id} is gone: pick another for the video type pages`);
  return { href: post.url, title: titleOf(post), by: `@${post.creator.handle}` };
}

export const SHOWCASE_PATH = "/product-showcase-video";
export const EXPLAINER_PATH = "/explainer-video";

const showcaseLink: Link = { href: SHOWCASE_PATH, label: "Product showcase videos" };
const explainerLink: Link = { href: EXPLAINER_PATH, label: "Explainer videos" };
const launchLink: Link = { href: LAUNCH_VIDEO.path, label: "Product launch videos" };

export const VIDEO_FAMILY: Link[] = [launchLink, showcaseLink, explainerLink];

const tocFor = (hasExamples = true): Link[] => [
  { href: "#contains", label: "What it contains" },
  { href: "#timing", label: "Timing" },
  ...(hasExamples ? [{ href: "#examples", label: "Examples" }] : []),
  { href: "#moves", label: "Video components" },
  { href: "#make", label: "Make one" },
  { href: "#faq", label: "Questions" },
];

export const PRODUCT_SHOWCASE: VideoTypePage = {
  path: SHOWCASE_PATH,
  meta: {
    title: "Product showcase video: make one with code | vawe",
    description:
      "A product showcase video shows the real product doing real things, one feature per beat. The beats, the timing, the exact vawe commands, and examples.",
  },
  crumb: { group: "Learn", current: "Product showcase video" },
  h1: "Product showcase video, made with code.",
  lede: "A product showcase video shows your real product doing real things, one feature at a time, in about 20 seconds. With vawe you capture the real screens from a URL, write one HTML page, and render it to an mp4. You can write the page yourself or let an AI agent write it.",
  toc: tocFor(),
  contains: {
    id: "contains",
    title: "What a showcase video contains.",
    blocks: [
      {
        p: [
          "The repo’s feature tour is the showcase shape: one canvas, four screens of the product, and a camera that moves from one to the next. Four features read as one product and not as four slides. The beats, in order:",
        ],
      },
      {
        ol: [
          ["Screen one is a real capture on the first frame. A cursor presses one real button, and the done state stays on screen to 3.5 s."],
          ["The camera pans right to screen two. A card builds on it and holds to 7.5 s."],
          ["The camera pans up and to the right to screen three. Another press, and the result stays on screen to 11.5 s."],
          ["The camera pans down to screen four, then 1.4 s of quiet."],
          ["The big moment: the cursor lands on a status, the camera scales in on it, and it holds to 16.3 s."],
          ["The world leaves up in 0.22 s. The brand name settles from 16.7 s, and the lockup holds still to 20 s."],
        ],
      },
      { p: ["Every screen is a capture of your real site or app, never a placeholder card. A feature you did not see on the site is a feature the film must not show."] },
    ],
    cite: "prompts/moves/RECIPES.md, recipe 11 (Feature tour, 20 s) · prompts/brand-launch-from-url.md",
  },
  timing: {
    id: "timing",
    title: "Timing: 20 seconds is the norm, 9 to 40 is the range.",
    blocks: [
      {
        p: [
          "A brand or product film runs 9 to 40 seconds. Under 15 seconds, most film types are one continuous action instead. The feature tour above is 20 seconds.",
        ],
      },
      {
        p: [
          "Each read holds 1.2 seconds or more, so a viewer can read a screen before the camera leaves it. Exits are quick (0.22 s). Entrances are slower (0.6 s or more). Neighbouring cuts change axis or direction, so three slides to the left in a row do not happen.",
        ],
      },
    ],
    cite: "prompts/brand-launch-from-url.md, Length · guides/ROUTING.md · prompts/moves/RECIPES.md, Complete videos",
  },
  examples: {
    title: "Examples.",
    lead: "Posts from the inspiration wall that show a product on screen. Each links to the creator’s post on X.",
    items: [
      example("2103273003555402193"),
      example("2102554209166000267"),
      example("2106426962738880879"),
    ],
    all: { href: INSPIRATION_PATH, label: "All motion video inspiration" },
  },
  moves: {
    title: "The video components a showcase is built from.",
    lead: "A pan from screen to screen, a press that does its job, a zoom to one status, a card that builds. Open one for its clip, snippet and notes.",
    clips: ["pan-stations", "cursor-click", "ui-focus-zoom", "card-assemble"],
  },
  make: {
    id: "make",
    title: "Make one with vawe.",
    blocks: [
      {
        p: [
          "Start from your product’s URL. The first command writes a starter page and a brief, and saves screenshots of the site in the film’s assets folder. Then draft, review and render, in this order.",
        ],
      },
      {
        ol: [
          [{ code: "bin/vawe frame <page> --world all" }, " gives one key frame per beat to check before any motion."],
          [{ code: "bin/vawe dev <page>" }, " renders a half-size draft with sound."],
          [{ code: "bin/vawe critique <page> --fresh" }, " asks a separate session to review the draft, then you fix the seconds it names."],
          ["You approve the plan and the full draft. Then ", { code: "bin/vawe ship <page>" }, " renders the final film."],
        ],
      },
      {
        p: [
          "For a real page worked by a cursor, add a steps file and ",
          { code: "--tour" },
          ": vawe drives the page with real mouse events and writes one mp4 to use inside the film.",
        ],
      },
    ],
    cite: "AGENTS.md, The loop · bin/vawe new --help · prompts/brand-launch-from-url.md, Build",
    code: {
      label: "Terminal",
      text: `bin/vawe new acme-showcase \\
  --request "a product showcase for acme" \\
  --from-url https://acme.com --full
bin/vawe frame films/acme-showcase/page.html \\
  --world all
bin/vawe dev films/acme-showcase/page.html`,
    },
  },
  faq: [
    {
      q: "How long should a product showcase video be?",
      a: ["The repo’s feature tour is 20 seconds. A brand or product film runs 9 to 40 seconds."],
    },
    {
      q: "Can I use my real product screens?",
      a: [
        "Yes, and you should. The template allows real captures only, and ",
        { code: "bin/vawe new --from-url <url>" },
        " saves the screenshots of your site for the film. Its own palette, fonts and favicon are read from the site, and nothing else is used.",
      ],
    },
    {
      q: "What if the product has no site yet?",
      a: ["Then it is not a showcase of a real product. An invented product with nothing real to capture takes the beat-sheet template and the launch chain from the recipes, not the brand-launch template."],
    },
    {
      q: "Can an AI agent make it?",
      a: [
        "Yes. A film is one HTML page, so any coding agent can write it, and vawe ships skills for the loop. The person approves the plan and the full draft. See ",
        { text: "vawe for AI agents", href: "/ai-agents" },
        ".",
      ],
    },
    {
      q: "Which screen shapes does it support?",
      a: ["16:9, 9:16, 1:1, 4:5 and 4:3, and any other whole ratio with the --aspect flag on a render command. The page never crops: it lays out for the shape."],
    },
  ],
  next: {
    title: "Make your showcase.",
    lead: [
      "Run ",
      { code: "bin/vawe new" },
      " with your product’s URL. For a first look at what a finished film is, see the product launch guide.",
    ],
    primary: { href: REPO_URL, label: "Get vawe on GitHub" },
    related: [launchLink, explainerLink, { href: "/video-components", label: "Every video component, with its clip" }],
  },
};

export const EXPLAINER: VideoTypePage = {
  path: EXPLAINER_PATH,
  meta: {
    title: "Explainer video: make one with code | vawe",
    description:
      "An explainer video teaches one topic with visuals that build on screen and sell nothing. Scene by scene, the timing, the exact vawe commands, and examples.",
  },
  crumb: { group: "Learn", current: "Explainer video" },
  h1: "Explainer video, made with code.",
  lede: "An explainer video teaches one topic, paper or process with visuals that build on screen, and it sells nothing. With vawe you list the facts first, plan one idea per scene, and write one HTML page that renders to an mp4. Captions can carry the words, or you can add a voice.",
  toc: tocFor(),
  contains: {
    id: "contains",
    title: "What an explainer contains.",
    blocks: [
      {
        p: ["Two lists come before any picture, and you check both. Then the scenes follow the list."],
      },
      {
        ol: [
          ["A facts list. Every claim the film makes, with its source. Formulas, dates, numbers and names are copied, never reworded. You check this list before anything is drawn."],
          ["A scene list. For each scene: its time, the one sentence the viewer takes away, what builds on screen, and the transition out."],
          ["One idea per scene, and each scene has one thing that changes. A diagram builds, a number counts, a process fills from empty to complete."],
          ["Short captions, one line each. Type is for labels and one sentence per scene, never paragraphs."],
          ["One palette for the whole film, and one accent for the thing being explained right now."],
        ],
      },
      { p: ["Not allowed: a slide with bullets, a stock icon grid, a scene where nothing moves."] },
    ],
    cite: "prompts/story-explainer.md, facts, direction, structure",
  },
  timing: {
    id: "timing",
    title: "Timing: 9 seconds to 3 minutes.",
    blocks: [
      {
        p: [
          "An explainer runs from 9 seconds to 3 minutes. The default is 30 seconds in 16:9, with three takeaways and one scene for each. Over 60 seconds, or over one working session, use the director’s brief instead. Under 15 seconds, a process that fills from empty to complete is one continuous action.",
        ],
      },
      {
        p: [
          "If there is a voice, every scene starts on a word boundary from a timings file, not on a guess. A diagram that finishes building in 300 ms was not seen, so give it time.",
        ],
      },
    ],
    cite: "prompts/story-explainer.md, Length, Questions, gotchas · guides/ROUTING.md, row 6",
  },
  examples: {
    title: "Examples.",
    lead: "Explainers on the inspiration wall, made with AI. Each links to the creator’s post on X.",
    items: [
      example("2102853258582880547"),
      example("2102591147927654847"),
      example("2104094723887501736"),
      example("2103683057689522564"),
    ],
    all: { href: INSPIRATION_PATH, label: "All motion video inspiration" },
  },
  moves: {
    title: "The video components an explainer is built from.",
    lead: "A chart that builds, a number that counts to its sourced value, captions that replace each other line by line, a before and after. Open one for its clip, snippet and notes.",
    clips: ["chart-build", "count-up", "caption-editorial", "before-after-wipe"],
  },
  make: {
    id: "make",
    title: "Make one with vawe.",
    blocks: [
      {
        p: [
          "Start from the explainer template. Diagrams are SVG inside the page, and their build is CSS animation, so a line can draw itself. Numbers count with a table of values over time, so the count is the same on every render.",
        ],
      },
      {
        ol: [
          ["Write the facts list and stop. Then write the scene list and stop. Then write code."],
          [{ code: "bin/vawe dev <page>" }, " renders a half-size draft with sound."],
          [{ code: "bin/vawe critique <page> --fresh" }, " asks a separate session to review the draft, then you fix the seconds it names."],
          ["You approve the full draft. Then ", { code: "bin/vawe ship <page>" }, " renders the final film."],
        ],
      },
    ],
    cite: "prompts/story-explainer.md, build and start · AGENTS.md, The loop · bin/vawe new --help",
    code: {
      label: "Terminal",
      text: `bin/vawe new how-it-works \\
  --from prompts/story-explainer.md --length 30
bin/vawe dev films/how-it-works/page.html`,
    },
  },
  faq: [
    {
      q: "How long should an explainer video be?",
      a: ["From 9 seconds to 3 minutes. The default is 30 seconds. Over 60 seconds, the director’s brief takes over."],
    },
    {
      q: "Do I need a voiceover?",
      a: ["No. The default is captions only. You can add a voice from a recorded file or a text-to-speech voice with a timings file. The model cannot hear the voice it rendered, so a person should listen once for pronunciation."],
    },
    {
      q: "How do I keep the facts right?",
      a: ["Write the facts list first, with a source for each claim, and check it before any drawing. A number that counts up ends on the sourced value, not a rounded one."],
    },
    {
      q: "Is this the same as a product launch video?",
      a: [
        "No. An explainer teaches and sells nothing. If a real product is behind the data and the ask is to market it, the film is a launch video. See ",
        { text: "product launch videos", href: LAUNCH_VIDEO.path },
        ".",
      ],
    },
    {
      q: "Can an AI agent make it?",
      a: [
        "Yes. A film is one HTML page, so any coding agent can write it, and vawe ships skills for the loop. See ",
        { text: "vawe for AI agents", href: "/ai-agents" },
        ".",
      ],
    },
  ],
  next: {
    title: "Make your explainer.",
    lead: ["Run ", { code: "bin/vawe new" }, " with the explainer template, then write the facts list first."],
    primary: { href: REPO_URL, label: "Get vawe on GitHub" },
    related: [launchLink, showcaseLink, { href: "/video-components", label: "Every video component, with its clip" }],
  },
};
