import { Header } from "../components/Header";
import { jsonLdScript, breadcrumbSchema } from "../../lib/schema";
import { Footer } from "../components/Footer";
import { pageMetadata } from "../components/seo";
import { PageTop, Toc } from "../components/Xp";
import { NextView, SectionView } from "../components/RichText";
import { EDIT_WITH_CLAUDE_CODE as C } from "../../lib/content/agentic-editing";
import "../components/intent.css";

export const metadata = pageMetadata({ ...C.meta, path: C.path });

export default function EditVideoWithClaudeCode() {
  return (
    <div className="shell">
      <Header />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(breadcrumbSchema([{ name: "vawe", url: "/" }, { name: "Agentic video editing", url: "/agentic-video-editing" }, { name: C.crumb.current, url: C.path }]))} />
      <div className="wrap">
        <main id="content" className="ipage xp" tabIndex={-1}>
          <section className="phead">
            <PageTop group={C.crumb.group} current={C.crumb.current} />
            <h1>{C.h1}</h1>
            <p>{C.lede}</p>
            <Toc items={C.toc} />
          </section>

          <SectionView s={C.setup} />
          <SectionView s={C.ask} />
          <SectionView s={C.steps} />
          <SectionView s={C.questions} />
          <SectionView s={C.gotchas} />
          <SectionView s={C.more} />

          <NextView n={C.next} />
        </main>
      </div>
      <Footer active={C.path} />
    </div>
  );
}
