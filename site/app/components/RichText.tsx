import { Fragment } from "react";
import type { NextBlock, Para, Section, Table } from "../../lib/content/types";
import { Next } from "./Xp";

export function RichText({ p }: { p: Para }) {
  return (
    <>
      {p.map((s, i) => {
        if (typeof s === "string") return <Fragment key={i}>{s}</Fragment>;
        if ("text" in s) return <a key={i} href={s.href}>{s.text}</a>;
        if ("code" in s) return <code key={i}>{s.code}</code>;
        return <strong key={i}>{s.strong}</strong>;
      })}
    </>
  );
}

export function SectionView({ s }: { s: Section }) {
  return (
    <section className={s.columns ? "isec isec-cols" : "isec"} id={s.id}>
      <div className="isec-text">
        <h2>{s.title}</h2>
        {s.blocks.map((b, i) =>
          "p" in b ? (
            <p key={i}><RichText p={b.p} /></p>
          ) : (
            <ol className="xp-list" key={i}>
              {b.ol.map((item, j) => (
                <li key={j}><span><RichText p={item} /></span></li>
              ))}
            </ol>
          ),
        )}
        {s.cite ? <span className="cite">{s.cite}</span> : null}
      </div>
      {s.code ? (
        <div className="isec-art">
          <div className="codeblock">
            <div className="lbl">{s.code.label}</div>
            <pre className="code">{s.code.text}</pre>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export function TableView({ t, scope }: { t: Table; scope?: boolean }) {
  return (
    <div className="itable-wrap">
      <table className="itable">
        <thead>
          <tr>
            {t.head.map((h) => (
              <th key={h} scope={scope ? "col" : undefined}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {t.rows.map((r, i) => (
            <tr key={i} className={r.vawe ? "is-vawe" : undefined}>
              {r.cells.map((c, j) => (
                <td key={j}><RichText p={c} /></td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function NextView({ n }: { n: NextBlock }) {
  return <Next title={n.title} lead={n.lead ? <RichText p={n.lead} /> : undefined} primary={n.primary} secondary={n.secondary} related={n.related} />;
}
