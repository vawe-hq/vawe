import { pageMetadata } from "../../components/seo";
import { SUBMIT_PAGES } from "../../../lib/marketplace-pages";
import { SubmitPage } from "../SubmitPage";

const P = SUBMIT_PAGES.listing;

export const metadata = pageMetadata({ title: P.title, description: P.description, path: P.path });

export default function SubmitListing() {
  return <SubmitPage kind="listing" parent={{ href: "/marketplace", label: "Marketplace" }} current="List a template" />;
}
