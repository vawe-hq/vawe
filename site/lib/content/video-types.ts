import { REPO_URL } from "../schema";
import { INSPIRATION, INSPIRATION_PATH, titleOf } from "../inspiration";
import { LAUNCH_VIDEO } from "./launch-video";
import type { Crumb, Link, Meta, NextBlock, Section } from "./types";
import type { FaqItem } from "../faq";

// /product-showcase-video and /explainer-video: two use-case pages beside /launch-video, built from
// guides/ROUTING.md (rows 2 and 4), prompts/brand-launch-from-url.md, prompts/story-explainer.md and
// prompts/moves/RECIPES.md.

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
      "A product showcase video shows the real product doing real things, one feature at a time. The parts, the timing, the exact vawe commands, and examples.",
  },
  crumb: { group: "Learn", current: "Product showcase video" },
  h1: "Product showcase video, made with code.",
  lede: "A product showcase video shows your real product doing real things, one feature at a time, in about 20\u00a0seconds. With vawe you capture the real screens from a URL, write one HTML page, and render it to an mp4. You can write the page yourself or ask a coding agent to write it.",
  toc: tocFor(),
  contains: {
    id: "contains",
    title: "What a showcase video contains.",
    columns: true,
    blocks: [
      {
        p: [
          "A good showcase is one canvas with four screens of the product and a camera that moves from one to the next. Four features then read as one product, not four slides. Here are the parts, in order:",
        ],
      },
      {
        ol: [
          ["Screen one is a real capture from the first frame. A cursor presses one real button, and the done state stays until 3.5\u00a0s."],
          ["The camera pans right to screen two. A card builds on it and holds until 7.5\u00a0s."],
          ["The camera pans up and right to screen three. Another press, and the result stays until 11.5\u00a0s."],
          ["The camera pans down to screen four, then 1.4\u00a0s of quiet."],
          ["The big moment: the cursor lands on a status, the camera zooms in on it, and it holds until 16.3\u00a0s."],
          ["The last screen leaves upward in 0.22\u00a0s. The brand name settles from 16.7\u00a0s, and the logo holds still until 20\u00a0s."],
        ],
      },
      { p: ["Every screen is a capture of your real site or app, never a placeholder card. If a feature is not on your site, the film does not show it."] },
    ],
  },
  timing: {
    id: "timing",
    title: "Timing: 20\u00a0seconds is the norm, 9 to 40 is the range.",
    blocks: [
      {
        p: [
          "A brand or product film runs 9 to 40\u00a0seconds. Under 15\u00a0seconds, most films work better as one continuous action. The example above is 20\u00a0seconds.",
        ],
      },
      {
        p: [
          "Each screen holds 1.2\u00a0seconds or more, so a viewer can read it before the camera leaves. Exits are quick (0.22\u00a0s). Entrances are slower (0.6\u00a0s or more). Neighbouring cuts change axis or direction, so you never get three slides to the left in a row.",
        ],
      },
    ],
  },
  examples: {
    title: "Examples.",
    lead: "Posts from our inspiration wall that show a product on screen. Each links to the creator’s post on X.",
    items: [
      example("2103273003555402193"),
      example("2102554209166000267"),
      example("2106426962738880879"),
    ],
    all: { href: INSPIRATION_PATH, label: "All motion video inspiration" },
  },
  moves: {
    title: "The video components a showcase is built from.",
    lead: "A pan from screen to screen, a press that does its job, a zoom to one status, and the screens leaving as the logo arrives. Open one for its clip, code and notes.",
    clips: ["pan-stations", "cursor-click", "ui-focus-zoom", "ui-strip-away"],
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
          [{ code: "bin/vawe frame <page> --world all" }, " gives one still per scene, to check before any motion."],
          [{ code: "bin/vawe dev <page>" }, " renders a half-size draft with sound."],
          [{ code: "bin/vawe critique <page> --fresh" }, " asks a separate session to review the draft, then you fix the seconds it names."],
          ["You approve the plan and the full draft. Then ", { code: "bin/vawe ship <page>" }, " renders the final film."],
        ],
      },
      {
        p: [
          "To show a real page worked by a cursor, add a steps file and ",
          { code: "--tour" },
          ": vawe drives the page with real mouse events and writes one mp4 to use inside the film.",
        ],
      },
    ],
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
      a: ["About 20\u00a0seconds. A brand or product film runs 9 to 40\u00a0seconds."],
    },
    {
      q: "Can I use my real product screens?",
      a: [
        "Yes, and you should. The template uses real captures only, and ",
        { code: "bin/vawe new --from-url <url>" },
        " saves screenshots of your site for the film. The palette, fonts and favicon come from the site, and nothing else is used.",
      ],
    },
    {
      q: "What if the product has no site yet?",
      a: ["Then there is nothing real to capture, so it is not a showcase. Use the template for invented products instead."],
    },
    {
      q: "Can an AI agent make it?",
      a: [
        "Yes. A film is one HTML page, so any coding agent can write it, and vawe ships skills for each step. You approve the plan and the full draft. See ",
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
      " with your product’s URL. To see what a finished film is, read the product launch guide.",
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
    columns: true,
    blocks: [
      {
        p: ["Two lists come before any picture, and you check both. Then the scenes follow the lists."],
      },
      {
        ol: [
          ["A facts list. Every claim the film makes, with its source. Copy formulas, dates, numbers and names exactly. Check the list before you draw anything."],
          ["A scene list. For each scene: its time, the one sentence the viewer takes away, what builds on screen, and how it ends."],
          ["One idea per scene, and one thing that changes in it: a diagram builds, a number counts, or a process fills from empty to complete."],
          ["Short captions, one line each. Text is for labels and one sentence per scene, never paragraphs."],
          ["One palette for the whole film, and one accent for the thing you explain right now."],
        ],
      },
      { p: ["Avoid a slide with bullets, a stock icon grid, and any scene where nothing moves."] },
    ],
  },
  timing: {
    id: "timing",
    title: "Timing: 9\u00a0seconds to 3\u00a0minutes.",
    blocks: [
      {
        p: [
          "An explainer runs from 9\u00a0seconds to 3\u00a0minutes. The default is 30\u00a0seconds in 16:9, with three takeaways and one scene for each. For a film over 60\u00a0seconds, or one that takes more than one working session, use the long-film brief instead. Under 15\u00a0seconds, a process that fills from empty to complete is one continuous action.",
        ],
      },
      {
        p: [
          "If there is a voice, every scene starts on a word boundary from a timings file, not on a guess. A viewer does not see a diagram that finishes building in 300\u00a0ms, so give it time.",
        ],
      },
    ],
  },
  examples: {
    title: "Examples.",
    lead: "Explainers from our inspiration wall. Each links to the creator’s post on X.",
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
    lead: "A chart that builds, a number that counts to its sourced value, captions that replace each other line by line, a before and after. Open one for its clip, code and notes.",
    clips: ["chart-build", "count-up", "caption-editorial", "before-after-wipe"],
  },
  make: {
    id: "make",
    title: "Make one with vawe.",
    blocks: [
      {
        p: [
          "Start from the explainer template. Diagrams are SVG inside the page, and CSS animation builds them, so a line can draw itself. Numbers count from a table of values over time, so the count is the same on every render.",
        ],
      },
      {
        ol: [
          ["Write the facts list and stop. Then write the scene list and stop. Then write the page."],
          [{ code: "bin/vawe dev <page>" }, " renders a half-size draft with sound."],
          [{ code: "bin/vawe critique <page> --fresh" }, " asks a separate session to review the draft, then you fix the seconds it names."],
          ["You approve the full draft. Then ", { code: "bin/vawe ship <page>" }, " renders the final film."],
        ],
      },
    ],
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
      a: ["From 9\u00a0seconds to 3\u00a0minutes. The default is 30\u00a0seconds. Over 60\u00a0seconds, use the long-film brief."],
    },
    {
      q: "Do I need a voiceover?",
      a: ["No. The default is captions only. You can add a voice from a recorded file or a text-to-speech voice with a timings file. An agent cannot hear the voice it made, so listen once yourself for pronunciation."],
    },
    {
      q: "How do I keep the facts right?",
      a: ["Write the facts list first, with a source for each claim, and check it before you draw. A number that counts up ends on the sourced value, not a rounded one."],
    },
    {
      q: "Is this the same as a product launch video?",
      a: [
        "No. An explainer teaches and sells nothing. If you want to market a real product, make a launch video. See ",
        { text: "product launch videos", href: LAUNCH_VIDEO.path },
        ".",
      ],
    },
    {
      q: "Can an AI agent make it?",
      a: [
        "Yes. A film is one HTML page, so any coding agent can write it, and vawe ships skills for each step. See ",
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

export function videoTypesUsing(moveName: string): Link[] {
  return [
    ...(PRODUCT_SHOWCASE.moves.clips.includes(moveName) ? [{ href: SHOWCASE_PATH, label: "Used in product showcase videos" }] : []),
    ...(EXPLAINER.moves.clips.includes(moveName) ? [{ href: EXPLAINER_PATH, label: "Used in explainer videos" }] : []),
    ...(LAUNCH_VIDEO.moves.clips.includes(moveName) ? [{ href: LAUNCH_VIDEO.path, label: "Used in product launch videos" }] : []),
  ];
}
