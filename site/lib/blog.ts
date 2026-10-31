import fs from "node:fs";
import path from "node:path";
import { Marked, type Tokens } from "marked";
import { smart, smartHtml } from "./typo.mjs";
import { SECTIONS, TOPICS, docsLinks, parseFrontMatter } from "./blog-front-matter.mjs";
import added from "./blog-added.json";
import { SITE_URL } from "./site";

export { smart, SECTIONS };

// The blog's one owner: reads content/blog/*.md at build time, checks the front matter and renders
// the Markdown. Every blog route, the sitemap and the RSS feed read posts through this file.

export const BLOG_URL = `${SITE_URL}/blog`;

export const BLOG_TITLE = "vawe blog: building agent-native motion graphics";
export const BLOG_DESCRIPTION =
  "Engineering notes from building vawe, where agents write motion graphics as HTML: what broke, what we measured and what we changed.";

export type SectionId = (typeof SECTIONS)[number]["id"];

export type Heading = { id: string; text: string };

// A post's cover: public/blog/<slug>/thumb.webp when one has been rendered.
export type Cover = { src: string; width: number; height: number };

export type Post = {
  slug: string;
  title: string;
  description: string;
  date: string;
  updated: string;
  section: SectionId;
  sectionLabel: string;
  tags: string[];
  keywords: string[];
  docs: { slug: string; title: string }[];
  hero?: { src: string; alt: string; width?: number; height?: number };
  heroInBody: boolean;
  cover?: Cover;
  featured: boolean;
  featuredOrder?: number;
  no: number;
  html: string;
  body: string;
  toc: Heading[];
  minutes: number;
};

const CONTENT = path.join(process.cwd(), "content/blog");
const PUBLIC = path.join(process.cwd(), "public");
const WORDS_PER_MINUTE = 230;
// Raw HTML a post may carry (SPEC): figure, figcaption, video, details, table. These stay out.
const BANNED_HTML = /<\s*(script|iframe|svg|object|embed|style)\b/i;
const showDrafts = process.env.NODE_ENV !== "production" || process.env.BLOG_DRAFTS === "1";
const FEATURED_MAX = 3;
// The first commit time of each post (scripts/site/blog-added.mjs). It orders posts that share a date and is never shown.
const addedAt = added as Record<string, string>;

function fail(file: string, msg: string): never {
  throw new Error(`content/blog/${file}: ${msg}`);
}

const list = (v?: string) => (v ? v.split(",").map((s) => s.trim()).filter(Boolean) : []);

function isDate(v?: string): v is string {
  return Boolean(v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)));
}

export function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/<[^>]+>/g, "")
    .replace(/&[a-z#0-9]+;/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function plain(html: string) {
  return html.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

function escapeAttr(s: string) {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Width and height for a local image, so the page reserves its box before the file arrives (CLS).
export function imageSize(src: string): { width: number; height: number } | undefined {
  if (!src.startsWith("/")) return undefined;
  const file = path.join(PUBLIC, decodeURI(src.split(/[?#]/)[0]));
  if (!fs.existsSync(file)) return undefined;
  const buf = fs.readFileSync(file);
  if (file.endsWith(".svg")) {
    const vb = /viewBox\s*=\s*["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(buf.toString("utf8"));
    return vb ? { width: Math.round(Number(vb[1])), height: Math.round(Number(vb[2])) } : undefined;
  }
  if (buf.toString("ascii", 1, 4) === "PNG") return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") {
    const kind = buf.toString("ascii", 12, 16);
    if (kind === "VP8X") return { width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3) };
    if (kind === "VP8 ") return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
    if (kind === "VP8L") {
      const b = buf.readUInt32LE(21);
      return { width: 1 + (b & 0x3fff), height: 1 + ((b >> 14) & 0x3fff) };
    }
  }
  return undefined;
}

function imgTag(src: string, alt: string) {
  const size = imageSize(src);
  const dims = size ? ` width="${size.width}" height="${size.height}"` : "";
  return `<img src="${escapeAttr(src)}" alt="${escapeAttr(alt)}"${dims} loading="lazy" decoding="async">`;
}

function isExternal(href: string) {
  return /^https?:\/\//i.test(href) && !/^https?:\/\/(www\.)?vawe\.dev(\/|$)/i.test(href);
}


function render(file: string, body: string) {
  const toc: Heading[] = [];
  const used = new Map<string, number>();
  const marked = new Marked({ gfm: true });
  marked.use({
    walkTokens(token) {
      if (token.type === "html" && BANNED_HTML.test(token.raw)) {
        fail(file, `raw HTML not allowed in a post: ${token.raw.trim().slice(0, 60)}`);
      }
    },
    renderer: {
      heading({ tokens, depth }: Tokens.Heading) {
        const inner = this.parser.parseInline(tokens);
        const base = slugify(plain(inner)) || "section";
        const n = used.get(base) ?? 0;
        used.set(base, n + 1);
        const id = n ? `${base}-${n}` : base;
        if (depth === 2) toc.push({ id, text: plain(inner) });
        return `<h${depth} id="${id}">${inner}</h${depth}>\n`;
      },
      link({ href, title, tokens }: Tokens.Link) {
        const inner = this.parser.parseInline(tokens);
        const t = title ? ` title="${escapeAttr(title)}"` : "";
        const rel = isExternal(href) ? ' rel="noopener"' : "";
        return `<a href="${escapeAttr(href)}"${t}${rel}>${inner}</a>`;
      },
      image({ href, title, text }: Tokens.Image) {
        const img = imgTag(href, text);
        return title ? `<figure>${img}<figcaption>${escapeHtml(title)}</figcaption></figure>` : img;
      },
      code({ text, lang }: Tokens.Code) {
        const l = (lang ?? "").trim().split(/\s+/)[0];
        const label = l ? `<span class="bp-code-lbl">${escapeHtml(l)}</span>` : "";
        const cls = l ? ` class="language-${escapeAttr(l)}"` : "";
        return `<div class="bp-code">${label}<pre><code${cls}>${escapeHtml(text)}</code></pre></div>\n`;
      },
    },
  });
  const html = smartHtml(marked.parse(body, { async: false }) as string);
  return { html, toc: toc.map((h) => ({ ...h, text: smart(h.text) })) };
}

function readingMinutes(body: string) {
  const text = body
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1");
  const words = text.split(/\s+/).filter((w) => /[a-z0-9]/i.test(w)).length;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

function loadPost(file: string): Post {
  const slug = file.replace(/\.md$/, "");
  if (!/^_?[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) fail(file, "the file name must be lowercase words joined by hyphens");
  const { data, body } = parseFrontMatter(file, fs.readFileSync(path.join(CONTENT, file), "utf8"));
  for (const key of ["title", "description", "date", "section"]) if (!data[key]) fail(file, `front matter needs "${key}"`);
  if (!isDate(data.date)) fail(file, `date must be YYYY-MM-DD, got "${data.date}"`);
  if (data.updated && !isDate(data.updated)) fail(file, `updated must be YYYY-MM-DD, got "${data.updated}"`);
  if (data.updated && data.updated < data.date) fail(file, `updated ${data.updated} is before date ${data.date}`);
  if (data.featured && data.featured !== "true" && data.featured !== "false") fail(file, `featured must be true or false, got "${data.featured}"`);
  if (data.featuredOrder && !/^\d+$/.test(data.featuredOrder)) fail(file, `featuredOrder must be a whole number, got "${data.featuredOrder}"`);
  const section = SECTIONS.find((s) => s.id === data.section);
  if (!section) fail(file, `section must be one of ${SECTIONS.map((s) => s.id).join(", ")}, got "${data.section}"`);
  if (!(TOPICS as readonly string[]).includes(data.topic)) fail(file, `topic must be one of ${TOPICS.join(", ")}, got "${data.topic ?? ""}" (it picks the share card's scene)`);
  let hero: Post["hero"];
  if (data.hero) {
    if (!fs.existsSync(path.join(PUBLIC, data.hero))) fail(file, `hero ${data.hero} is not in site/public`);
    hero = { src: data.hero, alt: data.heroAlt ?? "", ...imageSize(data.hero) };
  }
  const { html, toc } = render(file, body);
  return {
    heroInBody: Boolean(data.hero && body.includes(data.hero)),
    featured: data.featured === "true",
    featuredOrder: data.featuredOrder ? Number(data.featuredOrder) : undefined,
    no: 0,
    cover: coverFor(slug),
    slug,
    title: data.title,
    description: data.description,
    date: data.date,
    updated: data.updated ?? data.date,
    section: section.id,
    sectionLabel: section.label,
    tags: list(data.tags),
    keywords: list(data.keywords),
    docs: docsLinks(file, data),
    hero,
    html,
    body,
    toc,
    minutes: readingMinutes(body),
  };
}

// Same date: the post written later comes first. A post with no recorded commit is still being written, so it is the newest.
const writtenAt = (p: Post) => (addedAt[p.slug] ? Date.parse(addedAt[p.slug]) : Infinity);
const newestFirst = (a: Post, b: Post) => b.date.localeCompare(a.date) || writtenAt(b) - writtenAt(a) || a.title.localeCompare(b.title);

function coverFor(slug: string): Cover | undefined {
  const src = `/blog/${slug}/thumb.webp`;
  const size = imageSize(src);
  return size ? { src, ...size } : undefined;
}

let parsed: Post[] | null = null;

function parsedPosts() {
  if (parsed) return parsed;
  const files = fs.existsSync(CONTENT) ? fs.readdirSync(CONTENT).filter((f) => f.endsWith(".md") && f !== "README.md") : [];
  parsed = files.filter((f) => showDrafts || !f.startsWith("_")).map(loadPost);
  return parsed;
}

// A post dated after today (UTC) does not exist yet. The clock is read on every call: the server
// regenerates its pages hourly (revalidate), so a post goes live on its date without a redeploy.
export function allPosts(): Post[] {
  const today = new Date(Date.now()).toISOString().slice(0, 10);
  const live = parsedPosts().filter((p) => showDrafts || p.date <= today).sort(newestFirst);
  // The issue number counts from the oldest post.
  return live.map((p, i) => ({ ...p, no: live.length - i }));
}

export type IndexPost = { post: Post; feat?: "lead" | "mid" };

// The index order: the featured posts first (featuredOrder, then newest), then every other post newest first.
export function indexPosts(): IndexPost[] {
  const posts = allPosts();
  const byOrder = (a: Post, b: Post) => (a.featuredOrder ?? Infinity) - (b.featuredOrder ?? Infinity);
  const featured = posts.filter((p) => p.featured).sort(byOrder).slice(0, FEATURED_MAX);
  return [
    ...featured.map((post, i) => ({ post, feat: i === 0 ? ("lead" as const) : ("mid" as const) })),
    ...posts.filter((p) => !featured.includes(p)).map((post) => ({ post })),
  ];
}

export function postBySlug(slug: string) {
  return allPosts().find((p) => p.slug === slug);
}

export function postsBySection() {
  const posts = allPosts();
  return SECTIONS.map((s) => ({ ...s, posts: posts.filter((p) => p.section === s.id) })).filter((s) => s.posts.length);
}

// allPosts is newest first, so the older post is the next index.
export function neighbours(slug: string) {
  const posts = allPosts();
  const i = posts.findIndex((p) => p.slug === slug);
  return { older: posts[i + 1], newer: i > 0 ? posts[i - 1] : undefined };
}

export function relatedPosts(post: Post, n = 3) {
  const others = allPosts().filter((p) => p.slug !== post.slug);
  const same = others.filter((p) => p.section === post.section);
  const rest = others.filter((p) => p.section !== post.section);
  return [...same, ...rest].slice(0, n);
}

export function latestDate() {
  return allPosts().reduce<string | undefined>((max, p) => (!max || p.updated > max ? p.updated : max), undefined);
}

// "Updated October 2026": shown only when a real later edit exists. The one date a reader sees.
export function updatedLabel(post: Pick<Post, "date" | "updated">) {
  if (post.updated <= post.date) return undefined;
  return new Date(`${post.updated}T00:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
}

export function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}
