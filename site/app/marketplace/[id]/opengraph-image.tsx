import { OG_SIZE, staticOgImage } from "../../components/ogCard";
import { LISTINGS, listingById, priceLabel, softwareLabel } from "../../../lib/marketplace";

export const size = OG_SIZE;
export const contentType = "image/png";

export function generateStaticParams() {
  return LISTINGS.map((l) => ({ id: l.id }));
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const l = listingById(id);
  return staticOgImage({
    tag: l ? `${softwareLabel(l.software)} template · ${priceLabel(l.price)}` : "marketplace",
    title: l?.title ?? "Templates by motion designers",
    description: l?.summary ?? "",
    path: `/marketplace/${id}`,
  });
}
