/** @type {import('next').NextConfig} */
import { DOCS_ORIGIN } from "./lib/docs-origin.mjs";
import { ALIAS_HOST_REDIRECT, LEGACY_REDIRECTS } from "./lib/redirects.mjs";

// The docs are a separate Next app (vawe-hq/vawe-docs) pinned to Next 16 + fumadocs 16, while this site
// is on Next 15. This app proxies /docs/* to it. The docs app sets basePath:"/docs", so its own links and
// assets already carry the prefix and pass straight through untouched. The origin is in
// lib/docs-origin.mjs; the rewrites below are fixed at build time.

// A PRODUCTION BUILD MUST NOT WRITE INTO THE DEV SERVER'S .next.
// `next build` against the same directory a dev server is serving leaves dev reading half-written
// chunks: it 500s with "Cannot find module ./981.js" on whichever route was mid-write, and only
// `rm -rf .next` clears it. That cost this session twice. `--distDir` is NOT a CLI flag in Next 15
// (it was removed; `next build --distDir x` exits "unknown option"), so the split has to live here.
const nextConfig = {
  distDir: process.env.NEXT_DIST_DIR || ".next",
  reactStrictMode: true,
  outputFileTracingRoot: import.meta.dirname,
  // Docker: emit a self-contained server so the runtime image carries no dev deps.
  output: "standalone",
  // The blog index, posts, feed and sitemap regenerate hourly at runtime (a scheduled post goes live on its date), so the server reads the posts itself.
  outputFileTracingIncludes: { "/**": ["./content/blog/*.md", "./content/llms-base.txt"] },
  async redirects() {
    return [
      // www.vawe.dev and vawe.dev both served 200 with no redirect between them, so Google split
      // the site's crawl and its link authority across two hostnames for the same 984 pages (GSC
      // confirmed both being indexed). `alternates.canonical` in app/layout.tsx already names the
      // apex as canonical, but a canonical tag only advises; it does not stop the second hostname
      // from being crawled and ranked on its own. A real 308 here does that, and it lives HERE
      // rather than at the Coolify/proxy layer: this app is the one thing both hostnames point at
      // (Coolify's own multi-domain redirect toggle is dashboard state, not something this repo can
      // commit or review), and Next's `has: [{ type: "host" }]` match runs on the Host header the
      // proxy forwards, which Coolify's default Traefik config passes through unmodified.
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.vawe.dev" }],
        destination: "https://vawe.dev/:path*",
        permanent: true,
      },
      // Next splits the Host on ':' before matching, so `[::1]:3000` arrives as `[` and would redirect; dev and LAN testing skip the rule.
      ...(process.env.NODE_ENV === "production" ? [ALIAS_HOST_REDIRECT] : []),
      ...LEGACY_REDIRECTS,
      // THE FEATURES FOLD: eight feature detail pages became three sections on /features itself.
      // Wildcarded, because the slugs were content and a new one must not 404 either. The route's
      // own social card lives under /features too, so it is excluded from the catch-all.
      { source: "/features/:slug((?!opengraph-image$).+)", destination: "/features", permanent: true },
    ];
  },
  // Clip files keep their names when a move is re-rendered, so the pages link them as ?v=<hash of the
  // source clip> (lib/clip.ts). A versioned URL never changes content: cache it for a year. The same
  // file without ?v= (an agent following index.json or llms.txt) and the .md revalidate after an hour.
  // Later entries win, so the versioned rule comes last.
  async headers() {
    const media = "/moves/:file(.+\\.(?:mp4|webm|webp|md))";
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Strict-Transport-Security", value: "max-age=63072000" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      // Link headers (canonical, describedby) come from the markdown
      // handler and middleware.ts, not from here.
      // Data files for agents: fetchable, not for the index.
      { source: "/:file(llms\\.txt|llms-full\\.txt)", headers: [{ key: "X-Robots-Tag", value: "noindex" }] },
      { source: "/:dir(moves|video-components)/index.json", headers: [{ key: "X-Robots-Tag", value: "noindex" }] },
      { source: media, headers: [{ key: "Cache-Control", value: "public, max-age=3600, stale-while-revalidate=86400" }] },
      {
        source: media,
        has: [{ type: "query", key: "v" }],
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
  async rewrites() {
    return [
      // The files for agents keep their /moves path (clips, .md, index.json); the gallery moved to /video-components, so its index.json serves the same file. Its .md twins go through middleware.ts.
      { source: "/video-components/index.json", destination: "/moves/index.json" },
      // the docs pages (fumadocs already routes these at /docs in its own app)
      { source: "/docs", destination: `${DOCS_ORIGIN}/docs` },
      { source: "/docs/:path*", destination: `${DOCS_ORIGIN}/docs/:path*` },
      // its assets, which the docs app emits under assetPrefix "/docs-static" precisely so they do
      // not collide with this app's own /_next/*
      { source: "/docs-static/:path*", destination: `${DOCS_ORIGIN}/docs-static/:path*` },
      // fumadocs' search endpoint
      { source: "/api/search", destination: `${DOCS_ORIGIN}/api/search` },
    ];
  },
};
export default nextConfig;
