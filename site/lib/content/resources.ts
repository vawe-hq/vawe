import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { REPO_URL } from "../schema";
import type { IconName } from "../../app/components/Icon";
import { EASES } from "../easing";
import { MOVES } from "../moves";
import { INSPIRATION, INSPIRATION_PATH } from "../inspiration";
import { allPosts } from "../blog";
import { RIVALS } from "./vs";
import type { Crumb, Meta } from "./types";

// A riso tile: /resources/tiles/<id>.webp, painted by assets/brand-art/card.html with &word= (see site/DESIGN.md).
export type Tile = string;
export type Item = { href: string; title: string; line: string; icon: IconName | "github"; meta?: string; code?: boolean; external?: boolean; tile?: Tile };
export type Group = { id: string; title: string; lead?: string; tile?: Tile; items: Item[] };

const NBSP = "\u00a0";
const kb = (bytes: number) => `${(bytes / 1000).toFixed(1)}${NBSP}kB`;
const publicSize = (file: string) => kb(statSync(join(process.cwd(), "public", file)).size);

function skillLines(name: string) {
  try {
    const text = readFileSync(join(process.cwd(), "..", "skills", name, "SKILL.md"), "utf8");
    return `${text.trimEnd().split("\n").length}${NBSP}lines`;
  } catch {
    return undefined;
  }
}

const skill = (name: string, line: string): Item => ({
  href: `${REPO_URL}/blob/main/skills/${name}/SKILL.md`,
  title: name,
  line,
  icon: "skill",
  meta: skillLines(name),
  code: true,
  external: true,
});

// The sizes of the generated files, in bytes. The markdown renderer passes none: those files render this page too.
export type FileSizes = { llms: number; llmsFull: number; agents: number };

export const resourceGroups = (sizes?: FileSizes): Group[] => [
  {
    id: "tools",
    title: "Tools",
    items: [
      {
        href: "/easing",
        title: "Easing curves",
        line: `${EASES.length} easing functions: preview, compare, copy a CSS cubic-bezier or linear().`,
        icon: "curve",
        meta: `${EASES.length}${NBSP}curves`,
        tile: "easing",
      },
      {
        href: "/video-components",
        title: "The video components library",
        line: `${MOVES.length} video components. Each has a short clip, the CSS and one markdown file to copy.`,
        icon: "play",
        meta: `${MOVES.length}${NBSP}video components`,
        tile: "moves",
      },
      {
        href: INSPIRATION_PATH,
        title: "Motion video inspiration",
        line: "Motion videos made with AI, from posts on X, each with the command to use it as a reference.",
        icon: "play",
        meta: `${INSPIRATION.length}${NBSP}videos`,
        tile: "films",
      },
      {
        href: "/features",
        title: "Features",
        line: "What the engine decides for you, in three groups: agent experience, taste and speed.",
        icon: "list",
        meta: "page",
        tile: "features",
      },
    ],
  },
  {
    id: "agents",
    title: "For agents",
    lead: "Plain files an AI agent can fetch without a browser.",
    tile: "agents",
    items: [
      { href: "/llms.txt", title: "/llms.txt", line: "The site as a short index: install, the page contract, every page and video component.", icon: "file", meta: sizes && kb(sizes.llms), code: true },
      { href: "/llms-full.txt", title: "/llms-full.txt", line: "The guide, the pages and the video components in one text file.", icon: "file", meta: sizes && kb(sizes.llmsFull), code: true },
      { href: "/ai-agents.md", title: "/ai-agents.md", line: "How an agent writes and renders a film, as Markdown.", icon: "markdown", meta: sizes && kb(sizes.agents), code: true },
      { href: "/moves/index.json", title: "/moves/index.json", line: "Every video component with its group, look, jobs, duration and file, to filter by script.", icon: "json", meta: publicSize("moves/index.json"), code: true },
      { href: "/ai-agents", title: "How an agent installs vawe", line: "Clone the repo, run bin/vawe-dev doctor, then write one HTML page.", icon: "terminal", meta: "guide" },
    ],
  },
  {
    id: "skills",
    title: "Agent skills",
    lead: "Six SKILL.md files in the skills/ folder of the GitHub repo.",
    tile: "skills",
    items: [
      skill("html-to-video", "Start here: make a film from one HTML page when none exists yet."),
      skill("vawe-brief", "Ask for the missing facts, then write the film’s brief."),
      skill("vawe-page", "Write page.html: audio tags, springs and the usual first-draft mistakes."),
      skill("vawe-transitions", "Plan what carries over at every cut."),
      skill("vawe-critique", "Review a rendered film in a fresh session."),
      skill("vawe-reference", "Match a reference film, line by line."),
    ],
  },
  {
    id: "learn",
    title: "Learn",
    tile: "learn",
    items: [
      { href: "/docs", title: "Docs", line: "Quickstart, the page contract, the CLI and troubleshooting.", icon: "book", meta: "docs" },
      { href: "/docs/recipes", title: "Recipes", line: "Chains of video components for common short films, with the traps at each seam.", icon: "list", meta: "recipes" },
      { href: "/determinism", title: "Determinism", line: "Why the same page gives the same frames, and how a test proves it.", icon: "book", meta: "essay" },
      { href: "/when-determinism-matters", title: "When determinism matters", line: "When byte-identical output decides the engine, and when it does not.", icon: "book", meta: "essay" },
      { href: "/launch-video", title: "Launch videos", line: "A product launch film built from captured UI, one message per beat.", icon: "play", meta: "guide" },
      { href: "/product-showcase-video", title: "Product showcase videos", line: "A feature tour of the real product: four screens, one camera, about 20\u00a0seconds.", icon: "play", meta: "guide" },
      { href: "/explainer-video", title: "Explainer videos", line: "Facts first, then one idea per scene, 9\u00a0seconds to 3\u00a0minutes.", icon: "play", meta: "guide" },
      { href: "/blog", title: "Blog", line: "Notes on what broke, what we measured and what changed.", icon: "pen", meta: `${allPosts().length}${NBSP}posts` },
    ],
  },
  {
    id: "compare",
    title: "Compare",
    tile: "compare",
    items: [
      { href: "/remotion-alternatives", title: "Remotion alternatives", line: "A hosted JSON API or a self-hosted engine, and what each license requires.", icon: "compare", meta: "alternatives" },
      { href: "/hyperframes-alternatives", title: "HyperFrames alternatives", line: "The closest peer: both compose from HTML and make time deterministic differently.", icon: "compare", meta: "alternatives" },
      ...RIVALS.map((r): Item => ({ href: `/vs/${r.slug}`, title: `vawe vs ${r.name}`, line: `${r.metaTitle.split(": ")[1].replace(/^./, (c) => c.toUpperCase())}.`, icon: "compare", meta: "comparison" })),
    ],
  },
  {
    id: "project",
    title: "Project",
    tile: "project",
    items: [
      { href: "/problems", title: "Hard problems", line: "Thirteen problems in agent-made video: seven solved with numbers, six open.", icon: "alert", meta: "problems" },
      { href: "/roadmap", title: "Roadmap", line: "What is in work now, next and later.", icon: "map", meta: "now, next, later" },
      { href: REPO_URL, title: "GitHub", line: "The source, Apache 2.0, and the issue tracker.", icon: "github", meta: "Apache-2.0", external: true },
    ],
  },
];


export const RESOURCES = {
  path: "/resources",
  meta: {
    title: "Motion graphics resources: CSS easing, video components and AI agent video | vawe",
    description: `${EASES.length} CSS easing functions, ${MOVES.length} video components with clips, the files an AI agent reads to make a video, guides, and comparisons with Remotion, HyperFrames, Motion Canvas and Lottie.`,
  } as Meta,
  crumb: { current: "Resources" } as Crumb,
  h1: "Resources for motion graphics by code",
  lede: (count: number) =>
    `Easing curves, video components, files for AI agents, guides and comparisons: ${count} links in six groups. The easing page holds ${EASES.length} curves, and the video components library holds ${MOVES.length} components, each with the CSS and one markdown file to copy, and ${MOVES.filter((m) => m.clipHash).length} of them with a short clip. The agent files are plain text that a model can fetch without a browser.`,
  tocLabel: "Groups",
};
