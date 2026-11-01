import fs from "node:fs";
import path from "node:path";
import lastmod from "../lastmod.json";
import { AGENTS_DESCRIPTION, agentGuide } from "../agent-guide";
import { BLOG_DESCRIPTION, BLOG_TITLE, BLOG_URL, allPosts, latestDate, postBySlug, postsBySection, relatedPosts } from "../blog";
import {
  EASES, EASING_DESCRIPTION, EASING_TITLE, FAMILIES, JOBS as EASE_JOBS, classicIn, copyIsBezier, copyValue, easeBySlug, importLine, pageDescription, pageTitle, roleOf, speedText, summary, waapi,
  type Ease,
} from "../easing";
import { INSPIRATION, INSPIRATION_DESCRIPTION, INSPIRATION_PATH, INSPIRATION_TITLE, PROMPTS_PATH, titleOf } from "../inspiration";
import { MOVES_DESCRIPTION, MOVES_TITLE, GROUPS, MOVES, JOBS as MOVE_JOBS, groupLabel, moveByName } from "../moves";
import { moveSeoDescription, relatedMoves } from "../move-seo";
import { SITE_URL } from "../site";
import { absolutize, bareTitle, codeBlock, heading, item, markdownPage, table, type Link } from "./format";
import { CONTENT_RENDERERS } from "./pages";
import { RENDERED, matchPattern, mdUrlOf } from "./routes.mjs";

// The renderers of every page that has a markdown version. Each one reads the data the HTML page
// reads (lib/blog.ts, lib/moves.ts, lib/easing.ts, lib/inspiration.ts, content/agent-guide.md); none
// parses the rendered HTML. The pages whose words live in lib/content/ are in lib/md/pages.ts. The route list is lib/md/routes.mjs, which the middleware and the
// coverage test read too.

export type Doc = { title: string; description: string; body: string; updated?: string; related?: Link[] };
export type Entry = { path: string; title: string; description: string; kind: "page" | "item"; full: boolean };
type Params = Record<string, string>;
export type Renderer = { entries(): Entry[]; render(params: Params): Doc | null };

const dates = lastmod as Record<string, string>;
const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), "utf8");
const page = (p: string, title: string, description: string): Entry => ({ path: p, title: bareTitle(title), description, kind: "page", full: true });

const postPath = (slug: string) => `/blog/${slug}`;

// llms-full.txt carries the first few items of a large collection; llms.txt links the rest.
const BLOG_FULL_LIMIT = 15;
const EASE_FULL_LIMIT = 12;
const MOVE_FULL_LIMIT = 12;

const blogIndex: Renderer = {
  entries: () => [page("/blog", BLOG_TITLE, BLOG_DESCRIPTION)],
  render: () => ({
    title: BLOG_TITLE,
    description: BLOG_DESCRIPTION,
    updated: latestDate(),
    body: [
      ...postsBySection().flatMap((s) => [heading(2, s.label), s.intro, s.posts.map((p) => item(p.title, postPath(p.slug), p.description)).join("\n")]),
      `${item("RSS feed", `${BLOG_URL}/rss.xml`, "every post with its full text")}`,
    ].join("\n\n"),
  }),
};

const blogPost: Renderer = {
  entries: () => allPosts().map((p, i) => ({ path: postPath(p.slug), title: p.title, description: p.description, kind: "item", full: i < BLOG_FULL_LIMIT })),
  render: ({ slug }) => {
    const post = postBySlug(slug);
    if (!post) return null;
    return {
      title: post.title,
      description: post.description,
      updated: post.updated,
      body: absolutize(post.body),
      related: relatedPosts(post).map((p) => ({ text: p.title, path: postPath(p.slug) })),
    };
  },
};

const movesIndex: Renderer = {
  entries: () => [page("/video-components", MOVES_TITLE, MOVES_DESCRIPTION)],
  render: () => ({
    title: MOVES_TITLE,
    description: MOVES_DESCRIPTION,
    updated: dates["/video-components"],
    body: [
      "Each video component is one markdown file an agent copies. Add .md to a component’s URL to read it as Markdown.",
      ...GROUPS.flatMap((g) => [heading(2, g.label), MOVES.filter((m) => m.group === g.id).map((m) => item(m.title, `/video-components/${m.name}`, m.use)).join("\n")]),
      heading(2, "By job"),
      MOVE_JOBS.map((j) => `- ${j.label}: ${j.moves.map((name) => moveByName(name)?.title ?? name).join(", ")}`).join("\n"),
    ].join("\n\n"),
  }),
};

// The move .md files in public/moves are the agent copy; this serves them with the links made absolute.
const moveFile = (name: string) => absolutize(read(`public/moves/${name}.md`)).replace(/\]\((?!https?:|#|mailto:)([^)]+)\)/g, `](${SITE_URL}/moves/$1)`);

const moveItem: Renderer = {
  entries: () => MOVES.map((m, i) => ({ path: `/video-components/${m.name}`, title: m.title, description: m.use, kind: "item", full: i < MOVE_FULL_LIMIT })),
  render: ({ name }) => {
    const move = moveByName(name);
    if (!move) return null;
    return {
      title: move.title,
      description: moveSeoDescription(move),
      updated: move.modified,
      body: moveFile(move.name).replace(/^# .*\n+/, ""),
      related: [...relatedMoves(move).map((m) => ({ text: m.title, path: `/video-components/${m.name}` })), { text: `All video components (${groupLabel(move.group)} and more)`, path: "/video-components" }],
    };
  },
};

const easeLine = (e: Ease) => item(e.name, `/easing/${e.slug}`, e.blurb);

const easingIndex: Renderer = {
  entries: () => [page("/easing", EASING_TITLE, EASING_DESCRIPTION)],
  render: () => ({
    title: EASING_TITLE,
    description: EASING_DESCRIPTION,
    updated: dates["/easing"],
    body: [
      heading(2, "vawe After Effects eases"),
      EASES.filter((e) => e.kind === "vawe").map(easeLine).join("\n"),
      heading(2, "CSS keywords"),
      EASES.filter((e) => e.kind === "css").map(easeLine).join("\n"),
      ...FAMILIES.flatMap((f) => [heading(2, `Classic eases: ${f}`), classicIn(f).map(easeLine).join("\n")]),
      heading(2, "Which ease for which job"),
      table(["Job", "Ease", "Time", "Avoid"], EASE_JOBS.map((j) => [j.job, j.easeName, j.time, j.avoid])),
    ].join("\n\n"),
  }),
};

const pct = (u: number) => `${Math.round(u * 100)}%`;

function easeBody(e: Ease) {
  const numbers: [string, string][] = [
    ["Role", roleOf(e)],
    ["Reaches 50% of its travel at", pct(e.t50)],
    ["Reaches 90% of its travel at", pct(e.t90)],
    ["Peak speed", `${speedText(e)} the average`],
    ...(e.overshoot > 0 ? ([["Overshoot", `${e.overshoot}%`]] as [string, string][]) : []),
    ...(e.undershoot > 0 ? ([["Undershoot", `${e.undershoot}%`]] as [string, string][]) : []),
  ];
  const handles = e.handles
    ? [heading(2, "After Effects handles"), table(["Side", "Influence", "Speed"], [["Leaving a key", `${e.handles.out.influence}%`, e.handles.out.speed], ["Arriving at a key", `${e.handles.in.influence}%`, e.handles.in.speed]])]
    : [];
  return [
    summary(e),
    e.blurb,
    table(["Measure", "Value"], numbers),
    heading(2, copyIsBezier(e) ? "CSS cubic-bezier" : "CSS linear()"),
    codeBlock(copyValue(e), "css"),
    heading(2, "Web Animations"),
    codeBlock(waapi(e), "js"),
    heading(2, "In a vawe page"),
    codeBlock(importLine(e), "js"),
    ...handles,
    heading(2, "Use for"),
    e.use.map((u) => `- ${u}`).join("\n"),
    heading(2, "Avoid for"),
    e.avoid.map((u) => `- ${u}`).join("\n"),
  ].join("\n\n");
}

const easeItem: Renderer = {
  entries: () => EASES.map((e, i) => ({ path: `/easing/${e.slug}`, title: bareTitle(pageTitle(e)), description: pageDescription(e), kind: "item", full: i < EASE_FULL_LIMIT })),
  render: ({ slug }) => {
    const e = easeBySlug(slug);
    if (!e) return null;
    return {
      title: pageTitle(e).replace(/ \| vawe$/, ""),
      description: pageDescription(e),
      updated: dates["/easing"],
      body: easeBody(e),
      related: [...e.related.map((r) => ({ text: r.name, path: `/easing/${r.slug}` })), { text: "All easing functions", path: "/easing" }],
    };
  },
};

const inspirationIndex: Renderer = {
  entries: () => [page(INSPIRATION_PATH, INSPIRATION_TITLE, INSPIRATION_DESCRIPTION)],
  render: () => ({
    title: INSPIRATION_TITLE,
    description: INSPIRATION_DESCRIPTION,
    updated: dates[INSPIRATION_PATH],
    body: [
      `${INSPIRATION.length} posts, newest first. Each links the creator's post on X. The creator's own prompts are in ${SITE_URL}${PROMPTS_PATH}.`,
      INSPIRATION.map((p) => {
        const by = p.creator.name ? `${p.creator.name} (@${p.creator.handle})` : `@${p.creator.handle}`;
        return item(titleOf(p), p.url, `by ${by}${p.madeWith ? `, made with ${p.madeWith}` : ""}${p.typeLabel ? `, ${p.typeLabel}` : ""}`);
      }).join("\n"),
    ].join("\n\n"),
  }),
};

const agentsPage: Renderer = {
  entries: () => [page("/ai-agents", "AI agent video generation with vawe", AGENTS_DESCRIPTION)],
  render: () => {
    const guide = agentGuide();
    const title = /^# (.*)\n/.exec(guide)?.[1] ?? "vawe for AI agents";
    return { title, description: AGENTS_DESCRIPTION, updated: dates["/ai-agents"], body: absolutize(guide.replace(/^# .*\n+/, "")) };
  },
};

const RENDERERS: Record<string, Renderer> = {
  "/blog": blogIndex,
  "/blog/[slug]": blogPost,
  "/video-components": movesIndex,
  "/video-components/[name]": moveItem,
  "/easing": easingIndex,
  "/easing/[slug]": easeItem,
  "/inspiration": inspirationIndex,
  "/ai-agents": agentsPage,
  ...CONTENT_RENDERERS,
};

const patterns = Object.keys(RENDERERS);
if (patterns.length !== RENDERED.length || RENDERED.some((p: string) => !RENDERERS[p])) {
  throw new Error("lib/md/routes.mjs RENDERED and the renderers in lib/md/registry.ts must list the same patterns");
}

export function renderMarkdown(routePath: string): { text: string; updated?: string; longCache: boolean } | null {
  for (const pattern of RENDERED as string[]) {
    const params = matchPattern(pattern, routePath);
    if (!params) continue;
    const doc = RENDERERS[pattern].render(params as Params);
    if (!doc) return null;
    // The blog pages change on a post's date, so they keep the short cache.
    return { text: markdownPage({ ...doc, path: routePath }), updated: doc.updated, longCache: !pattern.startsWith("/blog") };
  }
  return null;
}

// Every addressable markdown route, in the order llms.txt and llms-full.txt print them: pages first, then the items.
export function listMarkdownRoutes(): Entry[] {
  const all = (RENDERED as string[]).flatMap((p) => RENDERERS[p].entries());
  return [...all.filter((e) => e.kind === "page"), ...all.filter((e) => e.kind === "item")];
}

export function catalogMarkdown() {
  const lines = listMarkdownRoutes().map((e) => item(e.title, mdUrlOf(e.path), e.description));
  return `# vawe markdown catalog\n\n> Every page of vawe.dev that has a Markdown version. Add .md to the URL, or send Accept: text/markdown.\n\n${lines.join("\n")}\n`;
}
