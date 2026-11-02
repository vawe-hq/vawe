import { notFound } from "next/navigation";
import { Header, VaweMark } from "../../components/Header";
import { Icon } from "../../components/Icon";
import { PageTop, Sources, Toc } from "../../components/Xp";
import { NextView } from "../../components/RichText";
import { Footer } from "../../components/Footer";
import { pageMetadata } from "../../components/seo";
import { jsonLdScript, breadcrumbSchema } from "../../../lib/schema";
import { MARK_LABEL } from "../../../lib/content/vs";
import { COMPARE_REMOTION_HYPERFRAMES as C, type Cell } from "../../../lib/content/compare";
import "../../components/intent.css";
import "../../components/study.css";

export const metadata = pageMetadata({ title: C.metaTitle, description: C.metaDescription, path: C.path });

function Td({ cell, vawe }: { cell: Cell; vawe?: boolean }) {
  return (
    <td className={vawe ? "is-vawe" : undefined}>
      {cell.mark && (
        <span className={`mk mk-${cell.mark}`}>
          <Icon name={cell.mark === "yes" ? "check" : cell.mark === "no" ? "x" : "minus"} size={14} label={MARK_LABEL[cell.mark]} />
        </span>
      )}
      {cell.text}
    </td>
  );
}

export const dynamicParams = false;

export function generateStaticParams() {
  return [{ slug: C.slug }];
}

export default async function RemotionVsHyperframes({ params }: { params: Promise<{ slug: string }> }) {
  if ((await params).slug !== C.slug) notFound();
  return (
    <div className="shell">
      <Header />
      <div className="wrap">
        <main id="content" className="ipage xp" tabIndex={-1}>
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={jsonLdScript(
              breadcrumbSchema([
                { name: "vawe", url: "/" },
                { name: "Compare", url: "/remotion-alternatives" },
                { name: "Remotion vs HyperFrames vs vawe", url: C.path },
              ]),
            )}
          />
          <section className="phead">
            <PageTop parent={{ href: "/remotion-alternatives", label: "Compare" }} current="Remotion vs HyperFrames vs vawe" />
            <h1>{C.h1}</h1>
            <p>{C.intro}</p>
            <p className="bnote">{C.note}</p>
            <Toc items={C.toc} />
          </section>

          <section className="tfacts" id="choose">
            <h2>Which one to choose.</h2>
            {C.choose.map((c) => (
              <div key={c.name}>
                <h3>Choose {c.name} when</h3>
                <ul className="tldr-list">
                  {c.items.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </div>
            ))}
          </section>

          <section className="iend" aria-labelledby="table">
            <h2 className="h2" id="table">Side by side.</h2>
            <div className="itable-wrap">
              <table className="itable">
                <thead>
                  <tr>
                    <th scope="col">feature</th>
                    <th scope="col">Remotion</th>
                    <th scope="col">HyperFrames</th>
                    <th scope="col" className="is-vawe">
                      <VaweMark className="glyph-sm" />
                      vawe
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {C.rows.map((row) => (
                    <tr key={row.feature}>
                      <td>{row.feature}</td>
                      <Td cell={row.remotion} />
                      <Td cell={row.hyperframes} />
                      <Td cell={row.vawe} vawe />
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="tfacts" id="time">
            <h2>How each one handles time.</h2>
            <p>Video from code comes down to one question: how does frame 400 know what to show? The three tools answer it differently.</p>
            {C.time.map((t) => (
              <p key={t.name}>
                <strong>{t.name}.</strong> {t.text}
              </p>
            ))}
          </section>

          <section className="tfacts" id="stronger">
            <h2>Where each one is stronger.</h2>
            {C.stronger.map((s) => (
              <div key={s.name}>
                <h3>{s.name}</h3>
                <ul className="tldr-list">
                  {s.items.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </div>
            ))}
          </section>

          <section className="faq" aria-labelledby="faq">
            <h2 id="faq">Questions.</h2>
            <dl>
              {C.faq.map((f) => (
                <div key={f.q}>
                  <dt>{f.q}</dt>
                  <dd>{f.a}</dd>
                </div>
              ))}
            </dl>
          </section>

          <NextView n={C.next} />
          <Sources count={C.sources.length}>
            {C.sources.map((s) => (
              <a key={s.url} href={s.url} rel="noopener">{s.label}</a>
            ))}
          </Sources>
          <p className="bnote">Read on {C.read}. Facts can change; each link above is the page they came from.</p>
        </main>
      </div>
      <Footer active={C.path} />
    </div>
  );
}
