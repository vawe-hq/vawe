"use client";

import { useEffect, useState } from "react";

export type Option = { id: string; label: string };
export type Facet = { key: string; label: string; options: Option[] };
export type Values = Record<string, string>;

const readValues = (facets: Facet[]): Values => {
  const q = new URLSearchParams(window.location.search);
  return Object.fromEntries(facets.map((f) => [f.key, f.options.some((o) => o.id === q.get(f.key)) ? (q.get(f.key) as string) : ""]));
};

function writeValues(values: Values) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(values)) if (v) q.set(k, v);
  const s = q.toString();
  window.history.replaceState(null, "", s ? `?${s}` : window.location.pathname);
}

// The filters live in the query string, so a filtered view is a link a person can share.
export function useFacets(facets: Facet[]) {
  const [values, setValues] = useState<Values>({});
  useEffect(() => setValues(readValues(facets)), []);
  const pick = (key: string, id: string) => {
    const next = { ...values, [key]: id };
    setValues(next);
    writeValues(next);
  };
  return { values, pick };
}

export function applyFacets<T>(items: T[], values: Values, has: (item: T, key: string, id: string) => boolean, skip?: string) {
  return items.filter((item) => Object.entries(values).every(([k, v]) => !v || k === skip || has(item, k, v)));
}

export function FacetBar<T>({ facets, items, values, pick, has, shown, noun }: {
  facets: Facet[];
  items: T[];
  values: Values;
  pick: (key: string, id: string) => void;
  has: (item: T, key: string, id: string) => boolean;
  shown: number;
  noun: [string, string];
}) {
  return (
    <div className="mk-facets">
      {facets.map((f) => {
        const pool = applyFacets(items, values, has, f.key);
        const used = f.options.filter((o) => pool.some((i) => has(i, f.key, o.id)) || values[f.key] === o.id);
        if (!used.length) return null;
        return (
          <div className="mk-facet" key={f.key} role="group" aria-label={`Filter by ${f.label.toLowerCase()}`}>
            <span className="meta mk-facet-h">{f.label}</span>
            <div className="mv-jump tpl-chips mk-chips">
              <button type="button" aria-pressed={!values[f.key]} onClick={() => pick(f.key, "")}>
                All<span className="mv-n">{pool.length}</span>
              </button>
              {used.map((o) => (
                <button key={o.id} type="button" aria-pressed={values[f.key] === o.id} onClick={() => pick(f.key, values[f.key] === o.id ? "" : o.id)}>
                  {o.label}
                  <span className="mv-n">{pool.filter((i) => has(i, f.key, o.id)).length}</span>
                </button>
              ))}
            </div>
          </div>
        );
      })}
      <p className="meta mk-count" role="status">
        {shown} {shown === 1 ? noun[0] : noun[1]}
      </p>
    </div>
  );
}
