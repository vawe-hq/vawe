import { ImageResponse } from "next/og";
import { OG_SIZE, loadOgFonts, renderOgCard } from "../../../components/ogCard";
import { JOB_SLUGS, jobPageBySlug } from "../../../../lib/easing-jobs";

export const size = OG_SIZE;
export const contentType = "image/png";

export function generateStaticParams() {
  return JOB_SLUGS.map((job) => ({ job }));
}

export default async function Image({ params }: { params: Promise<{ job: string }> }) {
  const { job } = await params;
  const p = jobPageBySlug(job);
  const fonts = await loadOgFonts();
  const curve = p?.ease ? (p.ease.kind === "vawe" ? `cubic-bezier(${p.ease.bezier.params.join(", ")})` : p.ease.linear.slice(0, 160)) : p?.time ?? "";
  return new ImageResponse(
    renderOgCard({
      tag: "easing",
      title: p ? p.h1.replace(/: .*$/, "") : "Easing for a job",
      description: p ? p.description : "",
      path: `/easing/for/${job}`,
      panel: p ? { kind: "code", text: curve } : null,
    }),
    { ...OG_SIZE, fonts },
  );
}
