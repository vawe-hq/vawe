import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "../../components/Header";
import { Footer } from "../../components/Footer";
import { Next } from "../../components/Xp";
import { pageMetadata } from "../../components/seo";
import { applyLabel, employmentLabel, jobById, jobValidThrough, liveJobs, payLabel, placeLabel, softwareLabel, workplaceLabel } from "../../../lib/marketplace";
import { jsonLdScript } from "../../../lib/schema";
import { CONTACT_URL } from "../../../lib/site";
import { jobPostingSchema, marketplaceCrumbs, paragraphs } from "../../../lib/schema-marketplace";
import { Chips, Facts } from "../../marketplace/parts";
import "../../video-components/moves.css";
import "../../templates/templates.css";
import "../../marketplace/marketplace.css";

type Params = { params: Promise<{ id: string }> };

export const dynamicParams = false;
export const revalidate = 3600;

export function generateStaticParams() {
  return liveJobs().map((j) => ({ id: j.id }));
}

export async function generateMetadata({ params }: Params) {
  const j = jobById((await params).id);
  if (!j) return {};
  return pageMetadata({
    title: `${j.title} at ${j.company} | vawe`,
    description: `${j.title} at ${j.company}. ${placeLabel(j)}, ${j.employment.map(employmentLabel).join(", ").toLowerCase()}${j.pay ? `, ${payLabel(j.pay)}` : ""}.`,
    path: `/jobs/${j.id}`,
    type: "article",
  });
}

export default async function JobPage({ params }: Params) {
  const j = jobById((await params).id);
  if (!j) notFound();
  const rows: [string, ReactNode][] = [
    ["Company", j.companyUrl ? <a href={j.companyUrl} rel="noopener">{j.company}</a> : j.company],
    ["Where", `${workplaceLabel(j.workplace)}: ${j.workplace === "remote" ? `people who live in ${j.countries.join(", ")}` : placeLabel(j)}`],
    ["Type", j.employment.map(employmentLabel).join(", ")],
    ["Pay", j.pay ? payLabel(j.pay) : "Not stated"],
    ["Posted", j.posted],
    ["Closes", jobValidThrough(j)],
  ];

  return (
    <div className="shell">
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(jobPostingSchema(j))} />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(marketplaceCrumbs([{ name: "Jobs", url: "/jobs" }, { name: j.title, url: `/jobs/${j.id}` }]))} />
      <Header active="jobs" />
      <main className="wrap" id="content" tabIndex={-1}>
        <article className="ipage mk-page">
          <header className="phead">
            <p className="kicker">
              <Link href="/jobs">Jobs</Link>
            </p>
            <h1>{j.title}</h1>
            <p className="mk-lead">{j.company} · {placeLabel(j)}</p>
          </header>
          <Facts rows={rows} />
          {j.software.length ? <Chips items={j.software.map(softwareLabel)} /> : null}
          <h2 className="tpl-h">The job</h2>
          <div className="mk-prose">
            {paragraphs(j.description).map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
          <div className="mk-buy">
            <a className="btn btn-primary" href={j.apply} rel="noopener">
              {applyLabel(j.apply)} <span className="arw">→</span>
            </a>
            <p className="mk-hint">You apply with {j.company} directly. vawe never sees your application.</p>
          </div>
          <p className="mk-hint mk-report">
            Something wrong with this job? <a href={CONTACT_URL}>Tell us on GitHub</a>.
          </p>
          <Next
            title="Not the one?"
            primary={{ href: "/jobs", label: "All jobs" }}
            secondary={{ href: "/hire/join", label: "Add a hire-me profile" }}
            related={[
              { href: "/marketplace", label: "Templates by motion designers" },
              { href: "/jobs/post", label: "Post a job" },
            ]}
          />
        </article>
      </main>
      <Footer />
    </div>
  );
}
