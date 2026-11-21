import { TEMPLATES, publicMetadata } from "../../lib/templates";
import { SITE_URL } from "../../lib/site";

export const dynamic = "force-static";

export function GET() {
  return Response.json(
    { site: SITE_URL, count: TEMPLATES.length, templates: publicMetadata() },
    { headers: { "cache-control": "public, s-maxage=3600, stale-while-revalidate=86400", "x-robots-tag": "noindex" } },
  );
}
