import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "../../components/Header";
import { Footer } from "../../components/Footer";
import { Clip } from "../../components/Clip";
import { Next } from "../../components/Xp";
import { pageMetadata } from "../../components/seo";
import { LISTINGS, categoryLabel, creatorByHandle, listingById, listingsBy, priceLabel, softwareLabel, storeName, type Creator } from "../../../lib/marketplace";
import { jsonLdScript } from "../../../lib/schema";
import { listingSchema, marketplaceCrumbs } from "../../../lib/schema-marketplace";
import { Avatar, Chips, Facts } from "../parts";
import "../../video-components/moves.css";
import "../../templates/templates.css";
import "../marketplace.css";

type Params = { params: Promise<{ id: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return LISTINGS.map((l) => ({ id: l.id }));
}

export async function generateMetadata({ params }: Params) {
  const l = listingById((await params).id);
  if (!l) return {};
  return pageMetadata({
    title: `${l.title}: ${softwareLabel(l.software)} template | vawe`,
    description: `${l.summary} ${priceLabel(l.price)}, by ${creatorByHandle(l.creator)?.name ?? l.creator}.`,
    path: `/marketplace/${l.id}`,
    type: "article",
  });
}

export default async function ListingPage({ params }: Params) {
  const l = listingById((await params).id);
  if (!l) notFound();
  const c: Creator = creatorByHandle(l.creator) ?? { handle: l.creator, name: l.creator, link: "" };
  const more = listingsBy(l.creator).filter((x) => x.id !== l.id);
  const free = l.price.amount === 0;
  const rows: [string, ReactNode][] = [
    ["Software", `${softwareLabel(l.software)}${l.version ? `, ${l.version}` : ""}`],
    ["Category", categoryLabel(l.category)],
    ["Price", priceLabel(l.price)],
    ...(l.length ? [["Length", `${l.length} s`] as [string, string]] : []),
    ...(l.resolution ? [["Resolution", l.resolution] as [string, string]] : []),
    ["Plugins", l.plugins ?? "Not stated"],
    ["Listed", l.added],
  ];

  return (
    <div className="shell">
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(listingSchema(l, c))} />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(marketplaceCrumbs([{ name: "Marketplace", url: "/marketplace" }, { name: l.title, url: `/marketplace/${l.id}` }]))} />
      <Header active="marketplace" />
      <main className="wrap" id="content" tabIndex={-1}>
        <article className="mvd">
          <header className="phead mvd-head">
            <p className="kicker">
              <Link href="/marketplace">Marketplace</Link>
              <span aria-hidden="true">/</span>
              <Link href={`/marketplace?software=${l.software}`}>{softwareLabel(l.software)}</Link>
            </p>
            <h1>{l.title}</h1>
            <p className="mvd-use">{l.summary}</p>
            <p className="mvd-meta">
              <span className="mv-pill">{priceLabel(l.price)}</span>
              <span className="mv-pill">{softwareLabel(l.software)}</span>
              <span className="mv-pill">{categoryLabel(l.category)}</span>
            </p>
          </header>

          <figure className="mvd-clip panel">
            <div className="mvd-stage">
              <img src={l.poster} alt={`${l.title}: a frame from the preview`} width={1280} height={720} fetchPriority="high" decoding="async" />
              <Clip src={l.preview} poster={l.poster} label={`${l.title} preview`} />
            </div>
          </figure>

          <div className="mk-buy">
            <a className="btn btn-primary" href={l.url} rel="noopener">
              {free ? "Download" : "Buy"} on {storeName(l.url)} <span className="arw">→</span>
            </a>
            <p className="mk-hint">You {free ? "download it" : "pay"} on {c.name}’s own store. vawe takes no cut.</p>
          </div>

          <h2 className="tpl-h">Details</h2>
          <Facts rows={rows} />
          {l.tags?.length ? <Chips items={l.tags} /> : null}

          <h2 className="tpl-h">Made by</h2>
          <Link className="mk-maker panel" href={`/creators/${c.handle}`}>
            <Avatar name={c.name} src={c.avatar} size={48} />
            <span>
              <strong>{c.name}</strong>
              <span className="meta">@{c.handle}</span>
            </span>
          </Link>

          <Next
            title={more.length ? `More from ${c.name}.` : "Find the next one."}
            primary={{ href: `/creators/${c.handle}`, label: `See ${c.name}’s page` }}
            secondary={{ href: "/marketplace", label: "All templates" }}
            related={[
              ...more.slice(0, 3).map((x) => ({ href: `/marketplace/${x.id}`, label: x.title })),
              { href: "/marketplace/submit", label: "List your own template" },
            ]}
          />
        </article>
      </main>
      <Footer />
    </div>
  );
}
