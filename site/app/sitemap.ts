import type { MetadataRoute } from "next";
import pages from "../lib/site-pages.json";
import lastmod from "../lib/lastmod.json";
import { MOVES, clip, type Move } from "../lib/moves";
import { EASES } from "../lib/easing";
import { SPRINGS } from "../lib/springs";
import { allPosts, latestDate } from "../lib/blog";
import { SITE_URL } from "../lib/site";

/* site/app/sitemap.ts: every URL vawe.dev serves. The routes come from lib/site-pages.json, the same
 * file the footer nav reads; the move pages come from lib/moves.json, the posts from lib/blog.ts. To
 * add a route, add one entry to the list in `entries()` or to site-pages.json.
 *
 * lastmod is the date of the last commit that touched the page's source (scripts/site/lastmod.mjs for
 * routes, scripts/site/moves.mjs for moves). A post's is its `updated` date (else its date), and /blog's is the
 * newest post's. A route with no known date gets none: Google ignores a lastmod that is always "now",
 * so a missing one is better than a made-up one. Google ignores changefreq and priority, so they are
 * not emitted. A move with a clip also carries a <video:video> entry (Next's `videos` field), so there is
 * no second sitemap.
 */

type Entry = { path: string; lastmod?: string; videos?: MetadataRoute.Sitemap[number]["videos"] };

const dates = lastmod as Record<string, string>;

// A scheduled post enters the sitemap on its date: regenerate hourly.
export const revalidate = 3600;

// The same plain URLs the page's VideoObject names (no ?v= hash), whole seconds as the sitemap wants.
function moveVideos(m: Move) {
  if (!m.clipHash) return undefined;
  const files = clip(m);
  return [
    {
      title: m.title,
      description: m.use,
      thumbnail_loc: `${SITE_URL}${files.posterHd.split("?")[0]}`,
      content_loc: `${SITE_URL}${files.mp4.split("?")[0]}`,
      ...(m.duration ? { duration: Math.max(1, Math.round(m.duration)) } : {}),
      family_friendly: "yes" as const,
    },
  ];
}

function entries(): Entry[] {
  return [
    ...[...pages.routes, ...pages.docs].map((r) => ({ path: r.path, lastmod: r.path === "/blog" ? latestDate() : dates[r.path] })),
    ...MOVES.map((m) => ({ path: `/video-components/${m.name}`, lastmod: m.modified, videos: moveVideos(m) })),
    ...EASES.map((e) => ({ path: `/easing/${e.slug}`, lastmod: dates["/easing"] })),
    ...SPRINGS.map((s) => ({ path: `/springs/${s.slug}`, lastmod: dates["/springs"] })),
    ...allPosts().map((p) => ({ path: `/blog/${p.slug}`, lastmod: p.updated })),
  ];
}

export default function sitemap(): MetadataRoute.Sitemap {
  return entries().map((e) => ({
    url: `${SITE_URL}${e.path}`,
    ...(e.lastmod ? { lastModified: e.lastmod } : {}),
    ...(e.videos ? { videos: e.videos } : {}),
  }));
}
