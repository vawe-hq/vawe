// Check what Google sees on each route type: status, redirect target, canonical, robots meta and
// the X-Robots-Tag / Link headers.
//
//   node scripts/site/indexing-check.mjs [base-url]     (default http://localhost:3000)
//
// Run it against `next start` after a build, or against https://vawe.dev after a deploy. Exits 1 when a
// row differs from what is expected below. Redirects are not followed: each row is one response.
import http from "node:http";
import https from "node:https";

const base = new URL(process.argv[2] ?? "http://localhost:3000");
const SITE = "https://vawe.dev";

function get(path, headers = {}) {
  const url = new URL(path, base);
  const lib = url.protocol === "https:" ? https : http;
  return new Promise((resolve, reject) => {
    lib
      .get(url, { headers }, (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString("utf8") }));
      })
      .on("error", reject);
  });
}

const attr = (html, tag, re) => html.match(re)?.[1] ?? null;
const canonicalOf = (html) => attr(html, "canonical", /<link rel="canonical" href="([^"]*)"/);
const robotsOf = (html) => attr(html, "robots", /<meta name="robots" content="([^"]*)"/);

// kind: page (200, self canonical, indexable) | redirect (308 to `to`) | gone (404) | file (200, header rules)
const CASES = [
  { path: "/", kind: "page", canonical: SITE },
  { path: "/features", kind: "page", canonical: `${SITE}/features` },
  { path: "/video-components", kind: "page", canonical: `${SITE}/video-components` },
  { path: "/video-components?group=reveal-a-title", kind: "page", canonical: `${SITE}/video-components` },
  { path: "/video-components/flap-resolve", kind: "page", canonical: `${SITE}/video-components/flap-resolve` },
  { path: "/moves/flap-resolve.md", kind: "file", link: `<${SITE}/video-components/flap-resolve>; rel="canonical"` },
  { path: "/moves/index.json", kind: "file", xRobots: "noindex" },
  { path: "/llms.txt", kind: "file", xRobots: "noindex" },
  { path: "/llms-full.txt", kind: "file", xRobots: "noindex" },
  { path: "/ai-agents.md", kind: "file", link: `<${SITE}/ai-agents>; rel="canonical"` },
  { path: "/easing", kind: "page", canonical: `${SITE}/easing` },
  { path: "/easing?compare=land,leave", kind: "page", canonical: `${SITE}/easing` },
  { path: "/easing/land", kind: "page", canonical: `${SITE}/easing/land` },
  { path: "/easing/ease-in-back", kind: "page", canonical: `${SITE}/easing/ease-in-back` },
  { path: "/blog", kind: "page", canonical: `${SITE}/blog` },
  { path: "/vs/remotion", kind: "page", canonical: `${SITE}/vs/remotion` },
  { path: "/resources", kind: "page", canonical: `${SITE}/resources` },
  { path: "/about", kind: "page", canonical: `${SITE}/about` },
  { path: "/video-components/", kind: "redirect", to: `${SITE}/video-components` },
  { path: "/about/", kind: "redirect", to: `${SITE}/about` },
  { path: "/", host: "www.vawe.dev", kind: "redirect", to: `${SITE}/` },
  { path: "/arsenal", kind: "redirect", to: "/video-components" },
  { path: "/arsenal/effects/shader-stings--warp", kind: "redirect", to: "/video-components/liquid-wipe" },
  { path: "/arsenal/effects/easings--easeinback", kind: "redirect", to: "/easing/ease-in-back" },
  { path: "/arsenal/codeBlock.midnight", kind: "redirect", to: "/video-components/caret-typing" },
  { path: "/moves/flash-cut", kind: "redirect", to: "/video-components/exposure-flash" },
  { path: "/moves/flash-cut.md", kind: "redirect", to: "/video-components/exposure-flash" },
  { path: "/moves/push-in", kind: "redirect", to: "/video-components/camera-moves" },
  { path: "/moves/land", kind: "redirect", to: "/easing/land" },
  { path: "/moves/pop.mp4", kind: "redirect", to: "/easing/pop" },
  { path: "/editor", kind: "redirect", to: "/docs/quickstart" },
  { path: "/playground/x", kind: "redirect", to: "/video-components" },
  { path: "/deck", kind: "redirect", to: "/docs/motion" },
  { path: "/features/old-feature", kind: "redirect", to: "/features" },
  { path: "/blog/taste-digest", kind: "redirect", to: "/blog/weaker-model" },
  { path: "/nope", kind: "gone" },
  { path: "/video-components/not-a-move", kind: "gone" },
  { path: "/moves", kind: "redirect", to: "/video-components" },
  { path: "/moves/lens", kind: "redirect", to: "/video-components/lens" },
];

const normal = (u) => {
  const url = new URL(u, SITE);
  return `${url.origin}${url.pathname.replace(/\/$/, "")}${url.search}`;
};
const sameTarget = (location, to) => Boolean(location) && normal(location) === normal(to);

function judge(c, r) {
  const html = r.body;
  const xRobots = r.headers["x-robots-tag"] ?? "";
  if (c.kind === "redirect") {
    if (r.status !== 308) return `status ${r.status}, want 308`;
    return sameTarget(r.headers.location, c.to) ? null : `location ${r.headers.location}, want ${c.to}`;
  }
  if (c.kind === "gone") return r.status === 404 ? null : `status ${r.status}, want 404`;
  if (r.status !== 200) return `status ${r.status}, want 200`;
  if (c.kind === "file") {
    if (c.link && !String(r.headers.link ?? "").includes(c.link)) return `Link header ${r.headers.link}, want ${c.link}`;
    if (c.xRobots && !xRobots.includes(c.xRobots)) return `X-Robots-Tag "${xRobots}", want ${c.xRobots}`;
    return null;
  }
  if (xRobots.includes("noindex") || robotsOf(html)?.includes("noindex")) return "noindex on an indexable page";
  const canonical = canonicalOf(html);
  return canonical === c.canonical ? null : `canonical ${canonical}, want ${c.canonical}`;
}

let failed = 0;
for (const c of CASES) {
  const r = await get(c.path, c.host ? { host: c.host } : {});
  const problem = judge(c, r);
  if (problem) failed++;
  const seen = r.headers.location ?? canonicalOf(r.body) ?? "";
  console.log(`${problem ? "FAIL" : "ok  "}  ${String(r.status)}  ${c.host ? `${c.host}` : ""}${c.path}  ${seen}${problem ? `   <- ${problem}` : ""}`);
}
if (failed) {
  console.error(`${failed} of ${CASES.length} rows differ`);
  process.exit(1);
}
console.log(`all ${CASES.length} rows match`);
