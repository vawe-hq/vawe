"use client";

import Link from "next/link";
import { FacetBar, applyFacets, useFacets, type Facet } from "../marketplace/Facets";

export type JobRow = { id: string; title: string; company: string; place: string; type: string; pay: string; posted: string; workplace: string; employment: string[]; software: string[] };

const has = (j: JobRow, key: string, id: string) => (key === "workplace" ? j.workplace === id : key === "employment" ? j.employment.includes(id) : j.software.includes(id));

export function JobsBoard({ jobs, facets }: { jobs: JobRow[]; facets: Facet[] }) {
  const { values, pick } = useFacets(facets);
  const shown = applyFacets(jobs, values, has);
  return (
    <>
      <FacetBar facets={facets} items={jobs} values={values} pick={pick} has={has} shown={shown.length} noun={["job", "jobs"]} />
      <ul className="mk-rows">
        {shown.map((j) => (
          <li key={j.id} className="mk-row panel">
            <h3 className="mk-row-h">
              <Link href={`/jobs/${j.id}`} prefetch={false}>{j.title}</Link>
            </h3>
            <p className="mk-row-co">{j.company}</p>
            <p className="meta mk-row-meta">
              <span>{j.place}</span>
              <span>{j.type}</span>
              {j.pay ? <span>{j.pay}</span> : null}
              <span>Posted {j.posted}</span>
            </p>
          </li>
        ))}
      </ul>
    </>
  );
}
