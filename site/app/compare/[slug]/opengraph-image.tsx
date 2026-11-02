import { OG_SIZE, staticOgImage } from "../../components/ogCard";
import { COMPARE_REMOTION_HYPERFRAMES as C } from "../../../lib/content/compare";

export const size = OG_SIZE;
export const contentType = "image/png";

export function generateStaticParams() {
  return [{ slug: C.slug }];
}

export default async function Image() {
  return staticOgImage({ tag: "compare", title: C.h1, description: C.intro.split(". ").slice(0, 2).join(". ") + ".", path: C.path });
}
