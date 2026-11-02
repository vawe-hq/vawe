import { Header } from "../components/Header";
import { jsonLdScript, breadcrumbSchema } from "../../lib/schema";
import { Footer } from "../components/Footer";
import { pageMetadata } from "../components/seo";
import { PageTop, Toc } from "../components/Xp";
import { NextView, SectionView, TableView } from "../components/RichText";
import { AltEvidence } from "../components/AltEvidence";
import { REMOTION_ALTERNATIVES as C } from "../../lib/content/remotion-alternatives";
import "../components/intent.css";

export const metadata = pageMetadata({ ...C.meta, path: C.path });

/* /remotion-alternatives · a fourth intent page, added after the three from site/AGENTS.md's
 * quiz brief. "Remotion alternative" and "JSON to video API" both carry real, ranking demand
 * (confirmed by search 2026-09-19: Shotstack, JSON2Video, Wireflow, Pexo, Product Hunt and
 * AlternativeTo all rank a "Remotion alternatives" page). This is the one comparison page the
 * research earned: every claim about another project below is read off that project's own
 * license, docs or pricing page, cited with the URL and the date read. No claim characterizes a
 * competitor's code quality, output quality or reliability, because none of that was verified.
 */

export default function RemotionAlternatives() {
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
            <p className="lead">{C.table.lead}</p>
            <TableView t={C.table.data} />
          </section>

          <SectionView s={C.shapes} />
          <SectionView s={C.license} />
          <SectionView s={C.selfHosted} />
          <SectionView s={C.revideo} />
          <SectionView s={C.json2video} />
          <SectionView s={C.creatomate} />

          <AltEvidence faq={C.faq} />

          <SectionView s={C.notCompared} />

          <NextView n={C.next} />
        </main>
      </div>
      <Footer active={C.path} />
    </div>
  );
}
