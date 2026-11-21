"use client";

import Link from "next/link";
import { FacetBar, applyFacets, useFacets, type Facet } from "../marketplace/Facets";

export type DesignerCard = { handle: string; name: string; avatar?: string; location?: string; availability: string; availabilityText: string; rate: string; software: string[]; softwareText: string[]; reel: string };

const has = (d: DesignerCard, key: string, id: string) => (key === "availability" ? d.availability === id : d.software.includes(id));

const initials = (name: string) => name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();

export function HireBoard({ designers, facets }: { designers: DesignerCard[]; facets: Facet[] }) {
  const { values, pick } = useFacets(facets);
  const shown = applyFacets(designers, values, has);
  return (
    <>
      <FacetBar facets={facets} items={designers} values={values} pick={pick} has={has} shown={shown.length} noun={["designer", "designers"]} />
      <ul className="mk-people">
        {shown.map((d) => (
          <li key={d.handle} className="mk-person panel">
            <div className="mk-person-top">
              {d.avatar ? (
                <img className="mk-avatar" src={d.avatar} alt="" width={48} height={48} loading="lazy" decoding="async" referrerPolicy="no-referrer" />
              ) : (
                <span className="mk-avatar mk-avatar-text" style={{ width: 48, height: 48 }} aria-hidden="true">{initials(d.name)}</span>
              )}
              <div>
                <h3 className="mk-row-h">
                  <Link href={`/creators/${d.handle}`} prefetch={false}>{d.name}</Link>
                </h3>
                {d.location ? <p className="meta">{d.location}</p> : null}
              </div>
            </div>
            <p className="mk-person-av" data-av={d.availability}>{d.availabilityText}</p>
            {d.rate ? <p className="meta">{d.rate}</p> : null}
            <p className="mk-person-sw">{d.softwareText.join(", ")}</p>
            <a className="mk-person-reel" href={d.reel} rel="noopener">Watch the reel</a>
          </li>
        ))}
      </ul>
    </>
  );
}
