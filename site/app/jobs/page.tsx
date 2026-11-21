import Link from "next/link";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";
import { Next } from "../components/Xp";
import { pageMetadata } from "../components/seo";
import { JOBS_DESCRIPTION, JOBS_INTRO, JOBS_TITLE, TOOLS, employmentLabel, liveJobs, payLabel, placeLabel, type Job } from "../../lib/marketplace";
import { EMPLOYMENT, WORKPLACES } from "../../lib/marketplace-schema.mjs";
import { jsonLdScript } from "../../lib/schema";
import { marketplaceListSchema } from "../../lib/schema-marketplace";
import { Empty } from "../marketplace/parts";
import { EMPTY } from "../../lib/marketplace-pages";
import { JobsBoard, type JobRow } from "./JobsBoard";
import "../video-components/moves.css";
import "../templates/templates.css";
import "../marketplace/marketplace.css";

export const metadata = pageMetadata({ title: JOBS_TITLE, description: JOBS_DESCRIPTION, path: "/jobs" });

// An expired job leaves the board within the hour, without a deploy.
export const revalidate = 3600;

const FACETS = [
  { key: "workplace", label: "Where", options: WORKPLACES },
  { key: "employment", label: "Type", options: EMPLOYMENT },
  { key: "software", label: "Software", options: TOOLS },
];

const row = (j: Job): JobRow => ({
  id: j.id,
  title: j.title,
  company: j.company,
  place: placeLabel(j),
  type: j.employment.map(employmentLabel).join(", "),
  pay: j.pay ? payLabel(j.pay) : "",
  posted: j.posted,
  workplace: j.workplace,
  employment: j.employment,
  software: j.software,
});

export default function Jobs() {
  const jobs = liveJobs();
  return (
    <div className="shell">
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(marketplaceListSchema(jobs.map((j) => ({ title: j.title, href: `/jobs/${j.id}` })), { name: "Motion design jobs", path: "/jobs" }))} />
      <Header active="jobs" />
      <main className="wrap" id="content" tabIndex={-1}>
        <section className="ls ls-top mv">
          <h1>Motion design jobs.</h1>
          <p className="mv-intro">{JOBS_INTRO}</p>
          <p className="mv-intro">
            Looking for work instead? <Link href="/hire/join">Add a hire-me profile</Link>. Selling templates? List them on the <Link href="/marketplace">marketplace</Link>.
          </p>
          <div className="mk-act">
            <a className="btn btn-primary" href="/jobs/post">Post a job <span className="arw">→</span></a>
          </div>
          {jobs.length ? (
            <JobsBoard jobs={jobs.map(row)} facets={FACETS} />
          ) : (
            <Empty title="No open jobs right now." action={{ href: "/jobs/post", label: "Post the first job" }}>
              {EMPTY.job}
            </Empty>
          )}
          <Next
            title="Hiring?"
            lead="Post a job for free, or contact a designer who is open to work."
            primary={{ href: "/jobs/post", label: "Post a job" }}
            secondary={{ href: "/hire", label: "See designers open to work" }}
            related={[
              { href: "/marketplace", label: "Templates by motion designers" },
              { href: "/inspiration", label: "Motion design inspiration" },
            ]}
          />
        </section>
      </main>
      <Footer active="/jobs" />
    </div>
  );
}
