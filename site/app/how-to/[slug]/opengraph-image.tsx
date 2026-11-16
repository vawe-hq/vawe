import { OG_SIZE, staticOgImage } from "../../components/ogCard";
import { HOW_TOS, HOW_TO_BY_SLUG, howToPath } from "../../../lib/content/how-to";

export const size = OG_SIZE;
export const contentType = "image/png";

export function generateStaticParams() {
  return HOW_TOS.map((h) => ({ slug: h.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const h = HOW_TO_BY_SLUG[slug];
  return staticOgImage({ tag: "how-to", title: h.h1, description: h.blurb, path: howToPath(h.slug) });
}
