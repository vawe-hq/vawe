import { ImageResponse } from "next/og";
import { OG_SIZE, loadOgFonts, renderOgCard } from "../../components/ogCard";
import { TEMPLATES, templateById } from "../../../lib/templates";

export const size = OG_SIZE;
export const contentType = "image/png";

export function generateStaticParams() {
  return TEMPLATES.map((t) => ({ id: t.id }));
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = templateById(id);
  const fonts = await loadOgFonts();
  return new ImageResponse(
    renderOgCard({ tag: "video template", title: t?.title ?? "Video templates", description: t?.summary ?? "", path: `/templates/${id}`, panel: null }),
    { ...OG_SIZE, fonts },
  );
}
