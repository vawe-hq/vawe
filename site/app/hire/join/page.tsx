import { pageMetadata } from "../../components/seo";
import { SUBMIT_PAGES } from "../../../lib/marketplace-pages";
import { SubmitPage } from "../../marketplace/SubmitPage";

const P = SUBMIT_PAGES.designer;

export const metadata = pageMetadata({ title: P.title, description: P.description, path: P.path });

export default function JoinHire() {
  return <SubmitPage kind="designer" parent={{ href: "/hire", label: "Hire" }} current="Add your profile" />;
}
