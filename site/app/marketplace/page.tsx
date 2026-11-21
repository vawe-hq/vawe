import Link from "next/link";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";
import { Next } from "../components/Xp";
import { pageMetadata } from "../components/seo";
import { CATEGORIES, MARKETPLACE_DESCRIPTION, MARKETPLACE_INTRO, MARKETPLACE_TITLE, SOFTWARE, marketItems } from "../../lib/marketplace";
import { jsonLdScript } from "../../lib/schema";
import { marketplaceListSchema } from "../../lib/schema-marketplace";
import { MarketGallery } from "./MarketGallery";
import { Empty } from "./parts";
import { EMPTY } from "../../lib/marketplace-pages";
import "../video-components/moves.css";
import "../templates/templates.css";
import "./marketplace.css";

export const metadata = pageMetadata({ title: MARKETPLACE_TITLE, description: MARKETPLACE_DESCRIPTION, path: "/marketplace" });

const FACETS = [
  { key: "software", label: "Software", options: SOFTWARE },
  { key: "category", label: "Category", options: CATEGORIES },
  { key: "price", label: "Price", options: [{ id: "free", label: "Free" }, { id: "paid", label: "Paid" }] },
];

export default function Marketplace() {
  const items = marketItems();
  const labels = Object.fromEntries(SOFTWARE.map((s) => [s.id, s.label]));
  return (
    <div className="shell">
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(marketplaceListSchema(items, { name: "Motion design templates", path: "/marketplace" }))} />
      <Header active="marketplace" />
      <main className="wrap" id="content" tabIndex={-1}>
        <section className="ls ls-top mv">
          <h1>Marketplace.</h1>
          <p className="mv-intro">{MARKETPLACE_INTRO}</p>
          <p className="mv-intro">
            Our own <Link href="/templates">vawe templates</Link> sit here too, with a vawe badge. Looking for work or for a motion designer? See the <Link href="/jobs">jobs</Link> and the <Link href="/hire">designers open to work</Link>.
          </p>
          <div className="mk-act">
            <a className="btn btn-primary" href="/marketplace/submit">List your template <span className="arw">→</span></a>
          </div>
          {items.length ? (
            <MarketGallery items={items} facets={FACETS} labels={labels} />
          ) : (
            <Empty title="No templates listed yet." action={{ href: "/marketplace/submit", label: "List the first one" }}>
              {EMPTY.listing}
            </Empty>
          )}
          <h2 className="tpl-h">How a listing works</h2>
          <ol className="mk-steps">
            <li>You fill in the form: the template, a preview video, a poster, the price and the link to your store.</li>
            <li>The form opens a pull request on GitHub that adds your listing as a JSON file. The owner checks it and merges it.</li>
            <li>Your listing goes live with its own page and your creator page. Buyers pay you on your store.</li>
          </ol>
          <Next
            title="Sell what you make."
            lead="One form, no fee, no cut."
            primary={{ href: "/marketplace/submit", label: "List your template" }}
            secondary={{ href: "/jobs", label: "See motion design jobs" }}
            related={[
              { href: "/templates", label: "vawe templates you remix with one command" },
              { href: "/hire", label: "Hire a motion designer" },
              { href: "/video-components", label: "Video components for vawe films" },
            ]}
          />
        </section>
      </main>
      <Footer active="/marketplace" />
    </div>
  );
}
