import { OG_SIZE, prerenderedOg } from "../components/ogCard";

export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return prerenderedOg("/agentic-video-editing");
}
