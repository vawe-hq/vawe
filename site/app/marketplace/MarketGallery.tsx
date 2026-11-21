"use client";

import Link from "next/link";
import { useState } from "react";
import type { MarketItem } from "../../lib/marketplace";
import { FacetBar, applyFacets, useFacets, type Facet } from "./Facets";

const has = (item: MarketItem, key: string, id: string) =>
  key === "price" ? (id === "free") === item.free : String(item[key as keyof MarketItem]) === id;

function Card({ item, first, softwareLabel }: { item: MarketItem; first: boolean; softwareLabel: string }) {
  const [live, setLive] = useState(false);
  const on = () => setLive(true);
  const off = () => setLive(false);
  return (
    <li className="mv-card panel" onMouseEnter={on} onMouseLeave={off} onFocus={on} onBlur={off}>
      <div className="mv-media">
        <img src={item.poster} alt={`${item.title}: a frame from the preview`} width={640} height={360} loading={first ? "eager" : "lazy"} decoding="async" />
        {live ? <video src={item.preview} muted loop playsInline autoPlay aria-hidden="true" onPlaying={(e) => e.currentTarget.setAttribute("data-on", "")} /> : null}
        {item.badge ? <span className="mv-chip mv-chip-num tpl-tier" data-tier={item.badge === "vawe Pro" ? "pro" : "free"}>{item.badge}</span> : null}
        <span className="mv-chip mv-chip-dur">{item.price}</span>
        <p className="mv-use">{item.summary}</p>
      </div>
      <div className="mv-cap mk-cap">
        <h3 className="mv-title">
          <Link href={item.href} prefetch={false}>{item.title}</Link>
        </h3>
        <p className="meta mk-by">{softwareLabel} · {item.by}</p>
        <p className="mv-use-touch">{item.summary}</p>
      </div>
    </li>
  );
}

export function MarketGallery({ items, facets, labels }: { items: MarketItem[]; facets: Facet[]; labels: Record<string, string> }) {
  const { values, pick } = useFacets(facets);
  const shown = applyFacets(items, values, has);
  return (
    <>
      <FacetBar facets={facets} items={items} values={values} pick={pick} has={has} shown={shown.length} noun={["template", "templates"]} />
      <ul className="mv-grid tpl-grid">
        {shown.map((item, i) => (
          <Card key={item.key} item={item} first={i < 3} softwareLabel={labels[item.software] ?? item.software} />
        ))}
      </ul>
    </>
  );
}
