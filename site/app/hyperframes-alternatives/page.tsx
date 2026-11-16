import { Header } from "../components/Header";
import { jsonLdScript, breadcrumbSchema } from "../../lib/schema";
import { Footer } from "../components/Footer";
import { pageMetadata } from "../components/seo";
import { PageTop, Toc } from "../components/Xp";
import { NextView, TableView } from "../components/RichText";
import { AltEvidence } from "../components/AltEvidence";
import { HeadToHead } from "../components/HeadToHead";
import { headToHead } from "../../lib/content/vs";
import "../components/study.css";
import { HYPERFRAMES_ALTERNATIVES as C } from "../../lib/content/hyperframes-alternatives";
import "../components/intent.css";

export const metadata = pageMetadata({ ...C.meta, path: C.path });

/* /hyperframes-alternatives keeps its URL (it ranks) and its angle: a short list of what to look at
 * instead of HyperFrames, vawe included. The per-tool facts, tables and sources live on /vs/<name>
 * (lib/content/vs.ts), so none of that text is repeated here. The HyperFrames facts below were read
 * 2026-10-03 from github.com/heygen-com/hyperframes and hyperframes.heygen.com/introduction. */

export default function HyperframesAlternatives() {
  return (
    <div className="shell">
      <Header />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(breadcrumbSchema([{ name: "vawe", url: "/" }, { name: C.crumb.current, url: C.path }]))} />
      <div className="wrap">
        <main id="content" className="ipage xp" tabIndex={-1}>
          <section className="phead">
            <PageTop group={C.crumb.group} current={C.crumb.current} />
            <h1>{C.h1}</h1>
            <p>{C.lede}</p>
            <p className="bnote">{C.note}</p>
            <Toc items={C.toc} />
          </section>

          <section className="iend" id="table">
            <h2 className="h2">{C.table.title}</h2>
            <TableView t={C.table.data} scope />
          </section>

          <ul className="xp-alts" id="alternatives">
            {C.alternatives.map((a) => (
              <li className="xp-alt" key={a.name}>
                <h2>{a.name}</h2>
                <p>{a.body}</p>
                <a href={a.href}>{a.cta} <span className="arw" aria-hidden="true">→</span></a>
              </li>
            ))}
          </ul>

          <AltEvidence faq={C.faq} />

          <HeadToHead r={headToHead("hyperframes")} />
          <HeadToHead r={headToHead("motion-canvas")} />

          <section className="tfacts" id="stay">
            <h2>{C.stay.title}</h2>
            <p>{C.stay.body}</p>
            <div className="srcs">
              {C.stay.sources.map((s) => (
                <a key={s.href} href={s.href} rel="noopener">{s.label}</a>
              ))}
            </div>
          </section>

          <NextView n={C.next} />
        </main>
      </div>
      <Footer active={C.path} />
    </div>
  );
}
