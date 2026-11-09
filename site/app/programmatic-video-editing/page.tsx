import { Header } from "../components/Header";
import { jsonLdScript, breadcrumbSchema } from "../../lib/schema";
import { Footer } from "../components/Footer";
import { pageMetadata } from "../components/seo";
import { PageTop, Toc } from "../components/Xp";
import { NextView, SectionView, TableView } from "../components/RichText";
import { PROGRAMMATIC_EDITING as C } from "../../lib/content/programmatic-editing";
import "../components/intent.css";

export const metadata = pageMetadata({ ...C.meta, path: C.path });

export default function ProgrammaticVideoEditing() {
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
            <Toc items={C.toc} />
          </section>

          <section className="iend" id="table">
            <h2 className="h2">{C.table.title}</h2>
            <p className="lead">{C.table.lead}</p>
            <TableView t={C.table.data} />
          </section>

          <SectionView s={C.tools} />
          <SectionView s={C.agent} />
          <SectionView s={C.pick} />
          <SectionView s={C.sources} />
          <SectionView s={C.more} />

          <NextView n={C.next} />
        </main>
      </div>
      <Footer active={C.path} />
    </div>
  );
}
