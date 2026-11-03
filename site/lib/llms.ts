import fs from "node:fs";
import path from "node:path";
import { BLOG_URL } from "./blog";
import { docMarkdown, docsIndex } from "./docs-index";
import { INSPIRATION, titleOf } from "./inspiration";
import { absoluteUrl, SITE_DESCRIPTION, SITE_NAME } from "./site";
import { item } from "./md/format";
import { listMarkdownRoutes, renderMarkdown } from "./md/registry";
import { RENDERED, mdUrlOf } from "./md/routes.mjs";

// llms.txt is content/llms-base.txt (the facts, the install steps, the docs list) with the site, blog,
// inspiration and video component sections filled from the markdown registry, so a new page or a
// scheduled post appears without editing a list (the route revalidates hourly).

const BLOG_LIST_MAX = 50;
const FULL_MAX_CHARS = 500_000;

const staticPaths = (RENDERED as string[]).filter((p) => !p.includes("["));

// The Site list in the base file names the HTML pages; a page with a markdown version links that instead.
const withMarkdownLinks = (text: string) =>
  staticPaths.reduce((t, p) => t.split(`](${absoluteUrl(p)})`).join(`](${absoluteUrl(mdUrlOf(p))})`), text);

const itemsUnder = (prefix: string) => listMarkdownRoutes().filter((e) => e.kind === "item" && e.path.startsWith(prefix));

export async function llmsText() {
  const base = fs.readFileSync(path.join(process.cwd(), "content/llms-base.txt"), "utf8");
  const posts = itemsUnder("/blog/");
  const blog = [
    `- [Blog](${BLOG_URL}.md): Tutorials and engineering notes from building vawe. Every post is also a Markdown file at ${BLOG_URL}/<slug>.md.`,
    `- [RSS feed](${BLOG_URL}/rss.xml): every post with its full text.`,
    ...posts.slice(0, BLOG_LIST_MAX).map((e) => item(e.title, mdUrlOf(e.path), e.description)),
    ...(posts.length > BLOG_LIST_MAX ? [`- [All ${posts.length} posts](${BLOG_URL}.md): the full list is on the Blog page.`] : []),
  ].join("\n");
  const inspiration = INSPIRATION.map((p) => {
    const by = p.creator.name ? `${p.creator.name} (@${p.creator.handle})` : `@${p.creator.handle}`;
    return `- [${titleOf(p)}](${p.url}): by ${by}${p.madeWith ? `, made with ${p.madeWith}` : ""}`;
  }).join("\n");
  const components = itemsUnder("/video-components/").map((e) => item(e.title, mdUrlOf(e.path), e.description)).join("\n");
  const easingJobs = itemsUnder("/easing/for/").map((e) => item(e.title, mdUrlOf(e.path), e.description)).join("\n");
  const springs = itemsUnder("/springs/").map((e) => item(e.title, mdUrlOf(e.path), e.description)).join("\n");
  const compare = itemsUnder("/vs/").map((e) => item(e.title, mdUrlOf(e.path), e.description)).join("\n");
  const docs = await docsIndex();
  const docsSection = docs.length ? ["## Docs", ...docs.map((d) => item(d.title, d.markdown, d.description))].join("\n") : "";
  const machine = [
    "## Machine-readable",
    item("Full content", "/llms-full.txt", "the guide and the main pages in one file"),
    item("Markdown catalog", "/api/md/_catalog", "every page that has a Markdown version"),
    item("Sitemap", "/sitemap.xml", "every URL of the site"),
    item("AI usage policy", "/ai.txt", "what AI systems may do with this site"),
  ].join("\n");
  const text = base.replace("{{BLOG}}", blog).replace("{{INSPIRATION}}", inspiration).replace("{{VIDEO_COMPONENTS}}", components).replace("{{EASING_JOBS}}", easingJobs).replace("{{COMPARE}}", compare).replace("{{SPRINGS}}", springs).replace("{{DOCS}}\n\n", docsSection ? `${docsSection}\n\n` : "");
  const sync = `<!-- Keep in sync with ${absoluteUrl("/robots.txt")} and ${absoluteUrl("/ai.txt")}. -->`;
  return `${withMarkdownLinks(text).trimEnd()}\n\n${machine}\n\n${sync}\n`;
}

// Whole pages only, in order: the site pages come first, so the docs at the end are what a tight budget drops.
function cutToBudget(parts: string[]) {
  const kept: string[] = [];
  let size = 0;
  for (const part of parts) {
    size += part.length + 9;
    if (size > FULL_MAX_CHARS) break;
    kept.push(part);
  }
  return `${kept.join("\n\n---\n\n")}\n`;
}

export async function llmsFull() {
  const pages = listMarkdownRoutes()
    .filter((e) => e.full)
    .map((e) => ({ path: e.path, md: renderMarkdown(e.path)?.text ?? "" }))
    .filter((p) => p.md);
  const docs = await docsIndex();
  const docPages = (await Promise.all(docs.map(async (d) => ({ path: new URL(d.url).pathname, md: await docMarkdown(d) })))).filter((d) => d.md);
  const head = `# ${SITE_NAME} - full content\n\n> ${SITE_DESCRIPTION}\n\nGenerated: ${new Date().toISOString().slice(0, 10)}\n\nThe guide, the main pages and the newest items of each collection. Every page and item: ${absoluteUrl("/llms.txt")}`;
  const all = [...pages, ...docPages];
  const text = `${[head, ...all.map((p) => `<!-- source: ${absoluteUrl(p.path)} -->\n${p.md.trim()}`)].join("\n\n---\n\n")}\n`;
  if (text.length <= FULL_MAX_CHARS) return text;
  console.warn(`llms-full.txt is ${text.length} characters, over the ${FULL_MAX_CHARS} budget: docs pages after the cut are dropped; lower a *_FULL_LIMIT in lib/md/registry.ts`);
  return cutToBudget([head, ...all.map((p) => `<!-- source: ${absoluteUrl(p.path)} -->\n${p.md.trim()}`)]);
}
