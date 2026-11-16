import { PromptCard } from "../components/PromptCard";
import { PAGE_PROMPTS } from "../../lib/prompts";
import { Header } from "../components/Header";
import { jsonLdScript, breadcrumbSchema } from "../../lib/schema";
import { Footer } from "../components/Footer";
import { pageMetadata } from "../components/seo";
import { PageTop, Toc } from "../components/Xp";
import { NextView, SectionView } from "../components/RichText";
import { STUDIO as C } from "../../lib/content/studio";
import "../components/intent.css";

export const metadata = pageMetadata({ ...C.meta, path: C.path });

export default function Studio() {
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

          <PromptCard prompt={PAGE_PROMPTS[C.path]} />

          <SectionView s={C.open} />
          <SectionView s={C.panels} />
          <SectionView s={C.patch} />
          <SectionView s={C.limits} />
          <SectionView s={C.more} />

          <NextView n={C.next} />
        </main>
      </div>
      <Footer active={C.path} />
    </div>
  );
}
