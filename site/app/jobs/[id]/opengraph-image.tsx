import { OG_SIZE, staticOgImage } from "../../components/ogCard";
import { jobById, liveJobs, placeLabel } from "../../../lib/marketplace";

export const size = OG_SIZE;
export const contentType = "image/png";
export const revalidate = 3600;

export function generateStaticParams() {
  return liveJobs().map((j) => ({ id: j.id }));
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const j = jobById(id);
  return staticOgImage({ tag: j ? `job · ${j.company}` : "jobs", title: j?.title ?? "Motion design jobs", description: j ? placeLabel(j) : "", path: `/jobs/${id}` });
}
