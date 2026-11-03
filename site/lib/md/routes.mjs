// Which routes have a markdown version. Plain JS with no imports, because the middleware (edge
// runtime) and tests/lib/site-markdown-coverage.test.mjs read it too. lib/md/registry.ts holds one
// renderer per RENDERED pattern and throws at load if the two lists differ.
//
// To add a page: put its pattern in RENDERED and add its renderer to registry.ts (or lib/md/pages.ts for a page whose words live in lib/content/). A page that has no
// renderer yet goes in SKIPPED with the reason; the coverage test fails for any page in neither list.

export const RENDERED = [
  "/ai-agents",
  "/blog",
  "/blog/[slug]",
  "/video-components",
  "/video-components/[name]",
  "/easing",
  "/easing/[slug]",
  "/easing/for/[job]",
  "/springs",
  "/springs/[slug]",
  "/inspiration",
  "/",
  "/features",
  "/resources",
  "/about",
  "/determinism",
  "/when-determinism-matters",
  "/problems",
  "/roadmap",
  "/launch-video",
  "/product-showcase-video",
  "/explainer-video",
  "/remotion-alternatives",
  "/hyperframes-alternatives",
  "/vs/[slug]",
  "/compare/[slug]",
  "/video-components/group/[group]",
];

// The docs are a separate app (vawe-hq/vawe-docs). It serves its own .md and negotiated markdown, and
// lists its pages at /docs/llms-index.json, so the site neither renders nor skips them.
export const DOCS_APP = ["/docs", "/docs/[slug]"];

// No page lacks a renderer today. A page that has none yet goes here with the reason; the coverage
// test fails for any page in neither list.
export const SKIPPED = [];

// Paths the middleware never rewrites: real files (the move .md files live in public/moves), the
// docs app and the site-level data files.
export const MD_EXCLUDED = ["/moves/", "/docs", "/docs-static/", "/api/", "/_next/", "/.well-known/", "/llms.txt", "/llms-full.txt", "/ai.txt", "/robots.txt", "/sitemap.xml", "/rss.xml", "/blog/rss.xml"];

// "/blog/[slug]" against "/blog/my-post": the params, or null.
export function matchPattern(pattern, path) {
  const want = pattern.split("/");
  const got = path.split("/");
  if (want.length !== got.length) return null;
  const params = {};
  for (let i = 0; i < want.length; i++) {
    const dynamic = /^\[(\w+)\]$/.exec(want[i]);
    if (dynamic) {
      if (!got[i]) return null;
      params[dynamic[1]] = got[i];
    } else if (want[i] !== got[i]) return null;
  }
  return params;
}

export const isRendered = (path) => RENDERED.some((p) => matchPattern(p, path));
export const skipReason = (path) => SKIPPED.find((s) => matchPattern(s.pattern, path))?.reason;
export const isDocsApp = (path) => DOCS_APP.some((p) => matchPattern(p, path));

// "/blog/my-post.md" is "/blog/my-post"; "/index.md" is "/". Null when the path has no .md suffix.
export function pathOfMdUrl(pathname) {
  if (!pathname.endsWith(".md")) return null;
  const path = pathname.slice(0, -3);
  return path === "/index" ? "/" : path;
}

export const mdUrlOf = (path) => (path === "/" ? "/index.md" : `${path}.md`);
export const isExcluded = (pathname) => MD_EXCLUDED.some((p) => (p.endsWith("/") ? pathname.startsWith(p) : pathname === p || pathname.startsWith(`${p}/`)));
