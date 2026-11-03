import { Header } from "./Header";
import { Footer } from "./Footer";
import { MoveClips } from "./MoveClips";
import { PageTop, Toc } from "./Xp";
import { NextView, RichText, SectionView } from "./RichText";
import { jsonLdScript, breadcrumbSchema } from "../../lib/schema";
import { faqPageSchema } from "../../lib/schema-content";
import type { VideoTypePage as Page } from "../../lib/content/video-types";
import "./intent.css";

// The shared body of /product-showcase-video and /explainer-video: answer, what it contains, timing,
// examples, video components, the commands, the FAQ (with FAQPage JSON-LD).
export function VideoTypePage({ C }: { C: Page }) {
  return (
    <div className="shell">
      <Header />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(breadcrumbSchema([{ name: "vawe", url: "/" }, { name: C.crumb.current, url: C.path }]))} />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(faqPageSchema(C.faq))} />
      <div className="wrap">
        <main id="content" className="ipage xp" tabIndex={-1}>
          <section className="phead">
            <PageTop group={C.crumb.group} current={C.crumb.current} />
            <h1>{C.h1}</h1>
            <p>{C.lede}</p>
            <Toc items={C.toc} />
          </section>

          <SectionView s={C.contains} />
          <SectionView s={C.timing} />

          <section className="isec ifaq" id="examples">
            <div className="isec-text">
              <h2>{C.examples.title}</h2>
              <p>{C.examples.lead}</p>
              <ul className="ievidence">
                {C.examples.items.map((e) => (
                  <li key={e.href}>
                    <a href={e.href} rel="noopener">{e.title}</a> by {e.by}
                  </li>
                ))}
              </ul>
              <p><a href={C.examples.all.href}>{C.examples.all.label}</a></p>
            </div>
          </section>

          <section className="ifilms" id="moves">
            <h2>{C.moves.title}</h2>
            <p>{C.moves.lead}</p>
            <MoveClips names={C.moves.clips} />
          </section>

          <SectionView s={C.make} />

          <section className="isec ifaq" id="faq">
            <div className="isec-text">
              <h2>Questions.</h2>
              {C.faq.map((item) => (
                <div key={item.q}>
                  <h3>{item.q}</h3>
                  <p><RichText p={item.a} /></p>
                </div>
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
