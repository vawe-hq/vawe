import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "../../components/Header";
import { Footer } from "../../components/Footer";
import { Next } from "../../components/Xp";
import { pageMetadata } from "../../components/seo";
import { SOFTWARE, availabilityText, categoryLabel, creatorByHandle, priceLabel, profileHandles, profileOf, rateLabel, softwareLabel, type MarketItem } from "../../../lib/marketplace";
import { jsonLdScript } from "../../../lib/schema";
import { marketplaceCrumbs, profileSchema } from "../../../lib/schema-marketplace";
import { MarketGallery } from "../../marketplace/MarketGallery";
import { Avatar, Facts } from "../../marketplace/parts";
import "../../video-components/moves.css";
import "../../templates/templates.css";
import "../../marketplace/marketplace.css";

type Params = { params: Promise<{ handle: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return profileHandles().map((handle) => ({ handle }));
}

function describe(handle: string) {
  const p = profileOf(handle);
  if (!p) return "";
  const parts = [p.listings.length ? `${p.listings.length} motion design template${p.listings.length === 1 ? "" : "s"}` : "", p.designer ? `open to work: ${availabilityText(p.designer).toLowerCase()}` : ""].filter(Boolean);
  return `${p.name}, motion designer. ${parts.join(", ")}.${p.bio ? ` ${p.bio.split("\n")[0]}` : ""}`.slice(0, 300);
}

export async function generateMetadata({ params }: Params) {
  const { handle } = await params;
  const p = profileOf(handle);
  if (!p) return {};
  return pageMetadata({ title: `${p.name} (@${p.handle}), motion designer | vawe`, description: describe(handle), path: `/creators/${handle}` });
}

export default async function CreatorPage({ params }: Params) {
  const { handle } = await params;
  const p = profileOf(handle);
  if (!p) notFound();
  const d = p.designer;
  const items: MarketItem[] = p.listings.map((l) => ({
    key: l.id, title: l.title, summary: l.summary, software: l.software, category: l.category, href: `/marketplace/${l.id}`,
    poster: l.poster, preview: l.preview, free: l.price.amount === 0, price: priceLabel(l.price), by: creatorByHandle(handle)?.name ?? p.name,
  }));
  const hire: [string, ReactNode][] = d
    ? [
        ["Availability", availabilityText(d)],
        ...(d.rate ? [["Rate", rateLabel(d.rate)] as [string, string]] : []),
        ...(d.location ? [["Based in", d.location] as [string, string]] : []),
        ["Software", d.software.map(softwareLabel).join(", ")],
        ["Updated", d.updated],
      ]
    : [];

  return (
    <div className="shell">
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(profileSchema(p))} />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(marketplaceCrumbs([{ name: d && !p.listings.length ? "Hire" : "Marketplace", url: d && !p.listings.length ? "/hire" : "/marketplace" }, { name: p.name, url: `/creators/${p.handle}` }]))} />
      <Header />
      <main className="wrap" id="content" tabIndex={-1}>
        <article className="ipage mk-page">
          <header className="phead mk-profile">
            <p className="kicker">
              {p.listings.length ? <Link href="/marketplace">Marketplace</Link> : <Link href="/hire">Hire</Link>}
            </p>
            <div className="mk-profile-top">
              <Avatar name={p.name} src={p.avatar} size={72} />
              <div>
                <h1>{p.name}</h1>
                <p className="meta">@{p.handle}</p>
              </div>
            </div>
            {p.bio ? <p className="mk-lead mk-bio">{p.bio}</p> : null}
            <div className="mk-buy">
              {d ? <a className="btn btn-primary" href={d.reel} rel="noopener">Watch the reel <span className="arw">→</span></a> : null}
              {p.link ? <a className={d ? "btn btn-ghost" : "btn btn-primary"} href={p.link} rel="noopener me">Visit {new URL(p.link).hostname.replace(/^www\./, "")}</a> : null}
            </div>
          </header>

          {d ? (
            <>
              <h2 className="tpl-h">Hire {p.name}</h2>
              <Facts rows={hire} />
              <p className="mk-hint">Contact {p.name} through the reel or the site above. vawe takes no fee.</p>
            </>
          ) : null}

          {items.length ? (
            <>
              <h2 className="tpl-h">Templates</h2>
              <p className="mk-hint">{[...new Set(p.listings.map((l) => `${softwareLabel(l.software)} ${categoryLabel(l.category).toLowerCase()}`))].join(", ")}</p>
              <MarketGallery items={items} facets={[]} labels={Object.fromEntries(SOFTWARE.map((s) => [s.id, s.label]))} />
            </>
          ) : null}

          <Next
            title="Make your own page."
            lead="List a template or add a hire-me profile, and get a page like this one."
            primary={{ href: "/marketplace/submit", label: "List a template" }}
            secondary={{ href: "/hire/join", label: "Add a hire-me profile" }}
            related={[
              { href: "/marketplace", label: "All templates" },
              { href: "/hire", label: "Designers open to work" },
            ]}
          />
        </article>
      </main>
      <Footer />
    </div>
  );
}
