import { Header } from "../components/Header";
import { jsonLdScript, breadcrumbSchema } from "../../lib/schema";
import { Footer } from "../components/Footer";
import { pageMetadata } from "../components/seo";
import { PageTop, Toc } from "../components/Xp";
import { NextView, SectionView, TableView } from "../components/RichText";
import { AltEvidence } from "../components/AltEvidence";
import { CREATOMATE_ALTERNATIVES as C } from "../../lib/content/creatomate-alternatives";
import "../components/intent.css";

export const metadata = pageMetadata({ ...C.meta, path: C.path });

export default function CreatomateAlternatives() {
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
          <SectionView s={C.shotstack} />
          <SectionView s={C.json2video} />
          <SectionView s={C.engines} />
          <SectionView s={C.stay} />

          <AltEvidence faq={C.faq} />

          <SectionView s={C.notCompared} />

          <NextView n={C.next} />
        </main>
      </div>
      <Footer active={C.path} />
    </div>
  );
}
