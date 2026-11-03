import { pageMetadata } from "../components/seo";
import { VideoTypePage } from "../components/VideoTypePage";
import { PRODUCT_SHOWCASE as C } from "../../lib/content/video-types";

export const metadata = pageMetadata({ ...C.meta, path: C.path });

export default function ProductShowcaseVideo() {
  return <VideoTypePage C={C} />;
}
