import { OG_SIZE, prerenderedOg } from "../../components/ogCard";
import { INSPIRATION_TYPE_PAGES } from "../../../lib/content/inspiration-types";

export const size = OG_SIZE;
export const contentType = "image/png";

export function generateStaticParams() {
  return INSPIRATION_TYPE_PAGES.map((t) => ({ type: t.id }));
}

export default function Image() {
  return prerenderedOg("/inspiration");
}
