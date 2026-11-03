import { pageMetadata } from "../components/seo";
import { VideoTypePage } from "../components/VideoTypePage";
import { EXPLAINER as C } from "../../lib/content/video-types";

export const metadata = pageMetadata({ ...C.meta, path: C.path });

export default function ExplainerVideo() {
  return <VideoTypePage C={C} />;
}
