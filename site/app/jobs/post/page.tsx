import { pageMetadata } from "../../components/seo";
import { SUBMIT_PAGES } from "../../../lib/marketplace-pages";
import { SubmitPage } from "../../marketplace/SubmitPage";

const P = SUBMIT_PAGES.job;

export const metadata = pageMetadata({ title: P.title, description: P.description, path: P.path });

export default function PostJob() {
  return <SubmitPage kind="job" parent={{ href: "/jobs", label: "Jobs" }} current="Post a job" />;
}
