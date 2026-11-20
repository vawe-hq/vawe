import fs from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import { isRendered, mdUrlOf } from "../../lib/md/routes.mjs";
import { SITE_URL } from "../../lib/site";

// The loops are `vawe dev` drafts, 960x504: half the 1920x1008 frame a 1200:630 page renders at. Next does not resolve og:video against metadataBase,
// so the URL is absolute, as on the home page.
const LOOP_SIZE = { width: 960, height: 504 } as const;

function shareLoop(route: string) {
  const file = `/og${route}.mp4`;
  if (!fs.existsSync(path.join(process.cwd(), "public", file))) return undefined;
  const url = `${SITE_URL}${file}`;
  return [{ url, secureUrl: url, type: "video/mp4", ...LOOP_SIZE }];
}

// Google shows about 60 characters of a title, so the brand suffix stays only where it fits.
const TITLE_MAX = 60;
const BRAND_SUFFIX = / \| vawe( blog)?$/;

export function fitTitle(title: string) {
  if (title.length <= TITLE_MAX || !BRAND_SUFFIX.test(title)) return title;
  const core = title.replace(BRAND_SUFFIX, "");
  const short = `${core} | vawe`;
  return short.length <= TITLE_MAX ? short : core;
}

// A route with a markdown renderer (lib/md/routes.mjs) also gets its <link rel="alternate" type="text/markdown">.
// `ai-summary` defaults to the meta description; pass `aiSummary` to give a key page its own.
//
// ONE HELPER, NOT 27 COPIES. Every route on vawe.dev calls this instead of hand-rolling its own
// canonical/OpenGraph/Twitter block. `metadataBase` (app/layout.tsx) is set to https://vawe.dev, so a
// relative `path` here resolves correctly for both the canonical link and the OG url.
//
// No `images` field here on purpose: every route this helper serves has a sibling
// `opengraph-image.tsx` (see app/components/ogCard.tsx) that Next reads and injects the og:image /
// twitter:image tags from automatically. Setting an image here too would just print a second,
// competing tag. A main page with a share loop (public/og/<route>.mp4, scripts/site/og-cards.mjs --loops) also
// gets og:video. Only the homepage and routes that set no openGraph take the root `app/opengraph-image.tsx`; a route built with this helper needs its own card. The homepage sets
// its own openGraph/twitter block directly in app/layout.tsx instead of calling this helper.
export function pageMetadata(opts: {
  title: string;
  description: string;
  path: string;
  type?: "website" | "article";
  aiSummary?: string;
}): Metadata {
  const { description, path, type = "website", aiSummary = description } = opts;
  const title = fitTitle(opts.title);
  return {
    title,
    description,
    alternates: { canonical: path, ...(isRendered(path) ? { types: { "text/markdown": mdUrlOf(path) } } : {}) },
    other: { "ai-summary": aiSummary },
    openGraph: {
      title,
      description,
      type,
      url: path,
      siteName: "vawe",
      videos: shareLoop(path),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}
