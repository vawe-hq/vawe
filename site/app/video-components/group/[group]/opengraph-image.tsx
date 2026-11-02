import { OG_SIZE, staticOgImage } from "../../../components/ogCard";
import { GROUPS } from "../../../../lib/moves";
import { groupFacts, groupMetaDescription, groupPage, groupPath } from "../../../../lib/content/move-groups";

export const size = OG_SIZE;
export const contentType = "image/png";

export function generateStaticParams() {
  return GROUPS.map((g) => ({ group: g.id }));
}

export default async function Image({ params }: { params: Promise<{ group: string }> }) {
  const p = groupPage((await params).group)!;
  return staticOgImage({
    tag: "video components",
    title: `${groupFacts(p.id).label}.`,
    description: groupMetaDescription(p),
    path: groupPath(p.id),
  });
}
