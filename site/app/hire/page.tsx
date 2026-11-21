import Link from "next/link";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";
import { Next } from "../components/Xp";
import { pageMetadata } from "../components/seo";
import { DESIGNERS, HIRE_DESCRIPTION, HIRE_INTRO, HIRE_TITLE, TOOLS, availabilityText, rateLabel, softwareLabel, type Designer } from "../../lib/marketplace";
import { AVAILABILITY } from "../../lib/marketplace-schema.mjs";
import { jsonLdScript } from "../../lib/schema";
import { marketplaceListSchema } from "../../lib/schema-marketplace";
import { Empty } from "../marketplace/parts";
import { EMPTY } from "../../lib/marketplace-pages";
import { HireBoard, type DesignerCard } from "./HireBoard";
import "../video-components/moves.css";
import "../templates/templates.css";
import "../marketplace/marketplace.css";

export const metadata = pageMetadata({ title: HIRE_TITLE, description: HIRE_DESCRIPTION, path: "/hire" });

const FACETS = [
  { key: "availability", label: "Availability", options: AVAILABILITY },
  { key: "software", label: "Software", options: TOOLS },
];

const ORDER = AVAILABILITY.map((a) => a.id);

const card = (d: Designer): DesignerCard => ({
  handle: d.handle,
  name: d.name,
  avatar: d.avatar,
  location: d.location,
  availability: d.availability,
  availabilityText: availabilityText(d),
  rate: d.rate ? rateLabel(d.rate) : "",
  software: d.software,
  softwareText: d.software.map(softwareLabel),
  reel: d.reel,
});

export default function Hire() {
  const designers = [...DESIGNERS].sort((a, b) => ORDER.indexOf(a.availability) - ORDER.indexOf(b.availability) || b.updated.localeCompare(a.updated));
  return (
    <div className="shell">
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(marketplaceListSchema(designers.map((d) => ({ title: d.name, href: `/creators/${d.handle}` })), { name: "Motion designers open to work", path: "/hire" }))} />
      <Header active="hire" />
      <main className="wrap" id="content" tabIndex={-1}>
        <section className="ls ls-top mv">
          <h1>Hire a motion designer.</h1>
          <p className="mv-intro">{HIRE_INTRO}</p>
          <p className="mv-intro">
            Have a role to fill? <Link href="/jobs/post">Post a job</Link> on the <Link href="/jobs">jobs board</Link>. Each designer’s templates sit on their page in the <Link href="/marketplace">marketplace</Link>.
          </p>
          <div className="mk-act">
            <a className="btn btn-primary" href="/hire/join">Add your profile <span className="arw">→</span></a>
          </div>
          {designers.length ? (
            <HireBoard designers={designers.map(card)} facets={FACETS} />
          ) : (
            <Empty title="No designers listed yet." action={{ href: "/hire/join", label: "Add the first profile" }}>
              {EMPTY.designer}
            </Empty>
          )}
          <Next
            title="Open to work?"
            lead="Add your reel and your rate. No fee from either side."
            primary={{ href: "/hire/join", label: "Add your profile" }}
            secondary={{ href: "/jobs", label: "See open jobs" }}
            related={[
              { href: "/marketplace/submit", label: "List a template you made" },
              { href: "/inspiration", label: "Motion design inspiration" },
            ]}
          />
        </section>
      </main>
      <Footer active="/hire" />
    </div>
  );
}
