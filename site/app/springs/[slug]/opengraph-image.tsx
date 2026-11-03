import { ImageResponse } from "next/og";
import { OG_SIZE, loadOgFonts, renderOgCard } from "../../components/ogCard";
import { SPRINGS, springBySlug, summary } from "../../../lib/springs";

export const size = OG_SIZE;
export const contentType = "image/png";

export function generateStaticParams() {
  return SPRINGS.map((s) => ({ slug: s.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const s = springBySlug(slug);
  const fonts = await loadOgFonts();
  return new ImageResponse(
    renderOgCard({
      tag: "springs",
      title: s ? s.name : "Springs",
      description: s ? `${s.note} ${summary(s)}` : "",
      path: `/springs/${slug}`,
      panel: s ? { kind: "code", text: `stiffness ${s.k}, damping ${s.d}` } : null,
    }),
    { ...OG_SIZE, fonts },
  );
}
